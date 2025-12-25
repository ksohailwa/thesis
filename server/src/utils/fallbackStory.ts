/**
 * Centralized fallback story generation when OpenAI is unavailable or fails.
 */

export interface FallbackStoryResult {
  paragraphs: string[];
  occurrences: Array<{
    word: string;
    paragraphIndex: number;
    sentenceIndex: number;
    charStart: number;
    charEnd: number;
  }>;
}

/**
 * Generate a minimal fallback story with target words distributed across paragraphs.
 * Each word appears exactly once per paragraph (5 times total for 5 paragraphs).
 */
export function generateFallbackStory(targetWords: string[]): FallbackStoryResult {
  const paragraphCount = 5;
  if (targetWords.length === 0) {
    return { paragraphs: [], occurrences: [] };
  }

  const sentencesPerParagraph = Math.max(4, targetWords.length);
  const baseSentences: string[][] = Array.from({ length: paragraphCount }, (_, p) =>
    Array.from(
      { length: sentencesPerParagraph },
      (_, s) => `Paragraph ${p + 1}, sentence ${s + 1}.`
    )
  );

  const occurrences: FallbackStoryResult['occurrences'] = [];
  const shuffle = (arr: string[]) => arr.sort(() => Math.random() - 0.5);
  let lastOrder: string[] | null = null;

  for (let pIdx = 0; pIdx < paragraphCount; pIdx++) {
    let order = shuffle([...targetWords]);
    // Avoid repeating the same word order in consecutive paragraphs
    if (lastOrder && order.join('|') === lastOrder.join('|')) {
      order = order.slice(1).concat(order[0]);
    }
    lastOrder = order;

    order.forEach((w, sIdx) => {
      const current = baseSentences[pIdx][sIdx];
      const insertion = ` ${w}`;
      const charStart = current.length;
      const charEnd = charStart + insertion.length;
      baseSentences[pIdx][sIdx] = current.replace(/[.!?]+$/, '') + insertion + '.';
      occurrences.push({
        word: w,
        paragraphIndex: pIdx,
        sentenceIndex: sIdx,
        charStart,
        charEnd,
      });
    });
  }

  const paragraphs = baseSentences.map((sentences) => sentences.join(' '));
  return { paragraphs, occurrences };
}
