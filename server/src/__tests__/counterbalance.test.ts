import {
  COUNTERBALANCE_CELLS,
  counterbalanceCellKey,
  selectLeastFilledCounterbalanceCell,
} from '../utils/counterbalance'

describe('four-cell counterbalancing', () => {
  it('contains every treatment-story and order combination', () => {
    expect(COUNTERBALANCE_CELLS).toEqual([
      { treatmentStory: 'A', storyOrder: 'A-first' },
      { treatmentStory: 'A', storyOrder: 'B-first' },
      { treatmentStory: 'B', storyOrder: 'A-first' },
      { treatmentStory: 'B', storyOrder: 'B-first' },
    ])
  })

  it('selects the least-filled group', () => {
    const counts = {
      'A:A-first': 4,
      'A:B-first': 3,
      'B:A-first': 2,
      'B:B-first': 3,
    }

    expect(selectLeastFilledCounterbalanceCell(counts, 'student-1')).toEqual({
      treatmentStory: 'B',
      storyOrder: 'A-first',
    })
  })

  it('uses a stable seeded choice when groups are tied', () => {
    const counts = Object.fromEntries(COUNTERBALANCE_CELLS.map((cell) => [counterbalanceCellKey(cell), 0]))

    expect(selectLeastFilledCounterbalanceCell(counts, 'student-1')).toEqual(
      selectLeastFilledCounterbalanceCell(counts, 'student-1')
    )
  })
})
