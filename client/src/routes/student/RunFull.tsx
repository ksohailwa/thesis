import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../../lib/api'

type Phase = 'baseline'|'learning'|'reinforcement'|'recall'

export default function RunFull() {
  const expId = sessionStorage.getItem('exp.experimentId') || sessionStorage.getItem('sessionId') || ''
  const condition = (sessionStorage.getItem('exp.condition') || 'with-hints') as 'with-hints'|'without-hints'
  const stories = JSON.parse(sessionStorage.getItem('exp.stories') || '{"A":{"paragraphs":[]},"B":{"paragraphs":[]}}')
  const schedule = JSON.parse(sessionStorage.getItem('exp.schedule') || '{}') as Record<string, Record<Phase, any>>
  const words: string[] = JSON.parse(sessionStorage.getItem('targetWords') || '[]')

  const label: 'H'|'N' = condition === 'with-hints' ? 'H' : 'N'
  const storyKey = label === 'H' ? 'A' : 'B'
  const paragraphs: string[] = stories?.[storyKey]?.paragraphs || []
  // Use full saved audio at student side

  type Blank = { key: string; word: string; occurrence: number; paragraphIndex: number; sentenceIndex: number }
  const blanksBySentence = useMemo(() => {
    const map = new Map<string, Blank[]>()
    const phases: Phase[] = ['baseline','learning','reinforcement','recall']
    for (const w of words) {
      phases.forEach((ph, i) => {
        const occ = (schedule[w] || {})[ph]
        if (!occ) return
        if ((occ.story || 'A') !== storyKey) return
        const k = `${occ.paragraphIndex}:${occ.sentenceIndex}`
        const arr = map.get(k) || []
        arr.push({ key: `${w}:${i+1}`, word: w, occurrence: i+1, paragraphIndex: occ.paragraphIndex, sentenceIndex: occ.sentenceIndex })
        map.set(k, arr)
      })
    }
    return map
  }, [schedule, words, storyKey])

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [attempts, setAttempts] = useState<Record<string, number>>({})
  const [locked, setLocked] = useState<Record<string, boolean>>({})
  const [hints, setHints] = useState<Record<string, string>>({})
  const [posDiffs, setPosDiffs] = useState<Record<string, boolean[]>>({})
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [segments, setSegments] = useState<string[][]>([])
  const [cur, setCur] = useState<{ p: number; s: number }>({ p: 0, s: 0 })

  const [offsets, setOffsets] = useState<number[][]>([])
  function splitSentences(text: string): string[] {
    const parts: string[] = []
    const re = /([^.!?]*[.!?])/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) parts.push(m[1].trim())
    if (parts.length === 0 && text.trim()) parts.push(text.trim())
    return parts
  }
  function escapeReg(w: string) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

  function renderInput(b: Blank) {
    const val = answers[b.key] || ''
    const correct = locked[b.key]
    const pd = posDiffs[b.key]
    const showPos = pd && pd.length > 0
    return (
      <span key={b.key} className={`inline-flex items-center gap-1 mx-1 ${activeKey===b.key ? 'ring-1 ring-blue-400 rounded-sm' : ''}`}>
        <input
          className={`input font-mono ${correct? 'border-emerald-500' : ''}`}
          style={{ width: `${Math.max(4, b.word.length + 2)}ch` }}
          disabled={!!correct}
          value={val}
          placeholder={label==='H' && b.occurrence <= 3 ? `${b.word[0]||''}${'_'.repeat(Math.max(0,b.word.length-1))}` : '____'}
          id={`blank-${b.key}`}
          onFocus={()=>{ setActiveKey(b.key); }}
          onChange={e=> setAnswers(a => ({ ...a, [b.key]: e.target.value }))}
          onKeyDown={e=>{ if (e.key==='Enter') check(b) }}
        />
        <button className="btn" onClick={()=>check(b)}>Check</button>
        {label==='H' && b.occurrence <= 3 && (
          <button className="btn"   onClick={()=>hint(b)}>Hint</button>
        )}
        {pd && pd.length > 0 && (
          <span className="font-mono text-xs">
            {Array.from({ length: Math.max((answers[b.key]||'').length, b.word.length) }, (_, i) => {
              const ch = (answers[b.key]||'')[i] ?? '·'
              const ok = !!pd[i]
              return <span key={i} style={{ color: ok ? '#16a34a' : '#dc2626' }}>{ch}</span>
            })}
          </span>
        )}
        {hints[b.key] && <span className="text-xs text-amber-700">{hints[b.key]}</span>}
      </span>
    )
  }

  function replaceInSentence(s: string, blanks: Blank[]): (JSX.Element|string)[] {
    let remaining = s
    const parts: (JSX.Element|string)[] = []
    blanks.forEach((b) => {
      const re = new RegExp(`\\b${escapeReg(b.word)}\\b`, 'i')
      const m = re.exec(remaining)
      if (!m) return
      const before = remaining.slice(0, m.index)
      const after = remaining.slice(m.index + m[0].length)
      if (before) parts.push(before)
      parts.push(renderInput(b))
      remaining = after
    })
    if (remaining) parts.push(remaining)
    return parts
  }

  async function check(b: Blank) {
    const attempt = (answers[b.key] || '').trim().toLowerCase()
    const target = b.word.toLowerCase()
    const ok = attempt === target
    setAttempts(a => ({ ...a, [b.key]: (a[b.key]||0) + 1 }))
    if (ok) {
      setLocked(l => ({ ...l, [b.key]: true }))
      setHints(h => ({ ...h, [b.key]: '' }))
      setPosDiffs(p => ({ ...p, [b.key]: [] }))
      await api.post('/api/student/attempt', { experimentId: expId, story: label, targetWord: b.word, occurrenceIndex: b.occurrence, text: answers[b.key] || '' }).catch(()=>{})
      // auto-focus next blank
      // Find next unsolved blank in reading order
      const ordered: string[] = []
      for (let p = 0; p < paragraphs.length; p++) {
        const parts = splitSentences(paragraphs[p])
        for (let s = 0; s < parts.length; s++) {
          const arr = blanksBySentence.get(`${p}:${s}`) || []
          arr.forEach(x => ordered.push(x.key))
        }
      }
      const idx = ordered.indexOf(b.key)
      const nextKey = ordered.slice(idx+1).find(k => !locked[k])
      if (nextKey) document.getElementById(`blank-${nextKey}`)?.focus()
      // resume from start of this sentence when solved
      const all = blanksBySentence.get(`${b.paragraphIndex}:${b.sentenceIndex}`) || []
      const solved = all.every(x => x.key === b.key || locked[x.key])
      if (solved) {
        const off = (offsets[b.paragraphIndex]?.[b.sentenceIndex])
        if (off != null && audioRef.current) { try { audioRef.current.currentTime = off } catch {} }
        // align sentence highlight driver to this sentence
        setCur({ p: b.paragraphIndex, s: b.sentenceIndex })
        if (segRef.current) { segRef.current.src = `${base}/static/audio/${expId}/${label}_p${b.paragraphIndex}_s${b.sentenceIndex}.mp3`; segRef.current.play().catch(()=>{}) }
        audioRef.current?.play().catch(()=>{})
      }
    } else {
      const L = Math.max(attempt.length, target.length)
      const arr: boolean[] = []
      for (let i = 0; i < L; i++) arr.push(attempt[i] === target[i])
      setPosDiffs(p => ({ ...p, [b.key]: arr }))
      audioRef.current?.pause()
    }
  }

  async function hint(b: Blank) {
    try {
      const tries = attempts[b.key] || 0
      const { data } = await api.post('/api/student/hint', { story: label, targetWord: b.word, occurrenceIndex: b.occurrence })
      const base = data?.hint || ''
      const adjusted = tries < 1 ? 'Focus on consonant patterns and length.' : base
      setHints(h => ({ ...h, [b.key]: adjusted }))
    } catch {}
  }

  // Audio: full (audible) and optional per-sentence segment (muted) for timing
  const audioRef = useRef<HTMLAudioElement>(null)
  const segRef = useRef<HTMLAudioElement>(null)
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

  function hasBlanks(p: number, s: number) { return (blanksBySentence.get(`${p}:${s}`) || []).length > 0 }
  function allLocked(p: number, s: number) {
    const arr = blanksBySentence.get(`${p}:${s}`) || []
    if (!arr.length) return true
    return arr.every(b => !!locked[b.key])
  }

  function skip(delta: number) {
    if (!audioRef.current) return
    try { audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime + delta) } catch {}
  }

  // Load full audio URL for this label and set playback rate based on CEFR
  useEffect(() => {
    (async () => {
      const full = `/static/audio/${expId}/${label}.mp3`
      if (audioRef.current) {
        audioRef.current.src = `${base}${full}`
        const cefr = (sessionStorage.getItem('exp.level') || 'B1').toUpperCase()
        const rate = cefr==='A2'?0.85: cefr==='B1'?0.9: cefr==='B2'?0.95: cefr==='C1'?1.0: 1.05
        audioRef.current.playbackRate = rate
      }
    })()
  }, [expId, label])

  // Load per-sentence segments for timing/highlighting (student-side, build URLs directly)
  useEffect(() => {
    const segs: string[][] = []
    for (let p = 0; p < paragraphs.length; p++) {
      const parts = splitSentences(paragraphs[p])
      const urls = parts.map((_, s) => `/static/audio/${expId}/${label}_p${p}_s${s}.mp3`)
      segs.push(urls)
    }
    setSegments(segs)
    setCur({ p: 0, s: 0 })
    if (segRef.current && segs[0]?.[0]) {
      segRef.current.src = `${base}${segs[0][0]}`
      segRef.current.play().catch(()=>{})
    }
  }, [expId, label])

  // Compute absolute offsets for each sentence (seconds from start)
  useEffect(() => {
    (async () => {
      const off: number[][] = []
      let total = 0
      for (let p = 0; p < segments.length; p++) {
        const row: number[] = []
        for (let s = 0; s < (segments[p]?.length || 0); s++) {
          row.push(total)
          try {
            const a = new Audio(`${base}${segments[p][s]}`)
            await new Promise<void>(res => { a.addEventListener('loadedmetadata', ()=>res(), { once: true }) })
            total += isFinite(a.duration) ? a.duration : 0
          } catch {}
        }
        off.push(row)
      }
      setOffsets(off)
    })()
  }, [segments, base])

  function onSegEnded() {
    const has = (blanksBySentence.get(`${cur.p}:${cur.s}`) || [])
    const allDone = has.every(b => !!locked[b.key])
    if (!allDone) { audioRef.current?.pause(); return }
    let np = cur.p, ns = cur.s + 1
    const sCount = segments[np]?.length || 0
    if (ns >= sCount) { np = np + 1; ns = 0 }
    if (np < segments.length && (segments[np]?.length || 0) > 0) {
      setCur({ p: np, s: ns })
      if (segRef.current) { segRef.current.src = `${base}${segments[np][ns]}`; segRef.current.play().catch(()=>{}) }
    }
  }

  return (
    <div className="container py-4">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b mb-3 p-2">
        <div className="w-full"><audio ref={audioRef} controls className="w-full" /></div>
        <div className="mt-2 flex items-center gap-2">
          <button className="btn" onClick={()=> audioRef.current?.play()}>Play</button>
          <button className="btn" onClick={()=> audioRef.current?.pause()}>Pause</button>
          <button className="btn" onClick={()=> skip(-3)}>-3s</button>
          <button className="btn" onClick={()=> skip(+3)}>+3s</button>
          <div className="flex-1" />
          <button className="btn" onClick={()=>{
            const ordered: string[] = []
            for (let p = 0; p < paragraphs.length; p++) {
              const parts = splitSentences(paragraphs[p])
              for (let s = 0; s < parts.length; s++) {
                const arr = blanksBySentence.get(`${p}:${s}`) || []
                arr.forEach(b => ordered.push(b.key))
              }
            }
            const next = ordered.find(k => !locked[k])
            if (next) document.getElementById(`blank-${next}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }}>Next blank</button>
        </div>
        <audio ref={segRef} hidden muted onEnded={onSegEnded} />
      </div>
      {paragraphs.map((p, pi) => {
        const sentences = splitSentences(p)
        return (
          <p key={pi} className="leading-8 mb-4">
            {sentences.map((s, si) => {
              const blanks = blanksBySentence.get(`${pi}:${si}`) || []
              const isCurrent = cur.p===pi && cur.s===si
              if (!blanks.length) return <span key={si} className={isCurrent? 'bg-yellow-50 rounded px-0.5' : ''}>{s} </span>
              return <span key={si} className={isCurrent? 'bg-yellow-50 rounded px-0.5' : ''}>{replaceInSentence(s, blanks)} </span>
            })}
          </p>
        )
      })}
    </div>
  )
}















