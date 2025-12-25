import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import api from '../../lib/api'
import LoadingScreen from '../../components/LoadingScreen'
import { toast } from '../../store/toasts'

type SummaryData = {
  experiment: { _id: string; title: string; status: string }
  counts: {
    students: number
    attempts: number
    correctRate: number
    hints: number
    definitionAccuracy: number
    recallAvg: number
  }
  byStory: {
    A: { attempts: number; accuracy: number }
    B: { attempts: number; accuracy: number }
  }
  funnel: { joined: number; story1: number; story2: number; breakDone: number; recall: number }
  students: Array<{
    studentId: string
    username: string
    condition: string
    attempts: number
    accuracy: number
    hints: number
    definitionAccuracy: number
    recallAvg: number
    timeOnTaskMin?: number
  }>
  words: Array<{ word: string; attempts: number; accuracy: number }>
  timeline: Array<{ day: string; attempts: number; correct: number; hints: number; definitions: number; recall: number }>
  timeOnTask: Array<{ studentId: string; username: string; minutes: number; firstTs: string | null; lastTs: string | null }>
  confusions: Array<{ word: string; attempts: number; topMisspellings: Array<{ text: string; count: number }> }>
  dataQuality: { totalEvents: number; missingExperiment: number; missingStudent: number; missingStory: number; missingTimestamp: number }
  comparisons: Array<{ condition: string; story: string; attempts: number; accuracy: number; hints: number }>
}

type ExperimentsSummary = Array<{
  experimentId: string
  title: string
  status: string
  students: number
  attempts: number
  correctRate: number
  recallAvg: number
}>

type FiltersState = {
  from: string
  to: string
  story: string
  condition: string
}

type StudentDetail = {
  student: SummaryData['students'][number] | null
  words: SummaryData['words']
  timeline: SummaryData['timeline']
  counts: SummaryData['counts']
  byStory: SummaryData['byStory']
  confusions: SummaryData['confusions']
}

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
  const [studentWordSort, setStudentWordSort] = useState<'word' | 'attempts' | 'accuracy'>('attempts')
  const [studentWordOrder, setStudentWordOrder] = useState<'asc' | 'desc'>('desc')
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

  function buildQuery(current: FiltersState, demo = false) {
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
      const { data } = await api.get(`/api/analytics/experiment/${id}/summary${buildQuery(appliedFilters, useDemo)}`)
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
      const { data } = await api.get('/api/analytics/experiments/summary')
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
        `/api/analytics/experiment/${expId}/student/${studentId}${buildQuery(appliedFilters, useDemo)}`
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
      const qs = buildQuery(appliedFilters, useDemo)
      const suffix = qs ? `${qs}&limit=${eventsLimit}&offset=${nextOffset}` : `?limit=${eventsLimit}&offset=${nextOffset}`
      const { data } = await api.get(`/api/analytics/experiment/${expId}/events${suffix}`)
      setEvents((prev) => (nextOffset === 0 ? data.events || [] : [...prev, ...(data.events || [])]))
      setEventsTotal(data.total || 0)
      setEventsOffset(nextOffset)
    } catch {
      toast.error('Failed to load events')
    } finally {
      setLoadingEvents(false)
    }
  }

  function applyFilters() {
    setAppliedFilters(filters)
  }

  function resetFilters() {
    const cleared = { from: '', to: '', story: '', condition: '' }
    setFilters(cleared)
    setAppliedFilters(cleared)
    setUseDemo(false)
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
  const studentTimelineMax = Math.max(1, ...(studentDetail?.timeline || []).map((t) => t.attempts))
  const studentWordMax = Math.max(1, ...(studentDetail?.words || []).map((w) => w.attempts))
  const studentTimelineAccuracyMax = 100

  const sortedStudentWords = (studentDetail?.words || []).slice().sort((a, b) => {
    const dir = studentWordOrder === 'asc' ? 1 : -1
    if (studentWordSort === 'word') return a.word.localeCompare(b.word) * dir
    if (studentWordSort === 'accuracy') return (a.accuracy - b.accuracy) * dir
    return (a.attempts - b.attempts) * dir
  })

  return (
    <div className="space-y-8 text-gray-900 transition-colors duration-300">
      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 transition-colors">
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
            <button
              className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold hover:border-gray-300 transition"
              onClick={() =>
                downloadCsv(
                  `/api/analytics/experiment/${summary.experiment._id}/csv?type=summary${buildQuery(appliedFilters, useDemo).replace('?', '&')}`,
                  `experiment_${summary.experiment._id}_summary.csv`
                )
              }
            >
              <span className="inline-flex items-center gap-2">
                <Download size={16} /> Summary CSV
              </span>
            </button>
            <button
              className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold hover:border-gray-300 transition"
              onClick={() =>
                downloadCsv(
                  `/api/analytics/experiment/${summary.experiment._id}/csv?type=students${buildQuery(appliedFilters, useDemo).replace('?', '&')}`,
                  `experiment_${summary.experiment._id}_students.csv`
                )
              }
            >
              <span className="inline-flex items-center gap-2">
                <Download size={16} /> Students CSV
              </span>
            </button>
            <button
              className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold hover:border-gray-300 transition"
              onClick={() =>
                downloadCsv(
                  `/api/analytics/experiment/${summary.experiment._id}/csv?type=words${buildQuery(appliedFilters, useDemo).replace('?', '&')}`,
                  `experiment_${summary.experiment._id}_words.csv`
                )
              }
            >
              <span className="inline-flex items-center gap-2">
                <Download size={16} /> Words CSV
              </span>
            </button>
            <button
              className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold hover:border-gray-300 transition"
              onClick={() =>
                downloadCsv(
                  `/api/analytics/experiment/${summary.experiment._id}/csv?type=timeline${buildQuery(appliedFilters, useDemo).replace('?', '&')}`,
                  `experiment_${summary.experiment._id}_timeline.csv`
                )
              }
            >
              <span className="inline-flex items-center gap-2">
                <Download size={16} /> Timeline CSV
              </span>
            </button>
            <button
              className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold hover:border-gray-300 transition"
              onClick={() =>
                downloadCsv(
                  `/api/analytics/experiment/${summary.experiment._id}/events/csv${buildQuery(appliedFilters, useDemo)}`,
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

      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 transition-colors">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Filters</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm text-gray-600">
            From
            <input
              type="date"
              className="input mt-1"
              value={filters.from}
              onChange={(e) => setFilters((s) => ({ ...s, from: e.target.value }))}
            />
          </label>
          <label className="text-sm text-gray-600">
            To
            <input
              type="date"
              className="input mt-1"
              value={filters.to}
              onChange={(e) => setFilters((s) => ({ ...s, to: e.target.value }))}
            />
          </label>
          <label className="text-sm text-gray-600">
            Story
            <select
              className="input mt-1"
              value={filters.story}
              onChange={(e) => setFilters((s) => ({ ...s, story: e.target.value }))}
            >
              <option value="">All</option>
              <option value="A">Story A</option>
              <option value="B">Story B</option>
            </select>
          </label>
          <label className="text-sm text-gray-600">
            Condition
            <select
              className="input mt-1"
              value={filters.condition}
              onChange={(e) => setFilters((s) => ({ ...s, condition: e.target.value }))}
            >
              <option value="">All</option>
              <option value="with-hints">With Hints</option>
              <option value="without-hints">Without Hints</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button className="btn primary px-5 py-2" onClick={applyFilters}>
            Apply Filters
          </button>
          <button className="px-5 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold hover:border-gray-300 transition" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Students', value: summary.counts.students },
          { label: 'Attempts', value: summary.counts.attempts },
          { label: 'Correct Rate', value: `${summary.counts.correctRate}%` },
          { label: 'Hints Used', value: summary.counts.hints },
          { label: 'Definition Accuracy', value: `${summary.counts.definitionAccuracy}%` },
          { label: 'Recall Avg', value: summary.counts.recallAvg },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border-2 border-gray-100 p-5 shadow-sm">
            <div className="text-sm text-gray-500">{card.label}</div>
            <div className="text-2xl font-semibold text-gray-900 mt-2">{card.value}</div>
          </div>
        ))}
      </div>

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
            <div className="mt-3">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-green-500"
                  style={{ width: `${Math.min(100, summary.byStory[story].accuracy)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {[
          { label: 'Joined', value: summary.funnel.joined },
          { label: 'Story 1 Done', value: summary.funnel.story1 },
          { label: 'Break Done', value: summary.funnel.breakDone },
          { label: 'Story 2 Done', value: summary.funnel.story2 },
          { label: 'Recall Done', value: summary.funnel.recall },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border-2 border-gray-100 p-4 shadow-sm">
            <div className="text-xs text-gray-500">{card.label}</div>
            <div className="text-xl font-semibold text-gray-900 mt-2">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 transition-colors">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Students</h2>
        {summary.students.length === 0 ? (
          <p className="text-sm text-gray-500">No student activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300 text-left text-sm text-gray-600">
                  <th className="p-3">Student</th>
                  <th className="p-3">Condition</th>
                  <th className="p-3">Attempts</th>
                  <th className="p-3">Accuracy</th>
                  <th className="p-3">Hints</th>
                  <th className="p-3">Definition Acc.</th>
                  <th className="p-3">Recall Avg</th>
                  <th className="p-3">Time (min)</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {summary.students.map((s) => (
                  <tr key={s.studentId} className="border-b hover:bg-gray-50 text-sm">
                    <td className="p-3 font-medium text-gray-900">{s.username}</td>
                    <td className="p-3 text-gray-600">{s.condition}</td>
                    <td className="p-3 text-gray-600">{s.attempts}</td>
                    <td className="p-3 text-gray-600">{s.accuracy}%</td>
                    <td className="p-3 text-gray-600">{s.hints}</td>
                    <td className="p-3 text-gray-600">{s.definitionAccuracy}%</td>
                    <td className="p-3 text-gray-600">{s.recallAvg}</td>
                    <td className="p-3 text-gray-600">{s.timeOnTaskMin ?? 0}</td>
                    <td className="p-3">
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
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 transition-colors">
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
                      <td className="p-2 text-gray-600">
                        {e.correct === null ? '-' : e.correct ? 'yes' : 'no'}
                      </td>
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

      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 transition-colors">
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
                        <div
                          className="h-2 bg-blue-500"
                          style={{ width: `${Math.min(100, Math.round((w.attempts / wordMax) * 100))}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 transition-colors">
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
                    <td className="p-3 text-gray-600">
                      {c.topMisspellings.map((m) => `${m.text} (${m.count})`).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 transition-colors">
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

      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 transition-colors">
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

      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 transition-colors">
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

      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 transition-colors">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Data Quality</h2>
        <div className="grid gap-4 md:grid-cols-5 text-sm">
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Total Events</div>
            <div className="text-lg font-semibold">{summary.dataQuality.totalEvents}</div>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Missing Experiment</div>
            <div className="text-lg font-semibold">{summary.dataQuality.missingExperiment}</div>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Missing Student</div>
            <div className="text-lg font-semibold">{summary.dataQuality.missingStudent}</div>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Missing Story</div>
            <div className="text-lg font-semibold">{summary.dataQuality.missingStory}</div>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Missing Timestamp</div>
            <div className="text-lg font-semibold">{summary.dataQuality.missingTimestamp}</div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">All Experiments Summary</h2>
          <button
            className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold hover:border-gray-300 transition"
            onClick={() => downloadCsv('/api/analytics/experiments/csv', 'experiments_summary.csv')}
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

      {selectedStudentId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto border border-gray-200 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Student Analytics</h3>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setSelectedStudentId(null)}>
                Close
              </button>
            </div>
            {loadingStudent ? (
              <p className="text-center text-gray-600">Loading...</p>
            ) : studentDetail?.student ? (
              <div className="space-y-6 text-gray-800">
                <div className="flex flex-wrap gap-2">
                  <button
                    className="px-3 py-2 border-2 border-gray-200 rounded-lg text-xs font-semibold hover:border-gray-300 transition"
                    onClick={() =>
                      downloadCsv(
                        `/api/analytics/experiment/${summary.experiment._id}/student/${selectedStudentId}/csv?type=summary${buildQuery(appliedFilters, useDemo).replace('?', '&')}`,
                        `experiment_${summary.experiment._id}_student_${selectedStudentId}_summary.csv`
                      )
                    }
                  >
                    Summary CSV
                  </button>
                  <button
                    className="px-3 py-2 border-2 border-gray-200 rounded-lg text-xs font-semibold hover:border-gray-300 transition"
                    onClick={() =>
                      downloadCsv(
                        `/api/analytics/experiment/${summary.experiment._id}/student/${selectedStudentId}/csv?type=words${buildQuery(appliedFilters, useDemo).replace('?', '&')}`,
                        `experiment_${summary.experiment._id}_student_${selectedStudentId}_words.csv`
                      )
                    }
                  >
                    Words CSV
                  </button>
                  <button
                    className="px-3 py-2 border-2 border-gray-200 rounded-lg text-xs font-semibold hover:border-gray-300 transition"
                    onClick={() =>
                      downloadCsv(
                        `/api/analytics/experiment/${summary.experiment._id}/student/${selectedStudentId}/csv?type=timeline${buildQuery(appliedFilters, useDemo).replace('?', '&')}`,
                        `experiment_${summary.experiment._id}_student_${selectedStudentId}_timeline.csv`
                      )
                    }
                  >
                    Timeline CSV
                  </button>
                </div>

                <div>
                  <div className="text-lg font-semibold">{studentDetail.student.username}</div>
                  <div className="text-sm text-gray-600">Condition: {studentDetail.student.condition}</div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <div className="text-xs text-gray-500">Attempts</div>
                    <div className="text-lg font-semibold">{studentDetail.student.attempts}</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <div className="text-xs text-gray-500">Accuracy</div>
                    <div className="text-lg font-semibold">{studentDetail.student.accuracy}%</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <div className="text-xs text-gray-500">Hints</div>
                    <div className="text-lg font-semibold">{studentDetail.student.hints}</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <div className="text-xs text-gray-500">Definition Accuracy</div>
                    <div className="text-lg font-semibold">{studentDetail.student.definitionAccuracy}%</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <div className="text-xs text-gray-500">Recall Avg</div>
                    <div className="text-lg font-semibold">{studentDetail.student.recallAvg}</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <div className="text-xs text-gray-500">Time on Task (min)</div>
                    <div className="text-lg font-semibold">{studentDetail.student.timeOnTaskMin ?? 0}</div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {(['A', 'B'] as const).map((story) => (
                    <div key={story} className="rounded-lg border border-gray-200 p-4">
                      <div className="text-sm text-gray-600">Story {story}</div>
                      <div className="font-semibold text-gray-900">
                        Attempts: {studentDetail.byStory[story].attempts} | Accuracy: {studentDetail.byStory[story].accuracy}%
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h4 className="text-sm font-semibold text-gray-700">Word Performance</h4>
                    <div className="flex items-center gap-2 text-xs">
                      <select
                        className="border border-gray-200 rounded px-2 py-1"
                        value={studentWordSort}
                        onChange={(e) => setStudentWordSort(e.target.value as any)}
                      >
                        <option value="attempts">Sort by Attempts</option>
                        <option value="accuracy">Sort by Accuracy</option>
                        <option value="word">Sort by Word</option>
                      </select>
                      <select
                        className="border border-gray-200 rounded px-2 py-1"
                        value={studentWordOrder}
                        onChange={(e) => setStudentWordOrder(e.target.value as any)}
                      >
                        <option value="desc">Desc</option>
                        <option value="asc">Asc</option>
                      </select>
                    </div>
                  </div>
                  {studentDetail.words.length === 0 ? (
                    <p className="text-sm text-gray-500">No word activity.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b-2 border-gray-300 text-left text-gray-600">
                            <th className="p-2">Word</th>
                            <th className="p-2">Attempts</th>
                            <th className="p-2">Accuracy</th>
                            <th className="p-2">Accuracy Bar</th>
                            <th className="p-2">Volume</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedStudentWords.map((w) => (
                            <tr key={w.word} className="border-b hover:bg-gray-50">
                              <td className="p-2 font-medium text-gray-900">{w.word}</td>
                              <td className="p-2 text-gray-600">{w.attempts}</td>
                              <td className="p-2 text-gray-600">{w.accuracy}%</td>
                              <td className="p-2">
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-2 bg-emerald-500" style={{ width: `${Math.min(100, w.accuracy)}%` }} />
                                </div>
                              </td>
                              <td className="p-2">
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-2 bg-blue-500"
                                    style={{ width: `${Math.min(100, Math.round((w.attempts / studentWordMax) * 100))}%` }}
                                  />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Timeline</h4>
                  {studentDetail.timeline.length === 0 ? (
                    <p className="text-sm text-gray-500">No timeline activity.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-end gap-2">
                        {studentDetail.timeline.map((t) => (
                          <div key={t.day} className="flex flex-col items-center gap-1 w-10">
                            <div
                              className="w-6 rounded bg-indigo-500"
                              style={{ height: `${Math.max(6, Math.round((t.attempts / studentTimelineMax) * 80))}px` }}
                              title={`${t.attempts} attempts`}
                            />
                            <div
                              className="w-6 rounded bg-emerald-400"
                              style={{ height: `${Math.max(4, Math.round(((t.attempts ? (t.correct / t.attempts) * 100 : 0) / studentTimelineAccuracyMax) * 40))}px` }}
                              title={`${t.attempts ? Math.round((t.correct / t.attempts) * 100) : 0}% accuracy`}
                            />
                            <span className="text-[10px] text-gray-500">{t.day.slice(5)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="border-b-2 border-gray-300 text-left text-gray-600">
                              <th className="p-2">Day</th>
                              <th className="p-2">Attempts</th>
                              <th className="p-2">Correct</th>
                              <th className="p-2">Hints</th>
                              <th className="p-2">Definitions</th>
                              <th className="p-2">Recall</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentDetail.timeline.map((t) => (
                              <tr key={t.day} className="border-b hover:bg-gray-50">
                                <td className="p-2 font-medium text-gray-900">{t.day}</td>
                                <td className="p-2 text-gray-600">{t.attempts}</td>
                                <td className="p-2 text-gray-600">{t.correct}</td>
                                <td className="p-2 text-gray-600">{t.hints}</td>
                                <td className="p-2 text-gray-600">{t.definitions}</td>
                                <td className="p-2 text-gray-600">{t.recall}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Common Misspellings</h4>
                  {studentDetail.confusions.length === 0 ? (
                    <p className="text-sm text-gray-500">No incorrect attempts logged.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b-2 border-gray-300 text-left text-gray-600">
                            <th className="p-2">Word</th>
                            <th className="p-2">Incorrect Attempts</th>
                            <th className="p-2">Top Misspellings</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentDetail.confusions.map((c) => (
                            <tr key={c.word} className="border-b hover:bg-gray-50">
                              <td className="p-2 font-medium text-gray-900">{c.word}</td>
                              <td className="p-2 text-gray-600">{c.attempts}</td>
                              <td className="p-2 text-gray-600">
                                {c.topMisspellings.map((m) => `${m.text} (${m.count})`).join(', ')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-600">No data available.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
