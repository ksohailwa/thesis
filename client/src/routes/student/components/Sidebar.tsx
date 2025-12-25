import { Sparkles, Lightbulb } from 'lucide-react'

type SentenceClip = {
  id: string
  paragraphIndex: number
  sentenceIndex: number
}

type Props = {
  label: 'H' | 'N'
  streak: number
  activeBlankKey: string | null
  activeHintWord: string | null
  hints: Record<string, { used: number; text: string }>
  hintsAllowed: boolean
  hintsMessage?: string
  sentenceClips: SentenceClip[]
  currentSentenceId: string | null
  onGetHint: () => void
  onPlaySentence: (pIdx: number, sIdx: number) => void
}

export default function Sidebar({
  label,
  streak,
  activeBlankKey,
  activeHintWord,
  hints,
  hintsAllowed,
  hintsMessage,
  sentenceClips,
  currentSentenceId,
  onGetHint,
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

      {/* Hint Card */}
      <div className={`p-4 rounded-xl border ${label === 'H' ? 'bg-amber-50 border-amber-100' : 'bg-gray-100 border-gray-200'}`}>
         <div className="flex items-center gap-2 mb-2">
           <Lightbulb size={18} className={label === 'H' ? 'text-amber-600' : 'text-gray-400'} />
           <h3 className={`font-bold ${label === 'H' ? 'text-amber-800' : 'text-gray-500'}`}>
             {label === 'H' ? 'Hints' : 'No Hints'}
           </h3>
         </div>
         
         {label === 'H' ? (
           activeBlankKey ? (
             <div>
               <p className="text-xs text-amber-600 mb-3">
                 Used: {hints[activeHintWord!]?.used || 0}
               </p>
               <button 
                 onClick={onGetHint}
                 disabled={!hintsAllowed}
                 className={`w-full py-2 border rounded-lg text-sm font-semibold transition ${
                   hintsAllowed
                     ? 'bg-white border-amber-200 text-amber-700 hover:bg-amber-100'
                     : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                 }`}
               >
                 {hintsAllowed ? 'Get Hint' : (hintsMessage || 'Hints disabled for this occurrence')}
               </button>
               {hints[activeHintWord!]?.text && (
                 <div className="mt-2 p-2 bg-white rounded text-sm text-amber-900 border border-amber-100 animate-fadeIn">
                   {hints[activeHintWord!]?.text}
                 </div>
               )}
             </div>
           ) : (
             <p className="text-sm text-amber-600 italic">Click a blank to see hint options.</p>
           )
         ) : (
           <p className="text-sm text-gray-500">Hints are disabled for this session.</p>
         )}
      </div>

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
