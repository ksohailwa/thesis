import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../../lib/api'
import { toast } from '../../store/toasts'
import { hydrateStudentSession } from '../../lib/studentSession'
import { Clock, Volume2, CheckCircle, XCircle } from 'lucide-react'

type RecallItem = {
  word: string
  audioUrl: string | null
  correctDefinition: string
  definitionOptions: string[]
}

type RecallAnswer = {
  spelling: string
  selectedDefinition: string | null
}

type RecallScore = {
  word: string
  spellingScore: number
  spellingCorrect: boolean
  definitionCorrect: boolean
  definitionScore: number
  combinedScore: number
}

export default function StudentTest() {
  hydrateStudentSession()

  const assignmentId = sessionStorage.getItem('assignmentId') || ''
  const [recallUnlockAt, setRecallUnlockAt] = useState<string | null>(() => sessionStorage.getItem('exp.recallUnlockAt'))
  const story1Done = sessionStorage.getItem('exp.story1Complete') === 'true'
  const story2Done = sessionStorage.getItem('exp.story2Complete') === 'true'

  const [items, setItems] = useState<RecallItem[]>([])
  const [answers, setAnswers] = useState<Record<string, RecallAnswer>>({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [scores, setScores] = useState<RecallScore[] | null>(null)
  const [averages, setAverages] = useState<{
    spellingAverage: number
    definitionAverage: number
    combinedAverage: number
  } | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const base = import.meta.env.VITE_API_BASE_URL || ''
  const [now, setNow] = useState(Date.now())

  // Check if recall test is locked (12-hour wait after Story 2)
  const recallLocked = useMemo(() => {
    if (!recallUnlockAt) return false
    return Date.now() < new Date(recallUnlockAt).getTime()
  }, [recallUnlockAt, now])

  const isReady = assignmentId && story1Done && story2Done && !recallLocked

  useEffect(() => {
    if (!assignmentId || !isReady) return
    setLoading(true)
    api.post('api/student/recall-list', { assignmentId })
      .then(({ data }) => {
        const list = Array.isArray(data?.items) ? data.items : []
        setItems(list)
        // Initialize answers
        const initialAnswers: Record<string, RecallAnswer> = {}
        list.forEach((item: RecallItem) => {
          initialAnswers[item.word] = { spelling: '', selectedDefinition: null }
        })
        setAnswers(initialAnswers)
      })
      .catch((e) => {
        const until = e?.response?.data?.recallUnlockAt
        if (until) {
          sessionStorage.setItem('exp.recallUnlockAt', until)
          setRecallUnlockAt(until)
          toast.error('Recall test is not yet available. Please come back later.')
        } else {
          toast.error('Failed to load recall list')
        }
      })
      .finally(() => setLoading(false))
  }, [assignmentId, isReady])

  useEffect(() => {
    if (!recallUnlockAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [recallUnlockAt])

  const recallRemainingMs = recallUnlockAt ? new Date(recallUnlockAt).getTime() - now : 0
  const recallRemainingSeconds = Math.max(0, Math.ceil(recallRemainingMs / 1000))
  const recallHours = Math.floor(recallRemainingSeconds / 3600)
  const recallMin = Math.floor((recallRemainingSeconds % 3600) / 60)
  const recallSec = recallRemainingSeconds % 60

  const playAudio = (url: string | null) => {
    if (!url || !audioRef.current) return
    const src = url.startsWith('http') ? url : `${base}${url}`
    audioRef.current.src = src
    audioRef.current.currentTime = 0
    audioRef.current.play().catch(() => {})
  }

  const updateAnswer = (word: string, field: 'spelling' | 'selectedDefinition', value: string) => {
    setAnswers(prev => ({
      ...prev,
      [word]: { ...prev[word], [field]: value }
    }))
  }

  // Check if all questions are answered
  const allAnswered = items.every(item => {
    const answer = answers[item.word]
    return answer?.spelling?.trim() && answer?.selectedDefinition
  })

  async function submit() {
    if (!assignmentId || !allAnswered) return

    const payload = items.map((item) => ({
      word: item.word,
      spellingAttempt: answers[item.word]?.spelling || '',
      selectedDefinition: answers[item.word]?.selectedDefinition || '',
      correctDefinition: item.correctDefinition,
    }))

    setSubmitting(true)
    try {
      const { data } = await api.post('api/student/recall-attempt', { assignmentId, items: payload })
      setScores(data?.scores || [])
      setAverages({
        spellingAverage: data?.spellingAverage || 0,
        definitionAverage: data?.definitionAverage || 0,
        combinedAverage: data?.combinedAverage || 0,
      })
      toast.success('Recall test submitted!')
    } catch {
      toast.error('Recall submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (!assignmentId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg text-center space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">Session not found</h2>
          <p className="text-gray-600 text-sm">Please re-enter your join code to continue.</p>
          <a href={`${import.meta.env.BASE_URL || '/'}student`} className="btn primary px-4 py-2 inline-flex justify-center">Go to join page</a>
        </div>
      </div>
    )
  }

  if (!isReady) {
    const unlockDate = recallUnlockAt ? new Date(recallUnlockAt) : null
    const unlockTimeStr = unlockDate
      ? unlockDate.toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : ''

    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-amber-50 via-white to-rose-50">
        <div className="bg-white border border-amber-200 rounded-2xl p-8 shadow-xl max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-800">Recall Test Locked</h2>
            {!story1Done || !story2Done ? (
              <p className="text-gray-600 mt-2">
                Please complete both stories before the recall test becomes available.
              </p>
            ) : recallLocked ? (
              <p className="text-gray-600 mt-2">
                The recall test will be available after a 12-hour waiting period to help measure your long-term memory.
              </p>
            ) : (
              <p className="text-gray-600 mt-2">
                The recall test is ready! Click below to start.
              </p>
            )}
          </div>

          {recallUnlockAt && recallRemainingMs > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-700 mb-2">Time remaining:</p>
              <div className="text-4xl font-bold text-amber-800 font-mono">
                {String(recallHours).padStart(2, '0')}:{String(recallMin).padStart(2, '0')}:{String(recallSec).padStart(2, '0')}
              </div>
              <p className="text-xs text-amber-600 mt-2">
                Available at: {unlockTimeStr}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {story1Done && story2Done && !recallLocked && (
              <button
                className="w-full btn primary py-3"
                onClick={() => window.location.reload()}
              >
                Start Recall Test
              </button>
            )}

            {(!story1Done || !story2Done) && (
              <a href={`${import.meta.env.BASE_URL || '/'}student/run`} className="w-full btn primary py-3 inline-flex justify-center">
                Continue Stories
              </a>
            )}

            <p className="text-xs text-gray-500 mt-4">
              You can close this page and come back later. Your progress is saved.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show results after submission
  if (scores && averages) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 text-gray-900">
        <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
          <div className="bg-white border border-green-200 rounded-2xl p-6 shadow-sm text-center">
            <h1 className="text-2xl font-bold text-green-800 mb-2">Recall Test Complete!</h1>
            <p className="text-sm text-gray-600">Thank you for completing the delayed recall test.</p>
          </div>

          {/* Summary scores */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-blue-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">
                {Math.round(averages.spellingAverage * 100)}%
              </div>
              <div className="text-sm text-gray-600 mt-1">Spelling</div>
            </div>
            <div className="bg-white border border-purple-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-purple-600">
                {Math.round(averages.definitionAverage * 100)}%
              </div>
              <div className="text-sm text-gray-600 mt-1">Definitions</div>
            </div>
            <div className="bg-white border border-green-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-green-600">
                {Math.round(averages.combinedAverage * 100)}%
              </div>
              <div className="text-sm text-gray-600 mt-1">Overall</div>
            </div>
          </div>

          {/* Detailed results */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Detailed Results</h2>
            {scores.map((score, idx) => {
              const item = items.find(i => i.word === score.word)
              const answer = answers[score.word]
              return (
                <div key={`${score.word}-${idx}`} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-gray-800">Word {idx + 1}: {score.word.toUpperCase()}</div>
                    <div className="text-sm text-gray-500">
                      {Math.round(score.combinedScore * 100)}% overall
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className={`p-3 rounded-lg ${score.spellingCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {score.spellingCorrect ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className="font-medium">Spelling</span>
                      </div>
                      <div className="text-gray-600">
                        Your answer: <span className={score.spellingCorrect ? 'text-green-700' : 'text-red-700 line-through'}>{answer?.spelling || '(empty)'}</span>
                      </div>
                      {!score.spellingCorrect && (
                        <div className="text-green-700 mt-1">Correct: {score.word}</div>
                      )}
                    </div>

                    <div className={`p-3 rounded-lg ${score.definitionCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {score.definitionCorrect ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className="font-medium">Definition</span>
                      </div>
                      {!score.definitionCorrect && (
                        <div className="text-green-700 text-xs mt-1">Correct: {item?.correctDefinition}</div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="text-center">
            <a href={`${import.meta.env.BASE_URL || '/'}student`} className="btn primary px-6 py-3 inline-flex justify-center">
              Return to Home
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50 text-gray-900">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div className="bg-white border border-amber-200 rounded-2xl p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-amber-800 mb-2">Delayed Recall Test</h1>
          <p className="text-sm text-gray-600">
            For each word, listen to the audio and:
          </p>
          <ol className="text-sm text-gray-600 mt-2 list-decimal list-inside space-y-1">
            <li>Type the correct spelling</li>
            <li>Select the correct definition from the options</li>
          </ol>
        </div>

        {loading ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm text-center">
            <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            Loading recall test...
          </div>
        ) : (
          <div className="space-y-6">
            {items.map((item, idx) => (
              <div key={`${item.word}-${idx}`} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                {/* Word header with audio */}
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-gray-800">Word {idx + 1}</div>
                  <button
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 transition"
                    onClick={() => playAudio(item.audioUrl)}
                    disabled={!item.audioUrl}
                  >
                    <Volume2 className="w-5 h-5" />
                    {item.audioUrl ? 'Play Audio' : 'Audio unavailable'}
                  </button>
                </div>

                {/* Spelling input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    1. Type the spelling:
                  </label>
                  <input
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg font-semibold text-center focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition"
                    value={answers[item.word]?.spelling || ''}
                    onChange={(e) => updateAnswer(item.word, 'spelling', e.target.value)}
                    placeholder="Type the word here"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                {/* Definition MCQ */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    2. Select the correct definition:
                  </label>
                  <div className="space-y-2">
                    {item.definitionOptions.map((option, optIdx) => {
                      const isSelected = answers[item.word]?.selectedDefinition === option
                      return (
                        <button
                          key={optIdx}
                          className={`w-full text-left px-4 py-3 rounded-xl border-2 transition ${
                            isSelected
                              ? 'border-amber-500 bg-amber-50 text-amber-900'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                          onClick={() => updateAnswer(item.word, 'selectedDefinition', option)}
                        >
                          <span className="font-medium mr-2">{String.fromCharCode(65 + optIdx)}.</span>
                          {option}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}

            {/* Submit button */}
            <button
              className={`w-full py-4 rounded-xl font-bold text-lg transition ${
                allAnswered
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              onClick={submit}
              disabled={submitting || !allAnswered}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Submitting...
                </span>
              ) : allAnswered ? (
                'Submit Recall Test'
              ) : (
                `Answer all questions (${items.filter(i => answers[i.word]?.spelling?.trim() && answers[i.word]?.selectedDefinition).length}/${items.length} complete)`
              )}
            </button>
          </div>
        )}
      </div>
      <audio ref={audioRef} className="hidden" />
    </div>
  )
}
