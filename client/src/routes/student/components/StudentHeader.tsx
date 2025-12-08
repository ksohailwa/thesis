import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'

type Props = {
  storyIndex: number
  solvedCount: number
  totalBlanks: number
  progressPct: number
  isPlaying: boolean
  onTogglePlay: () => void
  onSkip: (seconds: number) => void
  isStoryComplete: boolean
  onGoBack?: () => void
}

export default function StudentHeader({
  storyIndex,
  solvedCount,
  totalBlanks,
  progressPct,
  isPlaying,
  onTogglePlay,
  onSkip,
  isStoryComplete,
  onGoBack
}: Props) {
  return (
    <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-purple-100/60 shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-700 border border-purple-200">
              Story {storyIndex + 1} of 2
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-500">Words solved</span>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold tracking-tight ${isStoryComplete ? 'text-emerald-600' : 'text-purple-700'}`}>
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
                className="text-xs font-semibold text-purple-700 border border-purple-100 rounded-full px-3 py-1.5 uppercase tracking-wide hover:bg-purple-50 transition"
                title="Return to Story 1"
              >
                Story 1
              </button>
            )}
            <div className="flex items-center gap-2 bg-white/70 border border-purple-100 rounded-full px-2 py-1 shadow-sm">
              <button
                onClick={() => onSkip(-3)}
                className="p-2 text-gray-500 hover:bg-purple-50 rounded-full transition"
                title="Back 3s"
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={onTogglePlay}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow ${isPlaying ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-200' : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:scale-105'}`}
              >
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
              </button>
              <button
                onClick={() => onSkip(3)}
                className="p-2 text-gray-500 hover:bg-purple-50 rounded-full transition"
                title="Forward 3s"
              >
                <SkipForward size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 h-2 w-full bg-purple-50 rounded-full overflow-hidden border border-purple-100">
          <div
            className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
