import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { Button } from '../components/ui/Button'
import Card from '../components/ui/Card'
import { Sparkles, BookOpen, Users } from 'lucide-react'

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
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-6 hover:shadow-md transition-shadow">
            <Sparkles size={16} className="animate-pulse" />
            AI-Powered Spelling Research Platform
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight text-gray-900">
            Transform Spelling
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent animate-pulse">
              Education with AI
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8 font-medium leading-relaxed">
            Create adaptive spelling experiments with AI-generated stories and audio. Track student progress with
            research-grade analytics.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button onClick={goTeacher} size="lg" className="min-w-48">
              🎓 For Teachers
            </Button>
            <Button onClick={goStudent} size="lg" variant="secondary" className="min-w-48">
              👨‍🎓 For Students
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {[
            {
              icon: <Sparkles size={28} />,
              title: 'AI Story Generation',
              body: 'Automatically generate contextual stories with OpenAI, tailored to CEFR levels and target words.',
              color: 'from-blue-500 to-cyan-500',
            },
            {
              icon: <BookOpen size={28} />,
              title: 'Text-to-Speech Audio',
              body: 'Generate natural-sounding audio narration with adjustable playback speed based on difficulty.',
              color: 'from-purple-500 to-pink-500',
            },
            {
              icon: <Users size={28} />,
              title: 'Research Analytics',
              body: 'Track learning phases, hint usage, and spelling accuracy with detailed performance metrics.',
              color: 'from-green-500 to-emerald-500',
            },
          ].map((feature, idx) => (
            <Card key={feature.title} variant="elevated" className="animate-slideIn group hover:translate-y-[-8px]" style={{ animationDelay: `${idx * 0.1}s` }}>
              <div className="p-8">
                <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center text-white mb-4 shadow-lg shadow-${feature.color}/30 group-hover:scale-110 transition-transform`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.body}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Role Selection */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">Choose Your Role</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Teacher Card */}
            <Card variant="elevated" className="p-0 overflow-hidden">
              <button
                onClick={goTeacher}
                className="group p-8 text-left relative w-full h-full hover:bg-blue-50/50 transition-colors"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-100 rounded-full -mr-20 -mt-20 group-hover:scale-125 transition-transform duration-300"></div>
                <div className="absolute top-4 left-4 text-3xl">👨‍🏫</div>
                <div className="relative pt-8">
                  <h3 className="text-2xl font-bold mb-3 text-neutral-900">I am a Teacher</h3>
                  <p className="text-neutral-600 mb-6 leading-relaxed">
                    Create experiments, generate stories with AI, assign students, and analyze results.
                  </p>
                  <div className="space-y-3 text-sm text-neutral-600 mb-6">
                    {['Select target words with AI suggestions', 'Generate 2 stories automatically', 'Create TTS audio with one click', 'Share join codes with students'].map(
                      (item) => (
                        <div key={item} className="flex items-center gap-3">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          <span className="font-medium">{item}</span>
                        </div>
                      )
                    )}
                  </div>
                  <div className="inline-flex items-center gap-2 text-blue-700 font-semibold group-hover:gap-4 transition-all">
                    {role === 'teacher' ? 'Go to Dashboard' : 'Sign In as Teacher'} <span className="text-xl">→</span>
                  </div>
                </div>
              </button>
            </Card>

            {/* Student Card */}
            <Card variant="elevated" className="p-0 overflow-hidden">
              <button
                onClick={goStudent}
                className="group p-8 text-left relative w-full h-full hover:bg-purple-50/50 transition-colors"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-purple-100 rounded-full -mr-20 -mt-20 group-hover:scale-125 transition-transform duration-300"></div>
                <div className="absolute top-4 left-4 text-3xl">👨‍🎓</div>
                <div className="relative pt-8">
                  <h3 className="text-2xl font-bold mb-3 text-neutral-900">I am a Student</h3>
                  <p className="text-neutral-600 mb-6 leading-relaxed">
                    Join experiments with a code, listen to stories, and practice spelling with interactive feedback.
                  </p>
                  <div className="space-y-3 text-sm text-neutral-600 mb-6">
                    {['Join with a simple code', 'Listen to audio stories', 'Fill gaps with target words', 'Get instant feedback'].map(
                      (item) => (
                        <div key={item} className="flex items-center gap-3">
                          <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                          <span className="font-medium">{item}</span>
                        </div>
                      )
                    )}
                  </div>
                  <div className="inline-flex items-center gap-2 text-purple-700 font-semibold group-hover:gap-4 transition-all">
                    {role === 'student' ? 'Go to Dashboard' : 'Sign In as Student'} <span className="text-xl">→</span>
                  </div>
                </div>
              </button>
            </Card>

            {/* Demo Card */}
            <Card variant="elevated" className="p-0 overflow-hidden">
              <button
                onClick={() => nav('/demo-login')}
                className="group p-8 text-left relative w-full h-full hover:bg-amber-50/50 transition-colors"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-amber-100 rounded-full -mr-20 -mt-20 group-hover:scale-125 transition-transform duration-300"></div>
                <div className="absolute top-4 left-4 text-3xl">✨</div>
                <div className="relative pt-8">
                  <h3 className="text-2xl font-bold mb-3 text-neutral-900">Try Demo First</h3>
                  <p className="text-neutral-600 mb-6 leading-relaxed">
                    Explore SpellWise with a pre-made experiment. No sign-up needed.
                  </p>
                  <div className="space-y-3 text-sm text-neutral-600 mb-6">
                    {['Play a sample story', 'Test the student experience', 'No account required'].map((item) => (
                      <div key={item} className="flex items-center gap-3">
                        <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                        <span className="font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="inline-flex items-center gap-2 text-amber-700 font-semibold group-hover:gap-4 transition-all">
                    Start Demo <span className="text-xl">→</span>
                  </div>
                </div>
              </button>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50/30 py-12 mt-24 transition-colors">
        <div className="container text-center">
          <p className="text-gray-900 font-semibold text-lg">SpellWise</p>
          <p className="text-gray-600 mt-2">AI-Powered Spelling Research Platform</p>
          <p className="text-gray-500 text-sm mt-3">Built for educators and researchers worldwide</p>
        </div>
      </footer>
    </div>
  )
}
