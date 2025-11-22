export type Phase = 'baseline' | 'learning' | 'reinforcement' | 'recall';

export interface TargetOccurrence {
  word: string;
  paragraphIndex: number;
  sentenceIndex: number;
}

export interface PhasePlacement {
  phase: Phase;
  paragraphIndex?: number;
  sentenceIndex?: number;
}

// Given a list of paragraphs and occurrences, choose distinct sentence placements per phase.
// Ensures a target word appears in different sentences/paragraphs for baseline, learning, reinforcement.
// Recall has no sentence placement.
export function scheduleWordPhases(
  word: string,
  occurrences: TargetOccurrence[],
  paragraphCount: number
): Record<Phase, PhasePlacement> {
  const out: Record<Phase, PhasePlacement> = {
    baseline: { phase: 'baseline' },
    learning: { phase: 'learning' },
    reinforcement: { phase: 'reinforcement' },
    recall: { phase: 'recall' },
  };
  const uniqByKey = new Map<string, TargetOccurrence>();
  occurrences.forEach((o) => uniqByKey.set(`${o.paragraphIndex}:${o.sentenceIndex}`, o));
  const uniq = Array.from(uniqByKey.values());
  // Prefer occurrences in distinct paragraphs
  uniq.sort((a, b) => a.paragraphIndex - b.paragraphIndex || a.sentenceIndex - b.sentenceIndex);
  const picks: TargetOccurrence[] = [];
  for (const o of uniq) {
    if (
      picks.length === 0 ||
      !picks.some(
        (p) => p.paragraphIndex === o.paragraphIndex && p.sentenceIndex === o.sentenceIndex
      )
    ) {
      picks.push(o);
    }
    if (picks.length >= 3) break;
  }
  // If less than 3 unique occurrences, synthesize additional placements by scanning nearby paragraphs
  let cursor = 0;
  while (picks.length < 3 && cursor < paragraphCount) {
    const pi = cursor % Math.max(1, paragraphCount);
    if (!picks.some((p) => p.paragraphIndex === pi)) {
      picks.push({ word, paragraphIndex: pi, sentenceIndex: 0 });
    }
    cursor++;
  }
  out.baseline = {
    phase: 'baseline',
    paragraphIndex: picks[0]?.paragraphIndex,
    sentenceIndex: picks[0]?.sentenceIndex,
  };
  out.learning = {
    phase: 'learning',
    paragraphIndex: picks[1]?.paragraphIndex,
    sentenceIndex: picks[1]?.sentenceIndex,
  };
  out.reinforcement = {
    phase: 'reinforcement',
    paragraphIndex: picks[2]?.paragraphIndex,
    sentenceIndex: picks[2]?.sentenceIndex,
  };
  out.recall = { phase: 'recall' };
  return out;
}

export function buildPhaseSchedule(
  targetWords: string[],
  allOccurrences: TargetOccurrence[],
  paragraphCount: number
): Record<string, Record<Phase, PhasePlacement>> {
  const byWord = new Map<string, TargetOccurrence[]>();
  allOccurrences.forEach((o) => {
    const arr = byWord.get(o.word) || [];
    arr.push(o);
    byWord.set(o.word, arr);
  });
  const result: Record<string, Record<Phase, PhasePlacement>> = {};
  for (const w of targetWords) {
    result[w] = scheduleWordPhases(w, byWord.get(w) || [], paragraphCount);
  }
  return result;
}
