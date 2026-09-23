import { splitSentences } from '../utils/sentenceSplitter'

describe('splitSentences', () => {
  it('does not split after common abbreviations', () => {
    expect(splitSentences('Dr. Smith reviewed the case. Mr. Jones agreed.')).toEqual([
      'Dr. Smith reviewed the case.',
      'Mr. Jones agreed.',
    ])
  })

  it('does not split inside e.g. or i.e.', () => {
    expect(splitSentences('Use e.g. this example. It is clear.')).toEqual([
      'Use e.g. this example.',
      'It is clear.',
    ])
  })
})
