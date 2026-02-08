import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { Button } from '../components/ui/Button'

export default function Landing() {
  const { role } = useAuth()
  const nav = useNavigate()

  function goTeacher() {
    if (role === 'teacher') nav('/teacher')
    else nav('/login')
  }

  function goStudent() {
    if (role === 'student') nav('/student')
    else nav('/student-login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50 transition-colors">
      <main className="container py-16 md:py-24">
        {/* Hero Section */}
        <div className="text-center mb-16 animate-fadeIn">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight text-gray-900">
            SpellWise
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8 font-medium leading-relaxed">
            Spelling Research Platform
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button onClick={goTeacher} size="lg" className="min-w-48">
              Teacher
            </Button>
            <Button onClick={goStudent} size="lg" variant="secondary" className="min-w-48">
              Student
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-6 mt-24">
        <div className="container text-center">
          <p className="text-gray-500 text-sm">SpellWise</p>
        </div>
      </footer>
    </div>
  )
}
