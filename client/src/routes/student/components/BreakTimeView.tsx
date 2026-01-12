type BreakTimeViewProps = {
  breakMin: number
  breakSec: number
  breakRemainingMs: number
  onStartStory2: () => void
}

export default function BreakTimeView({
  breakMin,
  breakSec,
  breakRemainingMs,
  onStartStory2,
}: BreakTimeViewProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-amber-50 via-white to-rose-50">
      <div className="bg-white border border-amber-200 rounded-2xl shadow-xl p-8 max-w-lg w-full text-center space-y-4">
        <h2 className="text-2xl font-bold text-amber-700">Break Time</h2>
        <p className="text-gray-600">
          Take a 5-minute break before starting Story 2.
        </p>
        <div className="text-4xl font-bold text-gray-800">
          {String(breakMin).padStart(2, '0')}:{String(breakSec).padStart(2, '0')}
        </div>
        <div className="text-xs text-gray-500">
          Recall test unlocks after the break.
        </div>
        <button
          className="btn primary w-full"
          disabled={breakRemainingMs > 0}
          onClick={onStartStory2}
        >
          Start Story 2
        </button>
      </div>
    </div>
  )
}
