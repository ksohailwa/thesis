import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import api from '../../lib/api'
import { logger } from '../../lib/logger'
import LoadingScreen from '../../components/LoadingScreen'
import StoryManager from './StoryManager'
import { toast } from '../../store/toasts'

type ExperimentStatus = 'draft' | 'live' | 'closed'
type Condition = 'with-hints' | 'without-hints'

const participationEnabled = import.meta.env.VITE_ENABLE_PARTICIPATION === 'true'

export default function TeacherManage() {
  const { id: expId } = useParams()
  const nav = useNavigate()

  const [title, setTitle] = useState('')
  const [level, setLevel] = useState('')
  const [loading, setLoading] = useState(true)
  const [experimentStatus, setExperimentStatus] = useState<ExperimentStatus>('draft')
  const [assignedCondition, setAssignedCondition] = useState<Condition>('with-hints')
  const [launchLoading, setLaunchLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [participation, setParticipation] = useState<any>(null)
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [studentProgress, setStudentProgress] = useState<any>(null)
  const [loadingStudent, setLoadingStudent] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!expId) return
    loadExperiment()
  }, [expId])

  async function loadExperiment() {
    if (!expId) return
    setLoading(true)
    try {
      const { data } = await api.get(`/api/experiments/${expId}`)
      setTitle(data.title || '')
      setLevel(data.level || data.cefr || '')
      setExperimentStatus(data.status || 'draft')
      setAssignedCondition(data.assignedCondition || 'with-hints')
      if (data.status === 'live') await fetchParticipation()
    } catch {
      toast.error('Failed to load experiment')
      nav('/teacher')
    } finally {
      setLoading(false)
    }
  }

  async function fetchParticipation() {
    if (!participationEnabled) return
    if (!expId) return
    try {
      const { data } = await api.get(`/api/experiments/${expId}/participation`)
      setParticipation(data)
    } catch (e: any) {
      // Endpoint may not exist in some setups; ignore 404 to avoid noisy errors
      const status = e?.response?.status
      if (status !== 404) {
        logger.error('Failed to fetch participation', e)
      }
    }
  }

  async function launchExperiment() {
    if (!expId) return
    setLaunchLoading(true)
    setStatusMessage('')
    try {
      const { data } = await api.post(`/api/experiments/${expId}/launch`, { condition: assignedCondition })
      setExperimentStatus(data?.status || 'live')
      setStatusMessage(`Experiment launched! Join code: ${data.code}`)
      toast.success(`Experiment launched! Code: ${data.code}`)
      await fetchParticipation()
    } catch (e: any) {
      const error = e?.response?.data?.error || 'Failed to launch'
      setStatusMessage(`Launch failed: ${error}`)
      toast.error(error)
    } finally {
      setLaunchLoading(false)
    }
  }

  async function closeExperiment() {
    if (!expId) return
    try {
      await api.post(`/api/experiments/${expId}/status`, { status: 'closed' })
      setExperimentStatus('closed')
      setStatusMessage('Experiment closed')
      toast.success('Experiment closed')
    } catch (e: any) {
      const error = e?.response?.data?.error || 'Failed to close'
      setStatusMessage(`Close failed: ${error}`)
      toast.error(error)
    }
  }

  async function reopenExperiment() {
    if (!expId) return
    try {
      await api.post(`/api/experiments/${expId}/status`, { status: 'live' })
      setExperimentStatus('live')
      setStatusMessage('Experiment re-opened and set to live')
      toast.success('Experiment re-opened')
      await fetchParticipation()
    } catch (e: any) {
      const error = e?.response?.data?.error || 'Failed to reopen'
      setStatusMessage(`Re-open failed: ${error}`)
      toast.error(error)
    }
  }

  async function deleteExperiment() {
    if (!expId) return
    try {
      await api.delete(`/api/experiments/${expId}`)
      toast.success('Experiment deleted')
      nav('/teacher')
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Delete failed')
    } finally {
      setShowDeleteConfirm(false)
    }
  }

  async function viewStudentProgress(studentId: string) {
    if (!expId) return
    setLoadingStudent(true)
    setSelectedStudent(studentId)
    try {
      const { data } = await api.get(`/api/experiments/${expId}/student/${studentId}`)
      setStudentProgress(data)
    } catch {
      toast.error('Failed to load student progress')
      setSelectedStudent(null)
    } finally {
      setLoadingStudent(false)
    }
  }

  if (loading) return <LoadingScreen />

  const statusIsError = statusMessage.toLowerCase().includes('fail') || statusMessage.toLowerCase().includes('error')

  return (
    <div className="space-y-8 text-gray-900 transition-colors duration-300">
      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Link to="/teacher" className="text-sm text-blue-600 hover:underline mb-2 inline-flex items-center gap-2">
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </Link>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {title}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Level: <span className="font-semibold">{level}</span> | Status:{' '}
              <span
                className={
                  experimentStatus === 'live'
                    ? 'text-green-600 font-semibold'
                    : experimentStatus === 'draft'
                    ? 'text-amber-600 font-semibold'
                    : 'text-gray-600 font-semibold'
                }
              >
                {experimentStatus}
              </span>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center justify-end">
            <Link
              to={`/teacher/experiments/${expId}/analytics`}
              className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold hover:border-gray-300 transition"
            >
              Analytics
            </Link>
            {experimentStatus === 'draft' && (
              <>
                <select
                  value={assignedCondition}
                  onChange={(e) => setAssignedCondition(e.target.value as Condition)}
                  className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium hover:border-gray-300 transition"
                >
                  <option value="with-hints">With Hints</option>
                  <option value="without-hints">Without Hints</option>
                </select>
                <button
                  className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg font-semibold disabled:opacity-50 transition"
                  onClick={launchExperiment}
                  disabled={launchLoading}
                >
                  {launchLoading ? 'Launching...' : 'Launch'}
                </button>
              </>
            )}
            {experimentStatus === 'live' && (
              <button
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition"
                onClick={closeExperiment}
              >
                Close
              </button>
            )}
            {experimentStatus === 'closed' && (
              <button
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition"
                onClick={reopenExperiment}
              >
                Re-open
              </button>
            )}
          </div>
        </div>
        {statusMessage && (
          <div
            className={`mt-4 px-4 py-2 text-sm font-medium rounded-lg border ${
              statusIsError ? 'bg-red-50 text-red-800 border-red-200' : 'bg-green-50 text-green-800 border-green-200'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span>{statusMessage}</span>
              <button
                className="px-3 py-1 border-2 border-gray-200 rounded-lg text-xs font-semibold hover:border-gray-300 transition"
                onClick={loadExperiment}
              >
                Refresh
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100 transition-colors">
        <StoryManager experimentId={expId || ''} compact={false} />
      </div>

      {experimentStatus === 'live' && participation && (
        <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100 transition-colors">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Student Participation
            </h2>
            <button
              className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium hover:border-gray-300 transition"
              onClick={fetchParticipation}
            >
              Refresh
            </button>
          </div>
          {participation.students && participation.students.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left p-3 text-gray-700">Student</th>
                    <th className="text-left p-3 text-gray-700">Condition</th>
                    <th className="text-left p-3 text-gray-700">Progress</th>
                    <th className="text-left p-3 text-gray-700">Joined</th>
                    <th className="text-left p-3 text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {participation.students.map((student: any) => (
                    <tr key={student.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">{student.username}</td>
                      <td className="p-3 text-sm text-gray-600">
                        {student.condition === 'with-hints' ? 'With Hints' : 'Without Hints'}
                      </td>
                      <td className="p-3 text-sm">
                        {student.completed ? (
                          <span className="text-green-600 font-semibold">Completed</span>
                        ) : (
                          <span className="text-blue-600">{student.progress || '0'}%</span>
                        )}
                      </td>
                      <td className="p-3 text-sm text-gray-600">{new Date(student.joinedAt).toLocaleDateString()}</td>
                      <td className="p-3">
                        <button className="text-blue-600 hover:underline text-sm" onClick={() => viewStudentProgress(student.id)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No students have joined yet.</p>
          )}
        </div>
      )}

      {selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto border border-gray-200 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Student Progress</h3>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setSelectedStudent(null)}>
                Close
              </button>
            </div>
            {loadingStudent ? (
              <p className="text-center text-gray-600">Loading...</p>
            ) : studentProgress ? (
              <div className="space-y-4 text-gray-800">
                <div>
                  <strong>Username:</strong> {studentProgress.username}
                </div>
                <div>
                  <strong>Condition:</strong> {studentProgress.condition === 'with-hints' ? 'With Hints' : 'Without Hints'}
                </div>
                <div>
                  <strong>Started:</strong> {new Date(studentProgress.startedAt).toLocaleString()}
                </div>
                {studentProgress.completedAt && (
                  <div>
                    <strong>Completed:</strong> {new Date(studentProgress.completedAt).toLocaleString()}
                  </div>
                )}
                <div>
                  <strong>Attempts:</strong> {studentProgress.totalAttempts}
                </div>
                <div>
                  <strong>Correct Answers:</strong> {studentProgress.correctAnswers}
                </div>
                <div>
                  <strong>Hints Used:</strong> {studentProgress.hintsUsed}
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-600">No data available</p>
            )}
          </div>
        </div>
      )}

      <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-8 transition-colors">
        <h3 className="text-lg font-bold text-red-900 mb-4">Danger Zone</h3>
        <button
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition"
          onClick={() => setShowDeleteConfirm(true)}
        >
          Delete Experiment
        </button>
        {showDeleteConfirm && (
          <div className="mt-4 p-4 bg-red-100 rounded-lg border-2 border-red-300">
            <p className="mb-3 font-semibold text-red-900">Are you sure? This cannot be undone.</p>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold" onClick={deleteExperiment}>
                Yes, Delete
              </button>
              <button
                className="px-4 py-2 border-2 border-gray-200 rounded-lg hover:bg-gray-50 font-semibold"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
