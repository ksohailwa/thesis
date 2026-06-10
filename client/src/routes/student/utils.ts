import type { Blank, StoryPayload } from './types'

export function splitSentences(paragraph: string): string[] {
  const parts = paragraph
    .split(/(?<=[.!?])\s+/g)
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length ? parts : [paragraph]
}

export function parseParagraph(
  paragraph: string,
  pIdx: number,
  wordCounts: Record<string, number>,
  occs: StoryPayload['occurrences'],
  noiseOccs: StoryPayload['occurrences'] = []
): { segments: (string | Blank)[]; blanks: Blank[] } {
  const buildFromOccurrences = (
    text: string,
    occurrences: Array<{
      word: string
      sentenceIndex?: number
      charStart?: number
      charEnd?: number
      isNoise?: boolean
    }>
  ) => {
    const blanks: Blank[] = []
    const segments: (string | Blank)[] = []
    let cursor = 0

    occurrences
      .filter((o) => typeof o.charStart === 'number')
      .sort((a, b) => (a.charStart ?? 0) - (b.charStart ?? 0))
      .forEach((o) => {
        const start = Math.max(0, o.charStart ?? 0)
        const end = Math.min(text.length, o.charEnd ?? start + o.word.length)
        if (start < cursor || end <= start) return

        const counterKey = o.isNoise ? `noise:${o.word.toLowerCase()}` : o.word.toLowerCase()
        const idx = (wordCounts[counterKey] || 0) + 1
        wordCounts[counterKey] = idx

        if (start > cursor) segments.push(text.slice(cursor, start))
        const blank: Blank = {
          key: `${o.isNoise ? 'noise-' : ''}${o.word}-${idx}-${pIdx}-${blanks.length}`,
          word: o.word,
          occurrenceIndex: idx,
          paragraphIndex: pIdx,
          sentenceIndex: o.sentenceIndex,
          charStart: start,
          charEnd: end,
          isNoise: Boolean(o.isNoise),
        }
        blanks.push(blank)
        segments.push(blank)
        cursor = end
      })

    if (cursor < text.length) segments.push(text.slice(cursor))
    return { segments: segments.filter((s) => typeof s !== 'string' || s.length > 0), blanks }
  }

  // Strategy 1: Bold markers (**word**) for target and ++word++ for noise
  if (paragraph.includes('**') || paragraph.includes('++')) {
    const markerRegex = /(\*\*([^*]+)\*\*|\+\+([^+]+)\+\+)/g
    const markerOccurrences: Array<{
      word: string
      sentenceIndex: number
      charStart: number
      charEnd: number
      isNoise: boolean
    }> = []
    let cleanText = ''
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = markerRegex.exec(paragraph)) !== null) {
      cleanText += paragraph.slice(lastIndex, match.index)
      const word = (match[2] || match[3] || '').trim()
      const start = cleanText.length
      cleanText += word
      const end = cleanText.length
      const textBeforeMarker = paragraph.slice(0, match.index)
      markerOccurrences.push({
        word,
        sentenceIndex: (textBeforeMarker.match(/[.!?]+/g) || []).length,
        charStart: start,
        charEnd: end,
        isNoise: Boolean(match[3]),
      })
      lastIndex = match.index + match[0].length
    }
    cleanText += paragraph.slice(lastIndex)

    return buildFromOccurrences(cleanText, markerOccurrences)
  }

  const paraOcc = (occs || []).filter((o) => o.paragraphIndex === pIdx)
  const paraNoise = (noiseOccs || []).filter((o) => o.paragraphIndex === pIdx)
  const allOccurrences = [
    ...paraOcc.map((o) => ({ ...o, isNoise: false })),
    ...paraNoise.map((o) => ({ ...o, isNoise: true })),
  ].sort((a, b) => (a.charStart ?? 0) - (b.charStart ?? 0))

  if (allOccurrences.every((o) => typeof o.charStart === 'number')) {
    return buildFromOccurrences(paragraph, allOccurrences)
  }

  const blanks: Blank[] = []
  let segments: (string | Blank)[] = [paragraph]

  const addBlankFallback = (o: {
    word: string
    sentenceIndex?: number
    charStart?: number
    charEnd?: number
    isNoise?: boolean
  }) => {
    const counterKey = o.isNoise ? `noise:${o.word.toLowerCase()}` : o.word.toLowerCase()
    const idx = (wordCounts[counterKey] || 0) + 1
    wordCounts[counterKey] = idx
    const blank: Blank = {
      key: `${o.isNoise ? 'noise-' : ''}${o.word}-${idx}-${pIdx}-${blanks.length}`,
      word: o.word,
      occurrenceIndex: idx,
      paragraphIndex: pIdx,
      sentenceIndex: o.sentenceIndex,
      charStart: o.charStart,
      charEnd: o.charEnd,
      isNoise: Boolean(o.isNoise),
    }

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      if (typeof seg !== 'string') continue
      const pos = seg.toLowerCase().indexOf(o.word.toLowerCase())
      if (pos >= 0) {
        segments.splice(i, 1, seg.slice(0, pos), blank, seg.slice(pos + o.word.length))
        blanks.push(blank)
        return
      }
    }
  }

  allOccurrences.forEach((occ) => addBlankFallback(occ))
  segments = segments.filter((s) => typeof s !== 'string' || s.length > 0)
  return { segments, blanks }
}

export function buildLetterFeedback(
  value: string,
  target: string
): Array<boolean | null> {
  const out: Array<boolean | null> = []
  const len = target.length
  for (let i = 0; i < len; i++) {
    const v = value[i]
    if (!v) {
      out.push(null)
    } else {
      out.push(v.toLowerCase() === target[i]?.toLowerCase())
    }
  }
  return out
}
