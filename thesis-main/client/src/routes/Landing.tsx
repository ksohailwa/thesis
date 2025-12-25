import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { Button } from '../components/ui/Button'
import Card from '../components/ui/Card'

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
    <div className="min-h-screen bg-neutral-50 transition-colors">
      <main className="container py-16 md:py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-full text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></span>
            AI-Powered Spelling Research Platform
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight text-gray-900">
            Transform Spelling
            <br />
            <span className="bg-gradient-to-r from-primary-600 via-primary-500 to-primary-400 bg-clip-text text-transparent">
              Education with AI
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Create adaptive spelling experiments with AI-generated stories and audio. Track student progress with
            research-grade analytics.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button onClick={goTeacher} size="lg">
              For Teachers
            </Button>
            <Button onClick={goStudent} size="lg" variant="secondary">
              For Students
            </Button>
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
            <Card key={feature.title} className="hover:shadow-md transition">
              <div className="w-14 h-14 bg-primary-600 rounded-xl flex items-center justify-center text-white text-2xl mb-4">
                {idx === 0 ? 'AI' : idx === 1 ? 'TTS' : 'FX'}
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">{feature.title}</h3>
              <p className="text-gray-600">{feature.body}</p>
            </Card>
          ))}
        </div>

        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">Choose Your Role</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-0 overflow-hidden">
              <button
                onClick={goTeacher}
                className="group p-8 text-left relative w-full"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary-100 rounded-full -mr-20 -mt-20 group-hover:scale-110 transition-transform"></div>
                <div className="relative">
                  <h3 className="text-2xl font-bold mb-3 text-neutral-900">I am a Teacher</h3>
                  <p className="text-neutral-600 mb-6">
                    Create experiments, generate stories with AI, assign students, and analyze results.
                  </p>
                  <div className="space-y-2 text-sm text-neutral-600 mb-6">
                    {['Select target words with AI suggestions', 'Generate 2 stories automatically', 'Create TTS audio with one click', 'Share join codes with students'].map(
                      (item) => (
                        <div key={item} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                          {item}
                        </div>
                      )
                    )}
                  </div>
                  <div className="inline-flex items-center gap-2 text-primary-700 font-semibold group-hover:gap-4 transition-all">
                    {role === 'teacher' ? 'Go to Dashboard' : 'Sign In as Teacher'} <span className="text-xl">-&gt;</span>
                  </div>
                </div>
              </button>
            </Card>

            <Card className="p-0 overflow-hidden">
              <button
                onClick={goStudent}
                className="group p-8 text-left relative w-full"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-neutral-100 rounded-full -mr-20 -mt-20 group-hover:scale-110 transition-transform"></div>
                <div className="relative">
                  <h3 className="text-2xl font-bold mb-3 text-neutral-900">I am a Student</h3>
                  <p className="text-neutral-600 mb-6">
                    Join experiments with a code, listen to stories, and practice spelling with interactive feedback.
                  </p>
                  <div className="space-y-2 text-sm text-neutral-600 mb-6">
                    {['Join with a simple code', 'Listen to audio stories', 'Fill gaps with target words', 'Get instant feedback'].map(
                      (item) => (
                        <div key={item} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full"></span>
                          {item}
                        </div>
                      )
                    )}
                  </div>
                  <div className="inline-flex items-center gap-2 text-primary-700 font-semibold group-hover:gap-4 transition-all">
                    {role === 'student' ? 'Go to Dashboard' : 'Sign In as Student'} <span className="text-xl">-&gt;</span>
                  </div>
                </div>
              </button>
            </Card>

            <Card className="p-0 overflow-hidden">
              <button
                onClick={() => nav('/demo-login')}
                className="group p-8 text-left relative w-full"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-amber-50 rounded-full -mr-20 -mt-20 group-hover:scale-110 transition-transform"></div>
                <div className="relative">
                  <h3 className="text-2xl font-bold mb-3 text-neutral-900">Try Demo First</h3>
                  <p className="text-neutral-600 mb-6">
                    Explore SpellWise with a pre-made experiment. No sign-up needed.
                  </p>
                  <div className="space-y-2 text-sm text-neutral-600 mb-6">
                    {['Play a sample story', 'Test the student experience', 'No account required'].map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="inline-flex items-center gap-2 text-primary-700 font-semibold group-hover:gap-4 transition-all">
                    Start Demo <span className="text-xl">-&gt;</span>
                  </div>
                </div>
              </button>
            </Card>
          </div>
        </div>
      </main>

      <footer className="border-t bg-white py-8 mt-16 transition-colors">
        <div className="container text-center text-sm text-gray-600">
          <p>SpellWise - AI-Powered Spelling Research Platform</p>
          <p className="mt-2">Built for educators and researchers</p>
        </div>
      </footer>
    </div>
  )
}
