import { useState } from 'react';
import api from '../lib/api';
import { toMessage } from '../lib/err';
import { Link, useNavigate } from 'react-router-dom';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'teacher'|'student'>('teacher');
  const [error, setError] = useState('');
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post('/api/auth/signup', { email, password, role });
      nav('/login');
    } catch (e: any) {
      const serverErr = e?.response?.data?.error;
      setError(toMessage(serverErr) || 'Signup failed');
    }
  }

  return (
    <div className="focus-card">
      <div className="flex justify-end mb-2"><LanguageSwitcher /></div>
      <div className="flex flex-col items-center mb-4">
                <div className="text-xl font-semibold">Spell Wise</div>
      </div>
      <h1 className="text-xl font-semibold mb-4">Sign Up</h1>
      <form onSubmit={submit} className="space-y-3">
        <select value={role} onChange={e=>setRole(e.target.value as any)} className="input">
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
        </select>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="input" />
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="input" />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button className="btn primary w-full">Create account</button>
        <div className="text-sm">Have an account? <Link to="/login" className="text-blue-600">Login</Link></div>
      </form>
    </div>
  );
}


