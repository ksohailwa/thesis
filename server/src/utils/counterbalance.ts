export type CounterbalanceStory = 'A' | 'B'
export type CounterbalanceOrder = 'A-first' | 'B-first'

export type CounterbalanceCell = {
  treatmentStory: CounterbalanceStory
  storyOrder: CounterbalanceOrder
}

export const COUNTERBALANCE_CELLS: CounterbalanceCell[] = [
  { treatmentStory: 'A', storyOrder: 'A-first' },
  { treatmentStory: 'A', storyOrder: 'B-first' },
  { treatmentStory: 'B', storyOrder: 'A-first' },
  { treatmentStory: 'B', storyOrder: 'B-first' },
]

export function counterbalanceCellKey(cell: CounterbalanceCell) {
  return `${cell.treatmentStory}:${cell.storyOrder}`
}

function stableHash(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

export function selectLeastFilledCounterbalanceCell(
  counts: Record<string, number>,
  seed: string
): CounterbalanceCell {
  const smallestCount = Math.min(
    ...COUNTERBALANCE_CELLS.map((cell) => counts[counterbalanceCellKey(cell)] || 0)
  )
  const candidates = COUNTERBALANCE_CELLS.filter(
    (cell) => (counts[counterbalanceCellKey(cell)] || 0) === smallestCount
  )

  return candidates[stableHash(seed) % candidates.length]
}
