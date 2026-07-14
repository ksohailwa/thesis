type Props = {
  storyIndex: number
  solvedCount: number
  totalBlanks: number
  progressPct: number
  isStoryComplete: boolean
  onGoBack?: () => void
}

export default function StudentHeader({
  storyIndex,
  solvedCount,
  totalBlanks,
  progressPct,
  isStoryComplete,
  onGoBack
}: Props) {
  return (
    <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-neutral-200 shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200">
              Story {storyIndex + 1} of 2
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-500">Words solved</span>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold tracking-tight ${isStoryComplete ? 'text-emerald-600' : 'text-primary-700'}`}>
                  {solvedCount} / {totalBlanks}
                </span>
                {isStoryComplete && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Complete</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onGoBack && storyIndex > 0 && (
              <button
                onClick={onGoBack}
                className="text-xs font-semibold text-primary-700 border border-primary-100 rounded-full px-3 py-1.5 uppercase tracking-wide hover:bg-primary-50 transition"
                title="Return to Story 1"
              >
                Story 1
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 h-2 w-full bg-neutral-100 rounded-full overflow-hidden border border-neutral-200">
          <div
            className="h-full bg-gradient-to-r from-primary-600 via-primary-500 to-primary-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
