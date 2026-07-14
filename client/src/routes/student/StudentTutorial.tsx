import { ArrowRight, BookOpen, CheckCircle, Headphones, Keyboard, ListChecks, RotateCcw, Timer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/auth'

const steps = [
  {
    icon: Headphones,
    title: 'Listen sentence by sentence',
    text: 'Each sentence has its own audio button. Play the sentence, listen carefully, and replay it if needed before answering.',
  },
  {
    icon: Keyboard,
    title: 'Fill in the blanks',
    text: 'Type the missing word into the letter boxes. Use Check after each word. You need to complete the current paragraph before moving forward.',
  },
  {
    icon: RotateCcw,
    title: 'Complete practice when it opens',
    text: 'If a practice window appears after an incorrect answer, complete the definition and spelling activities shown on the screen.',
  },
  {
    icon: CheckCircle,
    title: 'Read feedback carefully',
    text: 'In some parts, the screen may show the correct spelling and meaning after a wrong answer. Read it and continue.',
  },
  {
    icon: ListChecks,
    title: 'Answer the short rating screens',
    text: 'After paragraphs, choose the numbers that match how difficult the activity felt and how much effort it took.',
  },
  {
    icon: Timer,
    title: 'Finish both stories and return later',
    text: 'After Story 1 there is a short break. After Story 2, the final activity opens later. Come back with the same account and class code.',
  },
]

export default function StudentTutorial() {
  const nav = useNavigate()
  const username = (useAuth((s) => s.username) || 'student').trim().toLowerCase()

  function continueToJoin() {
    localStorage.setItem(`student-tutorial:${username}`, 'true')
    nav('/student')
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 border-b border-slate-200 pb-6">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <BookOpen size={24} />
          </div>
          <h1 className="text-3xl font-bold">Before you start</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            These steps show how to complete the activities. Read them once, then enter your class code.
          </p>
        </div>

        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Work through the screens in order. Do not refresh the page during an activity. If you leave after finishing both stories, use the same account and code when you return.
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <div key={step.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                    <Icon size={20} />
                  </div>
                  <div className="text-sm font-semibold text-slate-500">Step {index + 1}</div>
                </div>
                <h2 className="text-lg font-bold">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.text}</p>
              </div>
            )
          })}
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">During the final activity</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Listen to each word audio, type the spelling, and choose the matching meaning. No practice windows are shown there, so answer as carefully as you can.
          </p>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={continueToJoin}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white transition hover:bg-emerald-800"
          >
            Continue
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
