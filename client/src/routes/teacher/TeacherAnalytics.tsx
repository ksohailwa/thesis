import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import api from '../../lib/api'
import LoadingScreen from '../../components/LoadingScreen'
import { toast } from '../../store/toasts'

// Types and components
import type { SummaryData, ExperimentsSummary, FiltersState, StudentDetail } from './analyticsTypes'
import FilterPanel from './components/FilterPanel'
import StatsGrid from './components/StatsGrid'
import StudentDetailModal from './components/StudentDetailModal'

export default function TeacherAnalytics() {
  const { id: expId } = useParams()
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [experiments, setExperiments] = useState<ExperimentsSummary>([])
  const [loadingExperiments, setLoadingExperiments] = useState(true)
  const [filters, setFilters] = useState<FiltersState>({ from: '', to: '', story: '', condition: '' })
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>({ from: '', to: '', story: '', condition: '' })
  const [useDemo, setUseDemo] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null)
  const [loadingStudent, setLoadingStudent] = useState(false)
  const [events, setEvents] = useState<any[]>([])
  const [eventsTotal, setEventsTotal] = useState(0)
  const [eventsLimit, setEventsLimit] = useState(200)
  const [eventsOffset, setEventsOffset] = useState(0)
  const [loadingEvents, setLoadingEvents] = useState(false)

  useEffect(() => {
    if (!expId) return
    loadSummary(expId)
  }, [expId, appliedFilters, useDemo])

  useEffect(() => {
    loadExperimentsSummary()
  }, [])

  useEffect(() => {
    setSelectedStudentId(null)
    setStudentDetail(null)
  }, [appliedFilters, useDemo])

  useEffect(() => {
    setEvents([])
    setEventsOffset(0)
    setEventsTotal(0)
  }, [appliedFilters, useDemo, expId])

  function buildQuery(current: FiltersState = appliedFilters, demo = useDemo) {
    const params = new URLSearchParams()
    if (current.from) params.set('from', current.from)
    if (current.to) params.set('to', current.to)
    if (current.story) params.set('story', current.story)
    if (current.condition) params.set('condition', current.condition)
    if (demo) params.set('demo', '1')
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }

  async function loadSummary(id: string) {
    setLoading(true)
    try {
      const { data } = await api.get(`api/analytics/experiment/${id}/summary${buildQuery()}`)
      setSummary(data)
    } catch {
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  async function loadExperimentsSummary() {
    setLoadingExperiments(true)
    try {
      const { data } = await api.get('api/analytics/experiments/summary')
      setExperiments(Array.isArray(data?.experiments) ? data.experiments : [])
    } catch {
      setExperiments([])
    } finally {
      setLoadingExperiments(false)
    }
  }

  async function downloadCsv(url: string, filename: string) {
    try {
      const { data } = await api.get(url, { responseType: 'blob' })
      const blob = new Blob([data], { type: 'text/csv' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(link.href)
    } catch {
      toast.error('Failed to download CSV')
    }
  }

  async function loadStudentDetail(studentId: string) {
    if (!expId) return
    setSelectedStudentId(studentId)
    setLoadingStudent(true)
    try {
      const { data } = await api.get(
        `api/analytics/experiment/${expId}/student/${studentId}${buildQuery()}`
      )
      setStudentDetail(data)
    } catch {
      toast.error('Failed to load student details')
      setStudentDetail(null)
    } finally {
      setLoadingStudent(false)
    }
  }

  async function loadEvents(nextOffset = 0) {
    if (!expId) return
    setLoadingEvents(true)
    try {
      const qs = buildQuery()
      const suffix = qs ? `${qs}&limit=${eventsLimit}&offset=${nextOffset}` : `?limit=${eventsLimit}&offset=${nextOffset}`
      const { data } = await api.get(`api/analytics/experiment/${expId}/events${suffix}`)
      setEvents((prev) => (nextOffset === 0 ? data.events || [] : [...prev, ...(data.events || [])]))
      setEventsTotal(data.total || 0)
      setEventsOffset(nextOffset)
    } catch {
      toast.error('Failed to load events')
    } finally {
      setLoadingEvents(false)
    }
  }

  if (loading) return <LoadingScreen message="Loading analytics..." />

  if (!summary) {
    return (
      <div className="text-center text-gray-600">
        <p>Analytics not available.</p>
      </div>
    )
  }

  const timelineMax = Math.max(1, ...summary.timeline.map((t) => t.attempts))
  const wordMax = Math.max(1, ...summary.words.map((w) => w.attempts))

  return (
    <div className="space-y-8 text-gray-900 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Link
              to={`/teacher/experiments/${summary.experiment._id}`}
              className="text-sm text-blue-600 hover:underline mb-2 inline-flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              <span>Back to Experiment</span>
            </Link>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Analytics: {summary.experiment.title}
            </h1>
            <p className="text-sm text-gray-600 mt-1">Status: {summary.experiment.status}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {['summary', 'students', 'words', 'timeline'].map((type) => (
              <button
                key={type}
                className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold hover:border-gray-300 transition"
                onClick={() =>
                  downloadCsv(
                    `api/analytics/experiment/${summary.experiment._id}/csv?type=${type}${buildQuery().replace('?', '&')}`,
                    `experiment_${summary.experiment._id}_${type}.csv`
                  )
                }
              >
                <span className="inline-flex items-center gap-2">
                  <Download size={16} /> {type.charAt(0).toUpperCase() + type.slice(1)} CSV
                </span>
              </button>
            ))}
            <button
              className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold hover:border-gray-300 transition"
              onClick={() =>
                downloadCsv(
                  `api/analytics/experiment/${summary.experiment._id}/events/csv${buildQuery()}`,
                  `experiment_${summary.experiment._id}_events.csv`
                )
              }
            >
              <span className="inline-flex items-center gap-2">
                <Download size={16} /> Events CSV
              </span>
            </button>
            <button
              className={`px-4 py-2 border-2 rounded-lg text-sm font-semibold transition ${
                useDemo ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setUseDemo((prev) => !prev)}
            >
              {useDemo ? 'Using Sample Data' : 'Show Sample Data'}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <FilterPanel
        filters={filters}
        setFilters={setFilters}
        onApply={() => setAppliedFilters(filters)}
        onReset={() => {
          const cleared = { from: '', to: '', story: '', condition: '' }
          setFilters(cleared)
          setAppliedFilters(cleared)
          setUseDemo(false)
        }}
      />

      {/* Summary Stats */}
      <StatsGrid
        items={[
          { label: 'Students', value: summary.counts.students },
          { label: 'Attempts', value: summary.counts.attempts },
          { label: 'Correct Rate', value: `${summary.counts.correctRate}%` },
          { label: 'Hints Used', value: summary.counts.hints },
          { label: 'Definition Accuracy', value: `${summary.counts.definitionAccuracy}%` },
          { label: 'Recall Avg', value: summary.counts.recallAvg },
        ]}
      />

      {/* Story Comparison */}
      <div className="grid gap-4 md:grid-cols-2">
        {(['A', 'B'] as const).map((story) => (
          <div key={story} className="bg-white rounded-2xl border-2 border-gray-100 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Story {story}</h3>
            <p className="text-sm text-gray-600">
              Attempts: <span className="font-semibold text-gray-900">{summary.byStory[story].attempts}</span>
            </p>
            <p className="text-sm text-gray-600">
              Accuracy: <span className="font-semibold text-gray-900">{summary.byStory[story].accuracy}%</span>
            </p>
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-2 bg-green-500"
                style={{ width: `${Math.min(100, summary.byStory[story].accuracy)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Funnel */}
      <StatsGrid
        items={[
          { label: 'Joined', value: summary.funnel.joined },
          { label: 'Story 1 Done', value: summary.funnel.story1 },
          { label: 'Break Done', value: summary.funnel.breakDone },
          { label: 'Story 2 Done', value: summary.funnel.story2 },
          { label: 'Recall Done', value: summary.funnel.recall },
        ]}
        columns={5}
        size="small"
      />

      {/* Students Participation Table */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Student Participation</h2>
        <p className="text-sm text-gray-500 mb-4">
          Detailed breakdown of each student's participation across both experimental conditions.
        </p>
        {summary.students.length === 0 ? (
          <p className="text-sm text-gray-500">No student activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-gray-300 text-left text-gray-600">
                  <th className="p-2 font-semibold">ID</th>
                  <th className="p-2 font-semibold">Username</th>
                  <th className="p-2 font-semibold bg-blue-50">Phase 1</th>
                  <th className="p-2 font-semibold bg-blue-50">Story</th>
                  <th className="p-2 font-semibold bg-blue-50">Time</th>
                  <th className="p-2 font-semibold bg-purple-50">Phase 2</th>
                  <th className="p-2 font-semibold bg-purple-50">Story</th>
                  <th className="p-2 font-semibold bg-purple-50">Time</th>
                  <th className="p-2 font-semibold">Effort</th>
                  <th className="p-2 font-semibold">Delayed</th>
                  <th className="p-2 font-semibold">Score</th>
                  <th className="p-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {summary.students.map((s) => (
                  <tr key={s.studentId} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-mono text-gray-500">{s.studentId.slice(-6)}</td>
                    <td className="p-2 font-medium text-gray-900">{s.username}</td>
                    {/* Phase 1 */}
                    <td className={`p-2 ${s.phase1Condition === 'treatment' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'}`}>
                      {s.phase1Condition === 'treatment' ? 'Treatment' : s.phase1Condition === 'control' ? 'Control' : '-'}
                    </td>
                    <td className="p-2 bg-blue-50 text-blue-700 font-semibold">
                      {s.phase1Story || '-'}
                    </td>
                    <td className="p-2 bg-blue-50 text-gray-600">
                      {s.phase1Story === 'A' ? s.timeStoryAMin : s.phase1Story === 'B' ? s.timeStoryBMin : '-'}m
                    </td>
                    {/* Phase 2 */}
                    <td className={`p-2 ${s.phase2Condition === 'treatment' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'}`}>
                      {s.phase2Condition === 'treatment' ? 'Treatment' : s.phase2Condition === 'control' ? 'Control' : '-'}
                    </td>
                    <td className="p-2 bg-purple-50 text-purple-700 font-semibold">
                      {s.phase2Story || '-'}
                    </td>
                    <td className="p-2 bg-purple-50 text-gray-600">
                      {s.phase2Story === 'A' ? s.timeStoryAMin : s.phase2Story === 'B' ? s.timeStoryBMin : '-'}m
                    </td>
                    {/* Mental Effort */}
                    <td className="p-2 text-gray-600">
                      {s.avgMentalEffort !== null ? s.avgMentalEffort.toFixed(1) : '-'}
                    </td>
                    {/* Delayed Test */}
                    <td className="p-2">
                      {s.delayedTestCompleted ? (
                        <span className="text-green-600 font-semibold">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="p-2 text-gray-600">
                      {s.delayedTestScore !== null ? `${(s.delayedTestScore * 100).toFixed(0)}%` : '-'}
                    </td>
                    <td className="p-2">
                      <button className="text-blue-600 hover:underline" onClick={() => loadStudentDetail(s.studentId)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
            <span>Treatment (with hints)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></div>
            <span>Control (without hints)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
            <span>Phase 1 (first story)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-100 border border-purple-300 rounded"></div>
            <span>Phase 2 (second story)</span>
          </div>
        </div>
      </div>

      {/* Events */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-900">Events</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-600">
              Limit
              <input
                type="number"
                min={10}
                max={1000}
                className="ml-2 w-24 border border-gray-200 rounded px-2 py-1"
                value={eventsLimit}
                onChange={(e) => setEventsLimit(Math.max(10, Math.min(1000, Number(e.target.value) || 10)))}
              />
            </label>
            <button
              className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold hover:border-gray-300 transition"
              onClick={() => loadEvents(0)}
              disabled={loadingEvents}
            >
              {loadingEvents ? 'Loading...' : 'Load Events'}
            </button>
          </div>
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-gray-500">No events loaded yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-gray-500">
              Showing {events.length} of {eventsTotal} events
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300 text-left text-gray-600">
                    <th className="p-2">Time</th>
                    <th className="p-2">Student</th>
                    <th className="p-2">Condition</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Story</th>
                    <th className="p-2">Word</th>
                    <th className="p-2">Attempt</th>
                    <th className="p-2">Correct</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e, idx) => (
                    <tr key={`${e.ts}-${idx}`} className="border-b hover:bg-gray-50">
                      <td className="p-2 text-gray-600">{e.ts ? new Date(e.ts).toLocaleString() : '-'}</td>
                      <td className="p-2 text-gray-900">{e.username}</td>
                      <td className="p-2 text-gray-600">{e.condition}</td>
                      <td className="p-2 text-gray-600">{e.type}</td>
                      <td className="p-2 text-gray-600">{e.story}</td>
                      <td className="p-2 text-gray-600">{e.word}</td>
                      <td className="p-2 text-gray-600">{e.attempt}</td>
                      <td className="p-2 text-gray-600">{e.correct === null ? '-' : e.correct ? 'yes' : 'no'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {events.length < eventsTotal && (
              <button
                className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold hover:border-gray-300 transition"
                onClick={() => loadEvents(events.length)}
                disabled={loadingEvents}
              >
                Load More
              </button>
            )}
          </div>
        )}
      </div>

      {/* Word Performance */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Word Performance</h2>
        {summary.words.length === 0 ? (
          <p className="text-sm text-gray-500">No word attempts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300 text-left text-sm text-gray-600">
                  <th className="p-3">Word</th>
                  <th className="p-3">Attempts</th>
                  <th className="p-3">Accuracy</th>
                  <th className="p-3">Volume</th>
                </tr>
              </thead>
              <tbody>
                {summary.words.map((w) => (
                  <tr key={w.word} className="border-b hover:bg-gray-50 text-sm">
                    <td className="p-3 font-medium text-gray-900">{w.word}</td>
                    <td className="p-3 text-gray-600">{w.attempts}</td>
                    <td className="p-3 text-gray-600">{w.accuracy}%</td>
                    <td className="p-3">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-2 bg-blue-500" style={{ width: `${Math.min(100, Math.round((w.attempts / wordMax) * 100))}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Common Misspellings */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Common Misspellings</h2>
        {summary.confusions.length === 0 ? (
          <p className="text-sm text-gray-500">No incorrect attempts logged.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300 text-left text-sm text-gray-600">
                  <th className="p-3">Word</th>
                  <th className="p-3">Incorrect Attempts</th>
                  <th className="p-3">Top Misspellings</th>
                </tr>
              </thead>
              <tbody>
                {summary.confusions.map((c) => (
                  <tr key={c.word} className="border-b hover:bg-gray-50 text-sm">
                    <td className="p-3 font-medium text-gray-900">{c.word}</td>
                    <td className="p-3 text-gray-600">{c.attempts}</td>
                    <td className="p-3 text-gray-600">{c.topMisspellings.map((m) => `${m.text} (${m.count})`).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Condition Comparison */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Condition Comparison</h2>
        {summary.comparisons.length === 0 ? (
          <p className="text-sm text-gray-500">No comparison data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300 text-left text-sm text-gray-600">
                  <th className="p-3">Condition</th>
                  <th className="p-3">Story</th>
                  <th className="p-3">Attempts</th>
                  <th className="p-3">Accuracy</th>
                  <th className="p-3">Hints</th>
                </tr>
              </thead>
              <tbody>
                {summary.comparisons.map((c, idx) => (
                  <tr key={`${c.condition}-${c.story}-${idx}`} className="border-b hover:bg-gray-50 text-sm">
                    <td className="p-3 font-medium text-gray-900">{c.condition}</td>
                    <td className="p-3 text-gray-600">{c.story}</td>
                    <td className="p-3 text-gray-600">{c.attempts}</td>
                    <td className="p-3 text-gray-600">{c.accuracy}%</td>
                    <td className="p-3 text-gray-600">{c.hints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Timeline</h2>
        {summary.timeline.length === 0 ? (
          <p className="text-sm text-gray-500">No timeline activity yet.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end gap-2">
              {summary.timeline.map((t) => (
                <div key={t.day} className="flex flex-col items-center gap-1 w-10">
                  <div
                    className="w-6 rounded bg-indigo-500"
                    style={{ height: `${Math.max(6, Math.round((t.attempts / timelineMax) * 80))}px` }}
                    title={`${t.attempts} attempts`}
                  />
                  <span className="text-[10px] text-gray-500">{t.day.slice(5)}</span>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300 text-left text-sm text-gray-600">
                    <th className="p-3">Day</th>
                    <th className="p-3">Attempts</th>
                    <th className="p-3">Correct</th>
                    <th className="p-3">Hints</th>
                    <th className="p-3">Definitions</th>
                    <th className="p-3">Recall</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.timeline.map((t) => (
                    <tr key={t.day} className="border-b hover:bg-gray-50 text-sm">
                      <td className="p-3 font-medium text-gray-900">{t.day}</td>
                      <td className="p-3 text-gray-600">{t.attempts}</td>
                      <td className="p-3 text-gray-600">{t.correct}</td>
                      <td className="p-3 text-gray-600">{t.hints}</td>
                      <td className="p-3 text-gray-600">{t.definitions}</td>
                      <td className="p-3 text-gray-600">{t.recall}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Time on Task */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Time on Task</h2>
        {summary.timeOnTask.length === 0 ? (
          <p className="text-sm text-gray-500">No time-on-task data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300 text-left text-sm text-gray-600">
                  <th className="p-3">Student</th>
                  <th className="p-3">Minutes</th>
                  <th className="p-3">First Event</th>
                  <th className="p-3">Last Event</th>
                </tr>
              </thead>
              <tbody>
                {summary.timeOnTask.map((t) => (
                  <tr key={t.studentId} className="border-b hover:bg-gray-50 text-sm">
                    <td className="p-3 font-medium text-gray-900">{t.username}</td>
                    <td className="p-3 text-gray-600">{t.minutes}</td>
                    <td className="p-3 text-gray-600">{t.firstTs ? new Date(t.firstTs).toLocaleString() : '-'}</td>
                    <td className="p-3 text-gray-600">{t.lastTs ? new Date(t.lastTs).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Data Quality */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Data Quality</h2>
        <div className="grid gap-4 md:grid-cols-5 text-sm">
          {[
            { label: 'Total Events', value: summary.dataQuality.totalEvents },
            { label: 'Missing Experiment', value: summary.dataQuality.missingExperiment },
            { label: 'Missing Student', value: summary.dataQuality.missingStudent },
            { label: 'Missing Story', value: summary.dataQuality.missingStory },
            { label: 'Missing Timestamp', value: summary.dataQuality.missingTimestamp },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs text-gray-500">{item.label}</div>
              <div className="text-lg font-semibold">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* All Experiments Summary */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">All Experiments Summary</h2>
          <button
            className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold hover:border-gray-300 transition"
            onClick={() => downloadCsv('api/analytics/experiments/csv', 'experiments_summary.csv')}
          >
            <span className="inline-flex items-center gap-2">
              <Download size={16} /> Export CSV
            </span>
          </button>
        </div>
        {loadingExperiments ? (
          <p className="text-sm text-gray-500">Loading experiments...</p>
        ) : experiments.length === 0 ? (
          <p className="text-sm text-gray-500">No experiments found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300 text-left text-sm text-gray-600">
                  <th className="p-3">Title</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Students</th>
                  <th className="p-3">Attempts</th>
                  <th className="p-3">Correct Rate</th>
                  <th className="p-3">Recall Avg</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((e) => (
                  <tr key={e.experimentId} className="border-b hover:bg-gray-50 text-sm">
                    <td className="p-3 font-medium text-gray-900">{e.title}</td>
                    <td className="p-3 text-gray-600">{e.status}</td>
                    <td className="p-3 text-gray-600">{e.students}</td>
                    <td className="p-3 text-gray-600">{e.attempts}</td>
                    <td className="p-3 text-gray-600">{e.correctRate}%</td>
                    <td className="p-3 text-gray-600">{e.recallAvg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Detail Modal */}
      {selectedStudentId && (
        <StudentDetailModal
          studentDetail={studentDetail}
          loading={loadingStudent}
          experimentId={summary.experiment._id}
          onClose={() => setSelectedStudentId(null)}
          onDownloadCsv={downloadCsv}
          buildQuery={() => buildQuery()}
        />
      )}
    </div>
  )
}
