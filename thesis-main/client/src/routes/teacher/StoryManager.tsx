import React, { useEffect, useState } from 'react'
import { BookOpen, CheckCircle2, Loader2, RefreshCw, Save, Volume2 } from 'lucide-react'
import api from '../../lib/api'
import { toast } from '../../store/toasts'

type Props = { experimentId: string; compact?: boolean }
// We keep two "sets" in the UI purely to represent Story 1 (set1) and Story 2 (set2)
// to maintain compatibility with the jobs/status API, but each holds its own word list now.
type SetKey = 'set1' | 'set2'
type JobStatus = 'idle' | 'generating' | 'success' | 'error'

type Suggestion = {
  word: string
  level?: string
  gloss?: string
  reason?: string
}

type SetState = {
  suggestions: Suggestion[]
  selected: string[] // story-specific selection (Story 1 for set1, Story 2 for set2)
  loadingPool: boolean
  savingWords: boolean
}

type SetJobState = {
  words: JobStatus
  s1: JobStatus
  tts1: JobStatus
  s2: JobStatus
  tts2: JobStatus
}

const emptyJobState: SetJobState = { words: 'idle', s1: 'idle', tts1: 'idle', s2: 'idle', tts2: 'idle' }

type StoryPreview = {
  paragraphs: string[]
  sentences?: string[][]
  ttsAudioUrl?: string
  noiseOccurrences?: { word: string; paragraphIndex: number }[]
  occurrences?: { word: string; paragraphIndex: number; sentenceIndex?: number; charStart?: number; charEnd?: number }[]
}

type PreviewState = {
  expanded: boolean
}

function countWordOccurrences(text: string, words: string[]) {
  const counts: Record<string, number> = {}
  const filtered = words.filter(Boolean)
  filtered.forEach((w) => (counts[w.toLowerCase()] = 0))
  if (!filtered.length) return counts
  const tokens = text.toLowerCase().match(/[a-zA-Z']+/g) || []
  tokens.forEach((tok) => {
    if (Object.prototype.hasOwnProperty.call(counts, tok)) counts[tok] += 1
  })
  return counts
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightParagraph(text: string, targets: string[], noise: string[] = []) {
  const tSet = new Set(targets.filter(Boolean).map(w => w.toLowerCase()))
  const nSet = new Set(noise.filter(Boolean).map(w => w.toLowerCase()))
  if (!tSet.size && !nSet.size) return text
  const pattern = new RegExp(`\\b(${[...tSet, ...nSet].map(escapeRegExp).join('|')})\\b`, 'gi')
  const parts = text.split(pattern)
  return parts.map((part, idx) => {
    const lower = part.toLowerCase()
    if (tSet.has(lower)) return <span key={idx} className="font-semibold text-blue-700">{part}</span>
    if (nSet.has(lower)) return <span key={idx} className="font-semibold text-amber-900 bg-amber-200/70 rounded px-0.5">{part}</span>
    return <React.Fragment key={idx}>{part}</React.Fragment>
  })
}


function StepPill({ label, status }: { label: string; status: JobStatus }) {
  const color =
    status === 'success'
      ? 'bg-green-100 text-green-700 border-green-200'
      : status === 'error'
      ? 'bg-red-100 text-red-700 border-red-200'
      : status === 'generating'
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-gray-100 text-gray-700 border-gray-200'

  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full border inline-flex items-center gap-1 ${color}`}>
      {status === 'generating' && <Loader2 className="w-3 h-3 animate-spin" />}
      {label}
    </span>
  )
}

function WordBadge({ item, active, onToggle }: { item: Suggestion; active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`px-3 py-2 rounded-lg border text-left transition hover:shadow-sm ${
        active ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-800'
      }`}
    >
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>{item.word}</span>
        {item.level && <span className="text-[11px] text-gray-500 ml-2">Level {item.level}</span>}
      </div>
      {item.gloss && <div className="text-xs text-gray-500 mt-1">{item.gloss}</div>}
      {item.reason && <div className="text-[11px] text-gray-400 mt-1">Why: {item.reason}</div>}
    </button>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2">
      <BookOpen className="w-5 h-5 text-blue-600" />
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  )
}

export default function StoryManager({ experimentId }: Props) {
  const base = import.meta.env.VITE_API_BASE_URL || ''
  const [setState, setSetState] = useState<Record<SetKey, SetState>>({
    set1: { suggestions: [], selected: [], loadingPool: false, savingWords: false },
    set2: { suggestions: [], selected: [], loadingPool: false, savingWords: false },
  })
  const [jobState, setJobState] = useState<Record<SetKey, SetJobState>>({
    set1: { ...emptyJobState },
    set2: { ...emptyJobState },
  })
  const [loadingInitial, setLoadingInitial] = useState(false)
  const [stories, setStories] = useState<Record<SetKey, { story1?: StoryPreview; story2?: StoryPreview }>>({
    set1: {},
    set2: {},
  })
  const [previewOpen, setPreviewOpen] = useState<Record<SetKey, { story1: boolean; story2: boolean }>>({
    set1: { story1: true, story2: true },
    set2: { story1: true, story2: true },
  })
  const [wordTtsItems, setWordTtsItems] = useState<{ word: string; audioUrl?: string | null; generated?: boolean; error?: string }[]>([])
  const [wordTtsLoading, setWordTtsLoading] = useState(false)

  // Load any saved words so both stories in a set share the same list.
  useEffect(() => {
    if (!experimentId) return
    setLoadingInitial(true)
    api
      .get(`/api/experiments/${experimentId}`)
      .then(({ data }) => {
        const set1Words = data?.stories?.story1?.targetWords || []
        const set2Words = data?.stories?.story2?.targetWords || []
        setSetState((prev) => ({
          set1: { ...prev.set1, selected: set1Words },
          set2: { ...prev.set2, selected: set2Words },
        }))
      })
      .catch(() => {
        toast.error('Failed to load saved words')
      })
      .finally(() => setLoadingInitial(false))
  }, [experimentId])

  async function fetchStory(setKey: SetKey, storyLabel: 'story1' | 'story2') {
    try {
      const labelParam = storyLabel === 'story1' ? '1' : '2'
      const { data } = await api.get(`/api/experiments/${experimentId}/story/${labelParam}`, {
        params: { set: setKey },
      })
      const resolveUrl = (u?: string) => {
        if (!u) return ''
        return u.startsWith('http') ? u : `${base}${u}`
      }
      const ttsUrl = resolveUrl(data?.ttsAudioUrl) || resolveUrl((data?.ttsSegments || [])[0])
      const preview: StoryPreview = {
        paragraphs: data?.paragraphs || [],
        sentences: data?.sentences || [],
        ttsAudioUrl: ttsUrl,
        noiseOccurrences: data?.noiseOccurrences || [],
        occurrences: data?.occurrences || [],
      }
      setStories((prev) => ({
        ...prev,
        [setKey]: { ...prev[setKey], [storyLabel]: preview },
      }))
    } catch (e: any) {
      // silently ignore missing until generated
    }
  }

  // Poll job status for both sets to drive the workflow pills.
  useEffect(() => {
    if (!experimentId) return
    const tick = async () => {
      try {
        const { data } = await api.get(`/api/jobs/experiment/${experimentId}/status`)
        const set1 = data?.set1 || { ...emptyJobState }
        const set2 = data?.set2 || { ...emptyJobState }
        setJobState({ set1, set2 })

        // Auto-fetch previews once generation succeeds
        if (set1.s1 === 'success') fetchStory('set1', 'story1')
        if (set1.s2 === 'success') fetchStory('set1', 'story2')
        if (set2.s1 === 'success') fetchStory('set2', 'story1')
        if (set2.s2 === 'success') fetchStory('set2', 'story2')
      } catch {
        // ignore
      }
    }
    tick()
    const id = setInterval(tick, 4000)
    return () => clearInterval(id)
  }, [experimentId])

  const groupByLevel = (items: Suggestion[]) =>
    items.reduce<Record<string, Suggestion[]>>((acc, cur) => {
      const key = cur.level || 'Any'
      acc[key] = acc[key] || []
      acc[key].push(cur)
      return acc
    }, {})

  function toggleWord(setKey: SetKey, word: string) {
    setSetState((prev) => {
      const otherSet: SetKey = setKey === 'set1' ? 'set2' : 'set1'
      if (prev[otherSet].selected.includes(word)) {
        toast.error('Stories must stay disjoint. That word is already in the other story.')
        return prev
      }
      const exists = prev[setKey].selected.includes(word)
      const nextSelected = exists
        ? prev[setKey].selected.filter((w) => w !== word)
        : [...prev[setKey].selected, word].slice(0, 5)
      return { ...prev, [setKey]: { ...prev[setKey], selected: nextSelected } }
    })
  }

  async function generateWordTts(regenerate = false) {
    if (!experimentId) return
    setWordTtsLoading(true)
    try {
      const { data } = await api.post(`/api/experiments/${experimentId}/word-tts`, { regenerate })
      const items = Array.isArray(data?.items) ? data.items : []
      setWordTtsItems(items)
      if (items.length) toast.success('Word TTS ready')
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Word TTS failed')
    } finally {
      setWordTtsLoading(false)
    }
  }

  async function fetchPool(setKey: SetKey) {
    setSetState((prev) => ({ ...prev, [setKey]: { ...prev[setKey], loadingPool: true } }))
    try {
      const { data } = await api.post(`/api/experiments/${experimentId}/word-suggestions`, {
        story: 'story1',
        set: setKey,
      })
      const items: Suggestion[] = Array.isArray(data?.items)
        ? data.items.map((i: any) => ({
            word: i.word,
            level: i.level,
            gloss: i.gloss,
            reason: i.reason,
          }))
        : (data?.suggestions || []).map((w: string) => ({ word: w }))
      setSetState((prev) => ({ ...prev, [setKey]: { ...prev[setKey], suggestions: items } }))
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to fetch word pool')
    } finally {
      setSetState((prev) => ({ ...prev, [setKey]: { ...prev[setKey], loadingPool: false } }))
    }
  }

  async function saveWords(setKey: SetKey) {
    const words = setState[setKey].selected
    if (words.length !== 5) {
      toast.error('Select exactly 5 words')
      return
    }
    setSetState((prev) => ({ ...prev, [setKey]: { ...prev[setKey], savingWords: true } }))
    try {
      await api.post(`/api/experiments/${experimentId}/story-words`, {
        story: setKey === 'set1' ? 'story1' : 'story2',
        targetWords: words,
        set: setKey,
      })
      toast.success(`Saved words for ${setKey === 'set1' ? 'Story 1' : 'Story 2'}`)
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to save words')
    } finally {
      setSetState((prev) => ({ ...prev, [setKey]: { ...prev[setKey], savingWords: false } }))
    }
  }

  async function queueJob(setKey: SetKey, type: 'generate_story' | 'generate_tts', storyLabel: 'story1' | 'story2') {
    const words = setState[setKey].selected
    if (words.length !== 5) {
      toast.error('Select and save exactly 5 words first')
      return
    }
    try {
      await api.post('/api/jobs', {
        type,
        experimentId,
        storyLabel,
        set: setKey,
        targetWords: words,
      })
      toast.success(
        `${type === 'generate_story' ? 'Story' : 'TTS'} job started for ${
          storyLabel === 'story1' ? 'Story 1' : 'Story 2'
        } (${setKey.toUpperCase()})`
      )
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Job failed to queue')
    }
  }

  const renderWorkflow = (setKey: SetKey) => {
    const js = jobState[setKey] || emptyJobState
    const isStory1 = setKey === 'set1'
    return (
      <div className="flex flex-wrap gap-2">
        <StepPill label="Words" status={js.words || 'idle'} />
        <StepPill label={isStory1 ? 'Story 1' : 'Story 2'} status={(isStory1 ? js.s1 : js.s2) || 'idle'} />
        <StepPill label={isStory1 ? 'TTS 1' : 'TTS 2'} status={(isStory1 ? js.tts1 : js.tts2) || 'idle'} />
      </div>
    )
  }

  const renderSet = (setKey: SetKey) => {
    const state = setState[setKey]
    const grouped = groupByLevel(state.suggestions)
    const currentStoryKey: 'story1' | 'story2' = setKey === 'set1' ? 'story1' : 'story2'
  const currentStoryPreview = stories[setKey]?.[currentStoryKey]
  const isStory1 = currentStoryKey === 'story1'
  const storyLabel = isStory1 ? 'Story 1' : 'Story 2'
    const noiseOccs = currentStoryPreview?.noiseOccurrences || []
    const noiseWords = Array.from(new Set(noiseOccs.map((o) => (o.word || '').toLowerCase()).filter(Boolean)))

    return (
      <div className="bg-white/90 border border-gray-100 rounded-2xl shadow-sm p-5 space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{setKey === 'set1' ? 'Story 1 (with hints)' : 'Story 2 (without hints)'}</h2>
            <p className="text-sm text-gray-500">Pick exactly 5 words for this story (stories stay disjoint)</p>
          </div>
          {renderWorkflow(setKey)}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchPool(setKey)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50"
            disabled={state.loadingPool}
          >
            {state.loadingPool ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Fetch word pool
          </button>
          <div className="text-xs text-gray-500">Pick exactly 5 words and save.</div>
        </div>

        {state.suggestions.length > 0 && (
          <div className="space-y-3">
            <SectionHeader title="Suggested words" subtitle="Grouped by level; tap to toggle" />
            <div className="space-y-3">
              {Object.entries(grouped).map(([level, items]) => (
                <div key={level} className="space-y-2">
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Level {level}</div>
                  <div className="grid md:grid-cols-3 sm:grid-cols-2 gap-2">
                    {items.map((s) => (
                      <WordBadge
                        key={`${setKey}-${s.word}`}
                        item={s}
                        active={state.selected.includes(s.word)}
                        onToggle={() => toggleWord(setKey, s.word)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <SectionHeader title="Selected words" subtitle="Used by this story only" />
            <span className="text-xs font-semibold text-gray-600">
              {state.selected.length}/5 selected
            </span>
          </div>
          {state.selected.length === 0 ? (
            <p className="text-sm text-gray-500">No words selected yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {state.selected.map((w) => (
                <span key={w} className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm border border-blue-200">
                  {w}
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => saveWords(setKey)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 disabled:opacity-50"
            disabled={state.savingWords || state.selected.length !== 5}
          >
            {state.savingWords ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save words (this story)
          </button>
        </div>

        <div className="grid md:grid-cols-1 gap-3">
          <div className="space-y-2 p-3 rounded-xl bg-white/60 border border-gray-100">
            <SectionHeader title={storyLabel} subtitle="Uses saved words" />
            <div className="flex gap-2">
              <button
                onClick={() => queueJob(setKey, 'generate_story', currentStoryKey)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 transition disabled:bg-blue-100 disabled:border-blue-200 disabled:text-blue-400 disabled:cursor-not-allowed"
                disabled={state.selected.length !== 5}
              >
                <BookOpen className="w-4 h-4" />
                {`Generate ${storyLabel}`}
              </button>
              <button
                onClick={() => queueJob(setKey, 'generate_tts', currentStoryKey)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:border-emerald-700 transition disabled:bg-emerald-100 disabled:border-emerald-200 disabled:text-emerald-400 disabled:cursor-not-allowed"
                disabled={state.selected.length !== 5}
              >
                <Volume2 className="w-4 h-4" />
                {`TTS ${isStory1 ? '1' : '2'}`}
              </button>
            </div>
            <div className="rounded-lg bg-gray-50/80 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewOpen((prev) => ({
                        ...prev,
                        [setKey]: { ...prev[setKey], [currentStoryKey]: !prev[setKey][currentStoryKey] },
                      }))
                    }
                    className="text-[11px] text-gray-800 font-semibold hover:text-blue-700"
                  >
                    {previewOpen[setKey][currentStoryKey] ? 'Hide preview' : 'Show preview'}
                  </button>
                  <span className="text-gray-400">•</span>
                  <button
                    onClick={() => fetchStory(setKey, currentStoryKey)}
                    className="text-[11px] text-blue-600 hover:underline"
                    type="button"
                  >
                    Refresh
                  </button>
                </div>
                <span className="text-gray-500">{storyLabel} preview</span>
              </div>
              {previewOpen[setKey][currentStoryKey] && (
                <>
                  {currentStoryPreview && currentStoryPreview.paragraphs.length > 0 ? (
                    <div className="space-y-2 text-sm text-gray-800">
                      {(currentStoryPreview.sentences?.length ? currentStoryPreview.sentences : currentStoryPreview.paragraphs.map((p) => [p])).map(
                        (sentences, idx) => (
                          <p key={`${currentStoryKey}-${idx}`} className="leading-relaxed">
                            {sentences.map((s, si) => (
                              <React.Fragment key={`${currentStoryKey}-${idx}-${si}`}>
                                {highlightParagraph(s, state.selected, noiseWords)}
                                {' '}
                              </React.Fragment>
                            ))}
                          </p>
                        )
                      )}
                      <div className="text-[11px] text-gray-700 rounded-md bg-white/80 p-2">
                        <div className="font-semibold mb-1">Counts</div>
                        <div className="grid grid-cols-2 gap-1">
                          {Object.entries(countWordOccurrences(currentStoryPreview.paragraphs.join(' '), state.selected)).map(
                            ([w, c]) => (
                              <div key={w} className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded">
                                <span className="font-medium text-gray-800">{w}</span>
                                <span className="text-gray-600">{c}</span>
                              </div>
                            )
                          )}
                        </div>
                        <div className="mt-2 border-t border-gray-200 pt-2">
                          <div className="text-[11px] text-gray-700 mb-1 font-semibold">Noise words</div>
                          {noiseWords.length > 0 ? (
                            <div className="grid grid-cols-2 gap-1">
                              {noiseWords.map((w) => {
                                const count = (noiseOccs || []).filter((o) => (o.word || '').toLowerCase() === w).length
                                return (
                                  <div key={`noise-${w}`} className="flex items-center justify-between bg-amber-50 px-2 py-1 rounded">
                                    <span className="font-medium text-amber-800">{w}</span>
                                    <span className="text-amber-700">{count}</span>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="text-[11px] text-gray-500">No noise words detected.</div>
                          )}
                        </div>
                      </div>
                      {currentStoryPreview.ttsAudioUrl && (
                        <div className="space-y-1">
                          <a
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            href={currentStoryPreview.ttsAudioUrl.startsWith('http') ? currentStoryPreview.ttsAudioUrl : `${base}${currentStoryPreview.ttsAudioUrl}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open TTS audio
                          </a>
                          <audio controls className="w-full">
                            <source src={currentStoryPreview.ttsAudioUrl.startsWith('http') ? currentStoryPreview.ttsAudioUrl : `${base}${currentStoryPreview.ttsAudioUrl}`} type="audio/mpeg" />
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No story generated yet.</p>
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    )
  }

  if (!experimentId) {
    return <div className="text-sm text-red-600">Missing experiment id</div>
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <div className="rounded-3xl border border-gray-200 bg-gradient-to-r from-slate-50 via-white to-blue-50 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Dual story setup</h1>
            <p className="text-sm text-gray-600 leading-relaxed">
              Flow: Fetch words &rarr; Save 5 words for Story 1 &rarr; Generate Story 1 & TTS 1 &rarr; Save 5 different words for Story 2 &rarr; Generate Story 2 & TTS 2.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-2xl px-3 py-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="font-medium">Stories must stay disjoint: 5 words each.</span>
          </div>
        </div>
      </div>

      {loadingInitial ? (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading saved words...
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-white/90 border border-gray-100 rounded-2xl shadow-sm p-5 space-y-4">
            <SectionHeader title="Target-word audio (recall test)" subtitle="Generate per-word TTS files for recall" />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => generateWordTts(false)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                disabled={wordTtsLoading}
              >
                {wordTtsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                Generate/list word TTS
              </button>
              <button
                onClick={() => generateWordTts(true)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 disabled:opacity-50"
                disabled={wordTtsLoading}
              >
                Regenerate
              </button>
            </div>
            {wordTtsItems.length > 0 && (
              <div className="grid md:grid-cols-2 gap-3">
                {wordTtsItems.map((item) => (
                  <div key={`tts-${item.word}`} className="border rounded-lg p-3 bg-white space-y-2">
                    <div className="text-sm font-semibold text-gray-800">{item.word}</div>
                    {item.audioUrl ? (
                      <audio controls className="w-full">
                        <source src={item.audioUrl.startsWith('http') ? item.audioUrl : `${base}${item.audioUrl}`} type="audio/mpeg" />
                        Your browser does not support the audio element.
                      </audio>
                    ) : (
                      <div className="text-xs text-gray-500">{item.error || 'Audio unavailable'}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {renderSet('set1')}
          {renderSet('set2')}
        </div>
      )}
    </div>
  )
}
