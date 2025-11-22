export interface QualityMetrics {
  score: number;
  readability: number;
  vocabularyDiversity: number;
  targetWordDistribution: number;
  issues: string[];
}

function sentenceCount(paragraphs: string[]): number {
  return paragraphs.reduce((count, p) => count + (p.match(/[.!?]/g) || []).length, 0);
}

function uniqueWords(paragraphs: string[]): number {
  const text = paragraphs.join(' ').toLowerCase();
  const words = text.match(/\b\w+\b/g) || [];
  return new Set(words).size;
}

function averageWordLength(paragraphs: string[]): number {
  const text = paragraphs.join(' ');
  const words = text.match(/\b\w+\b/g) || [];
  if (!words.length) return 0;
  return words.reduce((sum, w) => sum + w.length, 0) / words.length;
}

export function analyzeStoryQuality(
  paragraphs: string[],
  occurrences: any[],
  targetWords: string[]
): QualityMetrics {
  const issues: string[] = [];

  const sentCount = sentenceCount(paragraphs);
  const wordCount = Math.max(paragraphs.join(' ').split(/\s+/).length, 1);
  const avgSentenceLength = wordCount / Math.max(sentCount, 1);
  const avgWordLen = averageWordLength(paragraphs);

  let readability = 100;
  if (avgSentenceLength > 20) {
    readability -= 20;
    issues.push('Sentences too long (avg > 20 words)');
  }
  if (avgWordLen > 7) {
    readability -= 10;
    issues.push('Words too complex (avg length > 7)');
  }

  const unique = uniqueWords(paragraphs);
  const diversity = Math.min(100, (unique / wordCount) * 100 * 1.5);

  const occCounts = new Map<string, number>();
  occurrences.forEach((o) => occCounts.set(o.word, (occCounts.get(o.word) || 0) + 1));

  let distribution = 100;
  targetWords.forEach((w) => {
    const count = occCounts.get(w) || 0;
    if (count !== 4) {
      distribution -= 25;
      issues.push(`Word "${w}" appears ${count} times (expected 4)`);
    }
  });

  const score = Math.round(readability * 0.3 + diversity * 0.3 + distribution * 0.4);

  return {
    score,
    readability,
    vocabularyDiversity: diversity,
    targetWordDistribution: distribution,
    issues,
  };
}
