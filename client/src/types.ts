// Minimal types.ts for shared type definitions
// Note: Helper functions like makeRecord, toAudioUrl, paragraphHighlightsSafe, buildWordCountsSafe,
//       WORD_PATTERN, MAX_WORDS, sanitizeWord, normalizeList
//       are now defined directly within StoryManager.tsx (as per revert).

export type WordItem = { word: string; level?: string; reason?: string }
export type TargetOccurrence = { word: string; paragraphIndex: number; charStart: number; charEnd: number }
export type StoryData = { paragraphs: string[]; targetOccurrences?: TargetOccurrence[]; ttsSegments?: string[] }

export type SetKey = 'set1' | 'set2'
export type StoryKey = 'story1' | 'story2'
export type SlotKey = `${SetKey}-${StoryKey}`

// Helper to create slot key (still useful here, but should align with original StoryManager's content if it defined it)
export const slotKey = (set: SetKey, story: StoryKey): SlotKey => `${set}-${story}` as SlotKey

