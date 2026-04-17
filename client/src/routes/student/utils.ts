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
  const blanks: Blank[] = []
  let segments: (string | Blank)[] = [paragraph]

  // Strategy 1: Bold markers (**word**) for target and ++word++ for noise
  if (paragraph.includes('**') || paragraph.includes('++')) {
    // Split by both **word** (target) and ++word++ (noise) markers
    const parts = paragraph.split(/(\*\*[^*]+\*\*|\+\+[^+]+\+\+)/g)
    segments = []
    parts.forEach((part) => {
      // Check for target word (**word**)
      const targetMatch = part.match(/^\*\*([^*]+)\*\*$/)
      if (targetMatch) {
        const word = targetMatch[1]
        const idx = (wordCounts[word] || 0) + 1
        wordCounts[word] = idx
        const blank: Blank = {
          key: `${word}-${idx}-${pIdx}-${blanks.length}`,
          word,
          occurrenceIndex: idx,
          paragraphIndex: pIdx,
          isNoise: false,
        }
        blanks.push(blank)
        segments.push(blank)
        return
      }
      
      // Check for noise word (++word++)
      const noiseMatch = part.match(/^\+\+([^+]+)\+\+$/)
      if (noiseMatch) {
        const word = noiseMatch[1]
        const idx = (wordCounts[word] || 0) + 1
        wordCounts[word] = idx
        const blank: Blank = {
          key: `noise-${word}-${idx}-${pIdx}-${blanks.length}`,
          word,
          occurrenceIndex: idx,
          paragraphIndex: pIdx,
          isNoise: true,
        }
        blanks.push(blank)
        segments.push(blank)
        return
      }
      
      // Plain text segment
      if (part) {
        segments.push(part)
      }
    })
    return { segments, blanks }
  }

  // Strategy 2: Occurrences from backend (Explicit + Fallback Scan)
  const paraOcc = (occs || []).filter((o) => o.paragraphIndex === pIdx)
  const paraNoise = (noiseOccs || []).filter((o) => o.paragraphIndex === pIdx)

  const addBlank = (o: {
    word: string
    sentenceIndex?: number
    charStart?: number
    charEnd?: number
    isNoise?: boolean
  }) => {
    // Use separate counters for target vs noise to handle same word appearing as both
    const counterKey = o.isNoise ? `noise:${o.word}` : o.word
    const idx = (wordCounts[counterKey] || 0) + 1
    wordCounts[counterKey] = idx

    // Include noise prefix in key to match Strategy 1 and ensure uniqueness
    const keyPrefix = o.isNoise ? 'noise-' : ''
    const blank: Blank = {
      key: `${keyPrefix}${o.word}-${idx}-${pIdx}-${blanks.length}`,
      word: o.word,
      occurrenceIndex: idx,
      paragraphIndex: pIdx,
      sentenceIndex: o.sentenceIndex,
      charStart: o.charStart,
      charEnd: o.charEnd,
      isNoise: o.isNoise || false,
    }

    let inserted = false
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      if (typeof seg !== 'string') continue
      const pos = seg.toLowerCase().indexOf(o.word.toLowerCase())
      if (pos >= 0) {
        const before = seg.slice(0, pos)
        const after = seg.slice(pos + o.word.length)
        segments.splice(i, 1, before, blank, after)
        blanks.push(blank)
        inserted = true
        break
      }
    }
    if (!inserted) {
      wordCounts[counterKey] = idx // keep counter to avoid reusing keys
    }
  }

  // Merge target and noise occurrences, then sort by charStart for correct reading order
  const allOccurrences = [
    ...paraOcc.map((o) => ({ ...o, isNoise: false })),
    ...paraNoise.map((o) => ({ ...o, isNoise: true })),
  ].sort((a, b) => (a.charStart ?? 0) - (b.charStart ?? 0))

  // Process in text order (left-to-right) so blanks array matches reading sequence
  allOccurrences.forEach((occ) => addBlank(occ))

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
