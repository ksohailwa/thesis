import { useState } from 'react'
import api from '../../lib/api'
import { useNavigate, Link } from 'react-router-dom'
import LoadingScreen from '../../components/LoadingScreen'

export default function StudentJoin() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedCode = code.trim().toUpperCase()
    if (!trimmedCode || trimmedCode.length < 4) {
      setError('Please enter a valid class code (4+ characters)')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/api/student/join', { code: trimmedCode })
      sessionStorage.clear()
      if (data?.experiment) {
        sessionStorage.setItem('sessionId', data.experiment.id)
        sessionStorage.setItem('exp.experimentId', data.experiment.id)
        sessionStorage.setItem('exp.condition', data.condition || 'with-hints')
        if (data.experiment.level) sessionStorage.setItem('exp.level', data.experiment.level)
        sessionStorage.setItem('exp.stories', JSON.stringify(data.stories || {}))
        sessionStorage.setItem('exp.schedule', JSON.stringify(data.schedule || {}))
        sessionStorage.setItem('targetWords', JSON.stringify(data.experiment.targetWords || []))
        nav('/student/run')
        return
      }
      sessionStorage.setItem('sessionId', data.sessionId)
      sessionStorage.setItem('exp.condition', data.condition || 'with-hints')
      sessionStorage.setItem('targetWords', JSON.stringify(data.targetWords || []))
      nav('/student/run')
    } catch (e: any) {
      const msg = e?.response?.data?.error
      if (!e?.response || e?.code === 'ERR_NETWORK') setError('Cannot connect to server. Please check your internet connection.')
      else if (msg?.toLowerCase().includes('not live')) setError('This experiment is not active yet. Check with your teacher.')
      else if (msg?.toLowerCase().includes('not found')) setError('Invalid join code. Please check and try again.')
      else setError(msg || 'Failed to join. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingScreen message="Joining experiment..." />

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-2xl">
              S
            </div>
          </Link>
          <h1 className="text-3xl font-bold mt-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Welcome, Student!
          </h1>
          <p className="text-gray-600 mt-2">Enter your join code to start the experiment</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl border-2 border-gray-200 p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-400/10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-400/10 rounded-full -ml-12 -mb-12"></div>

          <form onSubmit={submit} className="relative space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3 text-center">Enter Join Code</label>
              <input
                className="w-full text-center text-4xl font-bold tracking-[0.5em] py-6 px-4 border-2 border-gray-300 rounded-2xl focus:ring-4 focus:ring-purple-500 focus:border-purple-500 transition uppercase"
                placeholder="ABC123"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                autoFocus
              />
              <p className="text-xs text-gray-500 text-center mt-2">Ask your teacher for the join code</p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <span className="text-red-500 text-xl">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900">Cannot Join</p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <button
              disabled={loading || !code}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-2xl font-bold text-lg hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                  Joining Experiment...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>Join Experiment</span>
                  <span className="text-2xl">→</span>
                </span>
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center space-y-3">
          <div className="flex items-center justify-center gap-8 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span role="img" aria-label="listen">🎧</span>
              <span>Listen to stories</span>
            </div>
            <div className="flex items-center gap-2">
              <span role="img" aria-label="write">✍️</span>
              <span>Practice spelling</span>
            </div>
            <div className="flex items-center gap-2">
              <span role="img" aria-label="track">📊</span>
              <span>Track progress</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
