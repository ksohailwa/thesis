import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, ArrowRight, ClipboardList, Layers, PenSquare, PlayCircle } from 'lucide-react'
import api from '../../lib/api'
import LoadingScreen from '../../components/LoadingScreen'
import { toast } from '../../store/toasts'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'

export default function TeacherHome() {
  const [experiments, setExperiments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<'all' | 'draft' | 'live' | 'closed'>('all')
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'>('B1')
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
    if (!title.trim()) {
      toast.error('Please enter a title')
      return
    }
    setCreating(true)
    try {
      const { data } = await api.post('/api/experiments', { title: title.trim(), level })
      const expId = data?.id || data?._id
      if (expId) nav(`/teacher/experiments/${expId}`)
      setTitle('')
      setLevel('B1')
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to create')
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

  const cardStyles: Record<string, { active: string; value: string }> = {
    blue: { active: 'border-primary-500 bg-primary-50 shadow-md', value: 'text-primary-600' },
    orange: { active: 'border-amber-400 bg-amber-50 shadow-md', value: 'text-amber-600' },
    green: { active: 'border-emerald-400 bg-emerald-50 shadow-md', value: 'text-emerald-600' },
    gray: { active: 'border-neutral-300 bg-neutral-50 shadow-md', value: 'text-neutral-600' },
    purple: { active: 'border-indigo-400 bg-indigo-50 shadow-md', value: 'text-indigo-600' },
  }

  const summaryCards = [
    { key: 'all', label: 'Total', value: stats.total, color: 'blue', Icon: Layers },
    { key: 'draft', label: 'Drafts', value: stats.draft, color: 'orange', Icon: PenSquare },
    { key: 'live', label: 'Live', value: stats.live, color: 'green', Icon: PlayCircle },
    { key: 'closed', label: 'Completed', value: stats.closed, color: 'gray', Icon: Archive },
    { key: 'analytics', label: 'Analytics', value: '', color: 'purple', Icon: ClipboardList },
  ] as const

  return (
      <div className="space-y-8 text-gray-900 transition-colors duration-300">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">
              Teacher Dashboard
            </h1>
            <p className="text-gray-600 text-sm mt-1">Manage your spelling experiments</p>
          </div>
        </div>

        <Card className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm text-gray-600 mb-1">Title</label>
            <Input
              placeholder="e.g., Week 1 Spelling"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Level</label>
            <select
              className="input"
              value={level}
              onChange={(e) => setLevel(e.target.value as any)}
            >
              <option value="A1">A1</option>
              <option value="A2">A2</option>
              <option value="B1">B1</option>
              <option value="B2">B2</option>
              <option value="C1">C1</option>
              <option value="C2">C2</option>
            </select>
          </div>
          <Button className="px-6 py-3" onClick={createNew} disabled={creating}>
            {creating ? 'Creating...' : 'Create Experiment'}
          </Button>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {summaryCards.map((card) => {
            const style = cardStyles[card.color]
            const Icon = card.Icon
            return (
              <button
                key={card.key}
                onClick={() => {
                  if (card.key === 'analytics') {
                    nav('/teacher/analytics')
                  } else {
                    setFilter(card.key as any)
                  }
                }}
                className={`rounded-xl border transition-all text-left ${
                  filter === card.key ? style.active : 'border-neutral-200 bg-white hover:border-neutral-300'
                }`}
              >
                <Card className="border-none shadow-none p-6">
                  <div className="flex items-start justify-between mb-2">
                    <Icon className={style.value} size={28} />
                    <div className={`text-2xl font-bold ${style.value}`}>{card.value}</div>
                  </div>
                  <div className="text-sm font-medium text-gray-600">{card.label === "Analytics" ? "Analytics" : `${card.label} Experiments`}</div>
                </Card>
              </button>
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="flex justify-center mb-4">
              <ClipboardList className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {filter === 'all' ? 'No experiments yet' : `No ${filter} experiments`}
            </h3>
            <p className="text-gray-600 mb-6">
              {filter === 'all' ? 'Create your first experiment to get started' : 'Try changing the filter or create a new experiment'}
            </p>
            {filter === 'all' && (
              <Button size="lg" onClick={createNew}>
                Create Your First Experiment
              </Button>
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
                <Card key={expId} className="p-0 overflow-hidden">
                  <div
                    className={`h-1 ${
                      status === 'live'
                        ? 'bg-emerald-500'
                        : status === 'draft'
                        ? 'bg-amber-500'
                        : 'bg-neutral-300'
                    }`}
                  />
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 pr-4">
                        <h3 className="font-bold text-lg mb-1 line-clamp-2">
                          {exp.title}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span className="px-2 py-0.5 bg-neutral-100 rounded font-medium">{level}</span>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${
                          status === 'live'
                            ? 'bg-emerald-100 text-emerald-700'
                            : status === 'draft'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {status}
                      </span>
                    </div>

                    <div className="flex gap-2 items-center justify-between">
                      <div className="text-xs text-gray-500">
                        Code: <span className="font-mono">{classCode}</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          navigator.clipboard.writeText(classCode);
                          toast.success('Code copied!');
                        }}
                        title="Copy code"
                      >
                        Copy
                      </Button>
                    </div>

                    <Button
                      className="w-full text-sm font-semibold"
                      onClick={() => nav(`/teacher/experiments/${expId}`)}
                    >
                      <span className="inline-flex items-center gap-2 justify-center w-full">
                        <span>Manage</span>
                        <ArrowRight size={16} />
                      </span>
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
    </div>
  )
}
