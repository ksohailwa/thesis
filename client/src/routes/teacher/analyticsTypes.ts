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
  students: Array<{
    studentId: string
    username: string
    condition: string
    attempts: number
    accuracy: number
    hints: number
    definitionAccuracy: number
    recallAvg: number
    timeOnTaskMin?: number
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
