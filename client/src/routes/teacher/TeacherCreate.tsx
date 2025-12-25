import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { toast } from '../../store/toasts';

type Level = 'A1'|'A2'|'B1'|'B2'|'C1'|'C2';

export default function TeacherCreate() {
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<Level>('B1');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!title.trim()) { toast.error('Please enter a title'); return; }
    setBusy(true);
    try {
      const payload = { title: title.trim(), description: '', level, maxTargetWords: 10 };
      const { data } = await api.post('/api/experiments', payload);
      toast.success('Experiment created');
      const newId = data?.id || data?._id;
      if (newId) nav(`/teacher/experiments/${newId}`);
      else nav('/teacher');
      } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Create Experiment</h1>
      <div className="focus-card space-y-2">
        <label className="text-sm">Title</label>
        <input className="border p-2 w-full" placeholder="Enter a title" value={title} onChange={e=>setTitle(e.target.value)} />
        <label className="text-sm">Level</label>
        <select className="border p-2 w-full" value={level} onChange={e=>setLevel(e.target.value as Level)}>
          <option>A1</option><option>A2</option><option>B1</option><option>B2</option><option>C1</option><option>C2</option>
        </select>
        <div className="pt-2">
          <button className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50" disabled={busy} onClick={create}>
            {busy ? 'Creating...' : 'Create'}
          </button>
          <button className="ml-2 px-3 py-1 border rounded" onClick={()=>nav('/teacher')}>Cancel</button>
        </div>
      </div>
    </div>
  );
}



