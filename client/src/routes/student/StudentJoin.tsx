import { useState } from 'react';
import api from '../../lib/api';
import { useNavigate } from 'react-router-dom';

export default function StudentJoin() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setBusy(true);
      const { data } = await api.post('/api/student/join', { code });
      // Clear previous session data to ensure latest UI
      sessionStorage.clear();
      if (data?.experiment) {
        // v2 experiment flow
        sessionStorage.setItem('sessionId', data.experiment.id); // use experiment id as session context
        sessionStorage.setItem('exp.experimentId', data.experiment.id);
        sessionStorage.setItem('exp.condition', data.condition);
        sessionStorage.setItem('exp.stories', JSON.stringify(data.stories));
        sessionStorage.setItem('exp.schedule', JSON.stringify(data.schedule));
        sessionStorage.setItem('targetWords', JSON.stringify(data.experiment.targetWords || []));
        nav('/student/exp');
        return;
      }
      // legacy session flow
      sessionStorage.setItem('sessionId', data.sessionId);
      sessionStorage.setItem('templateId', data.template._id);
      sessionStorage.setItem('condition', data.template.condition);
      sessionStorage.setItem('difficulty', data.template.difficulty || 'A1');
      sessionStorage.setItem('sentences', JSON.stringify(data.sentences || []));
      sessionStorage.setItem('gapPlan', JSON.stringify(data.gapPlan || []));
      {
        const au: string = data.template.ttsAudioUrl || '';
        const base = import.meta.env.VITE_API_BASE_URL || '';
        const full = au && au.startsWith('/static') ? `${base}${au}` : au;
        sessionStorage.setItem('audioUrl', full);
      }
      sessionStorage.setItem('storyText', data.template.storyText || '');
      sessionStorage.setItem('ttsSegments', JSON.stringify(data.template.ttsSegments || []));
      sessionStorage.setItem('targetWords', JSON.stringify(data.template.targetWords));
      nav('/student/consent');
    } catch (e: any) { setError(e?.response?.data?.error || 'Join failed'); } finally { setBusy(false); }
  }

  return (
    <div className="focus-card" role="main">
      <div className="flex flex-col items-center mb-4">
                <div className="text-xl font-semibold">Spell Wise</div>
      </div>
      <h1 className="text-xl font-semibold mb-4">Join Session</h1>
      <form onSubmit={submit} className="space-y-3" aria-label="Join form">
        <label className="block">
          <span className="sr-only">Join code</span>
          <input className="input text-center text-2xl tracking-widest" placeholder="CODE" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} inputMode="text" autoCapitalize="characters" autoFocus />
        </label>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button disabled={busy || !code} className="w-full bg-blue-600 text-white p-3 rounded disabled:opacity-60">{busy ? 'Joining…' : 'Enter'}</button>
      </form>
    </div>
  );
}


