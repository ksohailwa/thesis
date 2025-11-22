import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import api from '../../lib/api'
import LoadingScreen from '../../components/LoadingScreen'
import { StoryManager } from './StoryManager'
import { toast } from '../../store/toasts'

type ExperimentStatus = 'draft' | 'live' | 'closed'
type Condition = 'with-hints' | 'without-hints'

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
    } catch (err) {
      toast.error('Failed to load experiment')
      nav('/teacher')
    } finally {
      setLoading(false)
    }
  }

  async function fetchParticipation() {
    if (!expId) return
    try {
      const { data } = await api.get(`/api/experiments/${expId}/participation`)
      setParticipation(data)
    } catch (e) {
      console.error('Failed to fetch participation:', e)
    }
  }

  async function launchExperiment() {
    if (!expId) return
    setLaunchLoading(true)
    setStatusMessage('')
    try {
      const { data } = await api.post(`/api/experiments/${expId}/launch`, { condition: assignedCondition })
      setExperimentStatus('live')
      setStatusMessage(`�o" Experiment launched! Join code: ${data.code}`)
      toast.success(`Experiment launched! Code: ${data.code}`)
      await fetchParticipation()
    } catch (e: any) {
      const error = e?.response?.data?.error || 'Failed to launch'
      setStatusMessage(`�o- ${error}`)
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
      setStatusMessage('�o" Experiment closed')
      toast.success('Experiment closed')
    } catch (e: any) {
      const error = e?.response?.data?.error || 'Failed to close'
      setStatusMessage(`�o- ${error}`)
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
    } catch (e) {
      toast.error('Failed to load student progress')
      setSelectedStudent(null)
    } finally {
      setLoadingStudent(false)
    }
  }

  if (loading) return <LoadingScreen />

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <Link to="/teacher" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
                �+? Back to Dashboard
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
              {experimentStatus === 'draft' && (
                <>
                  <select
                    value={assignedCondition}
                    onChange={(e) => setAssignedCondition(e.target.value as Condition)}
                    className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium hover:border-gray-300 transition"
                  >
                    <option value="with-hints">dYZ_ With Hints</option>
                    <option value="without-hints">dYs? Without Hints</option>
                  </select>
                  <button
                    className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg font-semibold disabled:opacity-50 transition"
                    onClick={launchExperiment}
                    disabled={launchLoading}
                  >
                    {launchLoading ? '�?3 Launching...' : 'dYs? Launch'}
                  </button>
                </>
              )}
              {experimentStatus === 'live' && (
                <button className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition" onClick={closeExperiment}>
                  �?1 Close
                </button>
              )}
            </div>
          </div>
          {statusMessage && (
            <div
              className={`mt-4 px-4 py-2 text-sm font-medium rounded-lg border ${
                statusMessage.includes('�o-') ? 'bg-red-50 text-red-800 border-red-200' : 'bg-green-50 text-green-800 border-green-200'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span>{statusMessage}</span>
                <button className="px-3 py-1 border-2 border-gray-200 rounded-lg text-xs font-semibold hover:border-gray-300 transition" onClick={loadExperiment}>
                  dY", Refresh
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100">
          <StoryManager experimentId={expId || ''} compact={false} showBackLink={false} />
        </div>

        {experimentStatus === 'live' && participation && (
          <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">dY`� Student Participation</h2>
              <button className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium hover:border-gray-300 transition" onClick={fetchParticipation}>
                dY", Refresh
              </button>
            </div>
            {participation.students && participation.students.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="text-left p-3">Student</th>
                      <th className="text-left p-3">Condition</th>
                      <th className="text-left p-3">Progress</th>
                      <th className="text-left p-3">Joined</th>
                      <th className="text-left p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participation.students.map((student: any) => (
                      <tr key={student.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{student.username}</td>
                        <td className="p-3 text-sm">{student.condition === 'with-hints' ? 'With Hints' : 'Without Hints'}</td>
                        <td className="p-3 text-sm">
                          {student.completed ? (
                            <span className="text-green-600 font-semibold">�o" Completed</span>
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Student Progress</h3>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => setSelectedStudent(null)}>
                  �o
                </button>
              </div>
              {loadingStudent ? (
                <p className="text-center text-gray-600">Loading...</p>
              ) : studentProgress ? (
                <div className="space-y-4">
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

        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-8">
          <h3 className="text-lg font-bold text-red-900 mb-4">dYs" Danger Zone</h3>
          <button className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition" onClick={() => setShowDeleteConfirm(true)}>
            Delete Experiment
          </button>
          {showDeleteConfirm && (
            <div className="mt-4 p-4 bg-red-100 rounded-lg border-2 border-red-300">
              <p className="mb-3 font-semibold text-red-900">Are you sure? This cannot be undone.</p>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold" onClick={deleteExperiment}>
                  Yes, Delete
                </button>
                <button className="px-4 py-2 border-2 border-gray-200 rounded-lg hover:bg-gray-50 font-semibold" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
