import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import api from '../lib/api'
import { toMessage } from '../lib/err'
import { useAuth } from '../store/auth'
import logo from '../assets/spellwise.png'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const setAuth = useAuth((s) => s.setAuth)
  const nav = useNavigate()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const em = email.trim()
    const pw = password.trim()
    if (!em.includes('@')) return setError('Please enter a valid email address')
    if (pw.length < 6) return setError('Password must be at least 6 characters')
    setBusy(true)
    try {
      const { data } = await api.post('/api/auth/login', { email: em, password: pw })
      setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || null,
        role: data.role,
        email: data.email
      })
      nav(data.role === 'teacher' ? '/teacher' : '/student/join')
    } catch (e: any) {
      setError(toMessage(e?.response?.data?.error) || 'Login failed. Please check your credentials.')
    } finally {
      setBusy(false)
    }
  }

  async function tryDemo() {
    try {
      const { data } = await api.post('/api/auth/demo')
      setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || null,
        role: data.role,
        email: data.email,
        demo: true
      })
      nav('/demo')
    } catch {
      setError('Demo mode unavailable')
    }
  }

  const highlights = [
    { title: 'AI-Generated Content', text: 'Create contextual stories automatically.', icon: <CheckCircle2 size={18} /> },
    { title: 'Research-Grade Analytics', text: 'Track progress with detailed metrics.', icon: <CheckCircle2 size={18} /> },
    { title: 'Adaptive Learning', text: 'Phase-based difficulty progression.', icon: <CheckCircle2 size={18} /> },
  ]

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
      <aside className="hidden lg:flex lg:w-1/2 bg-neutral-900 p-12 flex-col justify-between relative overflow-hidden text-white rounded-2xl shadow-lg">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/10 rounded-full -ml-36 -mb-36" />
        <Link to="/" className="inline-flex items-center gap-3 text-white relative z-10">
          <img src={logo} alt="SpellWise" className="w-12 h-12 rounded-xl bg-white/20 p-1 object-contain" />
          <span className="text-3xl font-bold">SpellWise</span>
        </Link>
        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-bold leading-tight">
            Welcome back to your
            <br />
            spelling research platform
          </h2>
          {highlights.map((item) => (
            <div key={item.title} className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 text-white">
                {item.icon}
              </div>
              <div>
                <div className="font-semibold mb-1">{item.title}</div>
                <div className="text-blue-100 text-sm">{item.text}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="relative z-10 text-sm text-neutral-300">(c) 2024 SpellWise. Research Platform.</div>
      </aside>

      <section className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <Link to="/" className="inline-flex items-center gap-3">
              <img src={logo} alt="SpellWise" className="w-12 h-12 rounded-xl bg-neutral-900 p-1 object-contain" />
              <span className="text-3xl font-bold text-neutral-900">SpellWise</span>
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 transition-colors">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2 text-gray-900">Sign In</h1>
              <p className="text-gray-600">Welcome back! Please enter your details.</p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@example.com"
                  autoComplete="email"
                  autoFocus
                  disabled={busy}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="********"
                    autoComplete="current-password"
                    disabled={busy}
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    disabled={busy}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <Button type="submit" disabled={busy} className="w-full" size="lg">
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500 transition-colors">Or continue with</span>
                </div>
              </div>

              <Button type="button" onClick={tryDemo} variant="secondary" className="w-full" size="lg">
                Try Demo Mode
              </Button>

              <div className="text-center text-sm pt-4">
                <span className="text-gray-600">Don't have an account? </span>
                <Link to="/signup" className="text-blue-600 font-semibold hover:underline">
                  Sign up for free
                </Link>
              </div>
            </form>
          </div>

          <p className="text-center text-sm text-gray-500 mt-8">By signing in, you agree to our Terms of Service and Privacy Policy.</p>
        </div>
      </section>
    </div>
  )
}
