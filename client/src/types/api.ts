export interface TargetOccurrence {
  word: string
  paragraphIndex: number
  sentenceIndex: number
  charStart: number
  charEnd: number
}

export interface StoryQuality {
  score: number
  readability: number
  vocabularyDiversity: number
  targetWordDistribution: number
  issues: string[]
}

export interface Story {
  id: string
  label: 'A' | 'B'
  paragraphs: string[]
  targetOccurrences: TargetOccurrence[]
  ttsAudioUrl?: string
  quality?: StoryQuality
}

export interface Experiment {
  id: string
  _id?: string
  title: string
  description?: string
  level: string
  cefr?: string
  status: 'draft' | 'live' | 'closed'
  classCode: string
  targetWords: string[]
  stories?: {
    story1?: { targetWords: string[] }
    story2?: { targetWords: string[] }
  }
}

export interface WordSuggestion {
  word: string
  level: string
  reason: string
}

export interface Job {
  id: string
  type: 'fetch_words' | 'generate_story' | 'generate_tts'
  status: 'pending' | 'running' | 'success' | 'error'
  errorMessage?: string
  createdAt: number
  updatedAt: number
}
