import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import LoadingScreen from '../../components/LoadingScreen'

export default function TeacherHome() {
  const [experiments, setExperiments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<'all' | 'draft' | 'live' | 'closed'>('all')
  const nav = useNavigate()

  useEffect(() => {
    loadExperiments()

    const interval = setInterval(() => {
      loadExperiments()
    }, 15000)

    return () => clearInterval(interval)
  }, [])

  async function loadExperiments() {
    try {
      const { data } = await api.get('/api/experiments')
      setExperiments(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to load experiments', e)
    } finally {
      setLoading(false)
    }
  }

  async function createNew() {
    const title = prompt('Experiment title:')
    if (!title?.trim()) return
    const level = prompt('CEFR Level (A1, A2, B1, B2, C1, C2):', 'B1')
    if (!level) return
    setCreating(true)
    try {
      const { data } = await api.post('/api/experiments', { title: title.trim(), level: level.toUpperCase() })
      const expId = data?.id || data?._id
      if (expId) nav(`/teacher/experiments/${expId}/words`)
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <LoadingScreen message="Loading experiments..." />

  const filtered = filter === 'all' ? experiments : experiments.filter((e) => e.status === filter)
  const stats = {
    total: experiments.length,
    draft: experiments.filter((e) => e.status === 'draft').length,
    live: experiments.filter((e) => e.status === 'live').length,
    closed: experiments.filter((e) => e.status === 'closed').length,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="container py-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Teacher Dashboard
            </h1>
            <p className="text-gray-600 text-sm mt-1">Manage your spelling experiments</p>
          </div>
          <button className="btn primary px-6 py-3" onClick={createNew} disabled={creating}>
            {creating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                Creating...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-xl">+</span>
                New Experiment
              </span>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { key: 'all', label: 'Total', value: stats.total, color: 'blue' },
            { key: 'draft', label: 'Drafts', value: stats.draft, color: 'orange' },
            { key: 'live', label: 'Live', value: stats.live, color: 'green' },
            { key: 'closed', label: 'Completed', value: stats.closed, color: 'gray' },
          ].map((card) => (
            <button
              key={card.key}
              onClick={() => setFilter(card.key as any)}
              className={`p-6 rounded-2xl border-2 transition-all text-left ${
                filter === card.key ? `border-${card.color}-500 bg-${card.color}-50 shadow-lg` : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="text-3xl">{card.key === 'live' ? '✅' : card.key === 'draft' ? '✍️' : '📚'}</div>
                <div className={`text-2xl font-bold text-${card.color}-600`}>{card.value}</div>
              </div>
              <div className="text-sm font-medium text-gray-600">{card.label} Experiments</div>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🗂️</div>
            <h3 className="text-xl font-semibold mb-2">
              {filter === 'all' ? 'No experiments yet' : `No ${filter} experiments`}
            </h3>
            <p className="text-gray-600 mb-6">
              {filter === 'all' ? 'Create your first experiment to get started' : 'Try changing the filter or create a new experiment'}
            </p>
            {filter === 'all' && (
              <button className="btn primary px-8 py-3" onClick={createNew}>
                Create Your First Experiment
              </button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((exp) => {
              const expId = exp._id || exp.id;
              const level = exp.level || exp.cefr || 'N/A';
              const status = exp.status || 'draft';
              const classCode = exp.classCode || exp.code || 'N/A';
              return (
                <div
                  key={expId}
                className="group bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-400 hover:shadow-xl transition overflow-hidden"
              >
                <div
                  className={`h-2 ${
                    status === 'live'
                      ? 'bg-green-500'
                      : status === 'draft'
                      ? 'bg-orange-500'
                      : 'bg-gray-400'
                  }`}
                />

                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <h3 className="font-bold text-lg mb-1 line-clamp-2 group-hover:text-blue-600 transition">
                        {exp.title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="px-2 py-0.5 bg-gray-100 rounded font-medium">{level}</span>
                        <div className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded">
                          <span className="font-mono text-xs font-semibold">{classCode}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigator.clipboard.writeText(classCode)
                              toast.success('Code copied!')
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer ml-1"
                            title="Copy to clipboard"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full ${
                        status === 'live'
                          ? 'bg-green-100 text-green-700'
                          : status === 'draft'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {status}
                    </span>
                  </div>

                  <div className="flex gap-2 items-center justify-between">
                    <div className="text-xs text-gray-500">
                      Code: <span className="font-mono">{classCode}</span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(classCode);
                        toast.success('Code copied!');
                      }}
                      className="text-xs px-2 py-1 border rounded hover:bg-gray-100"
                      title="Copy code"
                    >
                      Copy
                    </button>
                  </div>

                  <button
                    className="btn primary w-full text-sm font-semibold"
                    onClick={() => nav(`/teacher/experiments/${expId}`)}
                  >
                    Manage →
                  </button>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  )
}
