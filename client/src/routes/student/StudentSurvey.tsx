import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../../lib/api'
import LoadingScreen from '../../components/LoadingScreen'
import { toast } from '../../store/toasts'
import { useTranslation } from 'react-i18next'

type Item = { id: number; text: string }

export default function StudentSurvey() {
  const nav = useNavigate()
  const expId = sessionStorage.getItem('exp.experimentId') || ''
  const [loading, setLoading] = useState(true)
  const [statusCompleted, setStatusCompleted] = useState<boolean>(false)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const { t, i18n } = useTranslation()

  const items: Item[] = useMemo(() => (
    [1,2,3,4,5].map((id) => ({ id, text: t(`survey.items.${id}`) }))
  ), [t])

  const allAnswered = items.every((i) => typeof answers[i.id] === 'number')

  useEffect(() => {
    async function fetchStatus() {
      if (!expId) {
        setLoading(false)
        return
      }
      try {
        const { data } = await api.get('api/student/survey/pre/status', { params: { experimentId: expId } })
        if (data?.completed) {
          setStatusCompleted(true)
          // If already completed, go to run
          nav('/student/run', { replace: true })
          return
        }
      } catch {
        // ignore; allow filling survey
      } finally {
        setLoading(false)
      }
    }
    fetchStatus()
  }, [expId, nav])

  const avg = useMemo(() => {
    const vals = items.map((i) => answers[i.id]).filter((v) => typeof v === 'number') as number[]
    if (!vals.length) return 0
    return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
  }, [answers, items])

  async function submit() {
    if (!expId || !allAnswered) return
    const offloadingItems = items.map((i) => Number(answers[i.id]))
    try {
      const { data } = await api.post('api/student/survey/pre', { experimentId: expId, offloadingItems })
      if (data?.ok) {
        // Persist a flag to bypass survey on refresh
        sessionStorage.setItem('exp.preSurveyCompleted', 'true')
        toast.success('Thank you! Survey submitted.')
        nav('/student/run')
      } else {
        toast.error('Submission failed. Please try again.')
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Submission failed'
      toast.error(msg)
    }
  }

  if (loading) return <LoadingScreen message="Loading survey..." />

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white border-2 border-gray-200 rounded-2xl shadow-xl p-6">
        <div className="mb-4">
          <Link to="/student" className="text-sm text-blue-600 hover:underline">Back</Link>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('survey.title')}</h1>
            <p className="text-sm text-gray-600 mt-1">{t('survey.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <button
              className={`px-3 py-1 border rounded ${i18n.language.startsWith('en') ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200'}`}
              onClick={() => i18n.changeLanguage('en')}
            >{t('survey.lang.english')}</button>
            <button
              className={`px-3 py-1 border rounded ${i18n.language.startsWith('de') ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200'}`}
              onClick={() => i18n.changeLanguage('de')}
            >{t('survey.lang.german')}</button>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {items.map((item) => (
            <div key={item.id} className="p-4 border border-gray-200 rounded-xl">
              <div className="font-medium text-gray-800 mb-3">{item.text}</div>
              <div className="grid grid-cols-6 gap-2 text-center">
                {[1,2,3,4,5,6].map((v) => (
                  <label key={v} className={`px-3 py-2 rounded-lg border cursor-pointer transition ${answers[item.id]===v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name={`q${item.id}`}
                      value={v}
                      checked={answers[item.id] === v}
                      onChange={() => setAnswers((prev) => ({ ...prev, [item.id]: v }))}
                      className="hidden"
                    />
                    {v}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-gray-600">
          <div>{t('survey.average')}: <span className="font-semibold text-gray-800">{avg || '-'}</span></div>
          <div>{Object.keys(answers).length}/{items.length} {t('survey.answered')}</div>
        </div>

        <div className="mt-6 flex gap-3">
          <button className="btn flex-1" onClick={() => nav('/student')}>{t('survey.cancel')}</button>
          <button
            className={`btn primary flex-1 ${allAnswered ? '' : 'opacity-50 cursor-not-allowed'}`}
            disabled={!allAnswered}
            onClick={submit}
          >
            {t('survey.submit')}
          </button>
        </div>
      </div>
    </div>
  )
}
