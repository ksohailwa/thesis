import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import api from '../../lib/api'
import LoadingScreen from '../../components/LoadingScreen'
import { toast } from '../../store/toasts'

// Types and components
import type { SummaryData, ExperimentsSummary, FiltersState, StudentDetail, OffloadingAnalytics, OffloadingRow } from './analyticsTypes'
import { LineChart, Line, Area, XAxis, YAxis, Tooltip as RTooltip, Legend as RLegend, CartesianGrid, ResponsiveContainer, ScatterChart, Scatter } from 'recharts'
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
  const [offloading, setOffloading] = useState<OffloadingAnalytics | null>(null)
  const [loadingOffloading, setLoadingOffloading] = useState(false)

  useEffect(() => {
    if (!expId) return
    loadSummary(expId)
    loadOffloading(expId)
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

  async function loadOffloading(id: string) {
    setLoadingOffloading(true)
    try {
      const { data } = await api.get(`api/analytics/experiment/${id}/offloading${buildQuery()}`)
      setOffloading(data)
    } catch {
      setOffloading(null)
    } finally {
      setLoadingOffloading(false)
    }
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
  const timelineMaxCorrect = Math.max(1, ...summary.timeline.map((t) => t.correct))
  const timelineMaxHints = Math.max(1, ...summary.timeline.map((t) => t.hints))
  const timelineMaxRecall = Math.max(1, ...summary.timeline.map((t) => t.recall))
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
                  `api/analytics/experiment/${summary.experiment._id}/csv?type=offloading${buildQuery().replace('?', '&')}`,
                  `experiment_${summary.experiment._id}_offloading.csv`
                )
              }
            >
              <span className="inline-flex items-center gap-2">
                <Download size={16} /> Offloading CSV
              </span>
            </button>
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
              className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold hover:border-gray-300 transition"
              onClick={async () => {
              try {
                const url = `api/analytics/experiment/${summary.experiment._id}/research-export${buildQuery()}`
                const { data } = await api.get(url, { responseType: 'blob' })
                const blob = new Blob([data], { type: 'application/zip' })
                const link = document.createElement('a')
                link.href = URL.createObjectURL(blob)
                link.download = `experiment_${summary.experiment._id}_research_export.zip`
                document.body.appendChild(link)
                link.click()
                link.remove()
                URL.revokeObjectURL(link.href)
              } catch {
                toast.error('Failed to download research export')
              }
              }}
            >
            <span className="inline-flex items-center gap-2">
              <Download size={16} /> Research Export (ZIP)
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

      {/* Trends (Attempts, Correct, Hints, Recall) */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Trends</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Attempts */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-800">Attempts</h3>
              <span className="text-xs text-gray-500">peak {timelineMax}</span>
            </div>
            <div className="flex items-end gap-1 h-24">
              {summary.timeline.map((d, i) => (
                <div key={`att-${i}`} className="w-3 bg-blue-500 rounded-sm" style={{ height: `${Math.round((d.attempts / timelineMax) * 100)}%` }} title={`${d.day}: ${d.attempts}`}></div>
              ))}
            </div>
          </div>
          {/* Correct */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-800">Correct</h3>
              <span className="text-xs text-gray-500">peak {timelineMaxCorrect}</span>
            </div>
            <div className="flex items-end gap-1 h-24">
              {summary.timeline.map((d, i) => (
                <div key={`cor-${i}`} className="w-3 bg-green-500 rounded-sm" style={{ height: `${Math.round((d.correct / timelineMaxCorrect) * 100)}%` }} title={`${d.day}: ${d.correct}`}></div>
              ))}
            </div>
          </div>
          {/* Hints */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-800">Hints</h3>
              <span className="text-xs text-gray-500">peak {timelineMaxHints}</span>
            </div>
            <div className="flex items-end gap-1 h-24">
              {summary.timeline.map((d, i) => (
                <div key={`hin-${i}`} className="w-3 bg-amber-500 rounded-sm" style={{ height: `${Math.round((d.hints / timelineMaxHints) * 100)}%` }} title={`${d.day}: ${d.hints}`}></div>
              ))}
            </div>
          </div>
          {/* Recall */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-800">Recall Items</h3>
              <span className="text-xs text-gray-500">peak {timelineMaxRecall}</span>
            </div>
            <div className="flex items-end gap-1 h-24">
              {summary.timeline.map((d, i) => (
                <div key={`rec-${i}`} className="w-3 bg-purple-500 rounded-sm" style={{ height: `${Math.round((d.recall / timelineMaxRecall) * 100)}%` }} title={`${d.day}: ${d.recall}`}></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-3">Funnel</h2>
        <div className="grid md:grid-cols-5 gap-3 text-sm">
          {([
            { label: 'Joined', v: summary.funnel.joined, base: summary.funnel.joined, color: 'bg-gray-500' },
            { label: 'Story 1', v: summary.funnel.story1, base: summary.funnel.joined, color: 'bg-blue-500' },
            { label: 'Break', v: summary.funnel.breakDone, base: summary.funnel.joined, color: 'bg-amber-500' },
            { label: 'Story 2', v: summary.funnel.story2, base: summary.funnel.joined, color: 'bg-purple-500' },
            { label: 'Recall', v: summary.funnel.recall, base: summary.funnel.joined, color: 'bg-green-600' },
          ]).map((f) => {
            const pct = f.base ? Math.round((f.v / f.base) * 100) : 0
            return (
              <div key={f.label} className="bg-white rounded-xl border-2 border-gray-100 p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 font-semibold">{f.label}</span>
                  <span className="text-gray-500">{f.v}</span>
                </div>
                <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-2 ${f.color}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="text-xs text-gray-500 mt-1">{pct}% of joined</div>
              </div>
            )
          })}
        </div>
        {summary.funnelByCondition && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">By Condition</h3>
            <div className="grid md:grid-cols-5 gap-3 text-sm">
              {(['joined','story1','breakDone','story2','recall'] as const).map((stage) => {
                const tBase = summary.funnelByCondition!.treatment.joined || 0
                const cBase = summary.funnelByCondition!.control.joined || 0
                const tv = (summary.funnelByCondition!.treatment as any)[stage] as number
                const cv = (summary.funnelByCondition!.control as any)[stage] as number
                const tp = tBase ? Math.round((tv / tBase) * 100) : 0
                const cp = cBase ? Math.round((cv / cBase) * 100) : 0
                const delta = tp - cp
                const label = stage === 'story1' ? 'Story 1' : stage === 'story2' ? 'Story 2' : stage === 'breakDone' ? 'Break' : stage === 'joined' ? 'Joined' : 'Recall'
                return (
                  <div key={stage} className="bg-white rounded-xl border-2 border-gray-100 p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-semibold">{label}</span>
                      <span className={`text-xs ${delta>0?'text-green-700':delta<0?'text-red-700':'text-gray-500'}`}>Δ {delta}%</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>Treatment</span><span>{tv} ({tp}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-2 bg-green-600" style={{ width: `${Math.min(100,tp)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>Control</span><span>{cv} ({cp}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-2 bg-gray-500" style={{ width: `${Math.min(100,cp)}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

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
            <span>Treatment (with interventions)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></div>
            <span>Control (no interventions)</span>
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

      {/* Offloading Analytics */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Offloading Analytics</h2>
          <button
            className={`px-3 py-1 border-2 rounded-lg text-sm font-semibold transition ${loadingOffloading ? 'opacity-50' : 'hover:border-gray-300'}`}
            onClick={() => expId && loadOffloading(expId)}
            disabled={loadingOffloading}
          >
            {loadingOffloading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {offloading ? (
          <div className="space-y-8">
            {/* Reliability badge */}
            <div className="flex items-center gap-3 text-sm">
              <span className="px-2 py-1 rounded border border-gray-200 bg-gray-50">
                Reliability (Cronbach’s α): <span className="font-semibold">{offloading.cronbachAlpha !== null ? offloading.cronbachAlpha.toFixed(3) : '—'}</span>
              </span>
              <span className="px-2 py-1 rounded border border-gray-200 bg-gray-50">N = {offloading.surveyCount}</span>
            </div>

            {/* Distribution */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Offloading Score Distribution</h3>
              {offloading.distribution.length === 0 ? (
                <p className="text-sm text-gray-500">No survey data yet.</p>
              ) : (
                <div className="flex items-end gap-1 h-32">
                  {offloading.distribution.map((v, idx) => {
                    const h = Math.max(6, Math.round((v / 6) * 100))
                    return (
                      <div key={idx} className="flex flex-col items-center">
                        <div className="w-6 bg-indigo-500 rounded-t" style={{ height: `${h}%` }}></div>
                        <div className="text-[10px] text-gray-500 mt-1">{v.toFixed(1)}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Correlations & Moderation */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border-2 border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Correlations (Pearson r)</h3>
                <div className="text-sm text-gray-700 space-y-1">
                  <div>Offloading × Hint Rate: <span className="font-semibold">{offloading.correlations.offloading_hintRate ?? '—'}</span></div>
                  <div>Offloading × Reveal Rate: <span className="font-semibold">{offloading.correlations.offloading_revealRate ?? '—'}</span></div>
                  <div>Offloading × Delayed Recall: <span className="font-semibold">{offloading.correlations.offloading_delayedRecall ?? '—'}</span></div>
                </div>
              </div>
              <div className="bg-white rounded-xl border-2 border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Moderation (Median Split)</h3>
                {offloading.moderation ? (
                  <div className="text-sm text-gray-700 space-y-1">
                    <div>Median: <span className="font-semibold">{offloading.moderation.median.toFixed(2)}</span></div>
                    <div>Low Offloading — Treatment vs Control: <span className="font-semibold">{offloading.moderation.low.treatment?.toFixed?.(2) ?? '—'} vs {offloading.moderation.low.control?.toFixed?.(2) ?? '—'}</span> (Δ {offloading.moderation.low.diff !== null ? offloading.moderation.low.diff.toFixed(2) : '—'})</div>
                    <div>High Offloading — Treatment vs Control: <span className="font-semibold">{offloading.moderation.high.treatment?.toFixed?.(2) ?? '—'} vs {offloading.moderation.high.control?.toFixed?.(2) ?? '—'}</span> (Δ {offloading.moderation.high.diff !== null ? offloading.moderation.high.diff.toFixed(2) : '—'})</div>
                    <div>Diff-in-Diff: <span className="font-semibold">{offloading.moderation.diffInDiff !== null ? offloading.moderation.diffInDiff.toFixed(3) : '—'}</span></div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Not enough survey data for moderation.</p>
                )}
              </div>
            </div>

            {/* Effect size summary */}
            {offloading.effectSize && (
              <div className="bg-white rounded-xl border-2 border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Effect Size (Treatment vs Control)</h3>
                <div className="text-sm text-gray-700 space-y-1">
                  <div>
                    Means (Delayed Recall):
                    <span className="ml-2">Treatment { (offloading.effectSize.treatment.mean*100).toFixed(1)}% (n={offloading.effectSize.treatment.n})</span>,
                    <span className="ml-2">Control { (offloading.effectSize.control.mean*100).toFixed(1)}% (n={offloading.effectSize.control.n})</span>
                  </div>
                  <div>
                    Hedges’ g: <span className="font-semibold">{offloading.effectSize.g.toFixed(3)}</span>
                    <span className="ml-2 text-gray-600">CI [{offloading.effectSize.ci[0].toFixed(3)}, {offloading.effectSize.ci[1].toFixed(3)}]</span>
                  </div>
                </div>
              </div>
            )}

            {/* Interaction Plot: Offloading bins × Condition → Delayed Recall (with SEM bands) */}
            <div className="bg-white rounded-xl border-2 border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Interaction: Offloading × Condition → Delayed Recall</h3>
              {(() => {
                const rows = (offloading.perStudent as OffloadingRow[]).filter(r => r.offloadingScore !== null && r.delayedRecallAvg !== null) as Array<OffloadingRow & { offloadingScore: number, delayedRecallAvg: number }>
                if (rows.length < 4) return <p className="text-sm text-gray-500">Not enough data.</p>
                const scores = rows.map(r => r.offloadingScore)
                const q = (p: number) => {
                  const s = scores.slice().sort((a,b)=>a-b)
                  const idx = Math.min(s.length-1, Math.max(0, Math.floor(p*(s.length-1))))
                  return s[idx]
                }
                const edges = [0, 0.25, 0.5, 0.75, 1].map(q)
                const bins = edges.map((e,i)=>({i, from: edges[i], to: edges[i+1] ?? edges[i]})).slice(0,4)
                const binLabel = (b:{from:number,to:number}) => `${b.from.toFixed(1)}–${b.to.toFixed(1)}`
                const meanSem = (vals: number[]) => {
                  if (!vals.length) return null
                  const n = vals.length
                  const mean = vals.reduce((s,v)=>s+v,0)/n
                  if (n === 1) return { mean, low: mean, high: mean }
                  const variance = vals.reduce((s,v)=> s + Math.pow(v-mean,2), 0) / (n - 1)
                  const sd = Math.sqrt(variance)
                  const sem = sd / Math.sqrt(n)
                  return { mean, low: mean - sem, high: mean + sem }
                }
                const data = bins.map(b => {
                  const inBin = rows.filter(r => r.offloadingScore >= b.from && r.offloadingScore <= b.to)
                  const tVals = inBin.filter(r => r.condition==='treatment').map(r=>r.delayedRecallAvg)
                  const cVals = inBin.filter(r => r.condition==='control').map(r=>r.delayedRecallAvg)
                  const t = meanSem(tVals)
                  const c = meanSem(cVals)
                  return {
                    bin: binLabel(b),
                    treat: t?.mean ?? null,
                    treatLow: t?.low ?? null,
                    treatSpan: t && t.high !== null && t.low !== null ? (t.high - t.low) : null,
                    ctrl: c?.mean ?? null,
                    ctrlLow: c?.low ?? null,
                    ctrlSpan: c && c.high !== null && c.low !== null ? (c.high - c.low) : null,
                  }
                })
                return (
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="bin" />
                        <YAxis tickFormatter={(v)=> (v*100).toFixed(0)+'%'} />
                        <RTooltip formatter={(v:any)=> typeof v==='number' ? [(v*100).toFixed(1)+'%', ''] : v} />
                        <RLegend />
                        {/* SEM bands via stacked Areas (low + span) */}
                        <Area type="monotone" dataKey="treatLow" stackId="treat" stroke="none" fill="transparent" isAnimationActive={false} />
                        <Area type="monotone" dataKey="treatSpan" stackId="treat" stroke="none" fill="#16a34a" fillOpacity={0.15} isAnimationActive={false} />
                        <Area type="monotone" dataKey="ctrlLow" stackId="ctrl" stroke="none" fill="transparent" isAnimationActive={false} />
                        <Area type="monotone" dataKey="ctrlSpan" stackId="ctrl" stroke="none" fill="#6b7280" fillOpacity={0.12} isAnimationActive={false} />
                        {/* Lines on top */}
                        <Line type="monotone" dataKey="treat" stroke="#16a34a" name="Treatment" connectNulls dot />
                        <Line type="monotone" dataKey="ctrl" stroke="#6b7280" name="Control" connectNulls dot />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )
              })()}
            </div>

            {/* Scatter: Hint Rate vs Delayed Recall by Condition */}
            <div className="bg-white rounded-xl border-2 border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Hint Rate vs Delayed Recall</h3>
              {(() => {
                const ptsT = (offloading.perStudent as OffloadingRow[]).filter(r => r.condition==='treatment' && typeof r.delayedRecallAvg==='number').map(r => ({ x: r.hintRate, y: r.delayedRecallAvg as number }))
                const ptsC = (offloading.perStudent as OffloadingRow[]).filter(r => r.condition==='control' && typeof r.delayedRecallAvg==='number').map(r => ({ x: r.hintRate, y: r.delayedRecallAvg as number }))
                if (ptsT.length + ptsC.length < 5) return <p className="text-sm text-gray-500">Not enough data.</p>
                return (
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <ScatterChart margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" dataKey="x" name="Hint Rate" tickFormatter={(v)=>v.toFixed(2)} domain={[0, 'auto']} />
                        <YAxis type="number" dataKey="y" name="Delayed Recall" tickFormatter={(v)=> (v*100).toFixed(0)+'%'} domain={[0,1]} />
                        <RTooltip formatter={(v:any, n:any)=> n==='x' ? [v.toFixed(3),'Hint Rate'] : [(v*100).toFixed(1)+'%','Delayed Recall']} />
                        <RLegend />
                        <Scatter name="Treatment" data={ptsT} fill="#16a34a" />
                        <Scatter name="Control" data={ptsC} fill="#6b7280" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                )
              })()}
            </div>

            {/* Per-student table */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Per-Student Metrics</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-300 text-left text-gray-600">
                      {['Username','Condition','Offloading','Hint Rate','Reveal Rate','Delayed Recall','Attempts','Hints','Reveals'].map((h) => (
                        <th key={h} className="p-2 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(offloading.perStudent as OffloadingRow[]).map((r) => (
                      <tr key={r.studentId} className="border-b hover:bg-gray-50">
                        <td className="p-2">{r.username}</td>
                        <td className={`p-2 ${r.condition === 'treatment' ? 'text-green-700' : r.condition === 'control' ? 'text-gray-600' : 'text-gray-400'}`}>{r.condition}</td>
                        <td className="p-2">{r.offloadingScore !== null ? r.offloadingScore.toFixed(2) : '—'}</td>
                        <td className="p-2">{r.hintRate.toFixed(3)}</td>
                        <td className="p-2">{r.revealRate.toFixed(3)}</td>
                        <td className="p-2">{r.delayedRecallAvg !== null ? (r.delayedRecallAvg * 100).toFixed(0) + '%' : '—'}</td>
                        <td className="p-2">{r.attempts}</td>
                        <td className="p-2">{r.hints}</td>
                        <td className="p-2">{r.reveals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">{loadingOffloading ? 'Loading offloading analytics…' : 'No offloading data available.'}</p>
        )}
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
