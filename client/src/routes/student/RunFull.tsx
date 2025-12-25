import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import api from '../../lib/api'
import { logger } from '../../lib/logger'
import { toast } from '../../store/toasts'
import ErrorBoundaryComponent from '../../components/ErrorBoundary'
import { hydrateStudentSession } from '../../lib/studentSession'

// Sub-components
import StudentHeader from './components/StudentHeader'
import Sidebar from './components/Sidebar'
import StoryReader from './components/StoryReader'
import FeedbackModal from './components/FeedbackModal'

// --- Types ---
type Blank = {
  key: string
  word: string
  occurrenceIndex: number
  paragraphIndex: number
  sentenceIndex?: number
  charStart?: number
  charEnd?: number
}

type StoryPayload = {
  paragraphs?: string[]
  occurrences?: { word: string; paragraphIndex: number; sentenceIndex?: number; charStart?: number; charEnd?: number }[]
  noiseOccurrences?: { word: string; paragraphIndex: number; sentenceIndex?: number; charStart?: number; charEnd
        ?: number }[]
}

// --- Helpers ---
function splitSentences(paragraph: string) {
  const parts = paragraph
    .split(/(?<=[.!?])\s+/g)
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length ? parts : [paragraph]
}

function parseParagraph(
    paragraph: string,
    pIdx: number,
    wordCounts: Record<string, number>,
    occs: StoryPayload['occurrences'],
    noiseOccs: StoryPayload['occurrences'] = []
  ): { segments: (string | Blank)[]; blanks: Blank[] } {
    const blanks: Blank[] = []
    let segments: (string | Blank)[] = [paragraph]

    // Strategy 1: Bold markers (**word**)
    if (paragraph.includes('**')) {
      const parts = paragraph.split(/(\*\*[^*]+\*\*)/g)
      segments = []
      parts.forEach((part) => {
        const m = part.match(/^\*\*([^*]+)\*\*$/)
        if (m) {
          const word = m[1]
          const idx = (wordCounts[word] || 0) + 1
          wordCounts[word] = idx
          const blank: Blank = {
            key: `${word}-${idx}-${pIdx}-${blanks.length}`,
            word,
            occurrenceIndex: idx,
            paragraphIndex: pIdx
          }
          blanks.push(blank)
          segments.push(blank)
        } else if (part) {
          segments.push(part)
        }
      })
      return { segments, blanks }
    }

    // Strategy 2: Occurrences from backend (Explicit + Fallback Scan)
    const paraOcc = (occs || []).filter((o) => o.paragraphIndex === pIdx)
    const paraNoise = (noiseOccs || []).filter((o) => o.paragraphIndex === pIdx)

    const addBlank = (o: { word: string; sentenceIndex?: number; charStart?: number; charEnd?: number }) => {
      const idx = (wordCounts[o.word] || 0) + 1
      wordCounts[o.word] = idx
      const blank: Blank = {
        key: `${o.word}-${idx}-${pIdx}-${blanks.length}`,
        word: o.word,
        occurrenceIndex: idx,
        paragraphIndex: pIdx,
        sentenceIndex: o.sentenceIndex,
        charStart: o.charStart,
        charEnd: o.charEnd,
      }

      let inserted = false
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        if (typeof seg !== 'string') continue
        const pos = seg.toLowerCase().indexOf(o.word.toLowerCase())
        if (pos >= 0) {
          const before = seg.slice(0, pos)
          const after = seg.slice(pos + o.word.length)
          segments.splice(i, 1, before, blank, after)
          blanks.push(blank)
          inserted = true
          break
        }
      }
      if (!inserted) {
        wordCounts[o.word] = idx // keep counter to avoid reusing keys
      }
    }

    paraOcc.forEach(addBlank)
    paraNoise.forEach(addBlank)

    segments = segments.filter(s => typeof s !== 'string' || s.length > 0)
    return { segments, blanks }
  }

function Confetti() {
  const pieces = useMemo(() =>
    Array.from({ length: 30 }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 1.5,
      duration: 3 + Math.random() * 2,
      color: ['#6366f1', '#ec4899', '#f97316', '#10b981'][Math.floor(Math.random() * 4)],
    })), [])

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-40">
      {pieces.map((piece, idx) => (
        <span
          key={idx}
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            background: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function RunFullWrapper() {
  return (
    <ErrorBoundaryComponent>
      <RunFull />
    </ErrorBoundaryComponent>
  )
}

function RunFull() {
  hydrateStudentSession()
  const expId = sessionStorage.getItem('exp.experimentId') || sessionStorage.getItem('sessionId') || ''
  const assignmentId = sessionStorage.getItem('assignmentId') || ''
  const rawCondition = sessionStorage.getItem('exp.condition') || 'with_hints'
  const condition = (rawCondition.replace('_', '-') as 'with-hints'|'without-hints')
  const storyOrder = (sessionStorage.getItem('exp.storyOrder') || 'A-first') as 'A-first' | 'B-first'
  const hintsByStory = (() => {
    try { return JSON.parse(sessionStorage.getItem('exp.hintsEnabledByStory') || 'null') as { A: boolean; B: boolean } | null } catch { return null }
  })()
  
  const story1 = JSON.parse(sessionStorage.getItem('exp.story1') || '{}') as StoryPayload
  const story2 = JSON.parse(sessionStorage.getItem('exp.story2') || '{}') as StoryPayload
  const tts1Segments = JSON.parse(sessionStorage.getItem('exp.tts1Segments') || '[]')
  const tts2Segments = JSON.parse(sessionStorage.getItem('exp.tts2Segments') || '[]')
  const tts1 = sessionStorage.getItem('exp.tts1') || ''
  const tts2 = sessionStorage.getItem('exp.tts2') || ''

  if (!expId && !assignmentId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg text-center space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">Session not found</h2>
          <p className="text-gray-600 text-sm">Please re-enter your join code to continue.</p>
          <a href="/student" className="btn primary px-4 py-2 inline-flex justify-center">Go to join page</a>
        </div>
      </div>
    )
  }

  const [storyIndex, setStoryIndex] = useState(0)
  
  const [blanksState, setBlanksState] = useState<
    Record<string, { value: string; correct: boolean; feedback: string; letterFeedback?: Array<boolean | null> }>
  >({})
  const [locked, setLocked] = useState<Record<string, boolean>>({})
  const [hints, setHints] = useState<Record<string, { used: number; text: string }>>({})
  const [attemptsByWord, setAttemptsByWord] = useState<Record<string, number>>({})
  const [timeByWordMs, setTimeByWordMs] = useState<Record<string, number>>({})
  
  const [activeBlankKey, setActiveBlankKey] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [activeHintWord, setActiveHintWord] = useState<string | null>(null)
  const [feedbackData, setFeedbackData] = useState({ difficulty: 3, enjoyment: 3, comment: '', effort: 'medium' })
  const [submitting, setSubmitting] = useState(false)
  const [autoAdvance, setAutoAdvance] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [breakUntil, setBreakUntil] = useState<string | null>(() => sessionStorage.getItem('exp.breakUntil'))
  const [now, setNow] = useState(Date.now())
  const wordTimerRef = useRef<Record<string, number>>({})

  const audioRef = useRef<HTMLAudioElement>(null)
  const sentenceAudioRef = useRef<HTMLAudioElement>(null)
  const [currentSentenceId, setCurrentSentenceId] = useState<string | null>(null)
  const base = import.meta.env.VITE_API_BASE_URL || ''

  const storySequence = storyOrder === 'B-first' ? (['B', 'A'] as const) : (['A', 'B'] as const)
  const storyByLabel = { A: story1, B: story2 } as const
  const segmentsByLabel = { A: tts1Segments, B: tts2Segments } as const
  const ttsByLabel = { A: tts1, B: tts2 } as const
  const currentStoryLabel = storySequence[storyIndex]
  const currentStory = storyByLabel[currentStoryLabel]
  const currentSegments = segmentsByLabel[currentStoryLabel]
  const currentTts = ttsByLabel[currentStoryLabel]
  const targetWordsAll = useMemo(() => {
    const map = new Map<string, number>()
    ;(currentStory.occurrences || []).forEach(o => map.set(o.word, 1))
    return Array.from(map.keys())
  }, [currentStory])

  const clientNoise = useMemo(() => {
    const explicit = (currentStory as any).noiseOccurrences || []
    if (explicit.length) return explicit
    const targets = new Set((currentStory.occurrences || []).map(o => (o.word || '').toLowerCase()))
    const out: any[] = []
    const targetByParagraph = new Map<number, { sentenceIndex?: number; charStart?: number; charEnd?: number }[]>()
    ;(currentStory.occurrences || []).forEach(o => {
      const list = targetByParagraph.get(o.paragraphIndex) || []
      list.push({ sentenceIndex: o.sentenceIndex, charStart: o.charStart, charEnd: o.charEnd })
      targetByParagraph.set(o.paragraphIndex, list)
    })
    ;(currentStory.paragraphs || []).forEach((p, pIdx) => {
      const tokens = p.split(/\b/)
      const candidates: { word: string; start: number; end: number; sentenceIndex: number }[] = []
      let cursor = 0
      const sentences = splitSentences(p)
      const sentenceIndexAt = (charPos: number) => {
        let cumulative = 0
        for (let si = 0; si < sentences.length; si++) {
          const len = sentences[si].length + 1
          if (charPos < cumulative + len) return si
          cumulative += len
        }
        return Math.max(0, sentences.length - 1)
      }
      const targetList = targetByParagraph.get(pIdx) || []
      const targetSentenceSet = new Set(targetList.map(t => t.sentenceIndex).filter(v => typeof v === 'number') as number[])
      const isAdjacentToTarget = (start: number, end: number) => {
        for (const t of targetList) {
          if (typeof t.charStart !== 'number' || typeof t.charEnd !== 'number') continue
          if (end <= t.charStart) {
            const between = p.slice(end, t.charStart)
            if (between.length <= 3 && !/[A-Za-z]/.test(between)) return true
          }
          if (t.charEnd <= start) {
            const between = p.slice(t.charEnd, start)
            if (between.length <= 3 && !/[A-Za-z]/.test(between)) return true
          }
        }
        return false
      }
      tokens.forEach(tok => {
        if (/^[A-Za-z]{4,}$/.test(tok) && !targets.has(tok.toLowerCase())) {
          const start = cursor
          const end = cursor + tok.length
          candidates.push({ word: tok, start, end, sentenceIndex: sentenceIndexAt(start) })
        }
        cursor += tok.length
      })
      const picks: typeof candidates = []
      const poolBySentence = candidates.filter(c => !targetSentenceSet.has(c.sentenceIndex))
      const basePool = poolBySentence.length ? poolBySentence : candidates
      const pool = basePool.filter(c => !isAdjacentToTarget(c.start, c.end))
      while (pool.length && picks.length < 3) {
        const idx = Math.floor(Math.random() * pool.length)
        picks.push(pool.splice(idx, 1)[0])
      }
      picks.slice(0, 3).forEach((pick) => {
        out.push({ word: pick.word, paragraphIndex: pIdx, sentenceIndex: pick.sentenceIndex, charStart: pick.start, charEnd: pick.end })
      })
    })
    return out
  }, [currentStory])

  const parsedStory = useMemo(() => {
    const wordCounts: Record<string, number> = {}
    return (currentStory.paragraphs || []).map((p, pIdx) =>
      parseParagraph(
        p,
        pIdx,
        wordCounts,
        currentStory.occurrences || [],
        (currentStory as any).noiseOccurrences?.length ? (currentStory as any).noiseOccurrences : clientNoise
      )
    )
  }, [currentStory, clientNoise])

  const allBlanks = useMemo(() => 
    parsedStory.flatMap(p => p.blanks), 
    [parsedStory]
  )
  const activeBlank = useMemo(() => allBlanks.find(b => b.key === activeBlankKey) || null, [allBlanks, activeBlankKey])
  const hintsEnabled = hintsByStory ? !!hintsByStory[currentStoryLabel] : condition === 'with-hints'
  const hintsAllowed = hintsEnabled && (!activeBlank || activeBlank.occurrenceIndex < 5)
  const hintsMessage = !hintsEnabled
    ? 'Hints are disabled for this session.'
    : activeBlank && activeBlank.occurrenceIndex >= 5
      ? 'Hints disabled for the 5th occurrence.'
      : ''

  const sentenceClips = useMemo(() => {
    const clips: any[] = []
    let globalIndex = 0
    ;(currentStory.paragraphs || []).forEach((p, pIdx) => {
      const sentences = splitSentences(p)
      sentences.forEach((_, sIdx) => {
        clips.push({
          id: `${storyIndex}-${pIdx}-${sIdx}`,
          paragraphIndex: pIdx,
          sentenceIndex: sIdx,
          globalIndex: globalIndex
        })
        globalIndex++
      })
    })
    return clips
  }, [currentStory, storyIndex])

  const solvedCount = allBlanks.filter(b => locked[b.key]).length
  const totalBlanks = allBlanks.length
  const progressPct = totalBlanks ? (solvedCount / totalBlanks) * 100 : 0
  const isStoryComplete = solvedCount === totalBlanks && totalBlanks > 0
  const [currentParagraph, setCurrentParagraph] = useState(0)
  const [readMode, setReadMode] = useState(false)
  const [showDefine, setShowDefine] = useState(false)
  const [definitionDrafts, setDefinitionDrafts] = useState<Record<string, string>>({})
  const [definitionResults, setDefinitionResults] = useState<Array<{ word: string; correct: boolean | null; feedback: string }> | null>(null)
  const [showDefinitionFeedback, setShowDefinitionFeedback] = useState(false)
  const [pendingDefinePara, setPendingDefinePara] = useState<number | null>(null)
  const [definitionDoneByKey, setDefinitionDoneByKey] = useState<Record<string, boolean>>({})
  const definitionKey = (para: number) => `${storyIndex}-${para}`
  const definitionWordsForPara = (para: number) => {
    const targetOcc = (currentStory.occurrences || []).filter(o => o.paragraphIndex === para)
    const noiseOcc = ((currentStory as any).noiseOccurrences?.length
      ? (currentStory as any).noiseOccurrences
      : clientNoise
    ).filter((o: any) => o.paragraphIndex === para)
    const seen = new Set<string>()
    const out: string[] = []
    ;[...targetOcc, ...noiseOcc].forEach((o: any) => {
      const w = (o.word || '').toString()
      const key = w.toLowerCase()
      if (!key || seen.has(key)) return
      seen.add(key)
      out.push(w)
    })
    return out
  }

  const displayParagraphs = currentStory.paragraphs || []
  const displayStory = { ...currentStory, paragraphs: displayParagraphs }
  const displayParsedStory = parsedStory
  const visibleBlanks = allBlanks.filter(b => b.paragraphIndex === currentParagraph)
  const visibleClips = sentenceClips.filter(c => c.paragraphIndex === currentParagraph)

  useEffect(() => {
    if (audioRef.current && currentTts) {
      const src = currentTts.startsWith('http') ? currentTts : `${base}${currentTts}`
      const path = audioRef.current.src.split(window.location.origin)[1] || audioRef.current.src
      if (!path.includes(currentTts)) {
        audioRef.current.src = src
        audioRef.current.load()
      }
    }
  }, [currentTts, base])

  useEffect(() => {
    if (!breakUntil) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [breakUntil])

  useEffect(() => {
    if (!breakUntil) return
    if (Date.now() >= new Date(breakUntil).getTime()) {
      sessionStorage.removeItem('exp.breakUntil')
      setBreakUntil(null)
    }
  }, [breakUntil, now])

  useEffect(() => {
    if (showDefine) {
      setDefinitionDrafts({})
    }
  }, [showDefine, pendingDefinePara, currentStoryLabel])

  useEffect(() => {
    if (isStoryComplete) {
      setShowConfetti(true)
      const timer = setTimeout(() => setShowConfetti(false), 3500)
      return () => {
        clearTimeout(timer)
      }
    }
  }, [isStoryComplete])

  function softPause() {
    // Pause BOTH audios
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
    if (sentenceAudioRef.current && !sentenceAudioRef.current.paused) {
      sentenceAudioRef.current.pause()
    }
    setAutoAdvance(false)
  }

  function softResume(useSentenceAudio = false) {
    // Resume appropriate audio
    if (useSentenceAudio && sentenceAudioRef.current) {
       // If we were playing sentence audio, resume it? 
       // Actually sentence audio usually starts from 0.
       // But if we paused mid-sentence, we might want to resume.
       sentenceAudioRef.current.play().catch(() => {})
    } else if (audioRef.current) {
       audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 1.5)
       audioRef.current.play().catch(() => {})
       setIsPlaying(true)
    }
  }

  function restartStory(targetIndex: number) {
    softPause()
    setBlanksState({})
    setLocked({})
    setHints({})
    setAttemptsByWord({})
    setTimeByWordMs({})
    wordTimerRef.current = {}
    setStreak(0)
    setActiveBlankKey(null)
    setActiveHintWord(null)
    setCurrentSentenceId(null)
    setShowDefine(false)
    setDefinitionDrafts({})
    setDefinitionResults(null)
    setShowDefinitionFeedback(false)
    setPendingDefinePara(null)
    setShowFeedback(false)
    setShowConfetti(false)
    window.scrollTo(0, 0)
    setStoryIndex(targetIndex)
  }

  function playSentence(pIdx: number, sIdx: number, autoContinue = false) {
    const clip = sentenceClips.find(c => c.paragraphIndex === pIdx && c.sentenceIndex === sIdx)
    if (!clip) return

    // Pause main audio when playing a sentence clip
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }

    if (sentenceAudioRef.current) {
      // Prefer precomputed segment URL; fallback to deterministic per-sentence file
      const segUrl = currentSegments[clip.globalIndex]
      const fallbackLabel = currentStoryLabel === 'A' ? 'H' : 'N'
      // Backend naming convention: {label}_s{globalIndex}.mp3
      const fallbackPath = `/static/audio/${expId}/${fallbackLabel}_s${clip.globalIndex}.mp3`
      const chosen = segUrl || fallbackPath
      const src = chosen.startsWith('http') ? chosen : `${base}${chosen}`

      sentenceAudioRef.current.src = src
      sentenceAudioRef.current.currentTime = 0
      sentenceAudioRef.current.onerror = () => {
        toast.error('Sentence audio is unavailable. Please regenerate TTS or try again.')
        setCurrentSentenceId(null)
      }

      sentenceAudioRef.current.play().catch(e => logger.error('Segment play error', e))
      setCurrentSentenceId(clip.id)
      setAutoAdvance(autoContinue)
      
      sentenceAudioRef.current.onended = () => {
        setCurrentSentenceId(null)
        if (autoContinue) {
           const nextIndex = clip.globalIndex + 1
           if (nextIndex < sentenceClips.length) {
             const nextClip = sentenceClips[nextIndex]
             playSentence(nextClip.paragraphIndex, nextClip.sentenceIndex, true)
           } else {
             setAutoAdvance(false)
           }
        }
      }
    }
  }

  function playParagraph(pIdx: number) {
    const clips = sentenceClips.filter(c => c.paragraphIndex === pIdx)
    if (!clips.length || !sentenceAudioRef.current) return
    const baseUrl = base
    let idx = 0

    // Pause main audio when playing paragraph
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
    setIsPlaying(true)

    const playNext = () => {
      const clip = clips[idx]
      if (!clip) {
        setCurrentSentenceId(null)
        setIsPlaying(false)
        return
      }
      const segUrl = currentSegments[clip.globalIndex]
      const fallbackLabel = currentStoryLabel === 'A' ? 'H' : 'N'
      const fallbackPath = `/static/audio/${expId}/${fallbackLabel}_s${clip.globalIndex}.mp3`
      const chosen = segUrl || fallbackPath
      const src = chosen.startsWith('http') ? chosen : `${baseUrl}${chosen}`

      sentenceAudioRef.current!.src = src
      sentenceAudioRef.current!.currentTime = 0
      sentenceAudioRef.current!.onerror = () => {
        toast.error('Paragraph audio is unavailable. Please regenerate TTS or try again.')
        setCurrentSentenceId(null)
        setIsPlaying(false)
      }
      sentenceAudioRef.current!.onended = () => {
        idx += 1
        playNext()
      }
      setCurrentSentenceId(clip.id)
      sentenceAudioRef.current!.play().catch(() => {})
    }

    playNext()
  }

  function focusNextBlank(currentKey?: string) {
    const currentIndex = currentKey ? allBlanks.findIndex(b => b.key === currentKey) : -1
    let nextIndex = -1
    for (let i = currentIndex + 1; i < allBlanks.length; i++) {
      if (!locked[allBlanks[i].key]) { nextIndex = i; break }
    }
    if (nextIndex === -1) {
      for (let i = 0; i < currentIndex; i++) {
        if (!locked[allBlanks[i].key]) { nextIndex = i; break }
      }
    }
    if (nextIndex !== -1) {
      const nextKey = allBlanks[nextIndex].key
      const el = document.getElementById(`blank-${nextKey}-0`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => el.focus(), 50)
      }
    }
  }

  function startWordTimer(word: string) {
    if (!word) return
    if (!wordTimerRef.current[word]) {
      wordTimerRef.current[word] = Date.now()
    }
  }

  function stopWordTimer(word: string) {
    if (!word) return
    const start = wordTimerRef.current[word]
    if (!start) return
    const delta = Date.now() - start
    delete wordTimerRef.current[word]
    if (delta > 0) {
      setTimeByWordMs(prev => ({ ...prev, [word]: (prev[word] || 0) + delta }))
    }
  }

  function buildLetterFeedback(value: string, target: string) {
    const out: Array<boolean | null> = []
    const len = target.length
    for (let i = 0; i < len; i++) {
      const v = value[i]
      if (!v) {
        out.push(null)
      } else {
        out.push(v.toLowerCase() === target[i]?.toLowerCase())
      }
    }
    return out
  }

  async function checkBlank(blank: Blank, attempt: string) {
    const val = attempt.trim()
    if (!val) { toast.error('Please type something'); return }
    setAttemptsByWord(prev => ({ ...prev, [blank.word]: (prev[blank.word] || 0) + 1 }))
    const isCorrect = val.toLowerCase() === blank.word.toLowerCase()
    const feedbackText = blank.occurrenceIndex >= 5 ? '' : (isCorrect ? 'Correct!' : 'Try again')
    const letterFeedback = blank.paragraphIndex === 4 ? undefined : buildLetterFeedback(val, blank.word)
    setBlanksState(prev => ({
      ...prev,
      [blank.key]: { value: val, correct: isCorrect, feedback: feedbackText, letterFeedback }
    }))
    if (isCorrect) {
      setLocked(prev => ({ ...prev, [blank.key]: true }))
      stopWordTimer(blank.word)
      toast.success('Correct!')
      setStreak(s => s + 1)
      setMaxStreak(m => Math.max(m, streak + 1))
      
      focusNextBlank(blank.key)
      api
        .post('/api/student/attempt', {
          experimentId: expId,
          word: blank.word,
          attempt: val,
          correct: true,
          story: currentStoryLabel,
          occurrenceIndex: blank.occurrenceIndex,
        })
        .catch(e => logger.error('Failed to submit attempt', e))
    } else {
      setStreak(0)
      softPause()
      toast.error('Try again')
      api
        .post('/api/student/attempt', {
          experimentId: expId,
          word: blank.word,
          attempt: val,
          correct: false,
          story: currentStoryLabel,
          occurrenceIndex: blank.occurrenceIndex,
        })
        .catch(e => logger.error('Failed to submit attempt', e))
    }
  }

  async function getHint(blankOverride?: Blank) {
    const active = blankOverride || allBlanks.find(b => b.key === activeBlankKey)
    const targetWord = active?.word || activeHintWord
    if (!targetWord) return
    if (active && active.occurrenceIndex >= 5) {
      toast.error('Hints are disabled for the 5th occurrence.')
      return
    }
    const used = hints[targetWord]?.used || 0
    const fallbackHint = 'Focus on the spelling pattern and sound. Check vowels and length.'
    try {
      const { data } = await api.post('/api/student/hint', {
        experimentId: expId,
        targetWord: targetWord,
        occurrenceIndex: active?.occurrenceIndex,
        abCondition: hintsEnabled ? 'with-hints' : 'without-hints',
        attemptCount: attemptsByWord[targetWord] || 0,
        timeSpentMs: timeByWordMs[targetWord] || 0,
        latestAttempt: active ? (blanksState[active.key]?.value || '') : ''
      })
      setHints(prev => ({
        ...prev,
        [targetWord]: { used: used + 1, text: data?.hint || fallbackHint }
      }))
    } catch (e) {
      setHints(prev => ({ ...prev, [targetWord]: { used: used + 1, text: fallbackHint } }))
      toast.error('Hint service unavailable, showing a basic hint.')
    }
  }
  async function submitFeedback() {
    try {
      const feedbackRes = await api.post('/api/student/feedback', {
        experimentId: expId,
        storyKey: currentStoryLabel,
        condition: hintsEnabled ? 'with-hints' : 'without-hints',
        storyIndex,
        ...feedbackData
      })
      if (storyIndex === 0) {
        sessionStorage.setItem('exp.story1Complete', 'true')
        const breakUntil = feedbackRes?.data?.breakUntil || new Date(Date.now() + 5 * 60 * 1000).toISOString()
        sessionStorage.setItem('exp.breakUntil', breakUntil)
        setBreakUntil(breakUntil)
        restartStory(1)
      } else {
        sessionStorage.setItem('exp.story2Complete', 'true')
        setSubmitting(true)
        try {
          await api.post('/api/student/submit', { experimentId: expId, totalCorrect: solvedCount, totalAttempts: 0 })
        } catch {}
        toast.success('Stories complete! Moving to recall test...')
        setTimeout(() => window.location.href = '/student/test', 1200)
      }
    } catch (e) { toast.error('Failed to save progress'); setSubmitting(false) }
  }

  const breakRemainingMs = breakUntil ? new Date(breakUntil).getTime() - now : 0
  const breakActive = storyIndex === 1 && !!breakUntil && breakRemainingMs > 0
  const breakSeconds = Math.max(0, Math.ceil(breakRemainingMs / 1000))
  const breakMin = Math.floor(breakSeconds / 60)
  const breakSec = breakSeconds % 60

  async function submitDefinitions() {
    try {
      const targetPara = pendingDefinePara ?? currentParagraph
      const definitionWords = definitionWordsForPara(targetPara)
      if (definitionWords.length === 0) {
        setDefinitionDoneByKey(prev => ({ ...prev, [definitionKey(targetPara)]: true }))
        setDefinitionDrafts({})
        setShowDefine(false)
        setPendingDefinePara(null)
        setCurrentParagraph(targetPara)
        return
      }
      const { data } = await api.post('/api/student/define', {
        experimentId: expId,
        storyLabel: currentStoryLabel,
        paragraphIndex: targetPara,
        answers: definitionWords.map(w => ({ word: w, definition: definitionDrafts[w] || '' }))
      })
      setDefinitionDoneByKey(prev => ({ ...prev, [definitionKey(targetPara)]: true }))
      setDefinitionDrafts({})
      if (targetPara < 4) {
        setShowDefine(false)
        setPendingDefinePara(null)
        setCurrentParagraph(targetPara)
        return
      }
      const results = Array.isArray(data?.results) ? data.results : []
      setDefinitionResults(results)
      setShowDefine(false)
      setShowDefinitionFeedback(true)
    } catch {
      toast.error('Could not submit definitions')
    }
  }

  if (showDefine) {
    const targetPara = pendingDefinePara ?? currentParagraph
    const definitionWords = definitionWordsForPara(targetPara)
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-800">Definitions</h2>
            <p className="text-sm text-gray-600">
              Paragraph {targetPara + 1}: write a short definition for each word.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
            {definitionWords.map((w) => (
              <div key={w} className="space-y-2">
                <label className="text-sm font-semibold text-gray-800">{w}</label>
                <textarea
                  className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  value={definitionDrafts[w] || ''}
                  onChange={e => setDefinitionDrafts(d => ({ ...d, [w]: e.target.value }))}
                  placeholder="Your definition"
                />
              </div>
            ))}
            {definitionWords.length === 0 && (
              <div className="text-sm text-gray-600">No words found for this paragraph.</div>
            )}
            <button onClick={submitDefinitions} className="w-full btn primary">
              Submit definitions
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (showDefinitionFeedback) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-800">Definition feedback</h2>
            <p className="text-sm text-gray-600">Scores are shown after the final definitions.</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
            {(definitionResults || []).map((r) => (
              <div key={r.word} className="border rounded-lg p-3">
                <div className="font-semibold text-gray-800">{r.word}</div>
                <div className={`text-sm ${r.correct ? 'text-green-700' : r.correct === false ? 'text-red-700' : 'text-gray-600'}`}>
                  {r.feedback || 'No feedback available.'}
                </div>
              </div>
            ))}
            {(!definitionResults || definitionResults.length === 0) && (
              <div className="text-sm text-gray-600">Feedback unavailable.</div>
            )}
            <button
              onClick={() => { setShowDefinitionFeedback(false); setShowFeedback(true); }}
              className="w-full btn primary"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (breakActive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-amber-50 via-white to-rose-50">
        <div className="bg-white border border-amber-200 rounded-2xl shadow-xl p-8 max-w-lg w-full text-center space-y-4">
          <h2 className="text-2xl font-bold text-amber-700">Break Time</h2>
          <p className="text-gray-600">Take a 5-minute break before starting Story 2.</p>
          <div className="text-4xl font-bold text-gray-800">
            {String(breakMin).padStart(2, '0')}:{String(breakSec).padStart(2, '0')}
          </div>
          <div className="text-xs text-gray-500">Recall test unlocks after the break.</div>
          <button
            className="btn primary w-full"
            disabled={breakRemainingMs > 0}
            onClick={() => {
              sessionStorage.removeItem('exp.breakUntil')
              setBreakUntil(null)
            }}
          >
            Start Story 2
          </button>
        </div>
      </div>
    )
  }

  const renderBlankInput = (blank: Blank) => {
    const state = blanksState[blank.key] || { value: '', correct: false, feedback: '' }
    const isLocked = locked[blank.key]
    const length = blank.word.length
    const letterFeedback = state.letterFeedback || []
    const feedbackEnabled = blank.paragraphIndex !== 4
    const letters = Array.from({ length }, (_, i) => state.value[i] || '')
    const blankHintsAllowed = hintsEnabled && blank.occurrenceIndex < 5

    const updateLetters = (nextLetters: string[]) => {
      setBlanksState(prev => ({
        ...prev,
        [blank.key]: { ...state, value: nextLetters.join(''), feedback: '', letterFeedback: undefined }
      }))
    }

    const handleLetterChange = (index: number, value: string) => {
      const clean = value.slice(-1)
      if (value.length > 1) {
        const clipped = value.slice(0, length).split('')
        const nextLetters = Array.from({ length }, (_, i) => clipped[i] || '')
        updateLetters(nextLetters)
        const lastId = `blank-${blank.key}-${Math.min(length - 1, clipped.length - 1)}`
        const lastEl = document.getElementById(lastId)
        if (lastEl) lastEl.focus()
        return
      }
      const nextLetters = [...letters]
      nextLetters[index] = clean
      updateLetters(nextLetters)
      if (clean && index < length - 1) {
        const nextEl = document.getElementById(`blank-${blank.key}-${index + 1}`)
        if (nextEl) nextEl.focus()
      }
    }

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        checkBlank(blank, state.value)
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        focusNextBlank(blank.key)
        return
      }
      if (e.key === 'Backspace' && !letters[index] && index > 0) {
        const prevEl = document.getElementById(`blank-${blank.key}-${index - 1}`)
        if (prevEl) prevEl.focus()
      }
      if (e.key === 'ArrowLeft' && index > 0) {
        const prevEl = document.getElementById(`blank-${blank.key}-${index - 1}`)
        if (prevEl) prevEl.focus()
      }
      if (e.key === 'ArrowRight' && index < length - 1) {
        const nextEl = document.getElementById(`blank-${blank.key}-${index + 1}`)
        if (nextEl) nextEl.focus()
      }
    }

    return (
      <span
        key={blank.key}
        className="inline-flex items-center gap-1 mx-1 relative"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onFocusCapture={() => {
          setActiveBlankKey(blank.key)
          setActiveHintWord(blank.word)
          startWordTimer(blank.word)
        }}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) stopWordTimer(blank.word)
        }}
      >
        <span className="inline-flex items-center gap-1">
          {letters.map((letter, i) => {
            const status = feedbackEnabled ? letterFeedback[i] : undefined
            const baseClass = isLocked
              ? 'border-green-500 text-green-700 bg-green-50'
              : status === true
                ? 'border-green-500 text-green-700 bg-green-50'
                : status === false
                  ? 'border-red-500 text-red-700 bg-red-50'
                  : 'border-purple-300 text-gray-700 bg-purple-50/50'
            return (
              <input
                key={`${blank.key}-${i}`}
                id={`blank-${blank.key}-${i}`}
                type="text"
                inputMode="text"
                autoComplete="off"
                maxLength={1}
                value={letter}
                disabled={isLocked}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleLetterChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={`w-8 h-10 border rounded-md text-center font-bold text-lg outline-none transition-all ${baseClass}`}
              />
            )
          })}
        </span>
        <div className="flex items-center gap-1 ml-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); checkBlank(blank, state.value) }}
            disabled={isLocked}
            className={`px-2 py-1 text-xs font-semibold rounded border transition ${isLocked ? 'border-green-300 text-green-600 bg-green-50' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            Check
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); getHint(blank) }}
            disabled={!blankHintsAllowed}
            className={`px-2 py-1 text-xs font-semibold rounded border transition ${blankHintsAllowed ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'}`}
          >
            Hint
          </button>
        </div>
        {isLocked && <span className="absolute -top-3 -right-2 text-green-500 text-xs">OK</span>}
      </span>
    )
  }
  return (
    <div className="transition-colors duration-300 min-h-screen bg-gray-50 pb-20">
      <StudentHeader
        storyIndex={storyIndex}
        solvedCount={solvedCount}
        totalBlanks={totalBlanks}
        progressPct={progressPct}
        isPlaying={isPlaying} // Pass isPlaying state
        onTogglePlay={() => { // Pass the handler
           if (sentenceAudioRef.current && !sentenceAudioRef.current.paused) {
             sentenceAudioRef.current.pause()
             setIsPlaying(false)
             return
           }
           if (audioRef.current && !audioRef.current.paused) {
             audioRef.current.pause()
           }
           playParagraph(currentParagraph)
        }}
        onSkip={(secs) => { if(sentenceAudioRef.current) sentenceAudioRef.current.currentTime += secs }}
        isStoryComplete={isStoryComplete}
        readMode={readMode}
        onToggleReadMode={() => setReadMode((v) => !v)}
      />

      <div className="container mx-auto px-4 py-8 grid lg:grid-cols-4 gap-8">
        <div className={`${readMode ? 'lg:col-span-4' : 'lg:col-span-3'} flex items-center justify-between mb-2`}>
          <div className="space-x-2">
            <button className="btn" onClick={() => setCurrentParagraph(p => Math.max(0, p-1))} disabled={currentParagraph === 0}>Previous paragraph</button>
            <button
              className="btn primary"
              onClick={() => {
                const next = currentParagraph + 1
                if (next >= 5) return
                if (next >= 1 && next <= 3 && !definitionDoneByKey[definitionKey(next)]) {
                  setPendingDefinePara(next)
                  setShowDefine(true)
                  return
                }
                setCurrentParagraph(next)
              }}
              disabled={currentParagraph >= 4}
            >
              Next paragraph
            </button>
            {currentParagraph === 4 && (
              <button
                className="btn primary"
                onClick={() => { setPendingDefinePara(4); setShowDefine(true) }}
                disabled={!isStoryComplete || !!definitionDoneByKey[definitionKey(4)]}
              >
                Submit story
              </button>
            )}
          </div>
          <div className="text-sm text-gray-600">Paragraph {currentParagraph + 1} / 5</div>
        </div>

        <StoryReader
          parsedStory={displayParsedStory}
          allBlanks={visibleBlanks}
          currentStory={displayStory}
          activeParagraph={currentParagraph}
          sentenceClips={visibleClips}
          currentSentenceId={currentSentenceId}
          storyIndex={storyIndex}
          isStoryComplete={isStoryComplete}
          onPlaySentence={playSentence}
          onShowFeedback={() => {
            if (!definitionDoneByKey[definitionKey(4)]) {
              setPendingDefinePara(4)
              setShowDefine(true)
            } else {
              setShowFeedback(true)
            }
          }}
          onGoToStory={restartStory} // Pass the restartStory handler
          renderBlank={renderBlankInput}
          splitSentences={splitSentences}
          readMode={readMode}
        />

        {!readMode && (
          <Sidebar
            label={hintsEnabled ? 'H' : 'N'}
            streak={streak}
            activeBlankKey={activeBlankKey}
            activeHintWord={activeHintWord}
            hints={hints}
            hintsAllowed={hintsAllowed}
            hintsMessage={hintsMessage}
            sentenceClips={visibleClips}
            currentSentenceId={currentSentenceId}
            onGetHint={() => getHint()}
            onPlaySentence={playSentence}
          />
        )}
      </div>

      {showFeedback && (
        <FeedbackModal
          feedbackData={feedbackData}
          setFeedbackData={setFeedbackData}
          submitFeedback={submitFeedback}
          submitting={submitting}
          storyIndex={storyIndex}
        />
      )}

      {showConfetti && <Confetti />}
      
      <audio ref={audioRef} className="hidden" onEnded={() => setIsPlaying(false)} />
      <audio ref={sentenceAudioRef} className="hidden" />
    </div>
  )
}
