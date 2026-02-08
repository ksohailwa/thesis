import { useState } from 'react'
import api from '../lib/api'
import { toMessage } from '../lib/err'
import { useAuth } from '../store/auth'
import { Link, useNavigate } from 'react-router-dom'
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
      const un = (username || '').trim()
      const pw = (password || '').trim()
      if (!un) { setError('Enter a username'); setBusy(false); return }
      if (pw.length < 6) { setError('Password must be at least 6 characters'); setBusy(false); return }
      const { data } = await api.post('/api/auth/student/login', { username: un, password: pw })
      setAuth({ accessToken: data.accessToken, refreshToken: data.refreshToken || null, role: data.role, username: data.username })
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

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src={logo} alt="SpellWise" className="w-12 h-12 rounded-xl bg-neutral-900 p-1 object-contain" />
            <span className="text-3xl font-bold text-neutral-900">SpellWise</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 text-neutral-900">Student Sign In</h1>
            <p className="text-neutral-600">Enter your credentials to continue.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Username</label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
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

            <div className="text-center text-sm pt-4">
              <span className="text-neutral-600">No account yet? </span>
              <Link to="/student-signup" className="text-blue-600 font-semibold hover:underline">
                Sign up
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
