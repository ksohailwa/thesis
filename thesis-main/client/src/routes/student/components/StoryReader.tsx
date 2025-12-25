import { Play } from 'lucide-react'

// Duplicated types for prop clarity, ideally import from shared types
type Blank = {
  key: string
  word: string
  occurrenceIndex: number
  paragraphIndex: number
  sentenceIndex?: number
  charStart?: number
  charEnd?: number
}

type ParsedParagraph = {
  segments: (string | Blank)[]
  blanks: Blank[]
}

type SentenceClip = {
  id: string
  paragraphIndex: number
  sentenceIndex: number
}

type Props = {
  parsedStory: ParsedParagraph[]
  allBlanks: Blank[]
  currentStory: { paragraphs?: string[] }
  sentenceClips: SentenceClip[]
  activeParagraph: number
  currentSentenceId: string | null
  storyIndex: number
  isStoryComplete: boolean
  onPlaySentence: (pIdx: number, sIdx: number) => void
  onShowFeedback: () => void
  onGoToStory: (targetIndex: number) => void // NEW PROP
  renderBlank: (blank: Blank) => React.ReactNode
  splitSentences: (text: string) => string[]
  readMode?: boolean
}

export default function StoryReader({
  allBlanks,
  currentStory,
  sentenceClips,
  currentSentenceId,
  activeParagraph,
  storyIndex,
  isStoryComplete,
  onPlaySentence,
  onShowFeedback,
  onGoToStory, // NEW PROP
  renderBlank,
  splitSentences,
  readMode = false
}: Props) {
  return (
    <div className={`${readMode ? 'lg:col-span-4' : 'lg:col-span-3'} space-y-6`}>
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 md:p-8 leading-relaxed text-[1.05rem] text-neutral-800 font-sans">
        {currentStory.paragraphs && currentStory.paragraphs.map((paragraphText: string, pIdx: number) => {
          if (pIdx !== activeParagraph) return null
          const sentences = splitSentences(paragraphText)
          return (
            <div key={pIdx} className="mb-6 last:mb-0">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase tracking-wide text-gray-400">Paragraph {pIdx + 1}</div>
              </div>
              {sentences.map((sentenceText, sIdx) => {
                const clip = sentenceClips.find(
                  (c) => c.paragraphIndex === pIdx && c.sentenceIndex === sIdx
                )
                const isCurrentPlayingSentence = currentSentenceId === clip?.id
                
                // Filter blanks that belong to this sentence
                // We assume allBlanks is fully populated by the parent's parsing logic
                const sentenceBlanks = allBlanks.filter(
                  (b) => b.paragraphIndex === pIdx
                )
                
                // Render logic: Inject blanks into sentence string
                let currentSentenceSegments: (string | Blank)[] = [sentenceText];
                
                // Inject blanks
                sentenceBlanks.sort((a,b) => (b.charStart || 0) - (a.charStart || 0))
                sentenceBlanks.forEach(blank => {
                  for(let i=0; i<currentSentenceSegments.length; i++) {
                    const seg = currentSentenceSegments[i]
                    if (typeof seg === 'string') {
                      // Search for word in segment
                      const pos = seg.toLowerCase().indexOf(blank.word.toLowerCase())
                      if (pos >= 0) {
                        const before = seg.slice(0, pos)
                        const after = seg.slice(pos + blank.word.length)
                        currentSentenceSegments.splice(i, 1, before, blank, after)
                        break
                      }
                    }
                  }
                })

                return (
                  <span
                    key={`${pIdx}-${sIdx}`}
                    className={`inline-block group relative cursor-pointer pr-1 transition-all rounded-md px-1
                      ${isCurrentPlayingSentence ? 'bg-purple-100 ring-2 ring-purple-200' : 'hover:bg-gray-50'}
                    `}
                    onClick={() => onPlaySentence(pIdx, sIdx)}
                  >
                    {currentSentenceSegments.map((seg, segIdx) => (
                      typeof seg === 'string' ? <span key={segIdx}>{seg}</span> : renderBlank(seg)
                    ))}
                    {isCurrentPlayingSentence && (
                      <span className="absolute -left-4 top-1 text-purple-600 animate-pulse">
                        <Play size={10} fill="currentColor" />
                      </span>
                    )}
                  </span>
                )
              })}
            </div>
          )
        })}
      </div>
      
      {isStoryComplete && storyIndex === 0 && (
        <div className="p-6 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl flex items-center justify-between animate-fadeIn">
          <div>
            <h3 className="text-xl font-bold text-purple-900">Story 1 Complete!</h3>
            <p className="text-purple-700">Ready for the next challenge?</p>
          </div>
          <button 
            onClick={() => onGoToStory(1)} // Changed to use onGoToStory(1)
            className="px-6 py-2 bg-white text-purple-700 font-bold rounded-lg shadow hover:scale-105 transition"
          >
            Continue to Story 2
          </button>
        </div>
      )}

      {/* Go to Story 1 Button - Visible when on Story 2 */}
      {storyIndex === 1 && (
        <div className="mt-6 p-6 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Review Story 1?</h3>
            <p className="text-gray-700">Go back and practice Story 1 again.</p>
          </div>
          <button 
            onClick={() => onGoToStory(0)}
            className="px-6 py-2 bg-white text-gray-700 font-bold rounded-lg shadow hover:scale-105 transition"
          >
            Go to Story 1
          </button>
        </div>
      )}

      {/* Final Submission Button - Visible only when Story 2 is complete */}
      {isStoryComplete && storyIndex === 1 && (
        <div className="mt-6 p-6 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl border-2 border-green-300 text-center transition-colors">
            <button
              onClick={onShowFeedback} // Triggers Feedback Modal and then submission
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              Submit All
            </button>
          </div>
      )}
    </div>
  )
}
