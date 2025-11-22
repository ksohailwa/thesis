export type Phase = 'baseline' | 'learning' | 'reinforcement' | 'recall';

export function getPhaseForOccurrence(occurrenceIndex: number): Phase {
  if (occurrenceIndex <= 1) return 'baseline';
  if (occurrenceIndex === 2) return 'learning';
  if (occurrenceIndex === 3) return 'reinforcement';
  return 'recall';
}

export function getPhaseDescription(phase: Phase): string {
  switch (phase) {
    case 'baseline':
      return 'Prior Knowledge Assessment';
    case 'learning':
      return 'Learning Phase (First Practice)';
    case 'reinforcement':
      return 'Reinforcement Phase (Second Practice)';
    case 'recall':
      return 'Immediate Recall Assessment';
    default:
      return '';
  }
}

export function shouldShowHints(phase: Phase, condition: string): boolean {
  if (condition !== 'with-hints') return false;
  return phase === 'learning' || phase === 'reinforcement';
}

