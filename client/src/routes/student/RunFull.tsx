import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../../lib/api'
import { logger } from '../../lib/logger'
import { toast } from '../../store/toasts'
import ErrorBoundaryComponent from '../../components/ErrorBoundary'
import { hydrateStudentSession } from '../../lib/studentSession'
import { useIntervention, type WordMetadata } from '../../store/intervention'

// Types and utilities
import type { Blank, StoryPayload, BlankState, SentenceClip } from './types'
import { splitSentences, parseParagraph, buildLetterFeedback } from './utils'

// Sub-components
import StudentHeader from './components/StudentHeader'
import Sidebar from './components/Sidebar'
import StoryReader from './components/StoryReader'
import FeedbackModal from './components/FeedbackModal'
import Confetti from './components/Confetti'
import MentalEffortView from './components/MentalEffortView'
import BreakTimeView from './components/BreakTimeView'
import BlankInput from './components/BlankInput'
import CorrectAnswerModal from './components/CorrectAnswerModal'
import InterventionPopup from './components/InterventionPopup'

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
  const condition = rawCondition.replace('_', '-') as 'with-hints' | 'without-hints'
  const storyOrder = (sessionStorage.getItem('exp.storyOrder') || 'A-first') as 'A-first' | 'B-first'
  const hintsByStory = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('exp.hintsEnabledByStory') || 'null') as {
        A: boolean
        B: boolean
      } | null
    } catch {
      return null
    }
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
          <a href="/student" className="btn primary px-4 py-2 inline-flex justify-center">
            Go to join page
          </a>
        </div>
      </div>
    )
  }

  const [storyIndex, setStoryIndex] = useState(0)
  const [blanksState, setBlanksState] = useState<Record<string, BlankState>>({})
  const [locked, setLocked] = useState<Record<string, boolean>>({})
  const [attemptsByWord, setAttemptsByWord] = useState<Record<string, number>>({})
  const [timeByWordMs, setTimeByWordMs] = useState<Record<string, number>>({})

  const [activeBlankKey, setActiveBlankKey] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackData, setFeedbackData] = useState({
    difficulty: 3,
    enjoyment: 3,
    comment: '',
    effort: 'medium',
  })
  const [submitting, setSubmitting] = useState(false)
  const [autoAdvance, setAutoAdvance] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [breakUntil, setBreakUntil] = useState<string | null>(() =>
    sessionStorage.getItem('exp.breakUntil')
  )
  const [breakStartTime, setBreakStartTime] = useState<number>(() => {
    const stored = sessionStorage.getItem('exp.breakStartTime')
    return stored ? parseInt(stored, 10) : Date.now()
  })
  const [now, setNow] = useState(Date.now())
  const [storySubmitted, setStorySubmitted] = useState(false)
  const wordTimerRef = useRef<Record<string, number>>({})

  const audioRef = useRef<HTMLAudioElement>(null)
  const sentenceAudioRef = useRef<HTMLAudioElement>(null)
  const [currentSentenceId, setCurrentSentenceId] = useState<string | null>(null)
  const base = import.meta.env.VITE_API_BASE_URL || ''

  // Story setup
  const storySequence = storyOrder === 'B-first' ? (['B', 'A'] as const) : (['A', 'B'] as const)
  const storyByLabel = { A: story1, B: story2 } as const
  const segmentsByLabel = { A: tts1Segments, B: tts2Segments } as const
  const ttsByLabel = { A: tts1, B: tts2 } as const
  const currentStoryLabel = storySequence[storyIndex]
  const currentStory = storyByLabel[currentStoryLabel]
  const currentSegments = segmentsByLabel[currentStoryLabel]
  const currentTts = ttsByLabel[currentStoryLabel]

  // Client-side noise word generation
  const clientNoise = useMemo(() => {
    const explicit = (currentStory as any).noiseOccurrences || []
    if (explicit.length) return explicit
    const targets = new Set((currentStory.occurrences || []).map((o) => (o.word || '').toLowerCase()))
    const out: any[] = []
    const targetByParagraph = new Map<number, { sentenceIndex?: number; charStart?: number; charEnd?: number }[]>()
    ;(currentStory.occurrences || []).forEach((o) => {
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
      const targetSentenceSet = new Set(
        targetList.map((t) => t.sentenceIndex).filter((v) => typeof v === 'number') as number[]
      )
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
      tokens.forEach((tok) => {
        if (/^[A-Za-z]{4,}$/.test(tok) && !targets.has(tok.toLowerCase())) {
          const start = cursor
          const end = cursor + tok.length
          candidates.push({ word: tok, start, end, sentenceIndex: sentenceIndexAt(start) })
        }
        cursor += tok.length
      })
      const picks: typeof candidates = []
      const poolBySentence = candidates.filter((c) => !targetSentenceSet.has(c.sentenceIndex))
      const basePool = poolBySentence.length ? poolBySentence : candidates
      const pool = basePool.filter((c) => !isAdjacentToTarget(c.start, c.end))
      while (pool.length && picks.length < 3) {
        const idx = Math.floor(Math.random() * pool.length)
        picks.push(pool.splice(idx, 1)[0])
      }
      picks.slice(0, 3).forEach((pick) => {
        out.push({
          word: pick.word,
          paragraphIndex: pIdx,
          sentenceIndex: pick.sentenceIndex,
          charStart: pick.start,
          charEnd: pick.end,
        })
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

  const allBlanks = useMemo(() => parsedStory.flatMap((p) => p.blanks), [parsedStory])
  const activeBlank = useMemo(
    () => allBlanks.find((b) => b.key === activeBlankKey) || null,
    [allBlanks, activeBlankKey]
  )
  const hintsEnabled = hintsByStory ? !!hintsByStory[currentStoryLabel] : condition === 'with-hints'

  const sentenceClips = useMemo(() => {
    const clips: SentenceClip[] = []
    let globalIndex = 0
    ;(currentStory.paragraphs || []).forEach((p, pIdx) => {
      const sentences = splitSentences(p)
      sentences.forEach((_, sIdx) => {
        clips.push({
          id: `${storyIndex}-${pIdx}-${sIdx}`,
          paragraphIndex: pIdx,
          sentenceIndex: sIdx,
          globalIndex: globalIndex,
        })
        globalIndex++
      })
    })
    return clips
  }, [currentStory, storyIndex])

  const solvedCount = allBlanks.filter((b) => locked[b.key]).length
  const totalBlanks = allBlanks.length
  const progressPct = totalBlanks ? (solvedCount / totalBlanks) * 100 : 0
  const isStoryComplete = solvedCount === totalBlanks && totalBlanks > 0

  const [currentParagraph, setCurrentParagraph] = useState(0)
  const [readMode, setReadMode] = useState(false)
  const [showMentalEffort, setShowMentalEffort] = useState(false)
  const [pendingEffortPara, setPendingEffortPara] = useState<number | null>(null)
  const [effortDoneByKey, setEffortDoneByKey] = useState<Record<string, boolean>>({})

  // Control group: correct answer modal state
  const [correctAnswerModal, setCorrectAnswerModal] = useState<{
    word: string;
    definition: string;
    blankKey: string;
    studentAttempt: string;
  } | null>(null)

  // Intervention store
  const interventionStore = useIntervention()
  const [pendingInterventionBlank, setPendingInterventionBlank] = useState<Blank | null>(null)

  const effortKey = (para: number) => `${storyIndex}-${para}`

  const displayParagraphs = currentStory.paragraphs || []
  const displayStory = { ...currentStory, paragraphs: displayParagraphs }
  const displayParsedStory = parsedStory
  const visibleBlanks = allBlanks.filter((b) => b.paragraphIndex === currentParagraph)
  const visibleClips = sentenceClips.filter((c) => c.paragraphIndex === currentParagraph)

  // Effects
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

  // Note: We no longer auto-clear breakUntil - user must click the button


  useEffect(() => {
    if (isStoryComplete) {
      setShowConfetti(true)
      const timer = setTimeout(() => setShowConfetti(false), 3500)
      return () => clearTimeout(timer)
    }
  }, [isStoryComplete])

  // Audio functions
  function softPause() {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
    if (sentenceAudioRef.current && !sentenceAudioRef.current.paused) {
      sentenceAudioRef.current.pause()
    }
    setAutoAdvance(false)
  }

  function restartStory(targetIndex: number) {
    softPause()
    setBlanksState({})
    setLocked({})
    setAttemptsByWord({})
    setTimeByWordMs({})
    wordTimerRef.current = {}
    setStreak(0)
    setActiveBlankKey(null)
    setCurrentSentenceId(null)
    setShowMentalEffort(false)
    setPendingEffortPara(null)
    setEffortDoneByKey({})
    setShowFeedback(false)
    setShowConfetti(false)
    setCurrentParagraph(0)
    window.scrollTo(0, 0)
    setStoryIndex(targetIndex)
  }

  function playSentence(pIdx: number, sIdx: number, autoContinue = false) {
    const clip = sentenceClips.find((c) => c.paragraphIndex === pIdx && c.sentenceIndex === sIdx)
    if (!clip) return

    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }

    if (sentenceAudioRef.current) {
      const segUrl = currentSegments[clip.globalIndex]
      const fallbackLabel = currentStoryLabel === 'A' ? 'H' : 'N'
      const fallbackPath = `/static/audio/${expId}/${fallbackLabel}_s${clip.globalIndex}.mp3`
      const chosen = segUrl || fallbackPath
      const src = chosen.startsWith('http') ? chosen : `${base}${chosen}`

      sentenceAudioRef.current.src = src
      sentenceAudioRef.current.currentTime = 0
      sentenceAudioRef.current.onerror = () => {
        toast.error('Sentence audio is unavailable. Please regenerate TTS or try again.')
        setCurrentSentenceId(null)
      }

      sentenceAudioRef.current.play().catch((e) => logger.error('Segment play error', e))
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
    const clips = sentenceClips.filter((c) => c.paragraphIndex === pIdx)
    if (!clips.length || !sentenceAudioRef.current) return

    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
    setIsPlaying(true)

    let idx = 0
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
      const src = chosen.startsWith('http') ? chosen : `${base}${chosen}`

      sentenceAudioRef.current!.src = src
      sentenceAudioRef.current!.currentTime = 0
      sentenceAudioRef.current!.onerror = () => {
        toast.error('Paragraph audio is unavailable.')
        setCurrentSentenceId(null)
        setIsPlaying(false)
      }
      sentenceAudioRef.current!.onended = () => {
        // Check if current sentence has any blanks (unsolved)
        const sentenceBlanks = allBlanks.filter(
          (b) => b.paragraphIndex === clip.paragraphIndex && b.sentenceIndex === clip.sentenceIndex
        )
        const hasUnsolvedBlank = sentenceBlanks.some((b) => !locked[b.key])

        if (hasUnsolvedBlank) {
          // Stop playback after this sentence - user needs to fill in the blank
          setCurrentSentenceId(null)
          setIsPlaying(false)
          // Focus the first unsolved blank in this sentence
          const firstUnsolved = sentenceBlanks.find((b) => !locked[b.key])
          if (firstUnsolved) {
            const el = document.getElementById(`blank-${firstUnsolved.key}-0`)
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
              setTimeout(() => el.focus(), 100)
            }
          }
          return
        }

        idx += 1
        playNext()
      }
      setCurrentSentenceId(clip.id)
      sentenceAudioRef.current!.play().catch(() => {})
    }

    playNext()
  }

  // Blank interaction functions
  function focusNextBlank(currentKey?: string) {
    const currentIndex = currentKey ? allBlanks.findIndex((b) => b.key === currentKey) : -1
    let nextIndex = -1
    for (let i = currentIndex + 1; i < allBlanks.length; i++) {
      if (!locked[allBlanks[i].key]) {
        nextIndex = i
        break
      }
    }
    if (nextIndex === -1) {
      for (let i = 0; i < currentIndex; i++) {
        if (!locked[allBlanks[i].key]) {
          nextIndex = i
          break
        }
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
      setTimeByWordMs((prev) => ({ ...prev, [word]: (prev[word] || 0) + delta }))
    }
  }

  async function checkBlank(blank: Blank, attempt: string) {
    const val = attempt.trim()
    if (!val) {
      toast.error('Please type something')
      return
    }
    setAttemptsByWord((prev) => ({ ...prev, [blank.word]: (prev[blank.word] || 0) + 1 }))
    const isCorrect = val.toLowerCase() === blank.word.toLowerCase()
    const feedbackText = blank.occurrenceIndex >= 5 ? '' : isCorrect ? 'Correct!' : 'Try again'
    const letterFeedback = blank.paragraphIndex === 4 ? undefined : buildLetterFeedback(val, blank.word)
    setBlanksState((prev) => ({
      ...prev,
      [blank.key]: { value: val, correct: isCorrect, feedback: feedbackText, letterFeedback },
    }))
    if (isCorrect) {
      setLocked((prev) => ({ ...prev, [blank.key]: true }))
      stopWordTimer(blank.word)
      toast.success('Correct!')
      setStreak((s) => s + 1)
      setMaxStreak((m) => Math.max(m, streak + 1))
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
        .catch((e) => logger.error('Failed to submit attempt', e))
    } else {
      setStreak(0)
      softPause()

      // Log the incorrect attempt
      api
        .post('/api/student/attempt', {
          experimentId: expId,
          word: blank.word,
          attempt: val,
          correct: false,
          story: currentStoryLabel,
          occurrenceIndex: blank.occurrenceIndex,
        })
        .catch((e) => logger.error('Failed to submit attempt', e))

      // Handle based on condition
      if (!hintsEnabled) {
        // Control group (without-hints): Show correct answer + definition
        triggerControlGroupFeedback(blank, val)
      } else {
        // With-hints group: Trigger intervention
        triggerIntervention(blank)
      }
    }
  }

  // Control group: Fetch definition and show correct answer modal
  async function triggerControlGroupFeedback(blank: Blank, studentAttempt: string) {
    try {
      const { data } = await api.get(`/api/student/word-metadata/${expId}/${blank.word}`)
      setCorrectAnswerModal({
        word: blank.word,
        definition: data.definition || `Definition for ${blank.word}`,
        blankKey: blank.key,
        studentAttempt,
      })
    } catch (e) {
      // Fallback if API fails
      setCorrectAnswerModal({
        word: blank.word,
        definition: `The correct spelling is "${blank.word}"`,
        blankKey: blank.key,
        studentAttempt,
      })
    }
  }

  // Handle control group modal continue
  function handleControlGroupContinue() {
    if (correctAnswerModal) {
      // Lock the blank and move on
      setLocked((prev) => ({ ...prev, [correctAnswerModal.blankKey]: true }))
      setBlanksState((prev) => ({
        ...prev,
        [correctAnswerModal.blankKey]: {
          ...prev[correctAnswerModal.blankKey],
          value: correctAnswerModal.word,
          correct: true,
          feedback: 'Revealed',
        },
      }))
      stopWordTimer(correctAnswerModal.word)
      focusNextBlank(correctAnswerModal.blankKey)
      setCorrectAnswerModal(null)
    }
  }

  // With-hints group: Start intervention
  async function triggerIntervention(blank: Blank) {
    try {
      // Fetch word metadata
      const { data: metadata } = await api.get(`/api/student/word-metadata/${expId}/${blank.word}`)

      // Start intervention session
      const { data: interventionData } = await api.post('/api/student/intervention/start', {
        experimentId: expId,
        storyLabel: currentStoryLabel,
        targetWord: blank.word,
        occurrenceIndex: blank.occurrenceIndex,
        paragraphIndex: blank.paragraphIndex,
      })

      // Store the blank for later
      setPendingInterventionBlank(blank)

      // Start intervention in store
      interventionStore.startIntervention({
        interventionId: interventionData.interventionId,
        targetWord: blank.word,
        wordMetadata: metadata as WordMetadata,
        experimentId: expId,
        storyLabel: currentStoryLabel,
        occurrenceIndex: blank.occurrenceIndex,
        paragraphIndex: blank.paragraphIndex,
        currentExercise: interventionData.currentExercise || 1,
        mcqCompleted: interventionData.mcqCompleted || false,
        jumbleCompleted: interventionData.jumbleCompleted || false,
        sentenceCompleted: interventionData.sentenceCompleted || false,
      })
    } catch (e) {
      logger.error('Failed to start intervention', e)
      toast.error('Could not start practice exercises. Try again.')
    }
  }

  // Handle intervention completion
  function handleInterventionComplete() {
    if (pendingInterventionBlank) {
      // Lock the blank and fill in correct answer
      setLocked((prev) => ({ ...prev, [pendingInterventionBlank.key]: true }))
      setBlanksState((prev) => ({
        ...prev,
        [pendingInterventionBlank.key]: {
          ...prev[pendingInterventionBlank.key],
          value: pendingInterventionBlank.word,
          correct: true,
          feedback: 'Completed',
        },
      }))
      stopWordTimer(pendingInterventionBlank.word)
      focusNextBlank(pendingInterventionBlank.key)
      setPendingInterventionBlank(null)
      toast.success('Great practice! Moving on...')
    }
  }

  async function submitFeedback() {
    try {
      const feedbackRes = await api.post('/api/student/feedback', {
        experimentId: expId,
        storyKey: currentStoryLabel,
        condition: hintsEnabled ? 'with-hints' : 'without-hints',
        storyIndex,
        ...feedbackData,
      })
      if (storyIndex === 0) {
        sessionStorage.setItem('exp.story1Complete', 'true')
        const breakUntilValue =
          feedbackRes?.data?.breakUntil || new Date(Date.now() + 5 * 60 * 1000).toISOString()
        const breakStart = Date.now()
        sessionStorage.setItem('exp.breakUntil', breakUntilValue)
        sessionStorage.setItem('exp.breakStartTime', String(breakStart))
        setBreakUntil(breakUntilValue)
        setBreakStartTime(breakStart)
        restartStory(1)
      } else {
        sessionStorage.setItem('exp.story2Complete', 'true')
        // Save recall unlock time (12 hours from now)
        const recallUnlockValue =
          feedbackRes?.data?.recallUnlockAt || new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
        sessionStorage.setItem('exp.recallUnlockAt', recallUnlockValue)
        setSubmitting(true)
        try {
          await api.post('/api/student/submit', {
            experimentId: expId,
            totalCorrect: solvedCount,
            totalAttempts: 0,
          })
        } catch {}
        toast.success('Stories complete! Recall test will be available in 12 hours.')
        setTimeout(() => (window.location.href = '/student/test'), 1200)
      }
    } catch (e) {
      toast.error('Failed to save progress')
      setSubmitting(false)
    }
  }

  async function submitMentalEffort(score: number) {
    try {
      const targetPara = pendingEffortPara ?? currentParagraph
      const completedPara = targetPara === 4 ? targetPara : targetPara - 1

      // Submit mental effort to backend
      await api.post('/api/student/effort', {
        experimentId: expId,
        storyLabel: currentStoryLabel,
        paragraphIndex: completedPara,
        score,
        position: targetPara === 4 ? 'end' : 'mid',
      })

      // Save paragraph progress to server
      await saveParagraphProgress(completedPara)

      setEffortDoneByKey((prev) => ({ ...prev, [effortKey(targetPara)]: true }))
      setShowMentalEffort(false)
      setPendingEffortPara(null)
      setStorySubmitted(true)

      if (targetPara === 4) {
        // Final paragraph - show feedback modal
        setShowFeedback(true)
      } else {
        // Move to next paragraph
        setStorySubmitted(false)
        setCurrentParagraph(targetPara)
      }
    } catch {
      toast.error('Could not submit mental effort rating')
    }
  }

  // Break time calculation
  const breakRemainingMs = breakUntil ? new Date(breakUntil).getTime() - now : 0
  const breakActive = storyIndex === 1 && !!breakUntil
  const breakSeconds = Math.max(0, Math.ceil(breakRemainingMs / 1000))
  const breakMin = Math.floor(breakSeconds / 60)
  const breakSec = breakSeconds % 60

  // Save paragraph progress to server
  async function saveParagraphProgress(paragraphIndex: number) {
    try {
      const paraBlanks = allBlanks.filter((b) => b.paragraphIndex === paragraphIndex)
      const solvedParaBlanks = paraBlanks.filter((b) => locked[b.key])

      await api.post('/api/student/paragraph-progress', {
        experimentId: expId,
        storyLabel: currentStoryLabel,
        paragraphIndex,
        totalBlanks: paraBlanks.length,
        solvedBlanks: solvedParaBlanks.length,
        completedAt: new Date().toISOString(),
      })
    } catch (e) {
      logger.error('Failed to save paragraph progress', e)
    }
  }

  // Log break time when starting story 2
  async function handleStartStory2(actualBreakMs: number) {
    try {
      await api.post('/api/student/break-log', {
        experimentId: expId,
        actualBreakMs,
        expectedBreakMs: 5 * 60 * 1000,
        skippedEarly: actualBreakMs < 5 * 60 * 1000,
      })
    } catch (e) {
      logger.error('Failed to log break time', e)
    }

    sessionStorage.removeItem('exp.breakUntil')
    sessionStorage.removeItem('exp.breakStartTime')
    setBreakUntil(null)
  }

  // Render blank input using BlankInput component
  const renderBlankInput = (blank: Blank) => {
    const state = blanksState[blank.key] || { value: '', correct: false, feedback: '' }
    const isLocked = locked[blank.key]
    const feedbackEnabled = blank.paragraphIndex !== 4

    return (
      <BlankInput
        key={blank.key}
        blank={blank}
        state={state}
        isLocked={isLocked}
        hintsEnabled={false}
        feedbackEnabled={feedbackEnabled}
        onCheck={checkBlank}
        onHint={() => {}}
        onFocus={(b) => {
          setActiveBlankKey(b.key)
          startWordTimer(b.word)
        }}
        onBlur={(b) => stopWordTimer(b.word)}
        onFocusNext={focusNextBlank}
        onUpdateValue={(blankKey, value) => {
          setBlanksState((prev) => ({
            ...prev,
            [blankKey]: { ...prev[blankKey], value, feedback: '', letterFeedback: undefined },
          }))
        }}
      />
    )
  }

  // Conditional renders
  if (showMentalEffort) {
    const targetPara = pendingEffortPara ?? currentParagraph
    return (
      <MentalEffortView
        paragraphNumber={targetPara + 1}
        onSubmit={submitMentalEffort}
      />
    )
  }

  if (breakActive) {
    return (
      <BreakTimeView
        breakMin={breakMin}
        breakSec={breakSec}
        breakRemainingMs={breakRemainingMs}
        breakStartTime={breakStartTime}
        onStartStory2={handleStartStory2}
      />
    )
  }

  return (
    <div className="transition-colors duration-300 min-h-screen bg-gray-50 pb-20">
      <StudentHeader
        storyIndex={storyIndex}
        solvedCount={solvedCount}
        totalBlanks={totalBlanks}
        progressPct={progressPct}
        isPlaying={isPlaying}
        onTogglePlay={() => {
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
        onSkip={(secs) => {
          if (sentenceAudioRef.current) sentenceAudioRef.current.currentTime += secs
        }}
        isStoryComplete={isStoryComplete}
        readMode={readMode}
        onToggleReadMode={() => setReadMode((v) => !v)}
      />

      <div className="container mx-auto px-4 py-8 grid lg:grid-cols-4 gap-8">
        <div className={`${readMode ? 'lg:col-span-4' : 'lg:col-span-3'} flex items-center justify-between mb-2`}>
          <div className="space-x-2">
            <button
              className="btn"
              onClick={() => setCurrentParagraph((p) => Math.max(0, p - 1))}
              disabled={currentParagraph === 0}
            >
              Previous paragraph
            </button>
            <button
              className="btn primary"
              onClick={() => {
                // Check if all blanks in current paragraph are solved
                const currentParaBlanks = allBlanks.filter((b) => b.paragraphIndex === currentParagraph)
                const unsolvedBlanks = currentParaBlanks.filter((b) => !locked[b.key])

                // If there are unsolved blanks, auto-check them one at a time
                if (unsolvedBlanks.length > 0) {
                  // Find the first unchecked blank and check it
                  const firstUnchecked = unsolvedBlanks[0]
                  const state = blanksState[firstUnchecked.key]
                  const currentValue = state?.value?.trim() || ''

                  // Check the blank with current value
                  checkBlank(firstUnchecked, currentValue)

                  // Show message about remaining words
                  if (unsolvedBlanks.length === 1) {
                    toast.error('Please spell this word correctly before continuing')
                  } else {
                    toast.error(`Please spell all ${unsolvedBlanks.length} remaining words correctly before continuing`)
                  }

                  // Focus the first unchecked blank
                  const el = document.getElementById(`blank-${firstUnchecked.key}-0`)
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    setTimeout(() => el.focus(), 100)
                  }
                  return
                }

                const next = currentParagraph + 1
                if (next >= 5) return

                // Show mental effort questionnaire before moving to next paragraph
                if (!effortDoneByKey[effortKey(next)]) {
                  setPendingEffortPara(next)
                  setShowMentalEffort(true)
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
                className={`btn ${effortDoneByKey[effortKey(4)] ? 'bg-green-600 text-white cursor-not-allowed' : 'primary'}`}
                onClick={() => {
                  if (effortDoneByKey[effortKey(4)]) return

                  // Check if all blanks in current paragraph are solved
                  const currentParaBlanks = allBlanks.filter((b) => b.paragraphIndex === currentParagraph)
                  const unsolvedBlanks = currentParaBlanks.filter((b) => !locked[b.key])

                  // If there are unsolved blanks, auto-check them
                  if (unsolvedBlanks.length > 0) {
                    const firstUnchecked = unsolvedBlanks[0]
                    const state = blanksState[firstUnchecked.key]
                    const currentValue = state?.value?.trim() || ''
                    checkBlank(firstUnchecked, currentValue)

                    if (unsolvedBlanks.length === 1) {
                      toast.error('Please spell this word correctly before submitting')
                    } else {
                      toast.error(`Please spell all ${unsolvedBlanks.length} remaining words correctly before submitting`)
                    }

                    const el = document.getElementById(`blank-${firstUnchecked.key}-0`)
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      setTimeout(() => el.focus(), 100)
                    }
                    return
                  }

                  // Show mental effort questionnaire before finishing story
                  setPendingEffortPara(4)
                  setShowMentalEffort(true)
                }}
                disabled={!!effortDoneByKey[effortKey(4)]}
              >
                {effortDoneByKey[effortKey(4)] ? 'Submitted' : 'Submit story'}
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
            if (!effortDoneByKey[effortKey(4)]) {
              setPendingEffortPara(4)
              setShowMentalEffort(true)
            } else {
              setShowFeedback(true)
            }
          }}
          onGoToStory={restartStory}
          renderBlank={renderBlankInput}
          splitSentences={splitSentences}
          readMode={readMode}
        />

        {!readMode && (
          <Sidebar
            streak={streak}
            sentenceClips={visibleClips}
            currentSentenceId={currentSentenceId}
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

      {/* Control group: Correct answer modal */}
      {correctAnswerModal && (
        <CorrectAnswerModal
          word={correctAnswerModal.word}
          definition={correctAnswerModal.definition}
          studentAttempt={correctAnswerModal.studentAttempt}
          onContinue={handleControlGroupContinue}
        />
      )}

      {/* With-hints group: Intervention popup */}
      {interventionStore.isActive && (
        <InterventionPopup onComplete={handleInterventionComplete} />
      )}

      <audio ref={audioRef} className="hidden" onEnded={() => setIsPlaying(false)} />
      <audio ref={sentenceAudioRef} className="hidden" />
    </div>
  )
}
