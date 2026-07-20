import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import api from '../../lib/api'
import { resolveAssetUrl } from '../../lib/assetUrl'
import { logger } from '../../lib/logger'
import { toast } from '../../store/toasts'
import ErrorBoundaryComponent from '../../components/ErrorBoundary'
import {
  ensureStudentSessionAuth,
  hydrateStudentSession,
  loadSavedStudentSession,
  persistStudentSession,
  updateStoredStudentSession,
} from '../../lib/studentSession'
import { useIntervention, type WordMetadata } from '../../store/intervention'
import { Navigate } from 'react-router-dom'

// Types and utilities
import type { Blank, StoryPayload, BlankState, SentenceClip } from './types'
import { splitSentences, parseParagraph, buildLetterFeedback } from './utils'

// Sub-components
import StudentHeader from './components/StudentHeader'
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
  const savedSession = loadSavedStudentSession()
  const expId = sessionStorage.getItem('exp.experimentId') || sessionStorage.getItem('sessionId') || ''
  const assignmentId = sessionStorage.getItem('assignmentId') || ''
  const story2Done = sessionStorage.getItem('exp.story2Complete') === 'true'
  const story1Done = sessionStorage.getItem('exp.story1Complete') === 'true'
  const rawCondition = sessionStorage.getItem('exp.condition') || 'with_hints'
  const condition = rawCondition.replace('_', '-') as 'with-hints' | 'without-hints'
  const storyOrder = (sessionStorage.getItem('exp.storyOrder') || 'A-first') as 'A-first' | 'B-first'
  const storedProgress = (() => {
    try {
      const raw = sessionStorage.getItem('exp.progress') || (savedSession?.progress ? JSON.stringify(savedSession.progress) : null)
      return raw ? (JSON.parse(raw) as { storyIndex?: number; currentParagraph?: number } | null) : null
    } catch {
      return null
    }
  })()
  const initialBreakUntil = sessionStorage.getItem('exp.breakUntil') || savedSession?.breakUntil || null
  const initialBreakStartTime = (() => {
    const raw = sessionStorage.getItem('exp.breakStartTime')
    if (raw) {
      const parsed = parseInt(raw, 10)
      if (!Number.isNaN(parsed)) return parsed
    }
    return typeof savedSession?.breakStartTime === 'number' ? savedSession.breakStartTime : Date.now()
  })()
  const initialStoryIndex = (() => {
    if (initialBreakUntil && story1Done && !story2Done) return 1
    const progressStoryIndex = storedProgress?.storyIndex
    if (typeof progressStoryIndex === 'number') return progressStoryIndex
    return 0
  })()
  const initialParagraphIndex = (() => {
    const progressParagraph = storedProgress?.currentParagraph
    if (typeof progressParagraph === 'number') return progressParagraph
    if (initialBreakUntil && story1Done && !story2Done) return 0
    return 0
  })()
  const story1 = JSON.parse(sessionStorage.getItem('exp.story1') || '{}') as StoryPayload
  const story2 = JSON.parse(sessionStorage.getItem('exp.story2') || '{}') as StoryPayload
  const tts1Segments = JSON.parse(sessionStorage.getItem('exp.tts1Segments') || '[]')
  const tts2Segments = JSON.parse(sessionStorage.getItem('exp.tts2Segments') || '[]')

  if (!expId && !assignmentId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg text-center space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">Session not found</h2>
          <p className="text-gray-600 text-sm">Please re-enter your join code to continue.</p>
          <a href={`${import.meta.env.BASE_URL || '/'}student`} className="btn primary px-4 py-2 inline-flex justify-center">
            Go to join page
          </a>
        </div>
      </div>
    )
  }

  const [storyIndex, setStoryIndex] = useState(initialStoryIndex)
  const [blanksState, setBlanksState] = useState<Record<string, BlankState>>({})
  const [locked, setLocked] = useState<Record<string, boolean>>({})
  const [attemptsByWord, setAttemptsByWord] = useState<Record<string, number>>({})
  const [timeByWordMs, setTimeByWordMs] = useState<Record<string, number>>({})
  const hasRestoredRef = useRef(false)

  const [activeBlankKey, setActiveBlankKey] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const [wordsInStreak, setWordsInStreak] = useState<Set<string>>(new Set())
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
  const [breakUntil, setBreakUntil] = useState<string | null>(() => initialBreakUntil)
  const [breakStartTime, setBreakStartTime] = useState<number>(() => initialBreakStartTime)
  const [now, setNow] = useState(Date.now())
  const [storySubmitted, setStorySubmitted] = useState(false)
  const wordTimerRef = useRef<Record<string, number>>({})

  const sentenceAudioRef = useRef<HTMLAudioElement>(null)
  const [currentSentenceId, setCurrentSentenceId] = useState<string | null>(null)

  // Track paragraph playback state for resuming after correct answer
  const paragraphPlaybackRef = useRef<{
    active: boolean
    paragraphIndex: number
    sentenceIndex: number
    clips: SentenceClip[]
  } | null>(null)
  // Story setup
  const storySequence = storyOrder === 'B-first' ? (['B', 'A'] as const) : (['A', 'B'] as const)
  const storyByLabel = { A: story1, B: story2 } as const
  const segmentsByLabel = { A: tts1Segments, B: tts2Segments } as const
  const currentStoryLabel = storySequence[storyIndex]
  const currentStory = storyByLabel[currentStoryLabel]
  const currentSegments = segmentsByLabel[currentStoryLabel]

  // Noise words come ONLY from teacher selection - no random fallback
  const noiseOccurrences = useMemo(() => {
    const noise = (currentStory as any).noiseOccurrences || []
    return noise
  }, [currentStory])

  const parsedStory = useMemo(() => {
    const wordCounts: Record<string, number> = {}
    return (currentStory.paragraphs || []).map((p, pIdx) =>
      parseParagraph(
        p,
        pIdx,
        wordCounts,
        currentStory.occurrences || [],
        noiseOccurrences
      )
    )
  }, [currentStory, noiseOccurrences])

  const allBlanks = useMemo(() => {
    const blanks = parsedStory.flatMap((p) => p.blanks)
    return blanks
  }, [parsedStory])
  const activeBlank = useMemo(
    () => allBlanks.find((b) => b.key === activeBlankKey) || null,
    [allBlanks, activeBlankKey]
  )
  const interventionEnabled = condition === 'with-hints'

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

  const solvedCount = allBlanks.filter((b) => blanksState[b.key]?.correct).length
  const totalBlanks = allBlanks.length
  const progressPct = totalBlanks ? (solvedCount / totalBlanks) * 100 : 0
  const isStoryComplete = solvedCount === totalBlanks && totalBlanks > 0

  const [currentParagraph, setCurrentParagraph] = useState(initialParagraphIndex)
  const [showMentalEffort, setShowMentalEffort] = useState(false)
  const [pendingEffortContext, setPendingEffortContext] = useState<{
    completedPara: number
    nextPara: number | null
    final: boolean
  } | null>(null)
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
  const paragraphCount = Math.max(1, displayParagraphs.length)
  const lastParagraphIndex = paragraphCount - 1
  const displayStory = { ...currentStory, paragraphs: displayParagraphs }
  const displayParsedStory = parsedStory
  const visibleBlanks = allBlanks.filter((b) => b.paragraphIndex === currentParagraph)
  const visibleClips = sentenceClips.filter((c) => c.paragraphIndex === currentParagraph)
  const currentParagraphComplete = visibleBlanks.every((b) => blanksState[b.key]?.correct)

  // Effects
  useEffect(() => {
    if (!breakUntil) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [breakUntil])

  useEffect(() => {
    if (currentParagraph > lastParagraphIndex) {
      setCurrentParagraph(lastParagraphIndex)
    }
  }, [currentParagraph, lastParagraphIndex])

  // Note: We no longer auto-clear breakUntil - user must click the button


  useEffect(() => {
    if (isStoryComplete) {
      setShowConfetti(true)
      const timer = setTimeout(() => setShowConfetti(false), 3500)
      return () => clearTimeout(timer)
    }
  }, [isStoryComplete])

  // Reset intervention state on mount (interventions restart after refresh)
  useEffect(() => {
    interventionStore.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Restore progress from sessionStorage on mount
  useEffect(() => {
    const savedProgress = sessionStorage.getItem('exp.progress')
    console.log('🔄 Restoring progress:', savedProgress ? 'Found' : 'Not found')
    if (savedProgress) {
      try {
        const progress = JSON.parse(savedProgress)
        if (progress.currentParagraph !== undefined) {
          setCurrentParagraph(progress.currentParagraph)
        }
        if (progress.blanksState && Object.keys(progress.blanksState).length > 0) {
          setBlanksState(progress.blanksState)
        }
        if (progress.storyIndex !== undefined) {
          setStoryIndex(progress.storyIndex)
        }
        if (progress.wordsInStreak) {
          setWordsInStreak(new Set(progress.wordsInStreak))
        }
        if (progress.streak !== undefined) {
          setStreak(progress.streak)
        }
        if (progress.maxStreak !== undefined) {
          setMaxStreak(progress.maxStreak)
        }
        if (progress.attemptsByWord) {
          setAttemptsByWord(progress.attemptsByWord)
        }
        if (progress.timeByWordMs) {
          setTimeByWordMs(progress.timeByWordMs)
        }
      } catch (err) {
        logger.error('Failed to restore progress:', err)
      }
    }
    // Mark restoration as complete
    hasRestoredRef.current = true
  }, [])

  // Save progress to sessionStorage and localStorage when key state changes (but only after initial restore)
  useEffect(() => {
    // Skip saving until initial restoration is complete to prevent overwriting saved data
    if (!hasRestoredRef.current) {
      return
    }
    if (
      breakUntil &&
      story1Done &&
      !story2Done &&
      storyIndex === 1 &&
      currentParagraph === 0 &&
      Object.keys(blanksState).length === 0
    ) {
      return
    }

    const progress = {
      currentParagraph,
      blanksState,
      storyIndex,
      currentStoryLabel,
      wordsInStreak: Array.from(wordsInStreak),
      streak,
      maxStreak,
      attemptsByWord,
      timeByWordMs,
    }

    // Save to sessionStorage (fast access for current tab)
    sessionStorage.setItem('exp.progress', JSON.stringify(progress))

    // Also persist to localStorage (survives page refresh)
    const existingSession = loadSavedStudentSession()
    if (existingSession) {
      persistStudentSession({
        ...existingSession,
        progress,
        breakUntil: breakUntil || undefined,
        breakStartTime: breakStartTime || undefined,
        story1Complete: sessionStorage.getItem('exp.story1Complete') === 'true',
        story2Complete: sessionStorage.getItem('exp.story2Complete') === 'true',
        recallUnlockAt: sessionStorage.getItem('exp.recallUnlockAt') || undefined,
        delayedEffortSubmitted: sessionStorage.getItem('exp.delayedEffortSubmitted') === 'true',
        offloadingSubmitted: sessionStorage.getItem('exp.offloadingSubmitted') === 'true',
      })
    }
  }, [currentParagraph, blanksState, storyIndex, currentStoryLabel, wordsInStreak, streak, maxStreak, attemptsByWord, timeByWordMs, breakUntil, breakStartTime, story1Done, story2Done])

  // Audio functions
  function softPause(clearPlaybackState = true) {
    if (sentenceAudioRef.current && !sentenceAudioRef.current.paused) {
      sentenceAudioRef.current.pause()
    }
    setAutoAdvance(false)
    // Clear paragraph playback state when manually paused
    if (clearPlaybackState) {
      paragraphPlaybackRef.current = null
    }
  }

  function restartStory(targetIndex: number) {
    softPause()
    setBlanksState({})
    setLocked({})
    setAttemptsByWord({})
    setTimeByWordMs({})
    wordTimerRef.current = {}
    setStreak(0)
    setWordsInStreak(new Set())
    setActiveBlankKey(null)
    setCurrentSentenceId(null)
    setShowMentalEffort(false)
    setPendingEffortContext(null)
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

    if (sentenceAudioRef.current) {
      const segUrl = currentSegments[clip.globalIndex]
      const fallbackLabel = currentStoryLabel === 'A' ? 'H' : 'N'
      const fallbackPath = `/static/audio/${expId}/${fallbackLabel}_s${clip.globalIndex}.mp3`
      const chosen = segUrl || fallbackPath
      const src = resolveAssetUrl(chosen)

      sentenceAudioRef.current.src = src
      sentenceAudioRef.current.currentTime = 0
      sentenceAudioRef.current.onerror = () => {
        if (segUrl) {
          toast.error('Sentence audio is unavailable. Please regenerate TTS or try again.')
        } else {
          toast.error('Sentence audio is unavailable. Please generate TTS or try again.')
        }
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

  function playParagraph(pIdx: number, startFromSentence = 0) {
    const clips = sentenceClips.filter((c) => c.paragraphIndex === pIdx)
    if (!clips.length || !sentenceAudioRef.current) return

    // Track playback state for resuming
    paragraphPlaybackRef.current = {
      active: true,
      paragraphIndex: pIdx,
      sentenceIndex: startFromSentence,
      clips,
    }

    let idx = startFromSentence
    const playNext = () => {
      const clip = clips[idx]
      if (!clip) {
        setCurrentSentenceId(null)
        paragraphPlaybackRef.current = null
        return
      }

      // Update tracking
      if (paragraphPlaybackRef.current) {
        paragraphPlaybackRef.current.sentenceIndex = idx
      }

      const segUrl = currentSegments[clip.globalIndex]
      const fallbackLabel = currentStoryLabel === 'A' ? 'H' : 'N'
      const fallbackPath = `/static/audio/${expId}/${fallbackLabel}_s${clip.globalIndex}.mp3`
      const chosen = segUrl || fallbackPath
      const src = resolveAssetUrl(chosen)

      sentenceAudioRef.current!.src = src
      sentenceAudioRef.current!.currentTime = 0
      sentenceAudioRef.current!.onerror = () => {
        toast.error('Sentence audio is unavailable.')
        setCurrentSentenceId(null)
        paragraphPlaybackRef.current = null
      }
      sentenceAudioRef.current!.onended = () => {
        // Check if current sentence has any blanks (unsolved)
        const sentenceBlanks = allBlanks.filter(
          (b) => b.paragraphIndex === clip.paragraphIndex && b.sentenceIndex === clip.sentenceIndex
        )
        const hasUnsolvedBlank = sentenceBlanks.some((b) => !blanksState[b.key]?.correct)

        if (hasUnsolvedBlank) {
          // Pause playback - keep tracking state for resume
          setCurrentSentenceId(null)
          // Focus the first unsolved blank in this sentence
          const firstUnsolved = sentenceBlanks.find((b) => !blanksState[b.key]?.correct)
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

  // Resume paragraph playback from current sentence
  function resumeParagraphPlayback() {
    const state = paragraphPlaybackRef.current
    if (!state || !state.active) return

    // Resume from current sentence
    playParagraph(state.paragraphIndex, state.sentenceIndex)
  }

  // Blank interaction functions
  function focusNextBlank(currentKey?: string) {
    // Use setTimeout to ensure state updates have been applied
    setTimeout(() => {
      const currentIndex = currentKey ? allBlanks.findIndex((b) => b.key === currentKey) : -1

      const nextBlank = allBlanks
        .slice(Math.max(0, currentIndex + 1))
        .find((b) => !blanksState[b.key]?.correct)

      if (nextBlank && nextBlank.paragraphIndex === currentParagraph) {
        const nextKey = nextBlank.key
        const el = document.getElementById(`blank-${nextKey}-0`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Wait for scroll animation before focusing
          setTimeout(() => {
            el.focus()
            setActiveBlankKey(nextKey)
          }, 150)
        }
      }
    }, 50)
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
    const letterFeedback = blank.paragraphIndex === lastParagraphIndex ? undefined : buildLetterFeedback(val, blank.word)
    setBlanksState((prev) => ({
      ...prev,
      [blank.key]: { value: val, correct: isCorrect, feedback: feedbackText, letterFeedback },
    }))
    if (isCorrect) {
      // Allow editing after correct answer - don't lock the input
      // setLocked((prev) => ({ ...prev, [blank.key]: true }))
      stopWordTimer(blank.word)
      toast.success('Correct!')
      
      // Only increment streak for unique words (first time spelling each word correctly)
      const wordLower = blank.word.toLowerCase()
      if (!wordsInStreak.has(wordLower)) {
        setWordsInStreak((prev) => new Set(prev).add(wordLower))
        setStreak((s) => s + 1)
        setMaxStreak((m) => Math.max(m, streak + 1))
      }

      // Check if we were in paragraph playback mode - resume audio
      if (paragraphPlaybackRef.current?.active) {
        // Small delay to let the UI update, then resume audio
        setTimeout(() => {
          resumeParagraphPlayback()
        }, 300)
      } else {
        // Not in paragraph playback - just focus next blank
        focusNextBlank(blank.key)
      }

      api
        .post('api/student/attempt', {
          experimentId: expId,
          word: blank.word,
          attempt: val,
          correct: true,
          story: currentStoryLabel,
          occurrenceIndex: blank.occurrenceIndex,
          isNoise: Boolean(blank.isNoise),
        })
        .catch((e) => logger.error('Failed to submit attempt', e))
    } else {
      setStreak(0)
      // Pause audio but keep playback state for potential resume
      softPause(false)

      // Log the incorrect attempt
      api
        .post('api/student/attempt', {
          experimentId: expId,
          word: blank.word,
          attempt: val,
          correct: false,
          story: currentStoryLabel,
          occurrenceIndex: blank.occurrenceIndex,
          isNoise: Boolean(blank.isNoise),
        })
        .catch((e) => logger.error('Failed to submit attempt', e))

      // Handle based on condition
      if (!interventionEnabled) {
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
      const { data } = await api.get(`api/student/word-metadata/${expId}/${blank.word}`)
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
      ensureStudentSessionAuth()
      // Fetch word metadata
      const { data: metadata } = await api.get(`api/student/word-metadata/${expId}/${blank.word}`)

      // Start intervention session
      const { data: interventionData } = await api.post('api/student/intervention/start', {
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
      ensureStudentSessionAuth()
      const feedbackRes = await api.post('api/student/feedback', {
        experimentId: expId,
        storyKey: currentStoryLabel,
        condition,
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
        updateStoredStudentSession({
          story1Complete: true,
          breakUntil: breakUntilValue,
          breakStartTime: breakStart,
        })
        setBreakUntil(breakUntilValue)
        setBreakStartTime(breakStart)
        restartStory(1)
      } else {
        sessionStorage.setItem('exp.story2Complete', 'true')
        // Save recall unlock time (12 hours from now)
        const recallUnlockValue =
          feedbackRes?.data?.recallUnlockAt || new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
        sessionStorage.setItem('exp.recallUnlockAt', recallUnlockValue)
        updateStoredStudentSession({
          story2Complete: true,
          recallUnlockAt: recallUnlockValue,
        })
        setSubmitting(true)
        try {
          await api.post('api/student/submit', {
            experimentId: expId,
            totalCorrect: solvedCount,
            totalAttempts: 0,
          })
        } catch {}
        toast.success('Stories complete! Recall test will be available in 12 hours.')
        const basePath = import.meta.env.BASE_URL || '/'
        setTimeout(() => (window.location.href = `${basePath}student/test`), 1200)
      }
    } catch (e) {
      toast.error('Failed to save progress')
      setSubmitting(false)
    }
  }

  async function submitMentalEffort(scores: { difficulty: number; effort: number }) {
    try {
      ensureStudentSessionAuth()
      const context = pendingEffortContext || {
        completedPara: currentParagraph,
        nextPara: null,
        final: currentParagraph === lastParagraphIndex,
      }
      const { completedPara } = context
      const position = context.final ? 'end' : 'mid'

      // Submit perceived difficulty
      await api.post('api/student/effort', {
        experimentId: expId,
        storyLabel: currentStoryLabel,
        paragraphIndex: completedPara,
        taskType: 'difficulty',
        score: scores.difficulty,
        position,
      })

      // Submit mental effort (Paas)
      await api.post('api/student/effort', {
        experimentId: expId,
        storyLabel: currentStoryLabel,
        paragraphIndex: completedPara,
        taskType: 'effort',
        score: scores.effort,
        position,
      })

      // Save paragraph progress to server
      await saveParagraphProgress(completedPara)

      setEffortDoneByKey((prev) => ({ ...prev, [effortKey(completedPara)]: true }))
      setShowMentalEffort(false)
      setPendingEffortContext(null)
      setStorySubmitted(true)

      if (context.final) {
        // Final paragraph - show feedback modal
        setShowFeedback(true)
      } else {
        // Move to next paragraph
        setStorySubmitted(false)
        setCurrentParagraph(context.nextPara ?? Math.min(lastParagraphIndex, completedPara + 1))
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
      const solvedParaBlanks = paraBlanks.filter((b) => blanksState[b.key]?.correct)

      await api.post('api/student/paragraph-progress', {
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
      await api.post('api/student/break-log', {
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
    updateStoredStudentSession({
      breakUntil: undefined,
      breakStartTime: undefined,
    })
    setBreakUntil(null)
  }

  // Memoized callbacks for BlankInput to prevent re-renders during audio
  const handleBlankFocus = useCallback((b: Blank) => {
    setActiveBlankKey(b.key)
    startWordTimer(b.word)
  }, [])

  const handleBlankBlur = useCallback((b: Blank) => {
    stopWordTimer(b.word)
  }, [])

  const handleUpdateValue = useCallback((blankKey: string, value: string) => {
    setBlanksState((prev) => ({
      ...prev,
      [blankKey]: { ...prev[blankKey], value, feedback: '', letterFeedback: undefined },
    }))
  }, [])

  // Render blank input using BlankInput component
  const renderBlankInput = useCallback((blank: Blank) => {
    const state = blanksState[blank.key] || { value: '', correct: false, feedback: '' }
    const isLocked = locked[blank.key]
    const feedbackEnabled = blank.paragraphIndex !== lastParagraphIndex

    return (
      <BlankInput
        key={blank.key}
        blank={blank}
        state={state}
        isLocked={isLocked}
        feedbackEnabled={feedbackEnabled}
        onCheck={checkBlank}
        onFocus={handleBlankFocus}
        onBlur={handleBlankBlur}
        onFocusNext={focusNextBlank}
        onUpdateValue={handleUpdateValue}
      />
    )
  }, [blanksState, locked, checkBlank, handleBlankFocus, handleBlankBlur, focusNextBlank, handleUpdateValue, lastParagraphIndex])

  // Conditional renders
  if (story2Done) {
    return <Navigate to="/student/test" replace />
  }

  if (showMentalEffort) {
    const targetPara = pendingEffortContext?.completedPara ?? currentParagraph
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
        isStoryComplete={isStoryComplete}
      />

      <div className="container mx-auto px-4 py-8 grid lg:grid-cols-4 gap-8">
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
            if (!isStoryComplete) {
              toast.error('Please complete every blank before submitting the story.')
              return
            }
            if (!effortDoneByKey[effortKey(lastParagraphIndex)]) {
              setPendingEffortContext({
                completedPara: lastParagraphIndex,
                nextPara: null,
                final: true,
              })
              setShowMentalEffort(true)
            } else {
              setShowFeedback(true)
            }
          }}
          onGoToStory={restartStory}
          renderBlank={renderBlankInput}
          splitSentences={splitSentences}
        />

        <div className="lg:col-span-4 flex items-center justify-between mt-2">
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
                const next = currentParagraph + 1
                if (next >= paragraphCount) return
                if (!currentParagraphComplete) {
                  toast.error('Please complete all blanks in this paragraph before continuing.')
                  return
                }

                // Show mental effort questionnaire before moving to next paragraph
                if (!effortDoneByKey[effortKey(currentParagraph)]) {
                  setPendingEffortContext({
                    completedPara: currentParagraph,
                    nextPara: next,
                    final: false,
                  })
                  setShowMentalEffort(true)
                  return
                }
                setCurrentParagraph(next)
              }}
              disabled={currentParagraph >= lastParagraphIndex || !currentParagraphComplete}
            >
              Next paragraph
            </button>
            {currentParagraph === lastParagraphIndex && (
              <button
                className={`btn ${effortDoneByKey[effortKey(lastParagraphIndex)] ? 'bg-green-600 text-white cursor-not-allowed' : 'primary'}`}
                onClick={() => {
                  if (!isStoryComplete) {
                    toast.error('Please complete every blank before submitting the story.')
                    return
                  }
                  if (effortDoneByKey[effortKey(lastParagraphIndex)]) {
                    setShowFeedback(true)
                    return
                  }

                  // Show mental effort questionnaire before finishing story
                  setPendingEffortContext({
                    completedPara: lastParagraphIndex,
                    nextPara: null,
                    final: true,
                  })
                  setShowMentalEffort(true)
                }}
                disabled={!isStoryComplete}
              >
                {effortDoneByKey[effortKey(lastParagraphIndex)] ? 'Submitted' : 'Submit story'}
              </button>
            )}
          </div>
          <div className="text-sm text-gray-600">Paragraph {currentParagraph + 1} / {paragraphCount}</div>
        </div>
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

      <audio ref={sentenceAudioRef} className="hidden" />
    </div>
  )
}
