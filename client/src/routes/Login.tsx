import { useState } from 'react'
import api from '../lib/api'
import { toMessage } from '../lib/err'
import { useAuth } from '../store/auth'
import { Link, useNavigate } from 'react-router-dom'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const setAuth = useAuth(s => s.setAuth)
  const nav = useNavigate()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      setBusy(true)
      const em = (email || '').trim(); const pw = (password || '').trim(); if (!em.includes('@')) { setError('Enter a valid email address'); setBusy(false); return } if (pw.length < 6) { setError('Password must be at least 6 characters'); setBusy(false); return } const { data } = await api.post('/api/auth/login', { email: em, password: pw })
      setAuth({ accessToken: data.accessToken, role: data.role, email: data.email })
      nav(data.role === 'teacher' ? '/teacher' : '/student/join')
    } catch (e: any) {
      const serverErr = e?.response?.data?.error
      setError(toMessage(serverErr) || 'Login failed')
    } finally { setBusy(false) }
  }

  async function tryDemo() {
    try {
      const { data } = await api.post('/api/auth/demo')
      setAuth({ accessToken: data.accessToken, role: data.role, email: data.email, demo: true })
      nav('/demo')
    } catch {}
  }

  return (
    <div className="min-h-screen flex flex-col" role="main">
      <header className="app-header border-b">
        <div className="container flex items-center justify-between py-3">
          <Link to="/" className="inline-flex items-center gap-2" aria-label="Spell Wise">
            <span className="text-lg font-semibold tracking-tight">Spell&nbsp;Wise</span>
          </Link>
          <nav className="flex items-center gap-2">
            <LanguageSwitcher />
          </nav>
        </div>
      </header>

      <div className="container flex-1 grid place-items-center py-10">
        <section className="w-full max-w-md">
          <div className="focus-card">
            <h1 className="text-xl font-semibold mb-1">Sign in</h1>
            <p className="text-sm text-gray-600 mb-4">Use your teacher or student account</p>
            <form onSubmit={submit} className="space-y-3" aria-label="Login form">
              <label className="block">
                <span className="sr-only">Email</span>
                <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="input" autoComplete="email" autoFocus />
              </label>
              <label className="block">
                <span className="sr-only">Password</span>
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="input" autoComplete="current-password" />
              </label>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <button disabled={busy} className="btn primary w-full disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in'}</button>
              <div className="text-sm flex items-center justify-between">
                <span>New here? <Link to="/signup" className="text-blue-600">Create account</Link></span>
                <button type="button" onClick={tryDemo} className="btn">Try Demo</button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}





