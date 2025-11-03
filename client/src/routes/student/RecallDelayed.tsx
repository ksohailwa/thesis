import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import EffortPrompt from '../../components/EffortPrompt';
import LanguageSwitcher from '../../components/LanguageSwitcher';

export default function RecallDelayed() {
  const { t } = useTranslation();
  const sessionId = sessionStorage.getItem('sessionId')!;
  const templateId = sessionStorage.getItem('templateId')!;
  const targetWords = JSON.parse(sessionStorage.getItem('targetWords') || '[]') as string[];
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ average: number } | null>(null);
  const [unlockAt, setUnlockAt] = useState<string | null>(null);
  const [locked, setLocked] = useState(true);
  const [showEndEffort, setShowEndEffort] = useState(false);

  const items = useMemo(() => targetWords.map(w => ({ targetWord: w })), [targetWords]);

  useEffect(() => { (async () => {
    const { data } = await api.get(`/api/session/${sessionId}/tasks`);
    const ua = data.recall?.delayed?.unlockAt || null;
    setUnlockAt(ua);
    setLocked(ua ? new Date(ua).getTime() > Date.now() : false);
  })(); }, [sessionId]);

  async function submit() {
    const payload = { sessionId, storyTemplateId: templateId, items: items.map(i => ({ targetWord: i.targetWord, text: answers[i.targetWord] || '' })) };
    const { data } = await api.post('/api/recall/delayed', payload);
    setResult({ average: data.average });
    setShowEndEffort(true);
  }

  if (locked) return <div className="focus-card">{t('recall.delayed')} {t('recall.unlockAt')}: {unlockAt ? new Date(unlockAt).toLocaleString() : '—'}</div>;

  return (
    <div className="focus-card">
      <div className="flex justify-end mb-2"><LanguageSwitcher /></div>
      <h2 className="font-semibold mb-3">{t('recall.delayed')}</h2>
      <div className="space-y-2">
        {items.map(i => (
          <div className="flex gap-2 items-center" key={i.targetWord}>
            <div className="w-32 text-sm text-gray-600">{i.targetWord}</div>
            <input className="border p-2 flex-1" value={answers[i.targetWord] || ''} onChange={e=>setAnswers(a=>({...a, [i.targetWord]: e.target.value}))} />
          </div>
        ))}
      </div>
      <button className="mt-3 bg-blue-600 text-white px-3 py-2 rounded" onClick={submit}>{t('common.submit')}</button>
      {result && <div className="mt-2">{t('recall.avg')}: {result.average.toFixed(2)}</div>}
      <EffortPrompt open={showEndEffort} onClose={() => setShowEndEffort(false)} sessionId={sessionId} taskType="delayed-recall" position="end" />
    </div>
  );
}
