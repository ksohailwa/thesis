export type WordItem = { word: string; level?: string; reason?: string }
export type TargetOccurrence = { word: string; paragraphIndex: number; charStart: number; charEnd: number }
export type StoryData = { paragraphs: string[]; targetOccurrences?: TargetOccurrence[]; ttsSegments?: string[] }

export type SetKey = 'set1' | 'set2'
export type StoryKey = 'story1' | 'story2'
export type SlotKey = `${SetKey}-${StoryKey}`

export const slotKey = (set: SetKey, story: StoryKey): SlotKey => `${set}-${story}` as SlotKey
