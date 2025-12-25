import { useEffect, useState } from 'react'
import api from '../lib/api'
import { toMessage } from '../lib/err'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import logo from '../assets/spellwise.png'
import { Button } from '../components/ui/Button'
import Input from '../components/ui/Input'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<'teacher' | 'student'>('teacher')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const nav = useNavigate()
  const [params] = useSearchParams()

  useEffect(() => {
    const r = params.get('role')
    if (r === 'student' || r === 'teacher') setRole(r)
  }, [params])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (role === 'student') {
      const un = username.trim()
      if (!un) return setError('Please enter a username')
      if (!/^[A-Za-z0-9_]+$/.test(un)) return setError('Username can only contain letters, numbers, and underscores')
    } else {
      if (!email.includes('@')) return setError('Please enter a valid email address')
    }
    if (password.length < 6) return setError('Password must be at least 6 characters')
    if (password !== confirmPassword) return setError('Passwords do not match')
    setBusy(true)
    try {
      if (role === 'student') {
        await api.post('/api/auth/student/signup', { username: username.trim(), password })
        nav('/student-login')
      } else {
        await api.post('/api/auth/signup', { email, password, role })
        nav('/login')
      }
    } catch (e: any) {
      setError(toMessage(e?.response?.data?.error) || 'Signup failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src={logo} alt="SpellWise" className="w-12 h-12 rounded-xl bg-white p-1 object-contain shadow-sm ring-1 ring-primary-100" />
            <span className="text-3xl font-bold text-neutral-900">
              SpellWise
            </span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 text-neutral-900">Create Account</h1>
            <p className="text-neutral-600">Choose your role to get started.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-3">I am a...</label>
              <div className="grid grid-cols-2 gap-3">
                {(['teacher', 'student'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setRole(type)}
                    className={`p-4 rounded-xl border-2 transition text-left ${
                      role === type 
                        ? 'border-primary-500 bg-primary-50 text-primary-900' 
                        : 'border-neutral-200 hover:border-neutral-300 text-neutral-600'
                    }`}
                  >
                    <div className="font-semibold text-sm capitalize">{type}</div>
                    <p className="text-xs opacity-80 mt-1">{type === 'teacher' ? 'Create experiments' : 'Join a session'}</p>
                  </button>
                ))}
              </div>
            </div>

            {role === 'student' ? (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Username</label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  autoComplete="username"
                  disabled={busy}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Email Address</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoComplete="email"
                  disabled={busy}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  autoComplete="new-password"
                  disabled={busy}
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
                  disabled={busy}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-neutral-500 mt-1">Must be at least 6 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Confirm Password</label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="********"
                autoComplete="new-password"
                disabled={busy}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={busy}
              isLoading={busy}
              className="w-full"
              size="lg"
            >
              Create Account
            </Button>

            <div className="text-center text-sm pt-4">
              <span className="text-neutral-600">Already have an account? </span>
              <Link to={role === 'student' ? '/student-login' : '/login'} className="text-primary-600 font-semibold hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
