export type SummaryData = {
  experiment: { _id: string; title: string; status: string }
  counts: {
    students: number
    attempts: number
    correctRate: number
    hints: number
    definitionAccuracy: number
    recallAvg: number
  }
  byStory: {
    A: { attempts: number; accuracy: number }
    B: { attempts: number; accuracy: number }
  }
  funnel: {
    joined: number
    story1: number
    story2: number
    breakDone: number
    recall: number
  }
  funnelByCondition?: {
    treatment: { joined: number; story1: number; story2: number; breakDone: number; recall: number }
    control: { joined: number; story1: number; story2: number; breakDone: number; recall: number }
  }
  students: Array<{
    studentId: string
    username: string
    condition: string
    // Phase details
    storyOrder: 'A-first' | 'B-first' | null
    hintsStory: 'A' | 'B' | null
    phase1Condition: 'treatment' | 'control' | null
    phase1Story: 'A' | 'B' | null
    phase2Condition: 'treatment' | 'control' | null
    phase2Story: 'A' | 'B' | null
    // Per-story metrics
    storyAAccuracy: number
    storyBAccuracy: number
    timeStoryAMin: number
    timeStoryBMin: number
    // Overall metrics
    attempts: number
    accuracy: number
    hints: number
    definitionAccuracy: number
    recallAvg: number
    timeOnTaskMin?: number
    // Mental effort
    avgMentalEffort: number | null
    // Delayed test
    delayedTestCompleted: boolean
    delayedTestScore: number | null
  }>
  words: Array<{ word: string; attempts: number; accuracy: number }>
  timeline: Array<{
    day: string
    attempts: number
    correct: number
    hints: number
    definitions: number
    recall: number
  }>
  timeOnTask: Array<{
    studentId: string
    username: string
    minutes: number
    firstTs: string | null
    lastTs: string | null
  }>
  confusions: Array<{
    word: string
    attempts: number
    topMisspellings: Array<{ text: string; count: number }>
  }>
  dataQuality: {
    totalEvents: number
    missingExperiment: number
    missingStudent: number
    missingStory: number
    missingTimestamp: number
  }
  comparisons: Array<{
    condition: string
    story: string
    attempts: number
    accuracy: number
    hints: number
  }>
}

export type ExperimentsSummary = Array<{
  experimentId: string
  title: string
  status: string
  students: number
  attempts: number
  correctRate: number
  recallAvg: number
}>

export type FiltersState = {
  from: string
  to: string
  story: string
  condition: string
}

export type StudentDetail = {
  student: SummaryData['students'][number] | null
  words: SummaryData['words']
  timeline: SummaryData['timeline']
  counts: SummaryData['counts']
  byStory: SummaryData['byStory']
  confusions: SummaryData['confusions']
}

// Offloading analytics types
export type OffloadingRow = {
  studentId: string
  username: string
  condition: 'treatment' | 'control' | 'unknown'
  offloadingScore: number | null
  attempts: number
  hints: number
  hintRate: number
  reveals: number
  revealRate: number
  delayedRecallAvg: number | null
}

export type OffloadingAnalytics = {
  perStudent: OffloadingRow[]
  distribution: number[]
  correlations: {
    offloading_hintRate: number | null
    offloading_revealRate: number | null
    offloading_delayedRecall: number | null
  }
  moderation: {
    median: number
    low: { treatment: number | null; control: number | null; diff: number | null }
    high: { treatment: number | null; control: number | null; diff: number | null }
    diffInDiff: number | null
  } | null
  cronbachAlpha: number | null
  surveyCount: number
  effectSize?: {
    type: 'hedges_g'
    g: number
    ci: [number, number]
    treatment: { n: number; mean: number; sd: number }
    control: { n: number; mean: number; sd: number }
  }
}
