import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'

interface AppHeaderProps {
  onHelp?: () => void
  onTheme?: (mode: 'light' | 'dark') => void
  onScale?: (delta: number) => void
}

export default function AppHeader({ onHelp, onTheme, onScale }: AppHeaderProps) {
  const { role, clear, demo } = useAuth()
  const nav = useNavigate()

  return (
    <header className="bg-white border-b shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo - Always navigates to home */}
        <Link to="/" className="inline-flex items-center gap-2 group flex-shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold group-hover:scale-105 transition">
            S
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hidden sm:inline">
            SpellWise
          </span>
        </Link>

        {/* Navigation Controls */}
        <nav className="flex gap-2 items-center">
          {onHelp && (
            <button
              title="Help (H)"
              onClick={onHelp}
              className="px-3 py-1.5 border rounded-lg text-sm font-medium hover:bg-gray-100 transition"
            >
              ?
            </button>
          )}

          {onTheme && (
            <button
              title="Toggle theme (T)"
              onClick={() => onTheme(document.body.classList.contains('theme-dark') ? 'light' : 'dark')}
              className="px-3 py-1 border rounded-lg hover:bg-gray-100 transition"
            >
              Theme
            </button>
          )}

          {onScale && (
            <>
              <button
                title="Decrease text size (Ctrl/Cmd −)"
                onClick={() => onScale(-10)}
                className="px-2 py-1 border rounded-lg text-sm font-medium hover:bg-gray-100 transition"
              >
                A−
              </button>
              <button
                title="Increase text size (Ctrl/Cmd +)"
                onClick={() => onScale(+10)}
                className="px-2 py-1 border rounded-lg text-sm font-medium hover:bg-gray-100 transition"
              >
                A+
              </button>
            </>
          )}

          {role ? (
            <>
              <div className="w-px h-6 bg-gray-200"></div>
              <span className="text-sm text-gray-600 capitalize font-medium hidden sm:inline">
                {role}
              </span>
              <button
                className="px-3 py-1.5 border rounded-lg text-sm font-medium hover:bg-gray-100 transition"
                onClick={() => nav(role === 'teacher' ? '/teacher' : '/student')}
              >
                Dashboard
              </button>
              <button
                onClick={() => {
                  clear()
                  nav('/')
                }}
                className="text-sm font-medium text-red-600 hover:text-red-700 px-3 py-1.5"
              >
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="px-3 py-1.5 border rounded-lg text-sm font-medium hover:bg-gray-100 transition">
              Sign In
            </Link>
          )}
        </nav>
      </div>

      {/* Demo Mode Banner */}
      {demo && (
        <div className="w-full text-center text-xs py-1 bg-amber-100 text-amber-800 border-t border-amber-200">
          Demo Mode — progress not saved
        </div>
      )}
    </header>
  )
}
