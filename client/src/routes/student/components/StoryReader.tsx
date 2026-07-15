import { memo, useMemo } from 'react'
import { Play, Volume2 } from 'lucide-react'

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
}

export default function StoryReader({
  parsedStory,
  sentenceClips,
  currentStory,
  currentSentenceId,
  activeParagraph,
  storyIndex,
  isStoryComplete,
  onPlaySentence,
  onShowFeedback,
  onGoToStory, // NEW PROP
  renderBlank,
  splitSentences
}: Props) {
  const buildSentenceRows = (paragraph: ParsedParagraph, pIdx: number) => {
    const source = currentStory.paragraphs?.[pIdx] || ''
    const sentences = splitSentences(source)
    const rows: Array<Array<string | Blank>> = sentences.map(() => [])
    const sentenceBounds: Array<{ start: number; end: number }> = []
    sentences.forEach((sentence, index) => {
      const previousEnd = index > 0 ? sentenceBounds[index - 1].end : 0
      const foundAt = source.indexOf(sentence, previousEnd)
      const start = foundAt >= 0 ? foundAt : previousEnd
      sentenceBounds.push({ start, end: start + sentence.length })
    })
    if (!sentenceBounds.length) {
      sentenceBounds.push({ start: 0, end: source.length })
      rows.push([])
    }

    const sentenceIndexAt = (position: number) => {
      const index = sentenceBounds.findIndex((bound) => position >= bound.start && position <= bound.end)
      return index >= 0 ? index : sentenceBounds.length - 1
    }

    let cursor = 0
    paragraph.segments.forEach((segment) => {
      if (typeof segment !== 'string') {
        const rowIndex =
          typeof segment.sentenceIndex === 'number'
            ? segment.sentenceIndex
            : sentenceIndexAt(cursor)
        rows[Math.min(rowIndex, rows.length - 1)]?.push(segment)
        cursor = typeof segment.charEnd === 'number' ? segment.charEnd : cursor + segment.word.length
        return
      }

      let remaining = segment
      while (remaining.length) {
        const targetIndex = Math.min(sentenceIndexAt(cursor), rows.length - 1)
        const bound = sentenceBounds[targetIndex]
        const take = Math.max(1, Math.min(remaining.length, bound.end - cursor))
        rows[targetIndex].push(remaining.slice(0, take))
        remaining = remaining.slice(take)
        cursor += take
      }
    })

    return rows.filter((row) => row.length)
  }

  return (
    <div className="lg:col-span-4 space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 md:p-8 leading-relaxed text-[1.05rem] text-neutral-800 font-sans">
        {parsedStory.map((paragraph, pIdx: number) => {
          if (pIdx !== activeParagraph) return null
          const activeClip = sentenceClips.find((clip) => currentSentenceId === clip.id)
          return (
            <div key={pIdx} className="mb-6 last:mb-0">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase tracking-wide text-gray-400">Paragraph {pIdx + 1}</div>
              </div>
              <div className="space-y-3">
                {buildSentenceRows(paragraph, pIdx).map((sentenceParts, sIdx) => {
                  const active = activeClip?.paragraphIndex === pIdx && activeClip?.sentenceIndex === sIdx
                  return (
                    <div
                      key={`${pIdx}-${sIdx}`}
                      className={`relative flex items-start gap-3 rounded-md px-2 py-1 ${active ? 'bg-purple-50 ring-2 ring-purple-100' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => onPlaySentence(pIdx, sIdx)}
                        className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-purple-200 bg-white text-purple-700 shadow-sm transition hover:bg-purple-50"
                        aria-label={`Play sentence ${sIdx + 1}`}
                        title={`Play sentence ${sIdx + 1}`}
                      >
                        <Volume2 size={16} />
                      </button>
                      <span className="flex-1">
                        {sentenceParts.map((seg, segIdx) => (
                          typeof seg === 'string' ? <span key={segIdx}>{seg}</span> : renderBlank(seg)
                        ))}
                      </span>
                      {active && (
                        <span className="absolute -left-4 top-3 text-purple-600 animate-pulse">
                          <Play size={10} fill="currentColor" />
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
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
