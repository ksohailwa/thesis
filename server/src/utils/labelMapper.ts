export type StoryLabel = '1' | '2' | 'H' | 'N' | 'A' | 'B' | 'story1' | 'story2';
export type StoryKey = 'story1' | 'story2';
export type DbLabel = 'A' | 'B';

export function toStoryKey(label: StoryLabel): StoryKey {
  return label === '1' || label === 'H' || label === 'A' || label === 'story1' ? 'story1' : 'story2';
}

export function toDbLabel(label: StoryLabel): DbLabel {
  return label === '1' || label === 'H' || label === 'A' || label === 'story1' ? 'A' : 'B';
}

export function toApiLabel(label: StoryLabel): '1' | '2' {
  return label === '1' || label === 'H' || label === 'A' || label === 'story1' ? '1' : '2';
}

export function toConditionLabel(label: StoryLabel): 'H' | 'N' {
  return label === '1' || label === 'H' || label === 'A' || label === 'story1' ? 'H' : 'N';
}
