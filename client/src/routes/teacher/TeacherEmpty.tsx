import { useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'

type Exp = { id: string; title: string; cefr?: string; status?: string; code?: string; hasH?: boolean; hasN?: boolean }

export default function TeacherEmpty() {
  const [list, setList] = useState<Exp[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [newLevel, setNewLevel] = useState<'A1'|'A2'|'B1'|'B2'|'C1'|'C2'>('B1')
  const [creating, setCreating] = useState(false)

  async function load() {
    try { const { data } = await api.get('/api/experiments'); setList(data || []) }
    catch { setList([]) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  async function createExp() {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      await api.post('/api/experiments', { title: newTitle.trim(), level: newLevel })
      setNewTitle('')
      await load()
    } finally { setCreating(false) }
  }

  return (
    <div className="container py-10">
      <div className="mb-4"><h1 className="text-2xl font-semibold">My Experiments</h1></div>
      {loading && <div className="text-sm text-gray-600">Loading…</div>}
      {!loading && list.length === 0 && (
        <div className="text-sm text-gray-600">No experiments yet. Create one to get started.</div>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        <CreateTile
          title={newTitle}
          onTitle={setNewTitle}
          level={newLevel}
          onLevel={setNewLevel}
          creating={creating}
          onCreate={createExp}
        />
        {list.map(e => (
          <div key={e.id} className={`section p-4 ${e.hasH && e.hasN ? 'md:col-span-2' : ''}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{e.title} <span className="text-xs text-gray-500">({e.cefr||'B1'})</span></div>
                <div className="text-xs text-gray-500">
                  Status: {e.status || 'draft'} {e.code && <><span> • Code: </span><span className="font-mono">{e.code}</span></>}
                </div>
                <div className="text-xs mt-1">
                  <span className={e.hasH ? 'text-emerald-700' : 'text-gray-400'}>H {e.hasH ? 'available' : 'pending'}</span>
                  <span className="mx-2">•</span>
                  <span className={e.hasN ? 'text-emerald-700' : 'text-gray-400'}>N {e.hasN ? 'available' : 'pending'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn danger" onClick={async ()=>{
                  if (!confirm('Delete this experiment? This cannot be undone.')) return
                  try { await api.delete(`/api/experiments/${e.id}`); setList(list.filter(x => x.id !== e.id)) } catch {}
                }}>Delete</button>
              </div>
            </div>
            <ManagePanel expId={e.id} />
          </div>
        ))}
      </div>
    </div>
  )
}

function CreateTile({ title, onTitle, level, onLevel, creating, onCreate }: { title: string; onTitle: (v:string)=>void; level: 'A1'|'A2'|'B1'|'B2'|'C1'|'C2'; onLevel: (v:any)=>void; creating: boolean; onCreate: ()=>void }) {
  return (
    <div className="section p-4 flex flex-col gap-2">
      <div className="text-lg font-semibold">Create New Experiment</div>
      <input className="input" placeholder="Title" value={title} onChange={e=>onTitle(e.target.value)} />
      <div className="flex items-center gap-2">
        <label className="text-sm">Level</label>
        <select className="input" value={level} onChange={e=>onLevel(e.target.value as any)}>
          <option value="A1">A1</option><option value="A2">A2</option><option value="B1">B1</option><option value="B2">B2</option><option value="C1">C1</option><option value="C2">C2</option>
        </select>
        <button className="btn primary" disabled={creating || !title.trim()} onClick={onCreate}>{creating ? 'Creatingâ€¦' : 'Create'}</button>
      </div>
    </div>
  )
}

function useWordsState(initial: string) {
  const [words, setWords] = useState(initial)
  const arr = useMemo(() => words.split(',').map(s => s.trim()).filter(Boolean).slice(0,10), [words])
  function toggle(w: string) {
    if (arr.includes(w)) setWords(arr.filter(x=>x!==w).join(', '))
    else setWords([...arr, w].slice(0,10).join(', '))
  }
  return { words, setWords, arr, toggle }
}

function ManagePanel({ expId }: { expId: string }) {
  const [show, setShow] = useState(false)
  const [meta, setMeta] = useState<{ title?: string; level?: string } | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const { words, setWords, arr, toggle } = useWordsState('')
  const wordsH = arr.slice(0,5)
  const wordsN = arr.slice(5,10).length ? arr.slice(5,10) : arr.slice(0,5)
  const [busy, setBusy] = useState<{ save?: boolean; gen?: boolean; launch?: boolean }>({})
  const [status, setStatus] = useState('')
  const [storyH, setStoryH] = useState<string[] | null>(null)
  const [storyN, setStoryN] = useState<string[] | null>(null)
  const [audioH, setAudioH] = useState<string>('')
  const [audioN, setAudioN] = useState<string>('')
  const [joinCode, setJoinCode] = useState<string | null>(null)

  useEffect(() => { if (show) void loadMeta(); }, [show])
  async function loadMeta() {
    try {
      const { data } = await api.get(`/api/experiments/${expId}`)
      setMeta({ title: data?.title, level: data?.level })
      setWords((data?.targetWords||[]).join(', '))
      await refreshStories()
    } catch {}
  }

  async function fetchSuggestions() { try { const { data } = await api.post(`/api/experiments/${expId}/suggestions`); setSuggestions(data?.suggestions || []) } catch {} }
  async function saveWords() { setBusy(b=>({ ...b, save: true })); setStatus(''); try { await api.post(`/api/experiments/${expId}/target-words`, { targetWords: arr }); setStatus('Words saved') } catch(e:any){ setStatus(e?.response?.data?.error || 'Save failed') } finally { setBusy(b=>({ ...b, save: false })) } }
  async function refreshStories(){ try { const [h,n] = await Promise.all([ api.get(`/api/experiments/${expId}/story/H`).catch(()=>({ data:null } as any)), api.get(`/api/experiments/${expId}/story/N`).catch(()=>({ data:null } as any)) ]); setStoryH(h?.data?.paragraphs || null); setStoryN(n?.data?.paragraphs || null); const base = import.meta.env.VITE_API_BASE_URL || ''; const hu = (h?.data?.ttsAudioUrl || `/static/audio/${expId}/H.mp3`); const nu = (n?.data?.ttsAudioUrl || `/static/audio/${expId}/N.mp3`); setAudioH(hu ? (hu.startsWith('/static')? `${base}${hu}` : hu) : ''); setAudioN(nu ? (nu.startsWith('/static')? `${base}${nu}` : nu) : ''); } catch {} }

  async function generateH(){ setBusy(b=>({ ...b, gen: true })); setStatus(''); try { await api.post(`/api/experiments/${expId}/generate-story`, { label: 'H', targetWords: wordsH }); setStatus('Story H ready'); await refreshStories() } catch(e:any){ const msg = e?.response?.data?.error || 'Generation failed'; setStatus(e?.response?.status===403? msg+' (Teacher role required)':msg) } finally { setBusy(b=>({ ...b, gen: false })) } }
  async function generateN(){ setBusy(b=>({ ...b, gen: true })); setStatus(''); try { await api.post(`/api/experiments/${expId}/generate-story`, { label: 'N', targetWords: wordsN }); setStatus('Story N ready'); await refreshStories() } catch(e:any){ const msg = e?.response?.data?.error || 'Generation failed'; setStatus(e?.response?.status===403? msg+' (Teacher role required)':msg) } finally { setBusy(b=>({ ...b, gen: false })) } }
  async function generateAll(){
    setBusy(b=>({ ...b, gen: true })); setStatus('')
    try {
      await api.post(`/api/experiments/${expId}/generate-story`, { label: 'H', targetWords: wordsH })
      await api.post(`/api/experiments/${expId}/generate-story`, { label: 'N', targetWords: wordsN })
      const t = await api.post(`/api/experiments/${expId}/tts`, {})
      const base = import.meta.env.VITE_API_BASE_URL || ''
      const hu = t.data?.H?.url || `/static/audio/${expId}/H.mp3`
      const nu = t.data?.N?.url || `/static/audio/${expId}/N.mp3`
      setAudioH(hu.startsWith('/static')? `${base}${hu}` : hu)
      setAudioN(nu.startsWith('/static')? `${base}${nu}` : nu)
      setStatus('Stories and audio are ready')
      await refreshStories()
    } catch(e:any){
      const msg = e?.response?.data?.error || 'Generation failed'
      setStatus(e?.response?.status===403? msg+' (Are you logged in as a Teacher?)':msg)
    } finally { setBusy(b=>({ ...b, gen: false })) }
  }
  async function ttsOne(label: 'H'|'N') {
    setBusy(b=>({ ...b, gen: true })); setStatus('')
    try {
      const r = await api.post(`/api/experiments/${expId}/tts`, { label })
      const base = import.meta.env.VITE_API_BASE_URL || ''
      const url: string = r.data?.url || `/static/audio/${expId}/${label}.mp3`
      const full = url.startsWith('/static') ? `${base}${url}` : url
      if (label==='H') setAudioH(full); else setAudioN(full)
      setStatus('TTS ready')
    } catch(e:any){ const msg = e?.response?.data?.error || 'TTS failed'; setStatus(e?.response?.status===403? msg+' (Teacher role required)':msg) }
    finally { setBusy(b=>({ ...b, gen: false })) }
  }
  async function launch(condition: 'with-hints'|'without-hints'){
    setBusy(b=>({ ...b, launch: true })); setStatus('')
    try {
      const { data } = await api.post(`/api/experiments/${expId}/launch`, { condition })
      setJoinCode(data?.code||null)
      setStatus(`Launched (${condition}). Code: ${data?.code}`)
    } catch(e:any){ setStatus(e?.response?.data?.error || 'Launch failed') }
    finally { setBusy(b=>({ ...b, launch: false })) }
  }

  return (
    <div className="mt-3 text-sm">
      <button className="btn" onClick={()=> setShow(s=>!s)}>{show ? 'Hide' : 'Manage'}</button>
      {!show ? null : (
        <div className="mt-3 space-y-3 border rounded p-3">
           <div className="text-xs text-gray-500">{meta?.title} • Level {meta?.level || 'B1'}</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Select up to 10 target words</div>
              <button className="btn" onClick={fetchSuggestions}>Fetch Suggestions</button>
            </div>
            {!!suggestions.length && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map(w => {
                  const active = arr.includes(w)
                  return <button key={w} onClick={()=>toggle(w)} className={`px-2 py-1 border rounded ${active? 'bg-emerald-600 text-white border-emerald-600':''}`}>{w}</button>
                })}
              </div>
            )}
            <label className="text-xs">Words (comma separated)</label>
            <input className="input w-full" value={words} onChange={e=>setWords(e.target.value)} placeholder="e.g. apple, river, music" />
            <div className="text-xs text-gray-600">Story H uses: <span className="font-medium">{wordsH.join(', ') || 'â€”'}</span></div>
            <div className="text-xs text-gray-600">Story N uses: <span className="font-medium">{wordsN.join(', ') || 'â€”'}</span></div>
            <div className="flex gap-2 flex-wrap">
              <button className="btn" disabled={busy.save} onClick={saveWords}>{busy.save ? 'Savingâ€¦' : 'Save Words'}</button>
              <button className="btn" disabled={busy.gen || wordsH.length===0} onClick={generateH}>{busy.gen ? 'Generatingâ€¦' : 'Generate H'}</button>
              <button className="btn" disabled={busy.gen || wordsN.length===0} onClick={generateN}>{busy.gen ? 'Generatingâ€¦' : 'Generate N'}</button>
              <button className="btn primary" disabled={busy.gen || arr.length===0} onClick={generateAll}>{busy.gen ? 'Generatingâ€¦' : 'Generate Both + TTS'}</button>
            </div>
            {status && <div className="text-xs text-gray-700">{status}</div>}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Preview</div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-700">Story H (with hints)</div>
                {storyH ? storyH.map((p,i)=>(<p key={i} className="mb-2 leading-7">{p}</p>)) : <div className="text-xs text-gray-500">No story yet.</div>}
                {audioH && <audio id={`audio-H-${expId}`} controls src={audioH} className="mt-1 w-full" />}
                {audioH && (
                  <div className="mt-2 flex items-center gap-2">
                    <button className="btn" onClick={()=> (document.getElementById(`audio-H-${expId}`) as HTMLAudioElement)?.play()}>Play</button>
                    <button className="btn" onClick={()=> (document.getElementById(`audio-H-${expId}`) as HTMLAudioElement)?.pause()}>Pause</button>
                    <button className="btn" onClick={()=> { const a = document.getElementById(`audio-H-${expId}`) as HTMLAudioElement | null; if (a) a.currentTime = Math.max(0, a.currentTime - 3); }}>-3s</button>
                    <button className="btn" onClick={()=> { const a = document.getElementById(`audio-H-${expId}`) as HTMLAudioElement | null; if (a) a.currentTime = a.currentTime + 3; }}>+3s</button>
                  </div>
                )}
                <div className="mt-2"><button className="btn" onClick={()=>ttsOne('H')}>TTS H</button></div>
              </div>
              <div>
                <div className="text-xs text-gray-700">Story N (no hints)</div>
                {storyN ? storyN.map((p,i)=>(<p key={i} className="mb-2 leading-7">{p}</p>)) : <div className="text-xs text-gray-500">No story yet.</div>}
                {audioN && <audio id={`audio-N-${expId}`} controls src={audioN} className="mt-1 w-full" />}
                {audioN && (
                  <div className="mt-2 flex items-center gap-2">
                    <button className="btn" onClick={()=> (document.getElementById(`audio-N-${expId}`) as HTMLAudioElement)?.play()}>Play</button>
                    <button className="btn" onClick={()=> (document.getElementById(`audio-N-${expId}`) as HTMLAudioElement)?.pause()}>Pause</button>
                    <button className="btn" onClick={()=> { const a = document.getElementById(`audio-N-${expId}`) as HTMLAudioElement | null; if (a) a.currentTime = Math.max(0, a.currentTime - 3); }}>-3s</button>
                    <button className="btn" onClick={()=> { const a = document.getElementById(`audio-N-${expId}`) as HTMLAudioElement | null; if (a) a.currentTime = a.currentTime + 3; }}>+3s</button>
                  </div>
                )}
                <div className="mt-2"><button className="btn" onClick={()=>ttsOne('N')}>TTS N</button></div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Launch</div>
            <div className="flex items-center gap-2 flex-wrap">
              <button className="btn" disabled={busy.launch} onClick={()=>launch('with-hints')}>Launch H (with hints)</button>
              <button className="btn" disabled={busy.launch} onClick={()=>launch('without-hints')}>Launch N (no hints)</button>
              {joinCode && <div className="text-xs">Join Code: <span className="font-mono">{joinCode}</span></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}















