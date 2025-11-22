import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'

export default function Landing() {
  const { role } = useAuth()
  const nav = useNavigate()

  function goTeacher() {
    if (role === 'teacher') nav('/teacher')
    else nav('/login')
  }

  function goStudent() {
    if (role === 'student') nav('/student')
    else nav('/student/consent')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <main className="container py-16 md:py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            AI-Powered Spelling Research Platform
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Transform Spelling
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Education with AI
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Create adaptive spelling experiments with AI-generated stories and audio. Track student progress with
            research-grade analytics.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button onClick={goTeacher} className="btn primary text-lg px-8 py-4">
              For Teachers
            </button>
            <button onClick={goStudent} className="btn text-lg px-8 py-4">
              For Students
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {[
            {
              title: 'AI Story Generation',
              body: 'Automatically generate contextual stories with OpenAI, tailored to CEFR levels and target words.',
            },
            {
              title: 'Text-to-Speech Audio',
              body: 'Generate natural-sounding audio narration with adjustable playback speed based on difficulty.',
            },
            {
              title: 'Research Analytics',
              body: 'Track learning phases, hint usage, and spelling accuracy with detailed performance metrics.',
            },
          ].map((feature, idx) => (
            <div
              key={feature.title}
              className="p-6 bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl mb-4">
                {idx === 0 ? '�o?�,?' : idx === 1 ? 'dY\"S' : 'dY\"S'}
              </div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.body}</p>
            </div>
          ))}
        </div>

        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Choose Your Role</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <button
              onClick={goTeacher}
              className="group p-8 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border-2 border-blue-200 hover:border-blue-400 hover:shadow-2xl transition-all text-left relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/20 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
              <div className="relative">
                <h3 className="text-2xl font-bold mb-3 text-blue-900">I am a Teacher</h3>
                <p className="text-blue-700 mb-6">
                  Create experiments, generate stories with AI, assign students, and analyze results.
                </p>
                <div className="space-y-2 text-sm text-blue-600 mb-6">
                  {['Select target words with AI suggestions', 'Generate 2 stories automatically', 'Create TTS audio with one click', 'Share join codes with students'].map(
                    (item) => (
                      <div key={item} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        {item}
                      </div>
                    )
                  )}
                </div>
                <div className="inline-flex items-center gap-2 text-blue-900 font-semibold group-hover:gap-4 transition-all">
                  {role === 'teacher' ? 'Go to Dashboard' : 'Sign In as Teacher'} <span className="text-xl">�+'</span>
                </div>
              </div>
            </button>

            <button
              onClick={() => nav('/student/consent')}
              className="group p-8 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl border-2 border-purple-200 hover:border-purple-400 hover:shadow-2xl transition-all text-left relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-400/20 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
              <div className="relative">
                <h3 className="text-2xl font-bold mb-3 text-purple-900">I am a Student</h3>
                <p className="text-purple-700 mb-6">
                  Join experiments with a code, listen to stories, and practice spelling with interactive feedback.
                </p>
                <div className="space-y-2 text-sm text-purple-600 mb-6">
                  {['Join with a simple code', 'Listen to audio stories', 'Fill gaps with target words', 'Get instant feedback'].map(
                    (item) => (
                      <div key={item} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                        {item}
                      </div>
                    )
                  )}
                </div>
                <div className="inline-flex items-center gap-2 text-purple-900 font-semibold group-hover:gap-4 transition-all">
                  {role === 'student' ? 'Go to Dashboard' : 'Sign In as Student'} <span className="text-xl">�+'</span>
                </div>
              </div>
            </button>

            <button
              onClick={() => nav('/demo-login')}
              className="group p-8 bg-gradient-to-br from-amber-50 to-orange-100 rounded-2xl border-2 border-amber-200 hover:border-amber-400 hover:shadow-2xl transition-all text-left relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-400/20 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
              <div className="relative">
                <h3 className="text-2xl font-bold mb-3 text-amber-900">Try Demo First</h3>
                <p className="text-amber-700 mb-6">
                  Explore SpellWise with a pre-made experiment. No sign-up needed.
                </p>
                <div className="space-y-2 text-sm text-amber-600 mb-6">
                  {['Play a sample story', 'Test the student experience', 'No account required'].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                      {item}
                    </div>
                  ))}
                </div>
                <div className="inline-flex items-center gap-2 text-amber-900 font-semibold group-hover:gap-4 transition-all">
                  Start Demo <span className="text-xl">→</span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </main>

      <footer className="border-t bg-white py-8 mt-16">
        <div className="container text-center text-sm text-gray-600">
          <p>SpellWise - AI-Powered Spelling Research Platform</p>
          <p className="mt-2">Built for educators and researchers</p>
        </div>
      </footer>
    </div>
  )
}
