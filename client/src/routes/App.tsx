import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../store/auth";
import Login from "./Login";
import Landing from "./Landing";
import Signup from "./Signup";
import StudentConsentForm from "./StudentConsentForm";
import StudentJoin from "./student/StudentJoin";
import TeacherEmpty from "./teacher/TeacherEmpty";
import TeacherManage from "./teacher/TeacherManage";
import RunFull from "./student/RunFull";
import StudentLogin from "./StudentLogin";
import Toaster from "../components/Toaster";
import Demo from "./Demo";
import DemoLogin from "./DemoLogin";
import AppHeader from "../components/AppHeader";
// Home removed; default route redirects to /login

function RequireRole({ role, children }: { role: 'teacher'|'student'; children: JSX.Element }) {
  const state = useAuth();
  if (state.role !== role) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const loc2 = useLocation();
  const isFocus = loc2.pathname.startsWith('/student/run');
  const [showHelp, setShowHelp] = useState(false);
  const [scale, setScale] = useState<number>(parseInt(localStorage.getItem('textScale') || '100', 10));

  useEffect(() => { document.documentElement.style.fontSize = `${scale}%`; localStorage.setItem('textScale', String(scale)); }, [scale]);
  
  useEffect(() => {
    // Force light mode
    localStorage.removeItem('theme');
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('theme-dark');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || '').toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || (target?.getAttribute('contenteditable') === 'true');
      if (!isTyping) {
        if (e.key.toLowerCase() === 'h') { setShowHelp(v => !v); return; }
        if ((e.ctrlKey || e.metaKey) && e.key === '+') { setScale(s => Math.min(130, s + 10)); return; }
        if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) { setScale(s => Math.max(90, s - 10)); return; }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleScale = (delta: number) => {
    setScale((s) => Math.min(130, Math.max(90, s + delta)));
  };
  return (
    <div className="min-h-screen flex flex-col">
      <Toaster />
      {!isFocus && (
        <AppHeader
          onHelp={()=>setShowHelp(true)}
          onScale={handleScale}
        />
      )}
      <main className="p-6 flex-1">
        <div className="container max-w-5xl mx-auto">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/student-login" element={<StudentLogin />} />
          <Route path="/student/login" element={<StudentLogin />} />
          <Route path="/demo-login" element={<DemoLogin />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/signup" element={<Signup />} />

          <Route path="/teacher" element={<RequireRole role="teacher"><TeacherEmpty /></RequireRole>} />
          <Route path="/teacher/experiments" element={<RequireRole role="teacher"><TeacherEmpty /></RequireRole>} />
          <Route path="/teacher/experiments/:id" element={<RequireRole role="teacher"><TeacherManage /></RequireRole>} />
          <Route path="/teacher/experiments/:id/manage" element={<RequireRole role="teacher"><TeacherManage /></RequireRole>} />

          <Route path="/student" element={<RequireRole role="student"><StudentJoin /></RequireRole>} />
          <Route path="/student/consent" element={<StudentConsentForm />} />
          <Route path="/student/join" element={<Navigate to="/student" replace />} />
          <Route path="/student/exp" element={<Navigate to="/student/run" replace />} />
          <Route path="/student/gap-fill" element={<Navigate to="/student/run" replace />} />
          <Route path="/student/recall-immediate" element={<Navigate to="/student/run" replace />} />
          <Route path="/student/recall-delayed" element={<Navigate to="/student/run" replace />} />
          <Route path="/student/run" element={<RequireRole role="student"><RunFull /></RequireRole>} />
        </Routes>
        </div>
      </main>
      {isFocus && (
        <button aria-label="Help" title="Help" onClick={()=>setShowHelp(true)} className="btn fixed bottom-4 right-4 rounded-full w-10 h-10 flex items-center justify-center">?</button>
      )}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={()=>setShowHelp(false)}>
          <div className="bg-[var(--panel)] text-[var(--text)] p-4 rounded shadow max-w-lg w-full border border-[var(--panel-border)]" onClick={e=>e.stopPropagation()}>
            <h3 className="font-semibold mb-2">How it works</h3>
            <ul className="list-disc pl-5 text-sm text-[var(--muted)] space-y-1">
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



