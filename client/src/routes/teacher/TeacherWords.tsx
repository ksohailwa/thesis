import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../lib/api';

export default function TeacherWords() {
  const { id } = useParams();
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState('');
  const [words, setWords] = useState('');
  const [busySave, setBusySave] = useState(false);
  const [busyGen, setBusyGen] = useState(false);
  const [status, setStatus] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [ttsA, setTtsA] = useState<string | null>(null);
  const [ttsB, setTtsB] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [storyH, setStoryH] = useState<string[] | null>(null);
  const [storyN, setStoryN] = useState<string[] | null>(null);

  async function load() {
    try {
      const { data } = await api.get(`/api/experiments/${id}`);
      setTitle(data?.title || '');
      setLevel(data?.level || '');
      const existing = Array.isArray(data?.targetWords) ? data.targetWords.join(', ') : '';
      setWords(existing);
    } catch {}
  }

  useEffect(() => { if (id) load(); }, [id]);

  function parseWords(): string[] {
    return words.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
  }

  async function save() {
    if (!id) return;
    const arr = parseWords();
    if (!arr.length) { setStatus('Enter at least one word.'); return; }
    setBusySave(true);
    setStatus('');
    try {
      await api.post(`/api/experiments/${id}/target-words`, { targetWords: arr });
      setStatus('Words saved.');
    } catch (e: any) {
      setStatus(e?.response?.data?.error || 'Save failed');
    } finally {
      setBusySave(false);
    }
  }

  async function fetchSuggestions() {
    if (!id) return;
    setStatus('');
    try {
      const { data } = await api.post(`/api/experiments/${id}/suggestions`);
      setSuggestions(data?.suggestions || []);
      setStatus('Suggestions ready. Select up to 5.');
    } catch (e: any) {
      setStatus(e?.response?.data?.error || 'Failed to get suggestions');
    }
  }

  function toggleWord(w: string) {
    const current = parseWords();
    if (current.includes(w)) {
      const next = current.filter(x=>x!==w);
      setWords(next.join(', '));
    } else {
      const next = [...current, w].slice(0, 5);
      setWords(next.join(', '));
    }
  }

  async function genTTS(label: 'A'|'B') {
    if (!id) return;
    try {
      const { data } = await api.post(`/api/experiments/${id}/tts`, { label });
      if (label === 'A') setTtsA(data.url); else setTtsB(data.url);
    } catch (e: any) { setStatus(e?.response?.data?.error || 'TTS failed'); }
  }

  async function launch(condition: 'with-hints'|'without-hints') {
    if (!id) return;
    try {
      const { data } = await api.post(`/api/experiments/${id}/launch`, { condition });
      setJoinCode(data.code);
      setStatus(`Launched (${condition}). Join code: ${data.code}`);
    } catch (e: any) { setStatus(e?.response?.data?.error || 'Launch failed'); }
  }

  async function generate() {
    if (!id) return;
    const arr = parseWords();
    if (!arr.length) { setStatus('Enter at least one word.'); return; }
    setBusyGen(true);
    setStatus('');
    try {
      const { data } = await api.post(`/api/experiments/${id}/generate-stories`, { cefr: level, targetWords: arr });
      const src = data?.used === 'openai' ? 'LLM' : 'Mock';
      setStatus(`Stories generated (${src}).`);
      await loadStories();
    } catch (e: any) {
      setStatus(e?.response?.data?.error || 'Generation failed');
    } finally {
      setBusyGen(false);
    }
  }

  async function loadStories() {
    if (!id) return;
    try {
      const [h, n] = await Promise.all([
        api.get(`/api/experiments/${id}/story/H`).catch(()=>({ data:null } as any)),
        api.get(`/api/experiments/${id}/story/N`).catch(()=>({ data:null } as any)),
      ]);
      setStoryH(h?.data?.paragraphs || null);
      setStoryN(n?.data?.paragraphs || null);
    } catch {}
  }

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-4">
      <div className="text-xs text-gray-600">
        <Link to="/teacher">Home</Link>
      </div>
      <h1 className="text-xl font-semibold">Select Words</h1>
      {title && (
        <div className="text-sm text-gray-700">Title: {title} • Level: {level}</div>
      )}
      <div className="focus-card space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm">Words (select up to 5 or enter manually)</label>
          <button className="px-3 py-1 border rounded" onClick={fetchSuggestions}>Fetch Suggestions</button>
        </div>
        {!!suggestions.length && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {suggestions.map(w => {
              const active = parseWords().includes(w);
              return <button key={w} onClick={()=>toggleWord(w)} className={`px-2 py-1 border rounded ${active? 'bg-emerald-600 text-white border-emerald-600':''}`}>{w}</button>
            })}
          </div>
        )}
        <label className="text-sm">Words (comma separated)</label>
        <input className="border p-2 w-full" placeholder="e.g. apple, river, music" value={words} onChange={e=>setWords(e.target.value)} />
        <div className="flex gap-2">
          <button className="px-3 py-1 border rounded disabled:opacity-50" disabled={busySave} onClick={save}>{busySave ? 'Saving...' : 'Save'}</button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50" disabled={busyGen} onClick={generate}>{busyGen ? 'Generating...' : 'Generate Stories'}</button>
          <button className="px-3 py-1 border rounded" onClick={()=>nav('/teacher')}>Done</button>
        </div>
        {status && <div className="text-xs text-gray-700">{status}</div>}
      </div>

      {(storyH || storyN) && (
        <div className="focus-card space-y-4">
          <div className="font-semibold">Preview</div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-1">Story H (with hints)</div>
              {storyH ? storyH.map((p, i) => <p key={i} className="mb-3 leading-7">{p}</p>) : <div className="text-sm text-gray-500">No story yet.</div>}
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Story N (no hints)</div>
              {storyN ? storyN.map((p, i) => <p key={i} className="mb-3 leading-7">{p}</p>) : <div className="text-sm text-gray-500">No story yet.</div>}
            </div>
          </div>
          <div><button className="btn" onClick={loadStories}>Refresh Preview</button></div>
        </div>
      )}

      <div className="focus-card space-y-2">
        <div className="font-semibold">TTS & Launch</div>
        <div className="flex flex-wrap gap-2 items-center">
          <button className="px-3 py-1 border rounded" onClick={()=>genTTS('A')}>Generate TTS A</button>
          {ttsA && <audio controls src={ttsA} />}
          <button className="px-3 py-1 border rounded" onClick={()=>genTTS('B')}>Generate TTS B</button>
          {ttsB && <audio controls src={ttsB} />}
        </div>
        <div className="flex gap-2 items-center">
          <button className="px-3 py-1 bg-emerald-600 text-white rounded" onClick={()=>launch('with-hints')}>Launch H (with hints)</button>
          <button className="px-3 py-1 border rounded" onClick={()=>launch('without-hints')}>Launch N (no hints)</button>
          {joinCode && <div className="text-sm">Join code: <span className="font-mono">{joinCode}</span></div>}
        </div>
      </div>
    </div>
  );
}
