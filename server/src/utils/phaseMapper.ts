export type Phase = 'baseline' | 'learning' | 'reinforcement' | 'recall';

export function getPhaseForOccurrence(occurrenceIndex: number): Phase | undefined {
  switch (occurrenceIndex) {
    case 1: return 'baseline';
    case 2: return 'learning';
    case 3: return 'reinforcement';
    case 4: return 'recall';
    default: return undefined;
  }
}