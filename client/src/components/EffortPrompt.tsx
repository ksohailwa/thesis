import { useState } from 'react';
import api from '../lib/api';

type Props = { open: boolean; onClose: () => void; sessionId: string; taskType: string; position: 'mid'|'end' };

export default function EffortPrompt({ open, onClose, sessionId, taskType, position }: Props) {
  const [score, setScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (!open) return null;
  async function submit() {
    if (!score) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/api/effort', { sessionId, taskType, position, score });
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded shadow max-w-sm w-full">
        <h3 className="font-semibold mb-2">How mentally demanding was this?</h3>
        <div className="grid grid-cols-9 gap-1 mb-3 text-center">
          {Array.from({ length: 9 }).map((_, i) => (
            <button
              key={i}
              className={`border p-2 ${score===i+1?'bg-blue-600 text-white':''}`}
              onClick={async ()=>{ setScore(i+1); await submit(); }}
              disabled={saving}
            >{i+1}</button>
          ))}
        </div>
        {error && <div className="text-xs text-red-600 mb-2">{String(error)}</div>}
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 border rounded" onClick={onClose} disabled={saving}>Skip</button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={submit} disabled={!score || saving}>{saving ? 'Saving...' : 'Submit'}</button>
        </div>
      </div>
    </div>
  );
}
