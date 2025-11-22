import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import { toast } from '../../store/toasts'

const apiBase =
  (import.meta.env.VITE_API_BASE_URL ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '') : '') || ''

type WordItem = { word: string; level?: string; reason?: string }
type TargetOccurrence = {
  word: string
  paragraphIndex: number
  charStart: number
  charEnd: number
}
type StoryData = { paragraphs: string[]; targetOccurrences?: TargetOccurrence[] }

const WORD_PATTERN = /^[A-Za-z][A-Za-z\s-]*$/i
const MAX_WORDS = 10

function sanitizeWord(word: string) {
  return word.trim().replace(/\s+/g, ' ')
}

function normalizeList(list: string[]) {
  const seen = new Set<string>()
  const normalized: string[] = []
  list.forEach((raw) => {
    const cleaned = sanitizeWord(raw)
    if (!cleaned) return
    const key = cleaned.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    normalized.push(cleaned)
  })
  return normalized.slice(0, MAX_WORDS)
}

function listsEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const sortedA = [...a].map((w) => w.toLowerCase()).sort()
  const sortedB = [...b].map((w) => w.toLowerCase()).sort()
  return sortedA.every((w, idx) => w === sortedB[idx])
}

function paragraphHighlights(paragraph: string, paragraphIndex: number, occs?: TargetOccurrence[]) {
  if (!occs?.length) return paragraph
  const matches = occs
    .filter((occ) => occ.paragraphIndex === paragraphIndex)
    .sort((a, b) => a.charStart - b.charStart)
  if (!matches.length) return paragraph

  const nodes: ReactNode[] = []
  let cursor = 0
  matches.forEach((occ, idx) => {
    const start = Math.max(0, occ.charStart)
    const end = Math.min(paragraph.length, occ.charEnd)
    if (start > cursor) nodes.push(<span key={`text-${paragraphIndex}-${idx}`}>{paragraph.slice(cursor, start)}</span>)
    if (end > start) {
      nodes.push(
        <span key={`highlight-${paragraphIndex}-${idx}`} className="font-semibold text-indigo-700">
          {paragraph.slice(start, end)}
        </span>
      )
    }
    cursor = Math.max(cursor, end)
  })
  if (cursor < paragraph.length) nodes.push(<span key={`tail-${paragraphIndex}`}>{paragraph.slice(cursor)}</span>)
  return nodes
}

function buildWordCounts(story?: StoryData | null) {
  const counts: Record<string, number> = {}
  story?.targetOccurrences?.forEach((occ) => {
    const key = occ.word
    counts[key] = (counts[key] || 0) + 1
  })
  return counts
}

// Fallback-aware helpers
function paragraphHighlightsSafe(paragraph: string, paragraphIndex: number, occs?: TargetOccurrence[], targets?: string[]) {
  if (occs?.length) {
    const matches = occs
      .filter((occ) => occ.paragraphIndex === paragraphIndex && typeof occ.charStart === 'number' && typeof occ.charEnd === 'number')
      .sort((a, b) => (a.charStart || 0) - (b.charStart || 0))
    if (matches.length) {
      const nodes: ReactNode[] = []
      let cursor = 0
      matches.forEach((occ, idx) => {
        const start = Math.max(0, occ.charStart || 0)
        const end = Math.min(paragraph.length, occ.charEnd || paragraph.length)
        if (start > cursor) nodes.push(<span key={`text-${paragraphIndex}-${idx}`}>{paragraph.slice(cursor, start)}</span>)
        if (end > start) {
          nodes.push(
            <span key={`highlight-${paragraphIndex}-${idx}`} className="font-semibold text-indigo-700">
              {paragraph.slice(start, end)}
            </span>
          )
        }
        cursor = Math.max(cursor, end)
      })
      if (cursor < paragraph.length) nodes.push(<span key={`tail-${paragraphIndex}`}>{paragraph.slice(cursor)}</span>)
      return nodes
    }
  }

  if (targets?.length) {
    const regex = new RegExp(`\\b(${targets.map((w) => w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`, 'gi')
    const nodes: ReactNode[] = []
    let cursor = 0
    let m: RegExpExecArray | null
    let idx = 0
    while ((m = regex.exec(paragraph)) !== null) {
      const start = m.index
      const end = m.index + m[0].length
      if (start > cursor) nodes.push(<span key={`text-${paragraphIndex}-fb-${idx}`}>{paragraph.slice(cursor, start)}</span>)
      nodes.push(
        <span key={`highlight-${paragraphIndex}-fb-${idx}`} className="font-semibold text-indigo-700">
          {paragraph.slice(start, end)}
        </span>
      )
      cursor = end
      idx += 1
    }
    if (cursor < paragraph.length) nodes.push(<span key={`tail-fb-${paragraphIndex}`}>{paragraph.slice(cursor)}</span>)
    if (nodes.length) return nodes
  }

  return paragraph
}

function buildWordCountsSafe(story: StoryData | null | undefined, targets: string[]) {
  if (story?.targetOccurrences?.length) return buildWordCounts(story)
  const counts: Record<string, number> = {}
  if (story?.paragraphs?.length && targets.length) {
    const regexes = targets.map((t) => new RegExp(`\\b${t.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi'))
    story.paragraphs.forEach((p) => {
      regexes.forEach((re, idx) => {
        const matches = p.match(re)
        if (matches?.length) {
          const word = targets[idx]
          counts[word] = (counts[word] || 0) + matches.length
        }
      })
    })
  }
  return counts
}

export type StoryManagerProps = {
  experimentId: string
  compact?: boolean
  onDone?: () => void
  showBackLink?: boolean
}

function toAudioUrl(url?: string | null) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${apiBase}${url}`
}

export function StoryManager({ experimentId, compact = false, onDone, showBackLink = true }: StoryManagerProps) {
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState('')
  const [suggestions1, setSuggestions1] = useState<WordItem[]>([])
  const [selected1, setSelected1] = useState<string[]>([])
  const [savedWords1, setSavedWords1] = useState<string[]>([])
  const [loading1, setLoading1] = useState(false)
  const [story1, setStory1] = useState<StoryData | null>(null)
  const [genStatus1, setGenStatus1] = useState<'idle' | 'generating' | 'success' | 'error'>('idle')
  const [ttsStatus1, setTtsStatus1] = useState<'idle' | 'generating' | 'success' | 'error'>('idle')
  const [ttsUrl1, setTtsUrl1] = useState<string | null>(null)

  const [suggestions2, setSuggestions2] = useState<WordItem[]>([])
  const [selected2, setSelected2] = useState<string[]>([])
  const [savedWords2, setSavedWords2] = useState<string[]>([])
  const [loading2, setLoading2] = useState(false)
  const [story2, setStory2] = useState<StoryData | null>(null)
  const [genStatus2, setGenStatus2] = useState<'idle' | 'generating' | 'success' | 'error'>('idle')
  const [ttsStatus2, setTtsStatus2] = useState<'idle' | 'generating' | 'success' | 'error'>('idle')
  const [ttsUrl2, setTtsUrl2] = useState<string | null>(null)

  const [jobIds, setJobIds] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [jobStartTimes, setJobStartTimes] = useState<Record<string, number>>({})
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [, forceTick] = useState(0)
  const wordsDirty1 = useMemo(() => !listsEqual(selected1, savedWords1), [selected1, savedWords1])
  const wordsDirty2 = useMemo(() => !listsEqual(selected2, savedWords2), [selected2, savedWords2])
  const story1Counts = useMemo(() => buildWordCountsSafe(story1, selected1), [story1, selected1])
  const story2Counts = useMemo(() => buildWordCountsSafe(story2, selected2), [story2, selected2])

  const formatWordIssues = (issues?: any) => {
    if (!issues) return ''
    const parts: string[] = []
    if (issues.invalidFormat?.length) parts.push(`Invalid: ${issues.invalidFormat.join(', ')}`)
    if (issues.duplicates?.length) parts.push(`Duplicates removed: ${issues.duplicates.join(', ')}`)
    if (issues.overlaps?.length) parts.push(`Overlap: ${issues.overlaps.join(', ')}`)
    if (issues.tooMany) parts.push('Maximum 10 words allowed')
    if (issues.tooFew) parts.push('At least 1 word required')
    return parts.join(' | ')
  }

  useEffect(() => {
    if (!experimentId) return
    api
      .get(`/api/experiments/${experimentId}`)
      .then(({ data }) => {
        setTitle(data?.title || '')
        setLevel(data?.level || data?.cefr || '')
        const s1 = data?.stories?.story1?.targetWords || []
        const s2 = data?.stories?.story2?.targetWords || []
        const normalized1 = normalizeList(s1)
        const normalized2 = normalizeList(s2)
        setSelected1(normalized1)
        setSelected2(normalized2)
        setSavedWords1(normalized1)
        setSavedWords2(normalized2)
      })
      .catch(() => {})
    loadStories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experimentId])

  async function loadStories() {
    if (!experimentId) return
    const versioned = (url?: string | null) => {
      const parsed = toAudioUrl(url)
      if (!parsed) return null
      const sep = parsed.includes('?') ? '&' : '?'
      return `${parsed}${sep}v=${Date.now()}`
    }
    try {
      const [r1, r2] = await Promise.all([
        api.get(`/api/experiments/${experimentId}/story/H`).catch(() => null),
        api.get(`/api/experiments/${experimentId}/story/N`).catch(() => null),
      ])
      if (r1?.data?.paragraphs) {
        setStory1(r1.data)
        setTtsUrl1(versioned(r1.data.ttsAudioUrl))
      } else {
        setStory1(null)
        setTtsUrl1(null)
      }
      if (r2?.data?.paragraphs) {
        setStory2(r2.data)
        setTtsUrl2(versioned(r2.data.ttsAudioUrl))
      } else {
        setStory2(null)
        setTtsUrl2(null)
      }
    } catch {}
  }

  async function fetchSuggestions1() {
    if (!experimentId) return
    setLoading1(true)
    try {
      const { data } = await api.post(`/api/experiments/${experimentId}/word-suggestions`, { story: 'story1' })
      setSuggestions1(data?.items || [])
      toast.success('Story 1 suggestions loaded')
    } catch {
      toast.error('Failed to fetch suggestions')
    } finally {
      setLoading1(false)
    }
  }

  async function fetchSuggestions2() {
    if (!experimentId) return
    setLoading2(true)
    try {
      const { data } = await api.post(`/api/experiments/${experimentId}/word-suggestions`, { story: 'story2' })
      setSuggestions2(data?.items || [])
      toast.success('Story 2 suggestions loaded')
    } catch {
      toast.error('Failed to fetch suggestions')
    } finally {
      setLoading2(false)
    }
  }

  function toggleWord1(wordRaw: string) {
    const word = sanitizeWord(wordRaw)
    if (!word) return
    const existsHere = selected1.some((w) => w.toLowerCase() === word.toLowerCase())
    if (existsHere) {
      setSelected1(selected1.filter((w) => w.toLowerCase() !== word.toLowerCase()))
      return
    }
    if (!WORD_PATTERN.test(word)) {
      toast.error('Words must use only letters, spaces, or hyphens')
      return
    }
    if (selected2.some((w) => w.toLowerCase() === word.toLowerCase())) {
      toast.error('Word already exists in Story 2')
      return
    }
    if (selected1.length >= MAX_WORDS) return toast.error('Maximum 10 words per story')
    setSelected1([...selected1, word])
  }

  function toggleWord2(wordRaw: string) {
    const word = sanitizeWord(wordRaw)
    if (!word) return
    const existsHere = selected2.some((w) => w.toLowerCase() === word.toLowerCase())
    if (existsHere) {
      setSelected2(selected2.filter((w) => w.toLowerCase() !== word.toLowerCase()))
      return
    }
    if (!WORD_PATTERN.test(word)) {
      toast.error('Words must use only letters, spaces, or hyphens')
      return
    }
    if (selected1.some((w) => w.toLowerCase() === word.toLowerCase())) {
      toast.error('Word already exists in Story 1')
      return
    }
    if (selected2.length >= MAX_WORDS) return toast.error('Maximum 10 words per story')
    setSelected2([...selected2, word])
  }

  async function saveWords1() {
    if (!experimentId) return
    if (!selected1.length) return toast.error('Select at least 1 word')
    try {
      await api.post(`/api/experiments/${experimentId}/story-words`, { story: 'story1', targetWords: selected1 })
      setSavedWords1([...selected1])
      toast.success('Story 1 words saved. Regeneration job queued automatically.')
    } catch (e: any) {
      const apiError = e?.response?.data?.error || 'Save failed'
      const detail = formatWordIssues(e?.response?.data?.issues)
      toast.error(detail ? `${apiError}: ${detail}` : apiError)
    }
  }

  async function saveWords2() {
    if (!experimentId) return
    if (!selected2.length) return toast.error('Select at least 1 word')
    try {
      await api.post(`/api/experiments/${experimentId}/story-words`, { story: 'story2', targetWords: selected2 })
      setSavedWords2([...selected2])
      toast.success('Story 2 words saved. Regeneration job queued automatically.')
    } catch (e: any) {
      const apiError = e?.response?.data?.error || 'Save failed'
      const detail = formatWordIssues(e?.response?.data?.issues)
      toast.error(detail ? `${apiError}: ${detail}` : apiError)
    }
  }

  function resetError(key: string) {
    setErrors((err) => {
      const next = { ...err }
      delete next[key]
      return next
    })
  }

  async function generateStory1() {
    if (!experimentId) return
    if (!selected1.length) return toast.error('Save words first')
    setGenStatus1('generating')
    setJobStartTimes((prev) => ({ ...prev, s1: Date.now() }))
    try {
      const { data } = await api.post('/api/jobs', {
        type: 'generate_story',
        experimentId,
        storyLabel: 'story1',
        targetWords: selected1,
      })
      setJobIds((prev) => ({ ...prev, s1: data.id }))
    } catch {
      setGenStatus1('error')
      toast.error('Failed to start generation')
    }
  }

  async function generateStory2() {
    if (!experimentId) return
    if (!selected2.length) return toast.error('Save words first')
    setGenStatus2('generating')
    setJobStartTimes((prev) => ({ ...prev, s2: Date.now() }))
    try {
      const { data } = await api.post('/api/jobs', {
        type: 'generate_story',
        experimentId,
        storyLabel: 'story2',
        targetWords: selected2,
      })
      setJobIds((prev) => ({ ...prev, s2: data.id }))
    } catch {
      setGenStatus2('error')
      toast.error('Failed to start generation')
    }
  }

  async function regenerateStory1() {
    if (!experimentId || !selected1.length) return
    const confirm = window.confirm('This will replace the current Story 1. Continue?')
    if (!confirm) return

    setGenStatus1('generating')
    setJobStartTimes((prev) => ({ ...prev, s1: Date.now() }))

    try {
      const { data } = await api.post('/api/jobs', {
        type: 'generate_story',
        experimentId,
        storyLabel: 'story1',
        targetWords: selected1,
        regenerate: true,
      })
      setJobIds((prev) => ({ ...prev, s1: data.id }))
      toast.info('Regenerating Story 1...')
    } catch {
      setGenStatus1('error')
      toast.error('Failed to start regeneration')
    }
  }

  async function regenerateStory2() {
    if (!experimentId || !selected2.length) return
    const confirm = window.confirm('This will replace the current Story 2. Continue?')
    if (!confirm) return

    setGenStatus2('generating')
    setJobStartTimes((prev) => ({ ...prev, s2: Date.now() }))

    try {
      const { data } = await api.post('/api/jobs', {
        type: 'generate_story',
        experimentId,
        storyLabel: 'story2',
        targetWords: selected2,
        regenerate: true,
      })
      setJobIds((prev) => ({ ...prev, s2: data.id }))
      toast.info('Regenerating Story 2...')
    } catch {
      setGenStatus2('error')
      toast.error('Failed to start regeneration')
    }
  }

  async function generateTTS1() {
    if (!experimentId || !story1) return
    setTtsStatus1('generating')
    setJobStartTimes((prev) => ({ ...prev, tts1: Date.now() }))
    try {
      const { data } = await api.post('/api/jobs', {
        type: 'generate_tts',
        experimentId,
        storyLabel: 'story1',
      })
      setJobIds((prev) => ({ ...prev, tts1: data.id }))
    } catch {
      setTtsStatus1('error')
      toast.error('Failed to start TTS')
    }
  }

  async function generateTTS2() {
    if (!experimentId || !story2) return
    setTtsStatus2('generating')
    setJobStartTimes((prev) => ({ ...prev, tts2: Date.now() }))
    try {
      const { data } = await api.post('/api/jobs', {
        type: 'generate_tts',
        experimentId,
        storyLabel: 'story2',
      })
      setJobIds((prev) => ({ ...prev, tts2: data.id }))
    } catch {
      setTtsStatus2('error')
      toast.error('Failed to start TTS')
    }
  }

  function clearJobTracking(key: string) {
    setJobIds((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setJobStartTimes((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function retryStory1() {
    resetError('s1')
    setGenStatus1('idle')
    generateStory1()
  }

  function retryStory2() {
    resetError('s2')
    setGenStatus2('idle')
    generateStory2()
  }

  function retryTTS1() {
    resetError('tts1')
    setTtsStatus1('idle')
    generateTTS1()
  }

  function retryTTS2() {
    resetError('tts2')
    setTtsStatus2('idle')
    generateTTS2()
  }

  function elapsed(key: string) {
    const start = jobStartTimes[key]
    if (!start) return ''
    const sec = Math.floor((Date.now() - start) / 1000)
    return ` (${sec}s)`
  }

  useEffect(() => {
    if (!Object.keys(jobIds).length) return
    const interval = setInterval(async () => {
      for (const [key, jobId] of Object.entries(jobIds)) {
        try {
          const { data } = await api.get(`/api/jobs/${jobId}`)
          if (data.status === 'running') {
            const elapsed = Date.now() - (jobStartTimes[key] || Date.now())
            const estimate = key.includes('tts') ? 45000 : 30000
            const pct = Math.min(95, Math.floor((elapsed / estimate) * 100))
            setProgress((p) => ({ ...p, [key]: pct }))
          }
          if (data.status === 'success') {
            setProgress((p) => ({ ...p, [key]: 100 }))
            if (key === 's1') {
              setGenStatus1('success')
              await loadStories()
            } else if (key === 's2') {
              setGenStatus2('success')
              await loadStories()
            } else if (key === 'tts1') {
              setTtsStatus1('success')
              await loadStories()
            } else if (key === 'tts2') {
              setTtsStatus2('success')
              await loadStories()
            }
            clearJobTracking(key)
          } else if (data.status === 'error') {
            const errMsg = data.errorMessage || 'Generation failed'
            if (key === 's1') {
              setGenStatus1('error')
              setErrors((e) => ({ ...e, s1: errMsg }))
            }
            if (key === 's2') {
              setGenStatus2('error')
              setErrors((e) => ({ ...e, s2: errMsg }))
            }
            if (key === 'tts1') {
              setTtsStatus1('error')
              setErrors((e) => ({ ...e, tts1: errMsg }))
            }
            if (key === 'tts2') {
              setTtsStatus2('error')
              setErrors((e) => ({ ...e, tts2: errMsg }))
            }
            toast.error(`Job failed: ${errMsg}`)
            clearJobTracking(key)
          }
        } catch {}
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [jobIds, jobStartTimes])

  useEffect(() => {
    if (!Object.keys(jobIds).length) return
    const interval = setInterval(() => forceTick((tick) => tick + 1), 1000)
    return () => clearInterval(interval)
  }, [jobIds])

  const statusIcon = (s: string) => (s === 'success' ? '✓' : s === 'generating' ? '⏳' : s === 'error' ? '✗' : '')

  const renderSuggestionGroup = (
    items: WordItem[],
    selected: string[],
    toggle: (word: string) => void,
    theme: 'blue' | 'purple'
  ) => {
    const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    const grouped: Record<string, WordItem[]> = {}
    items.forEach((item) => {
      const raw = (item.level || '').toUpperCase()
      const bucket = CEFR_LEVELS.includes(raw) ? raw : 'Suggested'
      grouped[bucket] = grouped[bucket] || []
      grouped[bucket].push(item)
    })
    const selectedLower = selected.map((w) => w.toLowerCase())
    const order = [...CEFR_LEVELS, 'Suggested']
    return order.map((lvl) => {
      const list = grouped[lvl]
      if (!list?.length) return null
      return (
        <div key={lvl}>
          <div className="text-xs font-semibold text-gray-600 mb-1">
            {lvl === 'Suggested' ? 'Suggested Words' : lvl}
          </div>
          <div className="flex flex-wrap gap-1">
            {list.map((item) => (
              <button
                key={item.word}
                onClick={() => toggle(item.word)}
                className={`px-2 py-1 text-sm rounded border ${
                  selectedLower.includes(item.word.toLowerCase())
                    ? theme === 'blue'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white'
                }`}
                title={item.reason}
              >
                {item.word}
              </button>
            ))}
          </div>
        </div>
      )
    })
  }

  const renderSelected = (selected: string[], toggle: (w: string) => void, theme: 'blue' | 'purple') => (
    <div className="mt-1 flex flex-wrap gap-1">
      {selected.map((w) => (
        <span
          key={w}
          className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
            theme === 'blue' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'
          }`}
        >
          {w}
          <button onClick={() => toggle(w)} aria-label={`Remove ${w}`}>
            ×
          </button>
        </span>
      ))}
    </div>
  )

  const columns = (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="border rounded-lg p-4 bg-blue-50 space-y-3">
        <h2 className="text-lg font-semibold text-blue-700">Story 1</h2>
        <button className="btn w-full" onClick={fetchSuggestions1} disabled={loading1}>
          {loading1 ? 'Loading...' : 'Fetch Word Suggestions'}
        </button>
        {suggestions1.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto bg-white rounded p-2 border">
            {renderSuggestionGroup(suggestions1, selected1, toggleWord1, 'blue')}
          </div>
        )}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded text-xs text-blue-700 space-y-1">
          <div className="font-semibold">Workflow:</div>
          <div>1️⃣ <strong>Select words</strong> from suggestions (pick 1–{MAX_WORDS})</div>
          <div>2️⃣ <strong>Save words</strong> to enable story generation</div>
          <div>3️⃣ <strong>Generate story</strong> (AI creates paragraphs with your words)</div>
          <div>4️⃣ <strong>Generate TTS</strong> (creates audio narration)</div>
        </div>
        <div className="text-sm">
          <strong>Selected ({selected1.length}/{MAX_WORDS})</strong>
          {renderSelected(selected1, toggleWord1, 'blue')}
        </div>
        <button className="btn primary w-full" onClick={saveWords1} disabled={!selected1.length}>
          Save Words
        </button>
        {genStatus1 === 'error' ? (
          <button className="btn w-full bg-red-100" onClick={retryStory1}>
            Retry Story 1
          </button>
        ) : (
          <button
            className="btn w-full"
            onClick={story1 ? regenerateStory1 : generateStory1}
            disabled={!selected1.length || genStatus1 === 'generating' || wordsDirty1}
            title={wordsDirty1 ? 'Save words before generating' : undefined}
          >
            {statusIcon(genStatus1)} {story1 ? '↻ Regenerate' : 'Generate'} Story 1
            {genStatus1 === 'generating' ? elapsed('s1') : ''}
          </button>
        )}
        {wordsDirty1 && (
          <div className="text-xs text-amber-700">Save Story 1 words to enable generation</div>
        )}
        {errors.s1 && <div className="text-xs text-red-600">{errors.s1}</div>}
        {story1 && (
          <>
            {Object.keys(story1Counts).length > 0 && (
              <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded border mb-3">
                <strong>Target Word Coverage:</strong>
                {Object.entries(story1Counts).map(([word, count]) => (
                  <div key={word} className={count === 4 ? 'text-emerald-600 font-semibold' : 'text-amber-700'}>
                    • {word}: {count}/4 occurrences
                  </div>
                ))}
              </div>
            )}
            <div className="text-sm text-gray-700 bg-white p-2 rounded border max-h-96 overflow-y-auto leading-6 w-full">
              {story1.paragraphs.map((p, idx) => (
                <p key={idx} className="mb-3">
                  {paragraphHighlightsSafe(p, idx, story1.targetOccurrences, selected1)}
                </p>
              ))}
            </div>
            {ttsStatus1 === 'error' ? (
              <button className="btn w-full bg-red-100" onClick={retryTTS1}>
                Retry TTS 1
              </button>
            ) : (
              <button className="btn w-full" onClick={generateTTS1} disabled={ttsStatus1 === 'generating'}>
                {statusIcon(ttsStatus1)} Generate TTS 1
                {ttsStatus1 === 'generating' ? elapsed('tts1') : ''}
              </button>
            )}
            {ttsUrl1 && (
              <audio controls className="w-full mt-2" src={ttsUrl1}>
                Your browser does not support the audio element.
              </audio>
            )}
          </>
        )}
        {errors.tts1 && <div className="text-xs text-red-600">{errors.tts1}</div>}
      </div>
      <div className="border rounded-lg p-4 bg-purple-50 space-y-3">
        <h2 className="text-lg font-semibold text-purple-700">Story 2</h2>
        <button className="btn w-full" onClick={fetchSuggestions2} disabled={loading2}>
          {loading2 ? 'Loading...' : 'Fetch Word Suggestions'}
        </button>
        {suggestions2.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto bg-white rounded p-2 border">
            {renderSuggestionGroup(suggestions2, selected2, toggleWord2, 'purple')}
          </div>
        )}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded text-xs text-blue-700 space-y-1">
          <div className="font-semibold">Workflow:</div>
          <div>1️⃣ <strong>Select words</strong> from suggestions (pick 1–{MAX_WORDS})</div>
          <div>2️⃣ <strong>Save words</strong> to enable story generation</div>
          <div>3️⃣ <strong>Generate story</strong> (AI creates paragraphs with your words)</div>
          <div>4️⃣ <strong>Generate TTS</strong> (creates audio narration)</div>
        </div>
        <div className="text-sm">
          <strong>Selected ({selected2.length}/{MAX_WORDS})</strong>
          {renderSelected(selected2, toggleWord2, 'purple')}
        </div>
        <button className="btn primary w-full" onClick={saveWords2} disabled={!selected2.length}>
          Save Words
        </button>
        {genStatus2 === 'error' ? (
          <button className="btn w-full bg-red-100" onClick={retryStory2}>
            Retry Story 2
          </button>
        ) : (
          <button
            className="btn w-full"
            onClick={story2 ? regenerateStory2 : generateStory2}
            disabled={!selected2.length || genStatus2 === 'generating' || wordsDirty2}
            title={wordsDirty2 ? 'Save words before generating' : undefined}
          >
            {statusIcon(genStatus2)} {story2 ? '↻ Regenerate' : 'Generate'} Story 2
            {genStatus2 === 'generating' ? elapsed('s2') : ''}
          </button>
        )}
        {wordsDirty2 && (
          <div className="text-xs text-amber-700">Save Story 2 words to enable generation</div>
        )}
        {errors.s2 && <div className="text-xs text-red-600">{errors.s2}</div>}
        {story2 && (
          <>
            {Object.keys(story2Counts).length > 0 && (
              <div className="text-xs text-gray-600 bg-purple-50 p-2 rounded border mb-3">
                <strong>Target Word Coverage:</strong>
                {Object.entries(story2Counts).map(([word, count]) => (
                  <div key={word} className={count === 4 ? 'text-emerald-600 font-semibold' : 'text-amber-700'}>
                    • {word}: {count}/4 occurrences
                  </div>
                ))}
              </div>
            )}
            <div className="text-sm text-gray-700 bg-white p-2 rounded border max-h-96 overflow-y-auto leading-6 w-full">
              {story2.paragraphs.map((p, idx) => (
                <p key={idx} className="mb-3">
                  {paragraphHighlightsSafe(p, idx, story2.targetOccurrences, selected2)}
                </p>
              ))}
            </div>
            {ttsStatus2 === 'error' ? (
              <button className="btn w-full bg-red-100" onClick={retryTTS2}>
                Retry TTS 2
              </button>
            ) : (
              <button className="btn w-full" onClick={generateTTS2} disabled={ttsStatus2 === 'generating'}>
                {statusIcon(ttsStatus2)} Generate TTS 2
                {ttsStatus2 === 'generating' ? elapsed('tts2') : ''}
              </button>
            )}
            {ttsUrl2 && (
              <audio controls className="w-full mt-2" src={ttsUrl2}>
                Your browser does not support the audio element.
              </audio>
            )}
          </>
        )}
        {errors.tts2 && <div className="text-xs text-red-600">{errors.tts2}</div>}
      </div>
    </div>
  )

  if (compact) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-gray-600">Level: {level}</p>
        </div>
        {columns}
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">{columns}</div>
  )
}
