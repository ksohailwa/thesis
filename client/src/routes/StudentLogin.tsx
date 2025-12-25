import { useState } from 'react'
import api from '../lib/api'
import { toMessage } from '../lib/err'
import { useAuth } from '../store/auth'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Sparkles, TrendingUp } from 'lucide-react'
import logo from '../assets/spellwise.png'
import { Button } from '../components/ui/Button'
import Input from '../components/ui/Input'

export default function StudentLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const setAuth = useAuth(s => s.setAuth)
  const nav = useNavigate()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      setBusy(true)
      const un = (username || '').trim(); const pw = (password || '').trim(); if (!un) { setError('Enter a username'); setBusy(false); return } if (pw.length < 6) { setError('Password must be at least 6 characters'); setBusy(false); return } const { data } = await api.post('/api/auth/student/login', { username: un, password: pw })
      setAuth({ accessToken: data.accessToken, refreshToken: data.refreshToken || null, role: data.role, email: data.username })
      if (data?.newUser || !data?.consented) {
        nav('/student/consent')
      } else {
        nav('/student')
      }
    } catch (e: any) {
      const serverErr = e?.response?.data?.error
      setError(toMessage(serverErr) || 'Login failed')
    } finally { setBusy(false) }
  }

  async function tryDemo() {
    try {
      const { data } = await api.post('/api/auth/demo')
      setAuth({ accessToken: data.accessToken, refreshToken: data.refreshToken || null, role: data.role, email: data.username || data.email, demo: true })
      nav('/demo')
    } catch {}
  }

  const highlights = [
    { title: 'Instant Feedback', text: 'Check your answers in real-time.', icon: <CheckCircle2 size={18} /> },
    { title: 'Adaptive Stories', text: 'Stories tailored to your level.', icon: <Sparkles size={18} /> },
    { title: 'Progress Tracking', text: 'See your improvement over time.', icon: <TrendingUp size={18} /> },
  ]

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      <aside className="hidden lg:flex lg:w-1/2 bg-neutral-900 p-12 flex-col justify-between relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/10 rounded-full -ml-36 -mb-36" />
        <Link to="/" className="inline-flex items-center gap-3 text-white relative z-10">
          <img src={logo} alt="SpellWise" className="w-12 h-12 rounded-xl bg-white/20 p-1 object-contain" />
          <span className="text-3xl font-bold">SpellWise</span>
        </Link>
        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-bold leading-tight">Join your class and start practicing spelling</h2>
          {highlights.map((item) => (
            <div key={item.title} className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 text-white">
                {item.icon}
              </div>
              <div>
                <div className="font-semibold mb-1">{item.title}</div>
                <div className="text-primary-100 text-sm">{item.text}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="relative z-10 text-sm text-neutral-300">(c) 2024 SpellWise. Learning Platform.</div>
      </aside>

      <section className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <Link to="/" className="inline-flex items-center gap-3">
              <img src={logo} alt="SpellWise" className="w-12 h-12 rounded-xl bg-neutral-900 p-1 object-contain" />
              <span className="text-3xl font-bold text-neutral-900">SpellWise</span>
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2 text-neutral-900">Student Sign In</h1>
              <p className="text-neutral-600">Use your username and password to join your class.</p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Username</label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your username"
                  autoComplete="username"
                  autoFocus
                  disabled={busy}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  autoComplete="current-password"
                  disabled={busy}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <Button type="submit" disabled={busy} isLoading={busy} className="w-full" size="lg">
                Sign In
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-neutral-500">Or continue with</span>
                </div>
              </div>

              <Button type="button" onClick={tryDemo} variant="secondary" className="w-full" size="lg">
                Try Demo Mode
              </Button>

              <div className="text-center text-sm pt-4">
                <span className="text-neutral-600">No account yet? </span>
                <Link to="/signup?role=student" className="text-primary-600 font-semibold hover:underline">
                  Sign up as a student
                </Link>
              </div>
            </form>
          </div>

          <p className="text-center text-sm text-neutral-500 mt-8">By signing in, you agree to our Terms of Service and Privacy Policy.</p>
        </div>
      </section>
    </div>
  )
}
