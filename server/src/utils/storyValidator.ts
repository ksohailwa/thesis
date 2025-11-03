export interface Occurrence { word: string; paragraphIndex: number; sentenceIndex: number }

export interface StoryShape {
  paragraphs: string[];
  targetOccurrences: Occurrence[];
}

export interface StoriesPayload {
  storyA: StoryShape;
  storyB: StoryShape;
}

export interface ValidationResult {
  ok: boolean;
  violations: string[];
}

function countWord(occ: Occurrence[], word: string): number {
  return occ.filter(o => o.word === word).length;
}

export function validateStories(targetWords: string[], payload: StoriesPayload): ValidationResult {
  const v: string[] = [];
  const A = payload.storyA;
  const B = payload.storyB;

  // Basic structure checks
  if (!Array.isArray(A?.paragraphs) || !Array.isArray(B?.paragraphs)) v.push('Paragraphs missing or not arrays.');
  if (!Array.isArray(A?.targetOccurrences) || !Array.isArray(B?.targetOccurrences)) v.push('targetOccurrences missing or not arrays.');
  const occA = (A?.targetOccurrences || []) as Occurrence[];
  const occB = (B?.targetOccurrences || []) as Occurrence[];

  // Helper to check rules per story
  const checkStory = (name: 'A'|'B', occ: Occurrence[]) => {
    // Count: exactly 2 per word
    for (const w of targetWords) {
      const c = countWord(occ, w);
      if (c !== 2) v.push(`Story ${name}: word "${w}" must appear exactly 2 times (got ${c}).`);
    }
    // Non-adjacency and no same sentence duplicates for same word
    const byWord: Record<string, Occurrence[]> = {};
    occ.forEach(o => { (byWord[o.word] ||= []).push(o); });
    for (const [w, list] of Object.entries(byWord)) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i], b = list[j];
          if (a.paragraphIndex === b.paragraphIndex && a.sentenceIndex === b.sentenceIndex) v.push(`Story ${name}: word "${w}" appears twice in same sentence P${a.paragraphIndex} S${a.sentenceIndex}.`);
          if (a.paragraphIndex === b.paragraphIndex && Math.abs(a.sentenceIndex - b.sentenceIndex) === 1) v.push(`Story ${name}: word "${w}" appears in adjacent sentences in paragraph ${a.paragraphIndex}.`);
        }
      }
    }
    // Enforce per-word occurrences in different paragraphs
    for (const [w, list] of Object.entries(byWord)) {
      const paraSet = new Set(list.map(o => o.paragraphIndex));
      if (paraSet.size < list.length) v.push(`Story ${name}: word "${w}" occurrences must be in different paragraphs.`);
    }
    // Across-words: do not place two different words in the same sentence
    const byPos: Record<string, string[]> = {};
    occ.forEach(o => {
      const key = `${o.paragraphIndex}:${o.sentenceIndex}`;
      (byPos[key] ||= []).push(o.word);
    });
    for (const [key, words] of Object.entries(byPos)) {
      const unique = Array.from(new Set(words));
      if (unique.length > 1) v.push(`Story ${name}: multiple different target words share the same sentence at ${key}.`);
    }
  };

  checkStory('A', occA);
  checkStory('B', occB);

  // Cross-story: avoid identical positions for the same word (same paragraphIndex & sentenceIndex across A and B)
  const keySetA = new Map<string, string>();
  for (const o of occA) keySetA.set(`${o.word}|${o.paragraphIndex}|${o.sentenceIndex}`, '1');
  for (const o of occB) {
    const key = `${o.word}|${o.paragraphIndex}|${o.sentenceIndex}`;
    if (keySetA.has(key)) v.push(`Cross-story: word "${o.word}" appears at identical position in A and B (P${o.paragraphIndex} S${o.sentenceIndex}).`);
  }

  return { ok: v.length === 0, violations: v };
}
