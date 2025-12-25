import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../../lib/api'
import { toast } from '../../store/toasts'
import { hydrateStudentSession } from '../../lib/studentSession'

type RecallItem = {
  word: string
  audioUrl: string | null
}

export default function StudentTest() {
  hydrateStudentSession()

  const assignmentId = sessionStorage.getItem('assignmentId') || ''
  const [breakUntil, setBreakUntil] = useState<string | null>(() => sessionStorage.getItem('exp.breakUntil'))
  const story1Done = sessionStorage.getItem('exp.story1Complete') === 'true'
  const story2Done = sessionStorage.getItem('exp.story2Complete') === 'true'

  const [items, setItems] = useState<RecallItem[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [scores, setScores] = useState<{ word: string; score: number }[] | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const base = import.meta.env.VITE_API_BASE_URL || ''
  const [now, setNow] = useState(Date.now())

  const breakActive = useMemo(() => {
    if (!breakUntil) return false
    return Date.now() < new Date(breakUntil).getTime()
  }, [breakUntil])

  const isReady = assignmentId && story1Done && story2Done && !breakActive

  useEffect(() => {
    if (!assignmentId || !isReady) return
    setLoading(true)
    api.post('/api/student/recall-list', { assignmentId })
      .then(({ data }) => {
        const list = Array.isArray(data?.items) ? data.items : []
        setItems(list)
      })
      .catch((e) => {
        const until = e?.response?.data?.breakUntil
        if (until) {
          sessionStorage.setItem('exp.breakUntil', until)
          setBreakUntil(until)
          toast.error('Please finish the break before starting recall.')
        } else {
          toast.error('Failed to load recall list')
        }
      })
      .finally(() => setLoading(false))
  }, [assignmentId, isReady])

  useEffect(() => {
    if (!breakUntil) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [breakUntil])

  const breakRemainingMs = breakUntil ? new Date(breakUntil).getTime() - now : 0
  const breakSeconds = Math.max(0, Math.ceil(breakRemainingMs / 1000))
  const breakMin = Math.floor(breakSeconds / 60)
  const breakSec = breakSeconds % 60

  const playAudio = (url: string | null) => {
    if (!url || !audioRef.current) return
    const src = url.startsWith('http') ? url : `${base}${url}`
    audioRef.current.src = src
    audioRef.current.currentTime = 0
    audioRef.current.play().catch(() => {})
  }

  async function submit() {
    if (!assignmentId) return
    const payload = items.map((i) => ({ word: i.word, text: values[i.word] || '' }))
    setSubmitting(true)
    try {
      const { data } = await api.post('/api/student/recall-attempt', { assignmentId, items: payload })
      setScores(data?.scores || [])
      toast.success('Recall submitted')
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
          <a href="/student" className="btn primary px-4 py-2 inline-flex justify-center">Go to join page</a>
        </div>
      </div>
    )
  }

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg text-center space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">Recall test locked</h2>
          <p className="text-gray-600 text-sm">Finish both stories and complete the break before starting the recall test.</p>
          {breakUntil && breakRemainingMs > 0 && (
            <div className="text-2xl font-bold text-amber-700">
              {String(breakMin).padStart(2, '0')}:{String(breakSec).padStart(2, '0')}
            </div>
          )}
          <button
            className="btn primary px-4 py-2 inline-flex justify-center"
            disabled={breakRemainingMs > 0}
            onClick={() => window.location.reload()}
          >
            Resume Recall
          </button>
          <a href="/student/run" className="btn primary px-4 py-2 inline-flex justify-center">Back to stories</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50 text-gray-900">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div className="bg-white border border-amber-200 rounded-2xl p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-amber-800 mb-2">Delayed Recall Test</h1>
          <p className="text-sm text-gray-600">Listen to each word audio and type the spelling from memory.</p>
        </div>

        {loading ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm text-center">
            Loading recall list...
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={`${item.word}-${idx}`} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-700">Word {idx + 1}</div>
                  <button
                    className="px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 text-sm"
                    onClick={() => playAudio(item.audioUrl)}
                    disabled={!item.audioUrl}
                  >
                    {item.audioUrl ? 'Play audio' : 'Audio unavailable'}
                  </button>
                </div>
                <input
                  className="w-full px-3 py-2 border rounded-lg text-lg font-semibold text-center"
                  value={values[item.word] || ''}
                  onChange={(e) => setValues((v) => ({ ...v, [item.word]: e.target.value }))}
                  placeholder="Type spelling here"
                  autoComplete="off"
                />
                {scores && (
                  <div className="text-xs text-gray-500">Score: {scores.find((s) => s.word === item.word)?.score ?? 0}</div>
                )}
              </div>
            ))}
            <button
              className="w-full btn primary py-3"
              onClick={submit}
              disabled={submitting || items.length === 0}
            >
              {submitting ? 'Submitting...' : 'Submit recall'}
            </button>
          </div>
        )}
      </div>
      <audio ref={audioRef} className="hidden" />
    </div>
  )
}
