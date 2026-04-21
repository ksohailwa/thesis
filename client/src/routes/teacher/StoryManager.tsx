import React, { useEffect, useRef, useState } from 'react'
import { BookOpen, CheckCircle2, Loader2, Lock, RefreshCw, Unlock, Volume2, AlertCircle } from 'lucide-react'
import api from '../../lib/api'
import { toast } from '../../store/toasts'

type Props = {
  experimentId: string
  compact?: boolean
  onStoriesConfirmed?: (confirmed: boolean) => void
}
type ExperimentStatus = 'draft' | 'live' | 'closed' | 'archived'

type WordItem = {
  word: string
  level: string
  meaning: string
  sentence1?: string
  sentence2?: string
  corpus?: string
}

type GroupedWords = {
  current: { level: string; words: WordItem[] }
  higher: { level: string | null; words: WordItem[] }
  lower: { level: string | null; words: WordItem[] }
}

type StoryPreview = {
  paragraphs: string[]
  sentences?: string[][]
  ttsAudioUrl?: string
  noiseOccurrences?: { word: string; paragraphIndex: number }[]
  occurrences?: { word: string; paragraphIndex: number; sentenceIndex?: number }[]
}

type GenerationStatus = 'idle' | 'generating' | 'success' | 'error'

// Word selection state structure
type WordSelection = {
  targetCurrent: string[]  // 4 words from current level
  targetHigher: string[]   // 4 words from higher level
  targetLower: string[]    // 2 words from lower level
  noiseCurrent: string[]   // 1 word from current level
  noiseHigher: string[]    // 1 word from higher level
  noiseLower: string[]     // 1 word from lower level
}

const initialSelection: WordSelection = {
  targetCurrent: [],
  targetHigher: [],
  targetLower: [],
  noiseCurrent: [],
  noiseHigher: [],
  noiseLower: [],
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightParagraph(text: string, targetWords: string[], noiseWords: string[]) {
  const targetSet = new Set(targetWords.filter(Boolean).map(w => w.toLowerCase()))
  const noiseSet = new Set(noiseWords.filter(Boolean).map(w => w.toLowerCase()))
  if (!targetSet.size && !noiseSet.size) return text
  const pattern = new RegExp(`\\b(${[...targetSet, ...noiseSet].map(escapeRegExp).join('|')})\\b`, 'gi')
  const parts = text.split(pattern)
  return parts.map((part, idx) => {
    const lower = part.toLowerCase()
    if (targetSet.has(lower)) return <span key={idx} className="font-semibold text-blue-700 bg-blue-50 px-0.5 rounded">{part}</span>
    if (noiseSet.has(lower)) return <span key={idx} className="font-semibold text-orange-600 bg-orange-50 px-0.5 rounded">{part}</span>
    return <React.Fragment key={idx}>{part}</React.Fragment>
  })
}

function countWordsInParagraphs(paragraphs: string[], words: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  words.forEach(w => { counts[w.toLowerCase()] = 0 })

  const text = paragraphs.join(' ').toLowerCase()
  words.forEach(word => {
    const pattern = new RegExp(`\\b${escapeRegExp(word.toLowerCase())}\\b`, 'gi')
    const matches = text.match(pattern)
    counts[word.toLowerCase()] = matches ? matches.length : 0
  })

  return counts
}

function WordCountBadge({ word, count, variant, expected }: { word: string; count: number; variant: 'target' | 'noise'; expected: number }) {
  const isGood = variant === 'target' ? count >= expected : (count >= 1 && count <= 2)
  const colors = {
    target: isGood ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-red-100 text-red-700 border-red-300',
    noise: isGood ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-red-100 text-red-700 border-red-300',
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[variant]}`}>
      {word}: <strong>{count}</strong>
      {!isGood && <AlertCircle className="w-3 h-3" />}
    </span>
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

function WordBadge({
  item,
  selected,
  onToggle,
  disabled,
  variant = 'target'
}: {
  item: WordItem
  selected: boolean
  onToggle: () => void
  disabled?: boolean
  variant?: 'target' | 'noise'
}) {
  const colors = {
    target: {
      selected: 'bg-blue-50 border-blue-300 text-blue-700 ring-2 ring-blue-200',
      unselected: 'bg-white border-gray-200 text-gray-800 hover:border-blue-300',
    },
    noise: {
      selected: 'bg-orange-50 border-orange-300 text-orange-700 ring-2 ring-orange-200',
      unselected: 'bg-white border-gray-200 text-gray-800 hover:border-orange-300',
    }
  }

  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`px-3 py-2 rounded-lg border text-left transition hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
        selected ? colors[variant].selected : colors[variant].unselected
      }`}
    >
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>{item.word}</span>
        {selected && <CheckCircle2 className="w-4 h-4 ml-2" />}
      </div>
      {item.meaning && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{item.meaning}</div>}
    </button>
  )
}

function LevelSection({
  title,
  levelLabel,
  words,
  selectedWords,
  maxSelection,
  onToggle,
  disabled,
  variant = 'target',
  color = 'blue'
}: {
  title: string
  levelLabel: string | null
  words: WordItem[]
  selectedWords: string[]
  maxSelection: number
  onToggle: (word: string) => void
  disabled?: boolean
  variant?: 'target' | 'noise'
  color?: 'blue' | 'purple' | 'green' | 'orange'
}) {
  const colorClasses = {
    blue: 'border-blue-200 bg-blue-50/30',
    purple: 'border-purple-200 bg-purple-50/30',
    green: 'border-green-200 bg-green-50/30',
    orange: 'border-orange-200 bg-orange-50/30',
  }

  if (!levelLabel || words.length === 0) {
    return (
      <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-gray-700">{title}</span>
          <span className="text-xs text-gray-500">Not available</span>
        </div>
        <p className="text-sm text-gray-500">No words available for this level</p>
      </div>
    )
  }

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-gray-700">{title}</span>
        <span className={`text-sm px-2 py-0.5 rounded-full ${
          selectedWords.length === maxSelection
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {selectedWords.length}/{maxSelection} selected
        </span>
      </div>
      <div className="text-xs text-gray-500 mb-3">Level: {levelLabel}</div>
      <div className="grid md:grid-cols-2 gap-2">
        {words.map((item) => {
          const isSelected = selectedWords.includes(item.word)
          const canSelect = selectedWords.length < maxSelection || isSelected
          return (
            <WordBadge
              key={item.word}
              item={item}
              selected={isSelected}
              variant={variant}
              disabled={disabled || (!canSelect && !isSelected)}
              onToggle={() => onToggle(item.word)}
            />
          )
        })}
      </div>
    </div>
  )
}

export default function StoryManager({ experimentId, onStoriesConfirmed }: Props) {
  const base = import.meta.env.VITE_API_BASE_URL || ''

  // Word pool
  const [groupedWords, setGroupedWords] = useState<GroupedWords | null>(null)
  const [experimentLevel, setExperimentLevel] = useState<string>('B1')
  const [loadingPool, setLoadingPool] = useState(false)

  // Word selection
  const [selection, setSelection] = useState<WordSelection>(initialSelection)

  // Generation status
  const [storiesStatus, setStoriesStatus] = useState<GenerationStatus>('idle')
  const [ttsStatus, setTtsStatus] = useState<GenerationStatus>('idle')

  // Job polling
  const [activeStoryJob, setActiveStoryJob] = useState<string | null>(null)
  const [activeTtsJob, setActiveTtsJob] = useState<string | null>(null)

  // Pending story2 job data (to chain after story1 completes)
  const pendingStory2 = useRef<{ targetWords: string[]; noiseWords: string[]; model: string } | null>(null)

  // Model selection for story generation
  const [selectedModel, setSelectedModel] = useState<'openai' | 'claude'>('openai')

  // Story previews
  const [story1Preview, setStory1Preview] = useState<StoryPreview | null>(null)
  const [story2Preview, setStory2Preview] = useState<StoryPreview | null>(null)

  // Word TTS
  const [wordTtsItems, setWordTtsItems] = useState<{ word: string; audioUrl?: string | null; error?: string }[]>([])
  const [wordTtsLoading, setWordTtsLoading] = useState(false)

  // Loading
  const [loadingInitial, setLoadingInitial] = useState(true)

  // Experiment state
  const [experimentStatus, setExperimentStatus] = useState<ExperimentStatus>('draft')
  const [storiesConfirmed, setStoriesConfirmed] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Derived: is editing locked?
  const isLocked = storiesConfirmed || experimentStatus !== 'draft'

  // Compute derived values
  const allTargetWords = [
    ...selection.targetCurrent,
    ...selection.targetHigher,
    ...selection.targetLower,
  ]
  const allNoiseWords = [
    ...selection.noiseCurrent,
    ...selection.noiseHigher,
    ...selection.noiseLower,
  ]

  // Story word distribution
  const story1TargetWords = [
    ...selection.targetCurrent.slice(0, 2),
    ...selection.targetHigher.slice(0, 2),
    ...selection.targetLower.slice(0, 1),
  ]
  const story2TargetWords = [
    ...selection.targetCurrent.slice(2, 4),
    ...selection.targetHigher.slice(2, 4),
    ...selection.targetLower.slice(1, 2),
  ]

  // Validation
  const targetSelectionComplete =
    selection.targetCurrent.length === 4 &&
    selection.targetHigher.length === 4 &&
    selection.targetLower.length === 2
  const noiseSelectionComplete =
    selection.noiseCurrent.length === 1 &&
    selection.noiseHigher.length === 1 &&
    selection.noiseLower.length === 1
  const canGenerate = targetSelectionComplete && noiseSelectionComplete

  // Load saved state on mount
  useEffect(() => {
    if (!experimentId) return
    setLoadingInitial(true)
    api.get(`api/experiments/${experimentId}`)
      .then(({ data }) => {
        setExperimentStatus(data?.status || 'draft')
        setStoriesConfirmed(data?.storiesConfirmed || false)
        // Load saved word selection if available
        if (data?.wordSelection) {
          setSelection(data.wordSelection)
        }
      })
      .catch(() => toast.error('Failed to load experiment'))
      .finally(() => setLoadingInitial(false))
  }, [experimentId])

  // Job polling effect for stories (chains story2 after story1)
  useEffect(() => {
    let interval: any
    if (activeStoryJob) {
      interval = setInterval(async () => {
        try {
          const { data } = await api.get(`api/jobs/${activeStoryJob}`)
          if (data?.data?.status === 'success') {
            setActiveStoryJob(null)

            // If story2 is pending, submit it now
            if (pendingStory2.current) {
              const { targetWords, noiseWords, model } = pendingStory2.current
              pendingStory2.current = null
              try {
                const res = await api.post('api/jobs', {
                  type: 'generate_story',
                  experimentId,
                  storyLabel: 'story2',
                  targetWords,
                  noiseWords,
                  model
                })
                const jobId = res.data?.data?.id
                if (jobId) {
                  setActiveStoryJob(jobId)
                  toast.success('Story 1 done! Generating Story 2...')
                } else {
                  setStoriesStatus('error')
                  toast.error('Failed to queue Story 2')
                }
              } catch {
                setStoriesStatus('error')
                toast.error('Failed to start Story 2 generation')
              }
            } else {
              // Both stories done
              setStoriesStatus('success')
              toast.success('Stories generated successfully!')
              await Promise.all([fetchStoryPreview(1), fetchStoryPreview(2)])
            }
          } else if (data?.data?.status === 'error') {
            setActiveStoryJob(null)
            pendingStory2.current = null
            setStoriesStatus('error')
            toast.error(data?.data?.errorMessage || 'Failed to generate stories')
          }
        } catch (e) {
          console.error('Job polling error', e)
        }
      }, 2000)
    }
    return () => clearInterval(interval)
  }, [activeStoryJob, experimentId])

  // Job polling effect for TTS
  useEffect(() => {
    let interval: any
    if (activeTtsJob) {
      interval = setInterval(async () => {
        try {
          const { data } = await api.get(`api/jobs/${activeTtsJob}`)
          if (data?.data?.status === 'success') {
            const { data: statusData } = await api.get(`api/jobs/experiment/${experimentId}/status`)
            const s = statusData?.data
            if (s?.tts1 === 'success' && s?.tts2 === 'success') {
              setActiveTtsJob(null)
              setTtsStatus('success')
              toast.success('TTS audio ready!')
              await Promise.all([fetchStoryPreview(1), fetchStoryPreview(2)])
            }
          } else if (data?.data?.status === 'error') {
            setActiveTtsJob(null)
            setTtsStatus('error')
            toast.error(data?.data?.errorMessage || 'Failed to generate TTS')
          }
        } catch (e) {
          console.error('Job polling error', e)
        }
      }, 3000)
    }
    return () => clearInterval(interval)
  }, [activeTtsJob, experimentId])

  // Fetch story previews
  async function fetchStoryPreview(storyNum: 1 | 2) {
    try {
      const { data } = await api.get(`api/experiments/${experimentId}/story/${storyNum}`)
      const resolveUrl = (u?: string) => {
        if (!u) return ''
        const baseUrl = u.startsWith('http') ? u : `${base}${u}`
        // Add cache buster to force browser to reload audio
        const separator = baseUrl.includes('?') ? '&' : '?'
        return `${baseUrl}${separator}t=${Date.now()}`
      }
      const preview: StoryPreview = {
        paragraphs: data?.paragraphs || [],
        sentences: data?.sentences || [],
        ttsAudioUrl: resolveUrl(data?.ttsAudioUrl),
        noiseOccurrences: data?.noiseOccurrences || [],
        occurrences: data?.occurrences || [],
      }
      if (storyNum === 1) setStory1Preview(preview)
      else setStory2Preview(preview)
    } catch {
      // Story not generated yet
    }
  }

  // Fetch existing word TTS items
  async function fetchWordTts() {
    try {
      const { data } = await api.get(`api/experiments/${experimentId}/word-tts`)
      if (Array.isArray(data?.items)) {
        // Only set if there are items with audio URLs
        const itemsWithAudio = data.items.filter((item: any) => item.audioUrl)
        if (itemsWithAudio.length > 0) {
          setWordTtsItems(data.items)
        }
      }
    } catch {
      // Word TTS not generated yet - ignore
    }
  }

  // Fetch both previews and word TTS on mount
  useEffect(() => {
    if (!experimentId || loadingInitial) return
    fetchStoryPreview(1)
    fetchStoryPreview(2)
    fetchWordTts()
  }, [experimentId, loadingInitial])

  // Fetch word pool
  async function fetchPool() {
    setLoadingPool(true)
    try {
      const { data } = await api.post(`api/experiments/${experimentId}/word-suggestions`, { story: 'story1' })
      if (data?.grouped) {
        setGroupedWords(data.grouped)
      }
      if (data?.experimentLevel) {
        setExperimentLevel(data.experimentLevel)
      }
    } catch (e: any) {
      const err = e?.response?.data?.error
      toast.error(typeof err === 'string' ? err : 'Failed to fetch word pool')
    } finally {
      setLoadingPool(false)
    }
  }

  // Toggle word selection
  function toggleWord(word: string, category: keyof WordSelection, max: number) {
    setSelection(prev => {
      const current = prev[category]
      if (current.includes(word)) {
        return { ...prev, [category]: current.filter(w => w !== word) }
      } else if (current.length < max) {
        return { ...prev, [category]: [...current, word] }
      }
      return prev
    })
  }

  // Check if word is already selected in any category
  function isWordSelectedElsewhere(word: string, currentCategory: keyof WordSelection): boolean {
    const categories: (keyof WordSelection)[] = [
      'targetCurrent', 'targetHigher', 'targetLower',
      'noiseCurrent', 'noiseHigher', 'noiseLower'
    ]
    for (const cat of categories) {
      if (cat !== currentCategory && selection[cat].includes(word)) {
        return true
      }
    }
    return false
  }

  // Generate both stories
  async function generateStories() {
    if (!canGenerate) {
      toast.error('Please complete all word selections')
      return
    }

    setStoriesStatus('generating')
    try {
      // Save word selection and generate stories
      await api.post(`api/experiments/${experimentId}/story-words`, {
        story: 'story1',
        targetWords: story1TargetWords,
        noiseWords: allNoiseWords,
      })
      await api.post(`api/experiments/${experimentId}/story-words`, {
        story: 'story2',
        targetWords: story2TargetWords,
        noiseWords: allNoiseWords,
      })

      // Save full word selection for later retrieval
      await api.post(`api/experiments/${experimentId}/word-selection`, {
        wordSelection: selection,
      })

      // Store story2 as pending — it will be submitted after story1 completes
      pendingStory2.current = {
        targetWords: story2TargetWords,
        noiseWords: allNoiseWords,
        model: selectedModel
      }

      // Submit only story1 now
      const res1 = await api.post('api/jobs', {
        type: 'generate_story',
        experimentId,
        storyLabel: 'story1',
        targetWords: story1TargetWords,
        noiseWords: allNoiseWords,
        model: selectedModel
      })

      const jobId = res1.data?.data?.id
      if (jobId) {
        setActiveStoryJob(jobId)
        toast.success('Story generation started...')
      } else {
        throw new Error('Failed to queue story generation')
      }
    } catch (e: any) {
      setStoriesStatus('error')
      const err = e?.response?.data?.error
      toast.error(typeof err === 'string' ? err : 'Failed to generate stories')
    }
  }

  // Generate TTS for both stories
  async function generateTts() {
    if (!story1Preview?.paragraphs?.length || !story2Preview?.paragraphs?.length) {
      toast.error('Please generate stories first')
      return
    }

    setTtsStatus('generating')
    try {
      const [res1, res2] = await Promise.all([
        api.post('api/jobs', { type: 'generate_tts', experimentId, storyLabel: 'story1', targetWords: story1TargetWords }),
        api.post('api/jobs', { type: 'generate_tts', experimentId, storyLabel: 'story2', targetWords: story2TargetWords }),
      ])

      const jobId = res2.data?.data?.id || res1.data?.data?.id
      if (jobId) {
        setActiveTtsJob(jobId)
        toast.success('TTS generation started...')
      } else {
        throw new Error('Failed to queue TTS generation')
      }
    } catch (e: any) {
      setTtsStatus('error')
      const err = e?.response?.data?.error
      toast.error(typeof err === 'string' ? err : 'Failed to generate TTS')
    }
  }

  // Generate word TTS for recall test
  async function generateWordTts(regenerate = false) {
    setWordTtsLoading(true)
    try {
      const { data } = await api.post(`api/experiments/${experimentId}/word-tts`, { regenerate })
      setWordTtsItems(Array.isArray(data?.items) ? data.items : [])
      toast.success('Word audio ready')
    } catch (e: any) {
      const err = e?.response?.data?.error
      toast.error(typeof err === 'string' ? err : 'Word TTS failed')
    } finally {
      setWordTtsLoading(false)
    }
  }

  // Confirm/unconfirm stories
  async function toggleConfirmStories() {
    setConfirmLoading(true)
    try {
      const { data } = await api.post(`api/experiments/${experimentId}/confirm-stories`, {
        confirmed: !storiesConfirmed
      })
      const newConfirmedStatus = data?.storiesConfirmed || false
      setStoriesConfirmed(newConfirmedStatus)
      // Notify parent component of the change
      onStoriesConfirmed?.(newConfirmedStatus)
      if (newConfirmedStatus) {
        toast.success('Stories confirmed and locked!')
      } else {
        toast.success('Stories unlocked for editing')
      }
    } catch (e: any) {
      const err = e?.response?.data?.error
      toast.error(typeof err === 'string' ? err : 'Failed to update confirmation status')
    } finally {
      setConfirmLoading(false)
    }
  }

  const storiesReady = story1Preview?.paragraphs?.length && story2Preview?.paragraphs?.length
  const ttsReady = Boolean(story1Preview?.ttsAudioUrl && story2Preview?.ttsAudioUrl)
  const wordTtsReady = wordTtsItems.length > 0 && wordTtsItems.every(item => item.audioUrl)
  const canConfirm = storiesReady && ttsReady && wordTtsReady

  if (!experimentId) {
    return <div className="text-sm text-red-600">Missing experiment id</div>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-r from-slate-50 via-white to-blue-50 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Experiment Setup</h1>
            <p className="text-sm text-gray-500 mt-1">Configure stories with target and noise words for your spelling experiment</p>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 ${
            isLocked
              ? 'bg-amber-100 text-amber-800 border border-amber-300'
              : 'bg-gray-100 text-gray-600 border border-gray-200'
          }`}>
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            {experimentStatus !== 'draft' ? `Experiment ${experimentStatus}` : storiesConfirmed ? 'Stories Locked' : 'Draft'}
          </div>
        </div>

        {isLocked && (
          <div className={`mt-4 p-4 rounded-xl flex items-center gap-3 ${
            experimentStatus !== 'draft'
              ? 'bg-red-50 border border-red-200'
              : 'bg-amber-50 border border-amber-200'
          }`}>
            <Lock className={`w-5 h-5 ${experimentStatus !== 'draft' ? 'text-red-600' : 'text-amber-600'}`} />
            <div>
              <div className={`font-medium ${experimentStatus !== 'draft' ? 'text-red-800' : 'text-amber-800'}`}>
                {experimentStatus !== 'draft'
                  ? 'Experiment has been launched - stories cannot be edited'
                  : 'Stories are confirmed and locked for editing'}
              </div>
              {experimentStatus === 'draft' && (
                <div className="text-xs text-amber-600 mt-1">
                  Click "Unlock Stories" below to make changes
                </div>
              )}
            </div>
          </div>
        )}

        {!isLocked && (
          <div className="mt-4 bg-white/80 border border-gray-200 rounded-xl p-4 space-y-2">
            <h3 className="font-semibold text-gray-900">Word Selection Guide</h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p><strong>Target Words (10 total):</strong> 4 from current level + 4 from higher level + 2 from lower level</p>
              <p><strong>Noise Words (3 total):</strong> 1 from each level (shared between both stories)</p>
              <p><strong>Per Story:</strong> 5 target words (2 current + 2 higher + 1 lower) + 3 shared noise words</p>
            </div>
          </div>
        )}
      </div>

      {loadingInitial ? (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-2xl px-4 py-3">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : (
        <>
          {/* Word Selection */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
              <SectionHeader
                title="Word Selection"
                subtitle={`Experiment Level: ${experimentLevel}`}
              />
              <button
                onClick={fetchPool}
                disabled={loadingPool || isLocked}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingPool ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {loadingPool ? 'Loading...' : 'Fetch Word Pool'}
              </button>
            </div>

            {/* Selection Summary */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-blue-800">Story 1 Target Words</span>
                  <span className="text-sm text-blue-600">{story1TargetWords.length}/5</span>
                </div>
                <div className="text-xs text-blue-600 mb-2">2 current + 2 higher + 1 lower</div>
                <div className="flex flex-wrap gap-2">
                  {story1TargetWords.length === 0 ? (
                    <span className="text-sm text-blue-600">Select words below</span>
                  ) : (
                    story1TargetWords.map(w => (
                      <span key={w} className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full border border-blue-300">
                        {w}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-purple-800">Story 2 Target Words</span>
                  <span className="text-sm text-purple-600">{story2TargetWords.length}/5</span>
                </div>
                <div className="text-xs text-purple-600 mb-2">2 current + 2 higher + 1 lower</div>
                <div className="flex flex-wrap gap-2">
                  {story2TargetWords.length === 0 ? (
                    <span className="text-sm text-purple-600">Select words below</span>
                  ) : (
                    story2TargetWords.map(w => (
                      <span key={w} className="px-2 py-1 bg-purple-100 text-purple-700 text-sm rounded-full border border-purple-300">
                        {w}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Noise Words Summary */}
            <div className="p-4 rounded-xl bg-orange-50 border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-orange-800">Noise Words (Shared)</span>
                <span className="text-sm text-orange-600">{allNoiseWords.length}/3</span>
              </div>
              <div className="text-xs text-orange-600 mb-2">1 from each level, used in both stories</div>
              <div className="flex flex-wrap gap-2">
                {allNoiseWords.length === 0 ? (
                  <span className="text-sm text-orange-600">Select noise words below</span>
                ) : (
                  allNoiseWords.map(w => (
                    <span key={w} className="px-2 py-1 bg-orange-100 text-orange-700 text-sm rounded-full border border-orange-300">
                      {w}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Word Pool Selection */}
            {groupedWords && (
              <div className="space-y-6">
                {/* Target Words Section */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                    Target Words Selection (10 total)
                  </h4>

                  <div className="grid md:grid-cols-3 gap-4">
                    <LevelSection
                      title="Current Level"
                      levelLabel={groupedWords.current.level}
                      words={groupedWords.current.words.filter(w => !isWordSelectedElsewhere(w.word, 'targetCurrent'))}
                      selectedWords={selection.targetCurrent}
                      maxSelection={4}
                      onToggle={(word) => toggleWord(word, 'targetCurrent', 4)}
                      disabled={isLocked}
                      variant="target"
                      color="blue"
                    />

                    <LevelSection
                      title="Higher Level"
                      levelLabel={groupedWords.higher.level}
                      words={groupedWords.higher.words.filter(w => !isWordSelectedElsewhere(w.word, 'targetHigher'))}
                      selectedWords={selection.targetHigher}
                      maxSelection={4}
                      onToggle={(word) => toggleWord(word, 'targetHigher', 4)}
                      disabled={isLocked}
                      variant="target"
                      color="purple"
                    />

                    <LevelSection
                      title="Lower Level"
                      levelLabel={groupedWords.lower.level}
                      words={groupedWords.lower.words.filter(w => !isWordSelectedElsewhere(w.word, 'targetLower'))}
                      selectedWords={selection.targetLower}
                      maxSelection={2}
                      onToggle={(word) => toggleWord(word, 'targetLower', 2)}
                      disabled={isLocked}
                      variant="target"
                      color="green"
                    />
                  </div>
                </div>

                {/* Noise Words Section */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                    Noise Words Selection (3 total - shared between stories)
                  </h4>

                  <div className="grid md:grid-cols-3 gap-4">
                    <LevelSection
                      title="Current Level"
                      levelLabel={groupedWords.current.level}
                      words={groupedWords.current.words.filter(w => !isWordSelectedElsewhere(w.word, 'noiseCurrent'))}
                      selectedWords={selection.noiseCurrent}
                      maxSelection={1}
                      onToggle={(word) => toggleWord(word, 'noiseCurrent', 1)}
                      disabled={isLocked}
                      variant="noise"
                      color="orange"
                    />

                    <LevelSection
                      title="Higher Level"
                      levelLabel={groupedWords.higher.level}
                      words={groupedWords.higher.words.filter(w => !isWordSelectedElsewhere(w.word, 'noiseHigher'))}
                      selectedWords={selection.noiseHigher}
                      maxSelection={1}
                      onToggle={(word) => toggleWord(word, 'noiseHigher', 1)}
                      disabled={isLocked}
                      variant="noise"
                      color="orange"
                    />

                    <LevelSection
                      title="Lower Level"
                      levelLabel={groupedWords.lower.level}
                      words={groupedWords.lower.words.filter(w => !isWordSelectedElsewhere(w.word, 'noiseLower'))}
                      selectedWords={selection.noiseLower}
                      maxSelection={1}
                      onToggle={(word) => toggleWord(word, 'noiseLower', 1)}
                      disabled={isLocked}
                      variant="noise"
                      color="orange"
                    />
                  </div>
                </div>

                {/* Validation Status */}
                {!canGenerate && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <div className="font-medium mb-1">Complete your selection:</div>
                      <ul className="list-disc list-inside space-y-1 text-amber-700">
                        {selection.targetCurrent.length < 4 && (
                          <li>Select {4 - selection.targetCurrent.length} more target word(s) from current level</li>
                        )}
                        {selection.targetHigher.length < 4 && (
                          <li>Select {4 - selection.targetHigher.length} more target word(s) from higher level</li>
                        )}
                        {selection.targetLower.length < 2 && (
                          <li>Select {2 - selection.targetLower.length} more target word(s) from lower level</li>
                        )}
                        {selection.noiseCurrent.length < 1 && (
                          <li>Select 1 noise word from current level</li>
                        )}
                        {selection.noiseHigher.length < 1 && (
                          <li>Select 1 noise word from higher level</li>
                        )}
                        {selection.noiseLower.length < 1 && (
                          <li>Select 1 noise word from lower level</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Story Generation */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <SectionHeader title="Generate Stories" subtitle="Create both stories with the selected words" />

            {/* Generating state */}
            {storiesStatus === 'generating' && (
              <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg animate-pulse">
                <div className="relative">
                  <div className="w-8 h-8 border-4 border-blue-200 rounded-full"></div>
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                </div>
                <div>
                  <div className="font-medium text-blue-800">Generating both stories...</div>
                  <div className="text-xs text-blue-600">This may take a minute. Please wait.</div>
                </div>
              </div>
            )}

            {/* Just completed state */}
            {storiesStatus === 'success' && storiesReady && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <div className="font-medium text-green-800">Stories generated successfully!</div>
                  <div className="text-xs text-green-600">Both stories are ready. You can preview them below.</div>
                </div>
              </div>
            )}

            {/* Error state */}
            {storiesStatus === 'error' && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <div className="font-medium text-red-800">Story generation failed</div>
                  <div className="text-xs text-red-600">Please try again or select different words.</div>
                </div>
              </div>
            )}

            {/* Not generated yet state */}
            {storiesStatus === 'idle' && !storiesReady && canGenerate && (
              <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <BookOpen className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="font-medium text-gray-700">Stories not generated yet</div>
                  <div className="text-xs text-gray-500">Select your AI model and click the button below.</div>
                </div>
              </div>
            )}

            {/* Model Selection */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <label htmlFor="model-select" className="text-sm font-medium text-gray-700">
                AI Model:
              </label>
              <select
                id="model-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as 'openai' | 'claude')}
                disabled={storiesStatus === 'generating' || isLocked}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <option value="openai">OpenAI (GPT)</option>
                <option value="claude">Anthropic (Claude)</option>
              </select>
              <span className="text-xs text-gray-500">
                {selectedModel === 'openai' ? 'Uses GPT for story generation' : 'Uses Claude for story generation'}
              </span>
            </div>

            <button
              onClick={generateStories}
              disabled={!canGenerate || storiesStatus === 'generating' || isLocked}
              className={`w-full inline-flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-medium transition ${
                storiesStatus === 'generating'
                  ? 'bg-blue-600 text-white animate-pulse'
                  : isLocked
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400'
              }`}
            >
              {storiesStatus === 'generating' ? (
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : isLocked ? (
                <Lock className="w-5 h-5" />
              ) : storiesReady ? (
                <RefreshCw className="w-5 h-5" />
              ) : (
                <BookOpen className="w-5 h-5" />
              )}
              {storiesStatus === 'generating' ? 'Generating Stories...' : isLocked ? 'Stories Locked' : storiesReady ? 'Regenerate Both Stories' : 'Generate Both Stories'}
            </button>

            {/* Story Previews */}
            {storiesReady && (
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-blue-800">Story 1 (treatment)</div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {story1Preview?.paragraphs.length || 0} paragraphs
                    </span>
                  </div>
                  <div className="text-xs text-blue-600">Target: {story1TargetWords.join(', ')}</div>
                  <div className="text-sm text-gray-700 space-y-2 max-h-60 overflow-y-auto">
                    {story1Preview?.paragraphs.map((p, idx) => (
                      <p key={idx} className="leading-relaxed">
                        {highlightParagraph(p, story1TargetWords, allNoiseWords)}
                      </p>
                    ))}
                  </div>
                  {/* Word Counts */}
                  {story1Preview?.paragraphs && (
                    <div className="pt-3 border-t border-blue-200 space-y-2">
                      <div className="text-xs font-medium text-blue-700">Word Counts:</div>
                      <div className="flex flex-wrap gap-1">
                        {story1TargetWords.map(word => {
                          const counts = countWordsInParagraphs(story1Preview.paragraphs, [word])
                          return <WordCountBadge key={word} word={word} count={counts[word.toLowerCase()]} variant="target" expected={4} />
                        })}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {allNoiseWords.map(word => {
                          const counts = countWordsInParagraphs(story1Preview.paragraphs, [word])
                          return <WordCountBadge key={word} word={word} count={counts[word.toLowerCase()]} variant="noise" expected={1} />
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-purple-800">Story 2 (control)</div>
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      {story2Preview?.paragraphs.length || 0} paragraphs
                    </span>
                  </div>
                  <div className="text-xs text-purple-600">Target: {story2TargetWords.join(', ')}</div>
                  <div className="text-sm text-gray-700 space-y-2 max-h-60 overflow-y-auto">
                    {story2Preview?.paragraphs.map((p, idx) => (
                      <p key={idx} className="leading-relaxed">
                        {highlightParagraph(p, story2TargetWords, allNoiseWords)}
                      </p>
                    ))}
                  </div>
                  {/* Word Counts */}
                  {story2Preview?.paragraphs && (
                    <div className="pt-3 border-t border-purple-200 space-y-2">
                      <div className="text-xs font-medium text-purple-700">Word Counts:</div>
                      <div className="flex flex-wrap gap-1">
                        {story2TargetWords.map(word => {
                          const counts = countWordsInParagraphs(story2Preview.paragraphs, [word])
                          return <WordCountBadge key={word} word={word} count={counts[word.toLowerCase()]} variant="target" expected={4} />
                        })}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {allNoiseWords.map(word => {
                          const counts = countWordsInParagraphs(story2Preview.paragraphs, [word])
                          return <WordCountBadge key={word} word={word} count={counts[word.toLowerCase()]} variant="noise" expected={1} />
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* TTS Generation */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <SectionHeader title="Generate Story Audio" subtitle="Create TTS audio for both stories" />

            {/* Generating state */}
            {ttsStatus === 'generating' && (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg animate-pulse">
                <div className="relative">
                  <div className="w-8 h-8 border-4 border-emerald-200 rounded-full"></div>
                  <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                </div>
                <div>
                  <div className="font-medium text-emerald-800">Generating TTS audio...</div>
                  <div className="text-xs text-emerald-600">Converting stories to speech. This may take a moment.</div>
                </div>
              </div>
            )}

            {/* Just completed state */}
            {ttsStatus === 'success' && ttsReady && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <div className="font-medium text-green-800">TTS audio generated successfully!</div>
                  <div className="text-xs text-green-600">Audio is ready for both stories.</div>
                </div>
              </div>
            )}

            {/* Error state */}
            {ttsStatus === 'error' && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <div className="font-medium text-red-800">TTS generation failed</div>
                  <div className="text-xs text-red-600">Please try again.</div>
                </div>
              </div>
            )}

            {/* Not generated yet state */}
            {ttsStatus === 'idle' && !ttsReady && storiesReady && (
              <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <Volume2 className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="font-medium text-gray-700">Story audio not generated</div>
                  <div className="text-xs text-gray-500">Click the button below to generate TTS audio.</div>
                </div>
              </div>
            )}

            <button
              onClick={generateTts}
              disabled={!storiesReady || ttsStatus === 'generating' || isLocked}
              className={`w-full inline-flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-medium transition ${
                ttsStatus === 'generating'
                  ? 'bg-emerald-600 text-white animate-pulse'
                  : isLocked
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-100 disabled:text-gray-400'
              }`}
            >
              {ttsStatus === 'generating' ? (
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : isLocked ? (
                <Lock className="w-5 h-5" />
              ) : ttsReady ? (
                <RefreshCw className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
              {ttsStatus === 'generating'
                ? 'Generating Audio...'
                : isLocked
                ? 'TTS Locked'
                : ttsReady
                ? 'Regenerate Story Audio'
                : 'Generate Story Audio'}
            </button>

            {/* Audio players */}
            {ttsReady && (
              <div className="grid md:grid-cols-2 gap-4">
                {story1Preview?.ttsAudioUrl && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="text-sm font-medium text-blue-800 mb-2">Story 1 Audio</div>
                    <audio key={story1Preview.ttsAudioUrl} controls className="w-full">
                      <source src={story1Preview.ttsAudioUrl} type="audio/mpeg" />
                    </audio>
                  </div>
                )}
                {story2Preview?.ttsAudioUrl && (
                  <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                    <div className="text-sm font-medium text-purple-800 mb-2">Story 2 Audio</div>
                    <audio key={story2Preview.ttsAudioUrl} controls className="w-full">
                      <source src={story2Preview.ttsAudioUrl} type="audio/mpeg" />
                    </audio>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Word TTS for Recall Test */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <SectionHeader title="Word Audio (Recall Test)" subtitle="Individual word pronunciations for the final test" />

            {/* Generating state */}
            {wordTtsLoading && (
              <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-lg animate-pulse">
                <div className="relative">
                  <div className="w-8 h-8 border-4 border-indigo-200 rounded-full"></div>
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                </div>
                <div>
                  <div className="font-medium text-indigo-800">Generating word audio...</div>
                  <div className="text-xs text-indigo-600">Creating pronunciation files. Please wait.</div>
                </div>
              </div>
            )}

            {/* Not generated yet state */}
            {!wordTtsLoading && !wordTtsReady && storiesReady && (
              <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <Volume2 className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="font-medium text-gray-700">Word audio not generated</div>
                  <div className="text-xs text-gray-500">Click the button below to generate pronunciations for all target words.</div>
                </div>
              </div>
            )}

            <button
              onClick={() => generateWordTts(false)}
              disabled={wordTtsLoading || isLocked || !storiesReady}
              className={`w-full inline-flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-medium transition ${
                wordTtsLoading
                  ? 'bg-indigo-600 text-white animate-pulse'
                  : isLocked
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400'
              }`}
            >
              {wordTtsLoading ? (
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : isLocked ? (
                <Lock className="w-5 h-5" />
              ) : wordTtsReady ? (
                <RefreshCw className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
              {wordTtsLoading
                ? 'Generating Word Audio...'
                : isLocked
                ? 'Word Audio Locked'
                : wordTtsReady
                ? 'Regenerate Word Audio'
                : 'Generate Word Audio'}
            </button>

            {wordTtsItems.length > 0 && (
              <div className="grid md:grid-cols-2 gap-3">
                {wordTtsItems.map((item) => {
                  const audioUrl = item.audioUrl
                    ? (item.audioUrl.startsWith('http') ? item.audioUrl : `${base}${item.audioUrl}`)
                    : ''
                  const audioUrlWithCache = audioUrl ? `${audioUrl}${audioUrl.includes('?') ? '&' : '?'}t=${Date.now()}` : ''
                  return (
                    <div key={item.word} className={`p-3 rounded-lg border ${item.audioUrl ? 'bg-white border-gray-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800">{item.word}</span>
                        {item.audioUrl && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      </div>
                      {item.audioUrl ? (
                        <audio key={audioUrlWithCache} controls className="w-full">
                          <source src={audioUrlWithCache} type="audio/mpeg" />
                        </audio>
                      ) : (
                        <div className="text-xs text-red-600">{item.error || 'Audio failed'}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Confirm Stories Section */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <SectionHeader title="Confirm Stories" subtitle="Lock stories before launching experiment" />

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
              <div className="text-sm font-medium text-gray-700">Readiness Checklist:</div>
              <div className="space-y-2">
                <div className={`flex items-center gap-2 text-sm ${canGenerate ? 'text-green-700' : 'text-gray-500'}`}>
                  {canGenerate ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                  Words selected (10 target + 3 noise)
                </div>
                <div className={`flex items-center gap-2 text-sm ${storiesReady ? 'text-green-700' : 'text-gray-500'}`}>
                  {storiesReady ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                  Stories generated
                </div>
                <div className={`flex items-center gap-2 text-sm ${ttsReady ? 'text-green-700' : 'text-gray-500'}`}>
                  {ttsReady ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                  Story TTS audio generated
                </div>
                <div className={`flex items-center gap-2 text-sm ${wordTtsReady ? 'text-green-700' : 'text-gray-500'}`}>
                  {wordTtsReady ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                  Word audio generated
                </div>
              </div>
            </div>

            {experimentStatus === 'draft' && (
              <button
                onClick={toggleConfirmStories}
                disabled={confirmLoading || (!storiesConfirmed && !canConfirm)}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition ${
                  confirmLoading
                    ? 'bg-amber-100 text-amber-600 cursor-wait'
                    : storiesConfirmed
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : canConfirm
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {confirmLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : storiesConfirmed ? (
                  <Unlock className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5" />
                )}
                {confirmLoading
                  ? 'Updating...'
                  : storiesConfirmed
                  ? 'Unlock Stories for Editing'
                  : canConfirm
                  ? 'Confirm & Lock Stories'
                  : 'Complete all steps above to confirm'}
              </button>
            )}

            {storiesConfirmed && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="font-medium text-green-800">Stories Confirmed</div>
                    <div className="text-xs text-green-600">
                      {experimentStatus === 'draft'
                        ? 'Stories are ready. You can now launch the experiment from the experiment page.'
                        : 'Experiment is live. Stories cannot be modified.'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!storiesConfirmed && experimentStatus !== 'draft' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-red-600" />
                  <div>
                    <div className="font-medium text-red-800">Experiment Already Launched</div>
                    <div className="text-xs text-red-600">Stories cannot be modified after the experiment has been launched.</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
