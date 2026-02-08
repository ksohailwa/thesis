import { Sparkles } from 'lucide-react'

type SentenceClip = {
  id: string
  paragraphIndex: number
  sentenceIndex: number
}

type Props = {
  streak: number
  sentenceClips: SentenceClip[]
  currentSentenceId: string | null
  onPlaySentence: (pIdx: number, sIdx: number) => void
}

export default function Sidebar({
  streak,
  sentenceClips,
  currentSentenceId,
  onPlaySentence
}: Props) {
  return (
    <div className="space-y-4">
      {/* Streak Card */}
      {streak > 1 && (
        <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex items-center gap-3 animate-bounce-subtle">
          <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="text-sm text-orange-600 font-bold uppercase">Streak</div>
            <div className="text-2xl font-bold text-orange-800">{streak}</div>
          </div>
        </div>
      )}

      {/* Sentence Nav */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
         <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Sentence Nav</h3>
         <div className="flex flex-wrap gap-1">
           {sentenceClips.map((clip, i) => (
             <button
               key={clip.id}
               onClick={() => onPlaySentence(clip.paragraphIndex, clip.sentenceIndex)}
               className={`
                 w-8 h-8 rounded-lg text-xs font-bold transition-all
                 ${currentSentenceId === clip.id
                   ? 'bg-purple-600 text-white shadow-md scale-110'
                   : 'bg-gray-50 text-gray-500 hover:bg-purple-50 hover:text-purple-600'
                 }
               `}
             >
               {i + 1}
             </button>
           ))}
         </div>
      </div>
    </div>
  )
}
