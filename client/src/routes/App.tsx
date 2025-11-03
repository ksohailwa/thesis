import { Link, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../store/auth";
import Login from "./Login";
import Signup from "./Signup";
import StudentJoin from "./student/StudentJoin";
import TeacherHome from "./teacher/TeacherHome";
import TeacherCreate from "./teacher/TeacherCreate";
import TeacherWords from "./teacher/TeacherWords";
import TeacherEmpty from "./teacher/TeacherEmpty";
import GapFill from "./student/GapFill";
import RecallImmediate from "./student/RecallImmediate";
import RecallDelayed from "./student/RecallDelayed";
import Consent from "./student/Consent";
import ExperimentRun from "./student/ExperimentRun";
import Toaster from "../components/Toaster";
import Demo from "./Demo";
import DemoLogin from "./DemoLogin";
import Home from "../pages/Home";

function Header({ onHelp, onTheme, onScale }: { onHelp: () => void; onTheme: (mode: 'light'|'dark')=>void; onScale: (delta: number)=>void }) {
  const { role, clear, demo } = useAuth();
  const nav = useNavigate();
  return (
    <div>
      <header className="p-4 flex justify-between items-center border-b app-header">
        <Link to="/" className="font-semibold inline-flex items-center gap-2">
          <span className="text-2xl tracking-tight">Spell Wise</span>
        </Link>
        <nav className="flex gap-2 items-center">
          <Link to="/demo-login" className="px-2 py-1 border rounded">Demo</Link>
          <button title="Help" onClick={onHelp} className="px-2 py-1 border rounded">?</button>
          <button title="Theme" onClick={()=>onTheme(document.body.classList.contains('theme-dark')?'light':'dark')} className="px-2 py-1 border rounded">Theme</button>
          <button title="Text smaller" onClick={()=>onScale(-10)} className="px-2 py-1 border rounded">A-</button>
          <button title="Text larger" onClick={()=>onScale(+10)} className="px-2 py-1 border rounded">A+</button>
          {role && (
            <button className="px-2 py-1 border rounded" onClick={()=> nav(role==='teacher' ? '/teacher' : '/student/join')}>Home</button>
          )}
          {role && <button onClick={()=>{clear(); nav('/');}} className="text-sm text-red-600">Logout</button>}
        </nav>
      </header>
      {demo && (
        <div className="w-full text-center text-xs py-1 bg-amber-100 text-amber-800 border-b">Demo Mode — progress not saved.</div>
      )}
    </div>
  );
}

function RequireRole({ role, children }: { role: 'teacher'|'student'; children: JSX.Element }) {
  const state = useAuth();
  if (state.role !== role) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [showHelp, setShowHelp] = useState(false);
  const [scale, setScale] = useState<number>(parseInt(localStorage.getItem('textScale') || '100', 10));
  useEffect(() => { document.documentElement.style.fontSize = `${scale}%`; localStorage.setItem('textScale', String(scale)); }, [scale]);
  useEffect(() => { const saved = localStorage.getItem('theme') || 'light'; document.body.classList.remove('theme-dark','theme-light'); document.body.classList.add(saved==='dark'?'theme-dark':'theme-light'); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') { setShowHelp(v => !v); }
      if (e.key.toLowerCase() === 't') {
        const next = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
        localStorage.setItem('theme', next);
        document.body.classList.remove('theme-dark','theme-light');
        document.body.classList.add(next==='dark'?'theme-dark':'theme-light');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '+') setScale(s => Math.min(130, s + 10));
      if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) setScale(s => Math.max(90, s - 10));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="min-h-screen flex flex-col">
      <Toaster />
      <Header onHelp={()=>setShowHelp(true)} onTheme={(mode)=>{ localStorage.setItem('theme', mode); document.body.classList.remove('theme-dark','theme-light'); document.body.classList.add(mode==='dark'?'theme-dark':'theme-light'); }} onScale={(d)=> setScale(s=> Math.min(130, Math.max(90, s + d)))} />
      <main className="p-6 flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/demo-login" element={<DemoLogin />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/signup" element={<Signup />} />

          <Route path="/teacher" element={<RequireRole role="teacher"><TeacherHome /></RequireRole>} />
          <Route path="/teacher/create" element={<RequireRole role="teacher"><TeacherCreate /></RequireRole>} />
          <Route path="/teacher/experiments/:id/words" element={<RequireRole role="teacher"><TeacherWords /></RequireRole>} />
          <Route path="/teacher/experiments" element={<RequireRole role="teacher"><TeacherEmpty /></RequireRole>} />

          <Route path="/student/join" element={<RequireRole role="student"><StudentJoin /></RequireRole>} />
          <Route path="/student/consent" element={<RequireRole role="student"><Consent /></RequireRole>} />
          <Route path="/student/run" element={<RequireRole role="student"><ExperimentRun /></RequireRole>} />
          <Route path="/student/exp" element={<RequireRole role="student"><ExperimentRun /></RequireRole>} />
          <Route path="/student/gap-fill" element={<RequireRole role="student"><GapFill /></RequireRole>} />
          <Route path="/student/recall-immediate" element={<RequireRole role="student"><RecallImmediate /></RequireRole>} />
          <Route path="/student/recall-delayed" element={<RequireRole role="student"><RecallDelayed /></RequireRole>} />
        </Routes>
      </main>
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={()=>setShowHelp(false)}>
          <div className="bg-white p-4 rounded shadow max-w-lg w-full" onClick={e=>e.stopPropagation()}>
            <h3 className="font-semibold mb-2">How it works</h3>
            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
              <li>Play the story audio at the top (pause/seek as needed).</li>
              <li>Type answers directly into the blanks; press Enter to check.</li>
              <li>Green input = correct; red = try again. Incorrect checks pause audio.</li>
              <li>Use the Hint button or Ctrl/Cmd+H for a helpful nudge.</li>
              <li>Progress shows how many blanks you have mastered.</li>
            </ul>
            <div className="mt-3 text-right"><button className="px-3 py-1 border rounded" onClick={()=>setShowHelp(false)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}