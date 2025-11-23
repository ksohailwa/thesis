import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../../lib/api'
import { toast } from '../../store/toasts'
import ErrorBoundaryComponent from '../../components/ErrorBoundary'

type HintRequestState = {
  word: string
  hintsUsed: number
  lastHint: string | null
}

type Phase = 'baseline'|'learning'|'reinforcement'|'recall'

export default function RunFullWrapper() {
  return (
    <ErrorBoundaryComponent>
      <RunFull />
    </ErrorBoundaryComponent>
  )
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 30 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.5,
        duration: 3 + Math.random() * 2,
        color: ['#6366f1', '#ec4899', '#f97316','#10b981'][Math.floor(Math.random() * 4)],
      })),
    []
  )

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

function RunFull() {
  const expId = sessionStorage.getItem('exp.experimentId') ||
sessionStorage.getItem('sessionId') || ''
  const condition = (sessionStorage.getItem('exp.condition') ||'with-hints') as 'with-hints'|'without-hints'
  const stories = JSON.parse(sessionStorage.getItem('exp.stories') || '{"A":{"paragraphs":[]},"B":{"paragraphs":[]}}')
  const schedule = JSON.parse(sessionStorage.getItem('exp.schedule')|| '{}') as Record<string, Record<Phase, any>>
  const words: string[] =JSON.parse(sessionStorage.getItem('targetWords') || '[]')
  const label: 'H'|'N' = condition === 'with-hints' ? 'H' : 'N'
  const [storyKey, setStoryKey] = useState<'A'|'B'>('A')
  const paragraphs: string[] = stories?.[storyKey]?.paragraphs || []

  type Blank = { key: string; word: string; occurrence: number;paragraphIndex: number; sentenceIndex: number; charStart?: number; charEnd?: number }
  const effectiveWords = useMemo(() => {
    if (words.length) return words
    const occs = stories?.[storyKey]?.targetOccurrences || []
    const uniq = Array.from(new Set(occs.map((o: any) => (o.word || '').toString()))).filter(Boolean)
    return uniq
  }, [words, stories, storyKey])

  const blanksBySentence = useMemo(() => {
    const map = new Map<string, Blank[]>()
    const phases: Phase[] = ['baseline','learning','reinforcement','recall']
    for (const w of effectiveWords) {
      phases.forEach((ph, i) => {
        const occ = (schedule[w] || {})[ph]
        if (!occ) return
        if ((occ.story || 'A') !== storyKey) return
        const k = `${occ.paragraphIndex}:${occ.sentenceIndex}`
        const arr = map.get(k) || []
        arr.push({ key: `${w}:${i+1}`, word: w, occurrence: i+1,paragraphIndex: occ.paragraphIndex, sentenceIndex: occ.sentenceIndex, charStart: occ.charStart, charEnd: occ.charEnd })
        map.set(k, arr)
      })
    }

    // Fallback: if schedule is missing, derive blanks from story occurrences
    if (map.size === 0) {
      const storyData = stories?.[storyKey]
      const occs: any[] = storyData?.targetOccurrences || []
      const counters: Record<string, number> = {}
      occs.forEach((occ) => {
        const word = occ.word
        counters[word] = (counters[word] || 0) + 1
        const key = `${word}:${counters[word]}`
        const mapKey = `${occ.paragraphIndex}:${occ.sentenceIndex}`
        const arr = map.get(mapKey) || []
        arr.push({
          key,
          word,
          occurrence: counters[word],
          paragraphIndex: occ.paragraphIndex,
          sentenceIndex: occ.sentenceIndex,
          charStart: occ.charStart,
          charEnd: occ.charEnd,
        })
        map.set(mapKey, arr)
      })

      // If still nothing, create blanks inline by scanning paragraphs for targets
      if (map.size === 0 && storyData?.paragraphs?.length) {
        storyData.paragraphs.forEach((para: string, pIdx: number) => {
          const sentences = splitSentences(para)
          sentences.forEach((sent, sIdx) => {
            effectiveWords.forEach((word) => {
              const regex = new RegExp(`\\b${word.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&')}\\b`, 'gi')
              let m: RegExpExecArray | null
              let localCount = 0
              while ((m = regex.exec(sent)) !== null) {
                localCount += 1
                const key = `${word}:${pIdx}:${sIdx}:${localCount}`
                const arr = map.get(`${pIdx}:${sIdx}`) || []
                arr.push({
                  key,
                  word,
                  occurrence: localCount,
                  paragraphIndex: pIdx,
                  sentenceIndex: sIdx,
                  charStart: m.index,
                  charEnd: m.index + m[0].length,
                })
                map.set(`${pIdx}:${sIdx}`, arr)
              }
            })
          })
        })
      }

      // If still nothing, synthesize blanks across sentences so inputs show up
      if (map.size === 0 && storyData?.paragraphs?.length) {
        const sentencesFlat = storyData.paragraphs.flatMap((para: string, pIdx: number) =>
          splitSentences(para).map((_, sIdx) => ({ pIdx, sIdx }))
        )
        const slots = sentencesFlat.length || 1
        effectiveWords.forEach((word, wi) => {
          for (let k = 0; k < 4; k++) {
            const slot = (wi * 4 + k) % slots
            const { pIdx, sIdx } = sentencesFlat[slot] || { pIdx: 0, sIdx: 0 }
            const arr = map.get(`${pIdx}:${sIdx}`) || []
            const occurrence = arr.filter((b) => b.word === word).length + 1
            const key = `${word}:${pIdx}:${sIdx}:synthetic-${occurrence}`
            arr.push({
              key,
              word,
              occurrence,
              paragraphIndex: pIdx,
              sentenceIndex: sIdx,
              charStart: 0,
              charEnd: 0,
            })
            map.set(`${pIdx}:${sIdx}`, arr)
          }
        })
      }
    }

    // Ensure each target word has at least 4 blanks by scanning text; if missing, prepend blanks
    if (paragraphs.length) {
      const sentencesByP = paragraphs.map((para) => splitSentences(para))
      const posKey = (p: number, s: number, start: number) => `${p}:${s}:${start}`
      for (const word of effectiveWords) {
        const existing = Array.from(map.values()).flat().filter((b) => b.word === word)
        const seen = new Set(existing.map((b) => posKey(b.paragraphIndex, b.sentenceIndex, b.charStart ?? -1)))
        let needed = Math.max(0, 4 - existing.length)
        if (needed === 0) continue
        for (let p = 0; p < sentencesByP.length && needed > 0; p++) {
          const sentences = sentencesByP[p]
          for (let s = 0; s < sentences.length && needed > 0; s++) {
            const sent = sentences[s]
            const regex = new RegExp(`\\b${word.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&')}\\b`, 'gi')
            let m: RegExpExecArray | null
            while ((m = regex.exec(sent)) !== null && needed > 0) {
              const start = m.index
              const pos = posKey(p, s, start)
              if (seen.has(pos)) continue
              const arr = map.get(`${p}:${s}`) || []
              const occurrence = arr.filter((b) => b.word === word).length + 1
              const key = `${word}:${p}:${s}:${occurrence}`
              arr.push({
                key,
                word,
                occurrence,
                paragraphIndex: p,
                sentenceIndex: s,
                charStart: start,
                charEnd: start + m[0].length,
              })
              map.set(`${p}:${s}`, arr)
              seen.add(pos)
              needed -= 1
            }
          }
        }
        // If still short, prepend placeholder blanks at sentence starts
        for (let p = 0; p < sentencesByP.length && needed > 0; p++) {
          const sentences = sentencesByP[p]
          for (let s = 0; s < sentences.length && needed > 0; s++) {
            const arr = map.get(`${p}:${s}`) || []
            const occurrence = arr.filter((b) => b.word === word).length + 1
            const key = `${word}:${p}:${s}:placeholder-${occurrence}`
            arr.push({
              key,
              word,
              occurrence,
              paragraphIndex: p,
              sentenceIndex: s,
              charStart: 0,
              charEnd: 0,
            })
            map.set(`${p}:${s}`, arr)
            needed -= 1
          }
        }
      }
    }

    return map
  }, [schedule, words, storyKey, stories, paragraphs])

  // Blank input states
  const [blanks, setBlanks] = useState<Record<string, { value: string;
 correct: boolean; feedback: string }>>({})
  const [hints, setHints] = useState<Record<string,HintRequestState>>({})
  const [activeHintWord, setActiveHintWord] = useState<string |null>(null)
  const [showHintModal, setShowHintModal] = useState(false)

  // Existing states (keep as-is)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [attempts, setAttempts] = useState<Record<string, number>>({})
  const [locked, setLocked] = useState<Record<string, boolean>>({})
  const [posDiffs, setPosDiffs] = useState<Record<string, boolean[]>>({})
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [durations, setDurations] = useState<Record<string,number>>({})
  const [segments, setSegments] = useState<string[][]>([])
  const [cur, setCur] = useState<{ p: number; s: number }>({ p: 0, s:0 })
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState({ difficulty: 3, enjoyment:3, comment: '', effort: 'medium' as 'low' | 'medium' | 'high' })
  const [lookupWord, setLookupWord] = useState<string | null>(null)
  const [definition, setDefinition] = useState<string>('')
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const [offsets, setOffsets] = useState<number[][]>([])
  const [isOnline, setIsOnline] = useState(true)
  const [pendingAttempts, setPendingAttempts] = useState<any[]>([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const segRef = useRef<HTMLAudioElement>(null)
  const base = import.meta.env.VITE_API_BASE_URL || ''
  // Helper functions
  function splitSentences(text: string): string[] {
    const parts: string[] = []
    const re = /([^.!?]*[.!?])/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) parts.push(m[1].trim())
    if (parts.length === 0 && text.trim()) parts.push(text.trim())
    return parts
  }

  // Check blank function
  async function checkBlank(blankKey: string, targetWord: string,attempt: string) {
    if (!attempt.trim()) {
      toast.error('Please type something')
      return
    }

    const isCorrect = attempt.toLowerCase().trim() === targetWord.toLowerCase().trim()

    if (isCorrect) {
      setBlanks(prev => ({
        ...prev,
        [blankKey]: { value: attempt, correct: true, feedback:'correct' }
      }))
      setLocked(prev => ({ ...prev, [blankKey]: true }))
      toast.success('Correct! 👏')
      setStreak(streak + 1)
      setMaxStreak(Math.max(maxStreak, streak + 1))
      try {
        await api.post('/api/student/attempt', {
          experimentId: expId,
          word: targetWord,
          attempt,
          correct: true,
          story: storyKey,
        })
      } catch (e) {
        console.error('Failed to record attempt', e)
        setPendingAttempts(prev => [...prev, { word: targetWord,attempt, correct: true }])
      }
    } else {
      let feedback = ''
      for (let i = 0; i < Math.min(attempt.length, targetWord.length);i++) {
        if (attempt[i].toLowerCase() === targetWord[i].toLowerCase())
{
          feedback += '✓'
        } else {
          feedback += '✗'
        }
      }
      if (attempt.length < targetWord.length) {
        feedback += ` +${targetWord.length - attempt.length}`
      }

      setBlanks(prev => ({
        ...prev,
        [blankKey]: { value: attempt, correct: false, feedback: `Try again: ${feedback}` }
      }))

      try {
        await api.post('/api/student/attempt', {
          experimentId: expId,
          word: targetWord,
          attempt,
          correct: false,
          feedback,
          story: storyKey,
        })
      } catch (e) {
        setPendingAttempts(prev => [...prev, { word: targetWord,attempt, correct: false }])
      }
    }
  }

  // Get hint function
  async function getHint() {
    if (!activeHintWord) return

    const hintData = hints[activeHintWord] || { word: activeHintWord,hintsUsed: 0, lastHint: null }
    if (hintData.hintsUsed >= 3 && label === 'H') {
      toast.error('No more hints available for this word')
      return
    }

    try {
      const { data } = await api.post('/api/student/hint', {
        experimentId: expId,
        word: activeHintWord,
      })

      const hintText = data.hint || 'Think about the spelling carefully'
      setHints(prev => ({
        ...prev,
        [activeHintWord]: {
          word: activeHintWord,
          hintsUsed: hintData.hintsUsed + 1,
          lastHint: hintText
        }
      }))
      toast.info(`💡 Hint: ${hintText}`)
      setShowHintModal(false)
    } catch (e) {
      toast.error('Failed to get hint')
    }
  }

  // Submit test function
  async function submitTest() {
    const allLocked = allKeys.every(k => locked[k])
    if (!allLocked) {
      toast.error('Please complete all blanks correctly first')
      return
    }

    if (storyKey === 'A') {
      // Move to Story 2
      continueToStoryTwo()
      return
    }

    // Both stories done - submit
    setSubmitting(true)
    try {
      await api.post('/api/student/submit', {
        experimentId: expId,
        difficulty: feedback.difficulty,
        enjoyment: feedback.enjoyment,
        effort: feedback.effort,
        comment: feedback.comment,
        totalCorrect: allKeys.filter(k => locked[k]).length,
        totalAttempts: allKeys.length,
      })
      toast.success('Test submitted! Thank you for participating.')
      setTimeout(() => window.location.href = '/student/join', 2000)
    } catch (e) {
      toast.error('Failed to submit test')
    } finally {
      setSubmitting(false)
    }
  }

  function renderSentence(sentence: string, blanksInSentence: Blank[]) {
    if (!blanksInSentence.length) {
      return <span>{sentence}</span>
    }

    const sorted = [...blanksInSentence].sort((a, b) => (a.charStart ?? 0) - (b.charStart ?? 0))
    const parts: JSX.Element[] = []
    let cursor = 0

    sorted.forEach((blank, idx) => {
      const word = blank.word
      const key = blank.key
      const blankData = blanks[key] || { value: '', correct: false, feedback: '' }
      const isCorrect = blankData.correct
      const blankValue = blankData.value || ''

      const wordLower = word.toLowerCase()
      let start = sentence.toLowerCase().indexOf(wordLower, cursor)
      if (start < 0 && typeof blank.charStart === 'number' && blank.charStart < sentence.length) {
        start = blank.charStart
      }
      if (start < 0) start = cursor
      const end = start + word.length

      if (cursor < start) {
        parts.push(<span key={`text-${key}-${idx}`}>{sentence.slice(cursor, start)}</span>)
      }

      parts.push(
        <input
          key={key}
          type="text"
          value={blankValue}
          onChange={(e) =>
            setBlanks((prev) => ({
              ...prev,
              [key]: { ...prev[key], value: e.target.value, correct: false, feedback: '' },
            }))
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = (e.target as HTMLInputElement).value
              checkBlank(key, word, val)
            }
          }}
          disabled={locked[key]}
          className={`inline-block border-2 px-1 py-0.5 rounded font-semibold text-center focus:outline-none transition ${
            isCorrect
              ? 'border-green-500 bg-green-50'
              : blankValue && !isCorrect
              ? 'border-red-500 bg-red-50'
              : 'border-gray-300 bg-white focus:border-blue-500'
          }`}
          style={{ width: `${Math.max(4, word.length)}ch` }}
          placeholder="_"
          autoComplete="off"
        />
      )

      cursor = end
    })

    if (cursor < sentence.length) {
      parts.push(<span key="tail">{sentence.slice(cursor)}</span>)
    }

    return <span className="break-words">{parts}</span>
  }

  // Existing helper functions
  function hasBlanks(p: number, s: number) { return (blanksBySentence.get(`${p}:${s}`) || []).length > 0 }
  function allLocked(p: number, s: number) {
    const arr = blanksBySentence.get(`${p}:${s}`) || []
    if (!arr.length) return true
    return arr.every(b => !!locked[b.key])
  }

  function skip(delta: number) {
    if (!audioRef.current) return
    try { audioRef.current.currentTime = Math.max(0,audioRef.current.currentTime + delta) } catch {}
  }

  function focusNextBlank() {
    const ordered: string[] = []
    for (let p = 0; p < paragraphs.length; p++) {
      const parts = splitSentences(paragraphs[p])
      for (let s = 0; s < parts.length; s++) {
        const arr = blanksBySentence.get(`${p}:${s}`) || []
        arr.forEach((b) => ordered.push(b.key))
      }
    }
    const next = ordered.find((k) => !locked[k])
    if (next) {
      document.getElementById(`blank-${next}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      document.getElementById(`blank-${next}`)?.focus()
    }
  }

  function continueToStoryTwo() {
    setStoryKey('B')
    setBlanks({})
    setAnswers({})
    setAttempts({})
    setLocked({})
    setHints({})
    setPosDiffs({})
    setSegments([])
    setOffsets([])
    setCur({ p: 0, s: 0 })
    setStreak(0)
    setShowFeedback(false)
    setShowConfetti(false)
    audioRef.current?.pause()
    segRef.current?.pause()
  }

  const allKeys: string[] = useMemo(() => {
    const ordered: string[] = []
    for (let p = 0; p < paragraphs.length; p++) {
      const parts = splitSentences(paragraphs[p])
      for (let s = 0; s < parts.length; s++) {
        const arr = blanksBySentence.get(`${p}:${s}`) || []
        arr.forEach(b => ordered.push(b.key))
      }
    }
    return ordered
  }, [paragraphs, blanksBySentence])

  const storyDone = allKeys.every(k => !!locked[k])
  const bothDone = storyDone && storyKey === 'B'
  const solvedCount = allKeys.filter((k) => locked[k]).length
  const totalAttempts = Object.values(attempts).reduce((sum, val) => sum + val, 0)
  const accuracy = totalAttempts ? Math.max(0, Math.min(100, Math.round((solvedCount / totalAttempts) * 100))) : solvedCount > 0 ? 100 : 0

  useEffect(() => {
    if (!storyDone) return
    setShowConfetti(true)
    const timer = setTimeout(() => setShowConfetti(false), 3500)
    return () => clearTimeout(timer)
  }, [storyDone, storyKey])

  useEffect(() => {
    if (!allKeys.length || !storyDone) return
    const timer = setTimeout(() => setShowFeedback(true), 1500)
    return () => clearTimeout(timer)
  }, [allKeys, storyDone])

  const storyLabel = storyKey === 'A' ? '1' : '2'
  const progressPct = allKeys.length ? (solvedCount / allKeys.length) * 100 : 0

  // Load audio
  useEffect(() => {
    (async () => {
      const audioLabel = label === 'H' ? 'H' : 'N'
      const full = `/static/audio/${expId}/${audioLabel}.mp3`
      if (audioRef.current) {
        audioRef.current.src = `${base}${full}`
        const cefr = (sessionStorage.getItem('exp.level') ||'B1').toUpperCase()
        const rate = cefr === 'A2' ? 0.85 : cefr === 'B1' ? 0.9 : cefr=== 'B2' ? 0.95 : cefr === 'C1' ? 1.0 : 1.05
        audioRef.current.playbackRate = rate
      }
    })()
  }, [expId, label, base])

  // Restore progress from sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`progress-${expId}`)
      if (saved) {
        const state = JSON.parse(saved)
        setStoryKey(state.storyKey)
        setBlanks(state.blanks || {})
        setLocked(state.locked || {})
        setHints(state.hints || {})
      }
    } catch (err) {
      console.error('Failed to restore progress', err)
    }
  }, [expId])

  // Save progress periodically
  useEffect(() => {
    if (!expId) return
    const saveState = () => {
      const state = {
        storyKey,
        blanks,
        locked,
        hints,
        activeKey,
        cur,
        timestamp: Date.now(),
      }
      sessionStorage.setItem(`progress-${expId}`,JSON.stringify(state))
    }

    const interval = setInterval(saveState, 5000)
    return () => {
      clearInterval(interval)
      saveState()
    }
  }, [expId, storyKey, blanks, locked, hints, activeKey, cur])

  async function submitFeedback() {
    setSubmitting(true)
    try {
      await api.post('/api/student/feedback', {
        experimentId: expId,
        difficulty: feedback.difficulty,
        enjoyment: feedback.enjoyment,
        effort: feedback.effort,
        comment: feedback.comment,
      })
      toast.success('Feedback submitted!')
      setShowFeedback(false)
      if (storyKey === 'A') {
        continueToStoryTwo()
      } else {
        await submitTest()
      }
    } catch (e) {
      toast.error('Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="transition-colors duration-300">
      {/* Header with Progress */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b shadow-lg transition-colors">
        <div className="container py-4">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">
                Progress: {solvedCount} / {allKeys.length || 0}
              </span>
              <span className="text-sm font-medium text-purple-600">Story {storyLabel} of 2</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Audio Player */}
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-3 border border-purple-200">
            <audio ref={audioRef} controls className="w-full mb-2" />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => audioRef.current?.play()}
className="px-3 py-1 bg-white rounded text-xs font-medium hover:shadow transition-colors">▶ Play</button>
              <button onClick={() => audioRef.current?.pause()}
className="px-3 py-1 bg-white rounded text-xs font-medium hover:shadow transition-colors">⏸ Pause</button>
              <button onClick={() => skip(-3)} className="px-3 py-1 bg-white rounded text-xs font-medium hover:shadow transition-colors">⏪ -3s</button>
              <button onClick={() => skip(3)} className="px-3 py-1 bg-white rounded text-xs font-medium hover:shadow transition-colors">+3s ⏩</button>
              <button onClick={focusNextBlank} className="px-3 py-1 bg-white rounded text-xs font-medium hover:shadow transition-colors">Next Blank</button>
              {streak > 0 && <span className="ml-auto px-3 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">🔥 Streak:
{streak}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Story - 3 cols */}
          <div className="lg:col-span-3">
            {bothDone && (
              <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-300">
              <div className="text-4xl mb-2">🎉</div>
                <h2 className="text-2xl font-bold text-green-900">Both stories complete!</h2>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-lg p-6 space-y-4 transition-colors">
              {paragraphs.map((p, pi) => {
                const sentences = splitSentences(p)
                return (
                  <div key={pi}>
                    <div className="text-lg leading-relaxed space-y-2">
                      {sentences.map((s, si) => {
                        const blanksHere = blanksBySentence.get(`${pi}:${si}`) || []
                        const isComplete = blanksHere.every((b) =>locked[b.key])
                        return (
                          <span
                            key={si}
                            className={`inline-block transition-all ${ 
                              isComplete ? 'bg-green-50 px-1 rounded' : ''
                            }`}
                          >
                            {renderSentence(s, blanksHere)}{' '}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {storyDone && storyKey === 'A' && (
              <div className="mt-6 p-6 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl border-2 border-purple-300 text-center transition-colors">
                <h3 className="text-xl font-bold text-purple-900 mb-2">Great job on Story 1!</h3>
                <button
                  onClick={continueToStoryTwo}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                >
                  Continue to Story 2 →
                </button>
              </div>
            )}

            {storyDone && storyKey === 'B' && (
              <div className="mt-6 p-6 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl border-2 border-green-300 text-center transition-colors">
                <button
                  onClick={submitTest}
                  disabled={submitting}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? '⏳ Submitting...' : '✅ Submit Test'}
                </button>
              </div>
            )}
          </div>

          {/* Hints Panel - 1 col */}
          <div className="lg:col-span-1 space-y-4">
            {/* Stats */}
            <div className="bg-white rounded-xl shadow-lg p-4 transition-colors">
              <h3 className="font-bold text-gray-800 mb-3">📊 Stats</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Correct:</span>
                  <span className="font-bold text-green-600">{solvedCount}/{allKeys.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Accuracy:</span>
                  <span className="font-bold text-blue-600">{accuracy}%</span>
                </div>
                {maxStreak > 0 && (
                  <div className="flex justify-between">
                    <span>Best Streak:</span>
                    <span className="font-bold text-orange-600">{maxStreak}🔥</span>
                  </div>
                )}
              </div>
            </div>

            {/* Hints Panel */}
            {label === 'H' && (
              <div className="bg-amber-50 rounded-xl shadow-lg border-2 border-amber-200 p-4 transition-colors">
                <h3 className="font-bold text-amber-900 mb-3">💡
Hints</h3>
                {activeHintWord ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-amber-900">Word: {activeHintWord}</div>
                    {hints[activeHintWord]?.lastHint && (
                      <div className="p-2 bg-white rounded border border-amber-200 text-sm text-gray-800">
                        {hints[activeHintWord].lastHint}
                      </div>
                    )}
                    <div className="text-xs text-amber-700">
                      Hints used: {hints[activeHintWord]?.hintsUsed ||  0}/3
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-700">Select a word and click 💡 to get a hint</p>
                )}
              </div>
            )}

            {label === 'N' && (
              <div className="bg-red-50 rounded-xl shadow-lg border-2 border-red-200 p-4 transition-colors">
                <h3 className="font-bold text-red-900 mb-2">🚫 No Hints</h3>
                <p className="text-xs text-red-700">This condition has   hints disabled.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedback && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border transition-colors">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">How was that?</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Difficulty</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button
                      key={v}
                      onClick={() => setFeedback(f => ({ ...f, difficulty: v }))}
                      className={`flex-1 py-2 rounded text-xs font-medium transition-colors ${ 
                        feedback.difficulty === v ? 'bg-purple-600 text-white' : 'bg-gray-200'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Mental Effort</label>
                <div className="space-y-1">
                  {['low', 'medium', 'high'].map(e => (
                    <label key={e} className="flex items-center gap-2 text-gray-700">
                      <input
                        type="radio"
                        name="effort"
                        value={e}
                        checked={feedback.effort === e}
                        onChange={() => setFeedback(f => ({ ...f, effort: e as any }))}
                        className="accent-purple-600"
                      />
                      <span className="text-sm capitalize">{e}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowFeedback(false)}
                className="flex-1 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={submitFeedback}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? '⏳...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hint Modal */}
      {showHintModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border transition-colors">
            <h3 className="text-lg font-bold mb-4 text-gray-900">Get a Hint</h3>
            <p className="text-sm text-gray-600 mb-4">Word: <strong>{activeHintWord}</strong></p>
            <button
              onClick={getHint}
              className="w-full px-4 py-2 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors"
            >
              Show Hint
            </button>
            <button
              onClick={() => setShowHintModal(false)}
              className="w-full mt-2 px-4 py-2 border rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showConfetti && <Confetti />}
    </div>
  )
}
