import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import LoadingScreen from '../../components/LoadingScreen'

export default function TeacherAnalyticsPicker() {
  const [experiments, setExperiments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
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
    loadExperiments()
  }, [])

  if (loading) return <LoadingScreen message="Loading experiments..." />

  return (
    <div className="space-y-6 text-gray-900">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Select an experiment</h1>
        <p className="text-sm text-gray-600">Choose an experiment to view analytics.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-2">
        {experiments.length === 0 && (
          <div className="text-sm text-gray-600">No experiments yet.</div>
        )}
        {experiments.map((exp) => {
          const expId = exp._id || exp.id
          const status = exp.status || 'draft'
          return (
            <button
              key={expId}
              onClick={() => nav(`/teacher/experiments/${expId}/analytics`)}
              className="w-full text-left border rounded-xl p-3 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-900">{exp.title}</div>
                <span className="text-xs text-gray-500">{status}</span>
              </div>
              <div className="text-xs text-gray-500">
                Code: <span className="font-mono">{exp.classCode || exp.code || 'N/A'}</span>
              </div>
            </button>
          )}
        )}
      </div>
    </div>
  )
}
