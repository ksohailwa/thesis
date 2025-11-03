import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../store/auth';
import { useGamify } from '../../store/gamify';

type Phase = 'baseline'|'learning'|'reinforcement'|'recall';

export default function ExperimentRun() {
  const sessionId = sessionStorage.getItem('exp.experimentId') || sessionStorage.getItem('sessionId') || '';
  const condition = (sessionStorage.getItem('exp.condition') || 'with-hints') as 'with-hints'|'without-hints';
  const stories = JSON.parse(sessionStorage.getItem('exp.stories') || '{"A":{"paragraphs":[]},"B":{"paragraphs":[]}}');
  const schedule = JSON.parse(sessionStorage.getItem('exp.schedule') || '{}') as Record<string, Record<Phase, any>>;
  const words: string[] = JSON.parse(sessionStorage.getItem('targetWords') || '[]');
  const [idx, setIdx] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [input, setInput] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const [hint, setHint] = useState<string>('');
  const [usedHintThisPhase, setUsedHintThisPhase] = useState(false);
  const [audioUrls, setAudioUrls] = useState<Record<string, string[]>>({ A: [], B: [] } as any);
  const audioRef = useRef<HTMLAudioElement>(null);
  const phases: Phase[] = ['baseline','learning','reinforcement','recall'];

  const currentWord = words[idx] || '';
  const currentPhase = phases[phaseIdx] || 'baseline';
  const placement = (schedule[currentWord] || {})[currentPhase] || {};
  const paragraphText: string = stories?.[placement?.story || 'A']?.paragraphs?.[placement?.paragraphIndex || 0] || '';
  const audioSrc = useMemo(() => {
    const base = import.meta.env.VITE_API_BASE_URL || '';
    const list = (audioUrls as any)?.[placement?.story || 'A'] || [];
    const rel = list[placement?.paragraphIndex || 0] || '';
    return rel && rel.startsWith('/static') ? `${base}${rel}` : '';
  }, [audioUrls, placement]);

  useEffect(() => {
    setInput(''); setScore(null); setHint('');
  }, [idx, phaseIdx]);
  useEffect(() => {
    // Initialize total tasks = words * 4
    const total = (words?.length || 0) * phases.length;
    useGamify.setState({ totalTasks: total, completedTasks: 0 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { setUsedHintThisPhase(false); }, [idx, phaseIdx]);

  // Attempt to playback pre-generated TTS if available (teacher generates via /experiments/:id/tts)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.post(`/api/experiments/${sessionId}/tts`, {});
        setAudioUrls({ A: data?.A?.urls || [], B: data?.B?.urls || [] });
      } catch {
        setAudioUrls({ A: [], B: [] } as any);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function next() {
    const nextPhase = phaseIdx + 1;
    if (nextPhase < phases.length) { setPhaseIdx(nextPhase); return; }
    const nextWord = idx + 1;
    if (nextWord < words.length) { setIdx(nextWord); setPhaseIdx(0); return; }
    alert('All tasks complete.');
  }

  async function submit() {
    try {
      const { data } = await api.post('/api/attempt', {
        sessionId,
        storyTemplateId: undefined,
        taskType: 'gap-fill',
        targetWord: currentWord,
        text: input,
        phase: currentPhase,
        abCondition: condition
      });
      setScore(data?.score ?? null);
      // Gamification: award XP and update streaks
      const scoreVal = typeof data?.score === 'number' ? data.score : 0;
      // Full XP for no-hint completions, half when hint used
      const baseXP = Math.round(scoreVal * 100);
      const xpAward = usedHintThisPhase ? Math.floor(baseXP / 2) : baseXP;
      useGamify.getState().addXP(xpAward);
      useGamify.getState().bumpStreak(!usedHintThisPhase);
      useGamify.getState().markTaskDone();
      next();
    } catch {}
  }

  async function requestHint() {
    try {
      const { data } = await api.post('/api/hint', {
        sessionId,
        word: currentWord,
        phase: currentPhase,
        abCondition: condition,
        context: paragraphText
      });
      setHint(data?.hint || '');
      setUsedHintThisPhase(true);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) setHint('Hints disabled for this phase.');
    }
  }

  function logEvent(type: string, payload: any) {
    const ev = { session: sessionId, taskType: 'gap-fill', targetWord: currentWord, type, payload, ts: new Date().toISOString() };
    api.post('/api/events', { events: [ev] }).catch(()=>{});
  }

  return (
    <div className="focus-wide">
      <GamifyHeader />
      <div className="text-sm text-gray-600 mb-2">Condition: <span className="font-mono">{condition}</span></div>
      <h2 className="font-semibold mb-2">{currentWord} · {currentPhase}</h2>
      {audioSrc && (
        <div className="mb-2 flex items-center gap-2">
          <audio ref={audioRef} controls src={audioSrc}
            onPlay={()=>logEvent('audio_play', { paragraphIndex: placement?.paragraphIndex, story: placement?.story })}
            onPause={()=>logEvent('audio_pause', { paragraphIndex: placement?.paragraphIndex, story: placement?.story })}
            onSeeked={()=>logEvent('audio_seek', { t: audioRef.current?.currentTime })}
          />
          <button className="px-2 py-1 border rounded" onClick={()=>{ if (audioRef.current){ audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 3); logEvent('audio_skip',{delta:-3});}}}>-3s</button>
          <button className="px-2 py-1 border rounded" onClick={()=>{ if (audioRef.current){ audioRef.current.currentTime = audioRef.current.currentTime + 3; logEvent('audio_skip',{delta:+3});}}}>+3s</button>
        </div>
      )}
      <div className="p-3 bg-white rounded border mb-3 whitespace-pre-wrap leading-relaxed">{paragraphText || '—'}</div>
      <div className="flex gap-2 items-center">
        <input className="border p-2 rounded flex-1 font-mono" placeholder="Type your answer" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if (e.key==='Enter'){ submit(); } }} />
        <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={submit}>Submit</button>
        {condition === 'with-hints' && (currentPhase==='learning' || currentPhase==='reinforcement') && (
          <button className="px-2 py-1 border rounded" onClick={requestHint}>Hint</button>
        )}
      </div>
      {score!==null && <div className="text-sm text-gray-700 mt-2">Score: {score.toFixed(2)}</div>}
      {hint && <div className="text-sm text-amber-700 mt-2">{hint}</div>}
      <PhaseProgress idx={idx} phaseIdx={phaseIdx} totalWords={words.length} />
      <DemoLeaderboard />
    </div>
  );
}

function GamifyHeader() {
  const { xp, streak, completedTasks, totalTasks } = useGamify();
  const pct = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-sm">
        <div>XP: <span className="font-mono">{xp}</span></div>
        <div>Streak (no-hint): <span className="font-mono">{streak}</span></div>
      </div>
      <div className="h-2 bg-gray-200 rounded mt-1">
        <div className="h-2 bg-emerald-500 rounded" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PhaseProgress({ idx, phaseIdx, totalWords }: { idx: number; phaseIdx: number; totalWords: number }) {
  return (
    <div className="text-xs text-gray-600 mt-4">
      Progress: Word {idx + 1}/{totalWords}, Phase {phaseIdx + 1}/4
    </div>
  );
}

function DemoLeaderboard() {
  const { demo } = useAuth();
  const { xp } = useGamify();
  if (!demo) return null;
  // Simple non-persistent demo leaderboard with sample data + current XP
  const base = [
    { name: 'Ava', xp: 820 }, { name: 'Liam', xp: 740 }, { name: 'Noah', xp: 690 }
  ];
  const all = [...base, { name: 'You (demo)', xp }].sort((a,b)=> b.xp - a.xp).slice(0, 5);
  return (
    <div className="mt-4 p-2 border rounded bg-white">
      <div className="font-semibold text-sm mb-1">Demo Leaderboard</div>
      <ul className="text-xs text-gray-700">
        {all.map((r,i)=>(<li key={i} className="flex justify-between"><span>{i+1}. {r.name}</span><span className="font-mono">{r.xp}</span></li>))}
      </ul>
    </div>
  );
}
