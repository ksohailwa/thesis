import { useState } from 'react'

type BreakTimeViewProps = {
  breakMin: number
  breakSec: number
  breakRemainingMs: number
  breakStartTime: number
  onStartStory2: (actualBreakMs: number) => void
}

export default function BreakTimeView({
  breakMin,
  breakSec,
  breakRemainingMs,
  breakStartTime,
  onStartStory2,
}: BreakTimeViewProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const breakComplete = breakRemainingMs <= 0

  const handleContinue = () => {
    const actualBreakMs = Date.now() - breakStartTime
    onStartStory2(actualBreakMs)
  }

  const handleEarlySkip = () => {
    if (!showConfirm) {
      setShowConfirm(true)
      return
    }
    // Double confirmed - allow early skip
    handleContinue()
  }

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
          {breakComplete
            ? 'Break complete! You may continue.'
            : 'Recall test unlocks after the break.'}
        </div>

        {breakComplete ? (
          <button
            className="btn primary w-full"
            onClick={handleContinue}
          >
            Start Story 2
          </button>
        ) : (
          <div className="space-y-2">
            {showConfirm ? (
              <>
                <p className="text-sm text-amber-600 font-medium">
                  Are you sure? The recommended 5-minute break helps with learning retention.
                </p>
                <div className="flex gap-2">
                  <button
                    className="btn flex-1"
                    onClick={() => setShowConfirm(false)}
                  >
                    Wait
                  </button>
                  <button
                    className="btn primary flex-1 bg-amber-600 hover:bg-amber-700"
                    onClick={handleEarlySkip}
                  >
                    Skip Anyway
                  </button>
                </div>
              </>
            ) : (
              <button
                className="btn w-full text-gray-500"
                onClick={handleEarlySkip}
              >
                Skip Break Early
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
