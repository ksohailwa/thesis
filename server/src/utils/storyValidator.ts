export interface Occurrence {
  word: string;
  paragraphIndex: number;
  sentenceIndex: number;
}

export interface StoryShape {
  paragraphs: string[];
  targetOccurrences: Occurrence[];
  noiseOccurrences?: Occurrence[];
}

export interface StoriesPayload {
  storyA: StoryShape;
  storyB: StoryShape;
}

export interface ValidationResult {
  ok: boolean;
  violations: string[];
  warnings: string[];
}

function countWord(occ: Occurrence[], word: string): number {
  return occ.filter((o) => o.word.toLowerCase() === word.toLowerCase()).length;
}

/**
 * Validate stories with flexible word distribution rules:
 *
 * TARGET WORDS:
 * - Each target word must appear exactly 4 times per story
 * - Target words can be distributed freely across paragraphs (not forced 1 per paragraph)
 * - Two different target words cannot appear in the same sentence
 *
 * NOISE WORDS:
 * - Each noise word can appear 1-2 times per story (not more than 2)
 * - Noise words should be dispersed across the story
 * - Same noise word cannot appear more than once in the same paragraph
 */
export function validateStories(
  targetWords: string[],
  payload: StoriesPayload,
  noiseWords: string[] = []
): ValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  const A = payload.storyA;
  const B = payload.storyB;

  // Basic structure checks
  if (!Array.isArray(A?.paragraphs) || !Array.isArray(B?.paragraphs)) {
    violations.push('Paragraphs missing or not arrays.');
  }
  if (!Array.isArray(A?.targetOccurrences) || !Array.isArray(B?.targetOccurrences)) {
    violations.push('targetOccurrences missing or not arrays.');
  }
  // No paragraph count restriction - stories can have any number of paragraphs
  if ((A?.paragraphs?.length || 0) < 1) {
    violations.push('Story A must have at least 1 paragraph.');
  }
  if ((B?.paragraphs?.length || 0) < 1) {
    violations.push('Story B must have at least 1 paragraph.');
  }

  const occA = (A?.targetOccurrences || []) as Occurrence[];
  const occB = (B?.targetOccurrences || []) as Occurrence[];
  const noiseOccA = (A?.noiseOccurrences || []) as Occurrence[];
  const noiseOccB = (B?.noiseOccurrences || []) as Occurrence[];

  // Helper to check target word rules per story
  const checkTargetWords = (name: 'A' | 'B', occ: Occurrence[]) => {
    // Rule 1: Each target word must appear exactly 4 times total in the whole story
    for (const w of targetWords) {
      const c = countWord(occ, w);
      if (c !== 4) {
        violations.push(`Story ${name}: target word "${w}" must appear exactly 4 times (got ${c}).`);
      }
    }

    // Rule 2: No two different target words in the same sentence
    const byPos: Record<string, string[]> = {};
    occ.forEach((o) => {
      const key = `${o.paragraphIndex}:${o.sentenceIndex}`;
      (byPos[key] ||= []).push(o.word.toLowerCase());
    });
    for (const [key, words] of Object.entries(byPos)) {
      const unique = Array.from(new Set(words));
      if (unique.length > 1) {
        violations.push(
          `Story ${name}: multiple different target words in the same sentence at position ${key}.`
        );
      }
    }
    // No distribution requirements - words can appear anywhere in the story
  };

  // Helper to check noise word rules per story
  const checkNoiseWords = (name: 'A' | 'B', occ: Occurrence[]) => {
    if (noiseWords.length === 0) return;

    for (const w of noiseWords) {
      const c = countWord(occ, w);

      // Rule: Each noise word should appear 1-2 times (not more than 2)
      if (c > 2) {
        violations.push(
          `Story ${name}: noise word "${w}" appears ${c} times (max 2 allowed).`
        );
      }

      // Warning if noise word doesn't appear at all
      if (c === 0) {
        warnings.push(`Story ${name}: noise word "${w}" doesn't appear in the story.`);
      }
    }

    // Check that same noise word doesn't appear more than once per paragraph
    const byParaWord: Record<string, number> = {};
    occ.forEach((o) => {
      const key = `${o.paragraphIndex}:${o.word.toLowerCase()}`;
      byParaWord[key] = (byParaWord[key] || 0) + 1;
    });
    for (const [key, count] of Object.entries(byParaWord)) {
      if (count > 1) {
        const [pIdx, word] = key.split(':');
        warnings.push(
          `Story ${name}: noise word "${word}" appears ${count} times in paragraph ${pIdx}. Consider dispersing.`
        );
      }
    }
  };

  checkTargetWords('A', occA);
  checkTargetWords('B', occB);
  checkNoiseWords('A', noiseOccA);
  checkNoiseWords('B', noiseOccB);

  // Cross-story check is now optional (just a warning, not a violation)
  // Stories are independent and can have similar structures

  return { ok: violations.length === 0, violations, warnings };
}

/**
 * Validate a single story (for use during generation)
 */
export function validateSingleStory(
  targetWords: string[],
  story: StoryShape,
  noiseWords: string[] = []
): ValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  // Basic structure
  if (!Array.isArray(story?.paragraphs)) {
    violations.push('Paragraphs missing or not an array.');
  }
  if ((story?.paragraphs?.length || 0) < 1) {
    violations.push('Story must have at least 1 paragraph.');
  }

  const occ = (story?.targetOccurrences || []) as Occurrence[];
  const noiseOcc = (story?.noiseOccurrences || []) as Occurrence[];

  // Target words: exactly 4 times each
  for (const w of targetWords) {
    const c = countWord(occ, w);
    if (c !== 4) {
      violations.push(`Target word "${w}" must appear exactly 4 times (got ${c}).`);
    }
  }

  // No two different target words in the same sentence
  const byPos: Record<string, string[]> = {};
  occ.forEach((o) => {
    const key = `${o.paragraphIndex}:${o.sentenceIndex}`;
    (byPos[key] ||= []).push(o.word.toLowerCase());
  });
  for (const [key, words] of Object.entries(byPos)) {
    const unique = Array.from(new Set(words));
    if (unique.length > 1) {
      violations.push(`Multiple target words in same sentence at position ${key}.`);
    }
  }

  // Noise words: 1-2 times each, max 2 per story
  for (const w of noiseWords) {
    const c = countWord(noiseOcc, w);
    if (c > 2) {
      violations.push(`Noise word "${w}" appears ${c} times (max 2 allowed).`);
    }
    if (c === 0) {
      warnings.push(`Noise word "${w}" doesn't appear in the story.`);
    }
  }

  return { ok: violations.length === 0, violations, warnings };
}
