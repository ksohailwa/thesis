export interface Occurrence {
  word: string;
  paragraphIndex: number;
  sentenceIndex: number;
}

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
  return occ.filter((o) => o.word === word).length;
}

export function validateStories(targetWords: string[], payload: StoriesPayload): ValidationResult {
  const v: string[] = [];
  const A = payload.storyA;
  const B = payload.storyB;

  // Basic structure checks
  if (!Array.isArray(A?.paragraphs) || !Array.isArray(B?.paragraphs))
    v.push('Paragraphs missing or not arrays.');
  if (!Array.isArray(A?.targetOccurrences) || !Array.isArray(B?.targetOccurrences))
    v.push('targetOccurrences missing or not arrays.');
  if ((A?.paragraphs?.length || 0) !== 5) v.push('Story A must have exactly 5 paragraphs.');
  if ((B?.paragraphs?.length || 0) !== 5) v.push('Story B must have exactly 5 paragraphs.');
  const occA = (A?.targetOccurrences || []) as Occurrence[];
  const occB = (B?.targetOccurrences || []) as Occurrence[];

  // Helper to check rules per story
  const checkStory = (name: 'A' | 'B', occ: Occurrence[]) => {
    // Count: exactly 5 per word (1 per paragraph for that word)
    for (const w of targetWords) {
      const c = countWord(occ, w);
      if (c !== 5) v.push(`Story ${name}: word "${w}" must appear exactly 5 times (got ${c}).`);
    }
    // Per-paragraph cap: no more than 1 occurrence of the same word in a paragraph
    const byParaWord: Record<string, number> = {};
    occ.forEach((o) => {
      const key = `${o.paragraphIndex}:${o.word}`;
      byParaWord[key] = (byParaWord[key] || 0) + 1;
    });
    for (const [key, count] of Object.entries(byParaWord)) {
      const [pIdx, word] = key.split(':');
      if (count > 1) {
        v.push(
          `Story ${name}: word "${word}" appears ${count} times in paragraph ${pIdx} (max 1).`
        );
      }
    }

    // No sentence may contain different target words
    // Across-words: do not place two different words in the same sentence
    const byPos: Record<string, string[]> = {};
    occ.forEach((o) => {
      const key = `${o.paragraphIndex}:${o.sentenceIndex}`;
      (byPos[key] ||= []).push(o.word);
    });
    for (const [key, words] of Object.entries(byPos)) {
      const unique = Array.from(new Set(words));
      if (unique.length > 1)
        v.push(`Story ${name}: multiple different target words share the same sentence at ${key}.`);
    }
  };

  checkStory('A', occA);
  checkStory('B', occB);

  // Cross-story: avoid identical positions for the same word (same paragraphIndex & sentenceIndex across A and B)
  const keySetA = new Map<string, string>();
  for (const o of occA) keySetA.set(`${o.word}|${o.paragraphIndex}|${o.sentenceIndex}`, '1');
  for (const o of occB) {
    const key = `${o.word}|${o.paragraphIndex}|${o.sentenceIndex}`;
    if (keySetA.has(key))
      v.push(
        `Cross-story: word "${o.word}" appears at identical position in A and B (P${o.paragraphIndex} S${o.sentenceIndex}).`
      );
  }

  return { ok: v.length === 0, violations: v };
}
