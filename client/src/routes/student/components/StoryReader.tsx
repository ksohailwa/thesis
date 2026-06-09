import { memo, useMemo } from 'react'
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
  isNoise?: boolean
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
          let sentenceCursor = 0
          const sentenceRanges = sentences.map((sentence) => {
            const foundAt = paragraphText.indexOf(sentence, sentenceCursor)
            const start = foundAt >= 0 ? foundAt : sentenceCursor
            const end = start + sentence.length
            sentenceCursor = end
            return { start, end }
          })
          return (
            <div key={pIdx} className="mb-6 last:mb-0">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase tracking-wide text-gray-400">Paragraph {pIdx + 1}</div>
              </div>
              {sentences.map((sentenceText, sIdx) => {
                const sentenceRange = sentenceRanges[sIdx] || { start: 0, end: sentenceText.length }
                const clip = sentenceClips.find(
                  (c) => c.paragraphIndex === pIdx && c.sentenceIndex === sIdx
                )
                const isCurrentPlayingSentence = currentSentenceId === clip?.id
                
                // Filter blanks that belong to this specific sentence
                // Using sentenceIndex ensures same word in different sentences gets correct blank
                const sentenceBlanks = allBlanks.filter((b) => {
                  if (b.paragraphIndex !== pIdx) return false
                  // If sentenceIndex is defined, use it for precise filtering
                  if (typeof b.sentenceIndex === 'number') return b.sentenceIndex === sIdx
                  if (typeof b.charStart === 'number') {
                    return b.charStart >= sentenceRange.start && b.charStart < sentenceRange.end
                  }
                  // Fallback for legacy bold marker mode: include all paragraph blanks
                  // (less precise but maintains backwards compatibility)
                  return true
                })

                // Sort blanks by charStart (ascending) for correct left-to-right processing
                // This ensures indexOf finds the correct occurrence when same word appears multiple times
                const sortedBlanks = [...sentenceBlanks].sort((a, b) => (a.charStart || 0) - (b.charStart || 0))

                let currentSentenceSegments: (string | Blank)[] = []
                const canUseExactPositions = sortedBlanks.every(
                  (blank) => typeof blank.charStart === 'number'
                )

                if (canUseExactPositions) {
                  let cursor = 0
                  sortedBlanks.forEach((blank) => {
                    const localStart = Math.max(0, (blank.charStart || 0) - sentenceRange.start)
                    const localEnd = Math.min(
                      sentenceText.length,
                      (blank.charEnd || (blank.charStart || 0) + blank.word.length) - sentenceRange.start
                    )
                    if (localStart < cursor || localEnd <= localStart) return
                    if (localStart > cursor) currentSentenceSegments.push(sentenceText.slice(cursor, localStart))
                    currentSentenceSegments.push(blank)
                    cursor = localEnd
                  })
                  if (cursor < sentenceText.length) currentSentenceSegments.push(sentenceText.slice(cursor))
                } else {
                  currentSentenceSegments = [sentenceText]
                  sortedBlanks.forEach(blank => {
                    for (let i = 0; i < currentSentenceSegments.length; i++) {
                      const seg = currentSentenceSegments[i]
                      if (typeof seg === 'string') {
                        const pos = seg.toLowerCase().indexOf(blank.word.toLowerCase())
                        if (pos >= 0) {
                          const before = seg.slice(0, pos)
                          const after = seg.slice(pos + blank.word.length)
                          currentSentenceSegments = [
                            ...currentSentenceSegments.slice(0, i),
                            before,
                            blank,
                            after,
                            ...currentSentenceSegments.slice(i + 1)
                          ]
                          break
                        }
                      }
                    }
                  })
                }

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
            onClick={onShowFeedback}
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
