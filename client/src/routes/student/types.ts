// Shared types for student components

export type Blank = {
  key: string
  word: string
  occurrenceIndex: number
  paragraphIndex: number
  sentenceIndex?: number
  charStart?: number
  charEnd?: number
  isNoise?: boolean
}

export type StoryPayload = {
  paragraphs?: string[]
  occurrences?: {
    word: string
    paragraphIndex: number
    sentenceIndex?: number
    charStart?: number
    charEnd?: number
  }[]
  noiseOccurrences?: {
    word: string
    paragraphIndex: number
    sentenceIndex?: number
    charEnd?: number
  }[]
}

export type BlankState = {
  value: string
  correct: boolean
  feedback: string
  letterFeedback?: Array<boolean | null>
}

export type HintState = {
  used: number
  text: string
}

export type SentenceClip = {
  id: string
  paragraphIndex: number
  sentenceIndex: number
  globalIndex: number
}
