import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../../lib/api'
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
  occs?: StoryPayload['occurrences']
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
  
  paraOcc.forEach((o) => {
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
  })
  
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
  const condition = (sessionStorage.getItem('exp.condition') || 'with_hints') as 'with-hints'|'without-hints'
  const label = condition === 'with-hints' ? 'H' : 'N'
  
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
  
  const [blanksState, setBlanksState] = useState<Record<string, { value: string; correct: boolean; feedback: string }>>({})
  const [locked, setLocked] = useState<Record<string, boolean>>({})
  const [hints, setHints] = useState<Record<string, { used: number; text: string }>>({})
  
  const [activeBlankKey, setActiveBlankKey] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showHintModal, setShowHintModal] = useState(false)
  const [activeHintWord, setActiveHintWord] = useState<string | null>(null)
  const [feedbackData, setFeedbackData] = useState({ difficulty: 3, enjoyment: 3, comment: '', effort: 'medium' })
  const [submitting, setSubmitting] = useState(false)
  const [autoAdvance, setAutoAdvance] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const sentenceAudioRef = useRef<HTMLAudioElement>(null)
  const [currentSentenceId, setCurrentSentenceId] = useState<string | null>(null)
  const base = import.meta.env.VITE_API_BASE_URL || ''

  const currentStory = storyIndex === 0 ? story1 : story2
  const currentSegments = storyIndex === 0 ? tts1Segments : tts2Segments
  const currentTts = storyIndex === 0 ? tts1 : tts2

  const parsedStory = useMemo(() => {
    const wordCounts: Record<string, number> = {}
    return (currentStory.paragraphs || []).map((p, pIdx) => 
      parseParagraph(p, pIdx, wordCounts, currentStory.occurrences)
    )
  }, [currentStory])

  const allBlanks = useMemo(() => 
    parsedStory.flatMap(p => p.blanks), 
    [parsedStory]
  )

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
    if (isStoryComplete) {
      setShowConfetti(true)
      const timer = setTimeout(() => setShowConfetti(false), 3500)
      const feedbackTimer = setTimeout(() => setShowFeedback(true), 1500)
      return () => {
        clearTimeout(timer)
        clearTimeout(feedbackTimer)
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
    setStreak(0)
    setActiveBlankKey(null)
    setActiveHintWord(null)
    setCurrentSentenceId(null)
    setShowHintModal(false)
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
      const fallbackLabel = storyIndex === 0 ? 'H' : 'N'
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

      sentenceAudioRef.current.play().catch(e => console.error("Segment play error:", e))
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
      const el = document.getElementById(`blank-${nextKey}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => el.focus(), 50)
      }
    }
  }

  async function checkBlank(blank: Blank, attempt: string) {
    const val = attempt.trim()
    if (!val) { toast.error('Please type something'); return }
    const isCorrect = val.toLowerCase() === blank.word.toLowerCase()
    setBlanksState(prev => ({ ...prev, [blank.key]: { value: val, correct: isCorrect, feedback: isCorrect ? 'Correct!' : 'Try again' } }))
    if (isCorrect) {
      setLocked(prev => ({ ...prev, [blank.key]: true }))
      toast.success('Correct! ≡ƒæÅ')
      setStreak(s => s + 1)
      setMaxStreak(m => Math.max(m, streak + 1))
      
      // Resume Logic
      const currentClipIndex = sentenceClips.findIndex(c => c.paragraphIndex === blank.paragraphIndex && c.sentenceIndex === blank.sentenceIndex)
      if (currentClipIndex !== -1) {
        const blanksInSentence = allBlanks.filter(b => b.paragraphIndex === blank.paragraphIndex && b.sentenceIndex === blank.sentenceIndex)
        const remainingHere = blanksInSentence.some(b => b.key !== blank.key && !locked[b.key])
        
        if (remainingHere) {
           // Stay on current sentence
           playSentence(blank.paragraphIndex, blank.sentenceIndex!, true)
        } else {
           // Move to next sentence
           const nextClip = sentenceClips[currentClipIndex + 1]
           if (nextClip) {
             playSentence(nextClip.paragraphIndex, nextClip.sentenceIndex, true)
           }
        }
      }

      focusNextBlank(blank.key)
      api.post('/api/student/attempt', { experimentId: expId, word: blank.word, attempt: val, correct: true, story: storyIndex === 0 ? 'A' : 'B' }).catch(console.error)
    } else {
      setStreak(0)
      softPause()
      toast.error('Try again')
      let fbStr = ''
      for(let i=0; i<Math.min(val.length, blank.word.length); i++) fbStr += val[i].toLowerCase() === blank.word[i].toLowerCase() ? '✓' : '✗'
      setBlanksState(prev => ({ ...prev, [blank.key]: { value: val, correct: false, feedback: fbStr } }))
      api.post('/api/student/attempt', { experimentId: expId, word: blank.word, attempt: val, correct: false, story: storyIndex === 0 ? 'A' : 'B' }).catch(console.error)
    }
  }

  async function getHint() {
    if (!activeHintWord) return
    const used = hints[activeHintWord]?.used || 0
    if (used >= 3 && label === 'H') { toast.error('No more hints for this word'); return }
    try {
      const { data } = await api.post('/api/student/hint', { experimentId: expId, word: activeHintWord })
      setHints(prev => ({ ...prev, [activeHintWord]: { used: used + 1, text: data.hint } }))
      setShowHintModal(false)
    } catch (e) { toast.error('Could not get hint') }
  }

  async function submitFeedback() {
    try {
      await api.post('/api/student/feedback', { experimentId: expId, ...feedbackData })
      if (storyIndex === 0) {
        restartStory(1)
      } else {
        setSubmitting(true)
        await api.post('/api/student/submit', { experimentId: expId, totalCorrect: solvedCount, totalAttempts: 0 })
        toast.success('All done!')
        setTimeout(() => window.location.href = '/student', 1500)
      }
    } catch (e) { toast.error('Failed to save progress'); setSubmitting(false) }
  }

  const renderBlankInput = (blank: Blank) => {
    const state = blanksState[blank.key] || { value: '', correct: false, feedback: '' }
    const isLocked = locked[blank.key]
    return (
      <span key={blank.key} className="inline-block mx-1 relative">
        <input
          id={`blank-${blank.key}`}
          type="text"
          value={state.value}
          onChange={e => setBlanksState(prev => ({ ...prev, [blank.key]: { ...state, value: e.target.value } }))}
          onFocus={() => { setActiveBlankKey(blank.key); setActiveHintWord(blank.word) }}
          onKeyDown={e => {
            if (e.key === 'Enter') checkBlank(blank, state.value)
            if (e.key === 'Tab') { e.preventDefault(); focusNextBlank(blank.key) }
          }}
          disabled={isLocked}
          className={`border-b-2 px-1 py-0.5 text-center font-bold text-lg outline-none transition-all ${isLocked ? 'border-green-500 text-green-700 bg-transparent' : state.feedback && !state.correct ? 'border-red-500 bg-red-50 text-red-700 animate-shake' : 'border-purple-300 focus:border-purple-600 bg-purple-50/50'}`}
          style={{ width: `${Math.max(3, blank.word.length)}ch` }}
          autoComplete="off"
        />
        {isLocked && <span className="absolute -top-3 -right-2 text-green-500 text-xs">✓</span>}
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
           if (audioRef.current?.paused) {
             audioRef.current.play(); setIsPlaying(true)
           } else {
             audioRef.current?.pause(); setIsPlaying(false)
           }
        }}
        onSkip={(secs) => { if(audioRef.current) audioRef.current.currentTime += secs }}
        isStoryComplete={isStoryComplete}
      />

      <div className="container mx-auto px-4 py-8 grid lg:grid-cols-4 gap-8">
        <StoryReader
          parsedStory={parsedStory}
          allBlanks={allBlanks}
          currentStory={currentStory}
          sentenceClips={sentenceClips}
          currentSentenceId={currentSentenceId}
          storyIndex={storyIndex}
          isStoryComplete={isStoryComplete}
          onPlaySentence={playSentence}
          onShowFeedback={() => setShowFeedback(true)}
          onGoToStory={restartStory} // Pass the restartStory handler
          renderBlank={renderBlankInput}
          splitSentences={splitSentences}
        />

        <Sidebar
          label={label}
          streak={streak}
          activeBlankKey={activeBlankKey}
          activeHintWord={activeHintWord}
          hints={hints}
          sentenceClips={sentenceClips}
          currentSentenceId={currentSentenceId}
          onGetHint={() => setShowHintModal(true)}
          onPlaySentence={playSentence}
        />
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
