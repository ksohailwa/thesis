import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { HelpCircle, Type, Minus, Plus, LogOut, LayoutDashboard, User, LogIn } from 'lucide-react'

interface AppHeaderProps {
  onHelp?: () => void
  onScale?: (delta: number) => void
}

export default function AppHeader({ onHelp, onScale }: AppHeaderProps) {
  const { role, clear, demo } = useAuth()
  const nav = useNavigate()

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40 transition-colors">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm transition-transform group-hover:scale-105">
            <span className="font-bold text-lg">S</span>
          </div>
          <span className="hidden sm:block text-xl font-bold tracking-tight text-gray-900">
            SpellWise
          </span>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Font Scale */}
          {onScale && (
            <div className="hidden sm:flex items-center bg-gray-100 rounded-full p-1">
              <button 
                onClick={() => onScale(-10)} 
                className="p-1.5 rounded-full text-gray-600 hover:bg-white hover:shadow-sm transition-all" 
                title="Decrease Font Size"
              >
                <Minus size={14} />
              </button>
              <div className="px-2 text-gray-400">
                <Type size={14} />
              </div>
              <button 
                onClick={() => onScale(10)} 
                className="p-1.5 rounded-full text-gray-600 hover:bg-white hover:shadow-sm transition-all" 
                title="Increase Font Size"
              >
                <Plus size={14} />
              </button>
            </div>
          )}

          {/* Theme & Help */}
          <div className="flex items-center gap-1">
            {onHelp && (
              <button 
                onClick={onHelp} 
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
                title="Help"
              >
                <HelpCircle size={20} />
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>

          {/* User Section */}
          {role ? (
            <div className="flex items-center gap-3 pl-2">
              <button
                onClick={() => nav(role === 'teacher' ? '/teacher' : '/student')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                title="Dashboard"
              >
                <LayoutDashboard size={18} />
                <span className="hidden md:inline">Dashboard</span>
              </button>
              
              <div className="flex items-center gap-2">
                 <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm" title={role}>
                    <User size={16} />
                 </div>
                 <button
                  onClick={() => { clear(); nav('/'); }}
                  className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Logout"
                 >
                   <LogOut size={20} />
                 </button>
              </div>
            </div>
          ) : (
            <Link to="/login" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
              <LogIn size={16} />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
      
      {/* Demo Banner */}
      {demo && (
        <div className="w-full text-center text-xs py-1 bg-amber-100 text-amber-800 border-t border-amber-200">
          Demo Mode — progress not saved
        </div>
      )}
    </header>
  )
}
