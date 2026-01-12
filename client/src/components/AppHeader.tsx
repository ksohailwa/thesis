import { Link, useNavigate } from 'react-router-dom'
import logo from '../assets/spellwise.png'
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
    <header className="bg-gradient-to-r from-white to-blue-50/30 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-40 transition-all duration-300 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30 ring-1 ring-white transition-all group-hover:scale-110 group-hover:shadow-blue-500/40">
            <img src={logo} alt="SpellWise logo" className="h-7 w-7 object-contain brightness-200" />
          </div>
          <span className="hidden sm:block text-xl font-bold tracking-tight bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
            SpellWise
          </span>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Font Scale */}
          {onScale && (
            <div className="hidden sm:flex items-center bg-gradient-to-r from-gray-100 to-gray-50 rounded-full p-1.5 shadow-sm border border-gray-200/50">
              <button 
                onClick={() => onScale(-10)} 
                className="p-1.5 rounded-lg text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-sm transition-all" 
                title="Decrease Font Size"
              >
                <Minus size={14} />
              </button>
              <div className="px-2.5 text-gray-400">
                <Type size={14} />
              </div>
              <button 
                onClick={() => onScale(10)} 
                className="p-1.5 rounded-lg text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-sm transition-all" 
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
                className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
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
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-blue-100 hover:text-blue-700 transition-all duration-200 group"
                title="Dashboard"
              >
                <LayoutDashboard size={18} className="group-hover:scale-110 transition-transform" />
                <span className="hidden md:inline">Dashboard</span>
              </button>
              
              <div className="flex items-center gap-2">
                 <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30 transition-transform hover:scale-110" title={role}>
                    <User size={16} />
                 </div>
                 <button
                  onClick={() => { clear(); nav('/'); }}
                  className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                  title="Logout"
                 >
                   <LogOut size={20} />
                 </button>
              </div>
            </div>
          ) : (
            <Link to="/login" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-blue-500/40 transition-all duration-200 shadow-md shadow-blue-500/30 hover:scale-105 active:scale-95">
              <LogIn size={16} />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
      
      {/* Demo Banner */}
      {demo && (
        <div className="w-full text-center text-xs py-2 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 border-t border-amber-200 animate-slide-up">
          ⚠️ Demo Mode - progress not saved
        </div>
      )}
    </header>
  )
}
