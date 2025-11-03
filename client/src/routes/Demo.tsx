import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../store/auth';
import { useNavigate } from 'react-router-dom';

export default function Demo() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();
  const { accessToken, demo, setAuth } = useAuth();
  useEffect(() => { (async () => {
    try { const { data } = await api.get('/api/demo'); setList(data || []); } finally { setLoading(false); }
  })(); }, []);
  if (loading) return <div className="focus-card">Loading demo experiments…</div>;
  return (
    <div className="focus-wide">
      <h1 className="text-xl font-semibold mb-3">Demo Experiments</h1>
      <div className="grid md:grid-cols-2 gap-3">
        {list.map((e) => (
          <div key={e.id} className="p-3 bg-white rounded shadow">
            <div className="font-semibold">{e.title} <span className="text-xs text-gray-500">({e.level})</span></div>
            <div className="text-sm text-gray-600 line-clamp-3">{e.description}</div>
            <div className="text-xs text-gray-500 mt-1">Words: {e.targetWordsCount}</div>
            <button
              className="inline-block mt-2 px-3 py-1 border rounded"
              onClick={async () => {
                try {
                  if (!accessToken || !demo) {
                    const { data } = await api.post('/api/auth/demo');
                    setAuth({ accessToken: data.accessToken, role: data.role, email: data.email, demo: true });
                  }
                  const start = await api.post(`/api/experiments/${e.id}/demo-start`, {});
                  const exp = start.data;
                  sessionStorage.clear();
                  sessionStorage.setItem('sessionId', exp.experiment.id);
                  sessionStorage.setItem('exp.experimentId', exp.experiment.id);
                  sessionStorage.setItem('exp.condition', exp.condition);
                  sessionStorage.setItem('exp.stories', JSON.stringify(exp.stories));
                  sessionStorage.setItem('exp.schedule', JSON.stringify(exp.schedule));
                  sessionStorage.setItem('targetWords', JSON.stringify(exp.experiment.targetWords || []));
                  nav('/student/exp');
                } catch {}
              }}
            >
              Try demo
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
