/**
 * Type definitions for API request and response bodies.
 * Reduces reliance on `any` types throughout routes.
 */

// ============================================================================
// Experiment Requests
// ============================================================================

export interface CreateExperimentRequest {
  title: string;
  description?: string;
  level?: string;
  cefr?: string;
}

export interface UpdateTargetWordsRequest {
  targetWords: string[];
}

export interface StoryWordsRequest {
  story: 'story1' | 'story2';
  targetWords: string[];
  set?: 'set1' | 'set2';
}

export interface WordSuggestionsRequest {
  story?: 'story1' | 'story2';
}

export interface GenerateStoriesRequest {
  cefr?: string;
  targetWords?: string[];
  topic?: string;
}

export interface GenerateStoryRequest {
  label: 'H' | 'N' | 'A' | 'B' | '1' | '2' | 'story1' | 'story2';
  targetWords?: string[];
  topic?: string;
  set?: 'set1' | 'set2';
}

export interface ExperimentStatusRequest {
  status: 'live' | 'closed';
}

// ============================================================================
// Student Requests
// ============================================================================

export interface StudentJoinRequest {
  code: string;
}

export interface StudentAttemptRequest {
  experimentId: string;
  word: string;
  attempt: string;
  correct: boolean;
  story: 'A' | 'B' | 'H' | 'N';
  occurrenceIndex: number;
}

export interface StudentHintRequest {
  experimentId: string;
  targetWord: string;
  occurrenceIndex: number;
  abCondition?: 'with-hints' | 'without-hints';
  attemptCount?: number;
  timeSpentMs?: number;
  latestAttempt?: string;
}

export interface StudentEventsRequest {
  experimentId?: string;
  events: Array<{
    type: string;
    ts?: number;
    payload?: Record<string, unknown>;
    experimentId?: string;
  }>;
}

export interface StudentFeedbackRequest {
  experimentId: string;
  storyKey: string;
  condition: 'with-hints' | 'without-hints';
  storyIndex?: number;
  [key: string]: unknown;
}

export interface StudentSubmitRequest {
  experimentId: string;
  totalCorrect?: number;
  totalAttempts?: number;
}

// ============================================================================
// Story Requests
// ============================================================================

export interface GenerateTextRequest {
  level: string;
  targetWords: string[];
  topic?: string;
}

export interface TTSRequest {
  paragraphs: string[];
}

export interface StoryTemplateRequest {
  title: string;
  language: string;
  difficulty: string;
  targetWords: string[];
  prompt: string;
  storyText: string;
  condition: string;
}

// ============================================================================
// Job Requests
// ============================================================================

export interface JobQueueRequest {
  type: 'fetch_words' | 'generate_story' | 'generate_tts';
  experimentId: string;
  storyLabel?: 'story1' | 'story2';
  set?: 'set1' | 'set2';
  targetWords?: string[];
  regenerate?: boolean;
}

// ============================================================================
// Analytics Requests
// ============================================================================

export interface AnalyticsFilters {
  condition?: string;
  studentId?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Data Models (for type safety in processing)
// ============================================================================

export interface StoryOccurrence {
  word: string;
  paragraphIndex: number;
  sentenceIndex?: number;
  charStart?: number;
  charEnd?: number;
}

export interface TargetWordData {
  word: string;
  level?: string;
  gloss?: string;
  reason?: string;
}

export interface StudentSession {
  _id?: string;
  student: string;
  experiment: string;
  code: string;
  storyOrder?: 'A-first' | 'B-first';
  hintsStory?: 'A' | 'B';
  condition?: unknown;
  createdAt?: Date;
  breakUntil?: Date;
}

export interface ExperimentStories {
  story1?: {
    targetWords?: string[];
  };
  story2?: {
    targetWords?: string[];
  };
}

export interface StoryData {
  paragraphs: string[];
  targetOccurrences?: StoryOccurrence[];
  noiseOccurrences?: StoryOccurrence[];
  targetWords?: string[];
  noiseWords?: string[];
}

// ============================================================================
// Response Models
// ============================================================================

export interface SuggestionsResponse {
  suggestions: string[];
  items: TargetWordData[];
}

export interface StoryResponse {
  ok?: boolean;
  used?: 'openai' | 'mock';
  paragraphs: string[];
  occurrences?: StoryOccurrence[];
  noiseOccurrences?: StoryOccurrence[];
}

export interface HintResponse {
  hint: string;
}

export interface StudentSessionResponse {
  sessionId: string;
  experimentId: string;
  story: StoryData;
  occurrences: StoryOccurrence[];
  noiseOccurrences?: StoryOccurrence[];
  hintsEnabled: boolean;
}

// ============================================================================
// Error Response
// ============================================================================

export interface ErrorResponse {
  error: string;
  details?: Record<string, unknown>;
  code?: string;
}

// ============================================================================
// Word Occurrence Types
// ============================================================================

export interface WordOccurrence {
  word: string;
  paragraphIndex: number;
  sentenceIndex?: number;
  charStart?: number;
  charEnd?: number;
}

export interface NoiseWord {
  word: string;
  paragraphIndex: number;
}

export interface NoiseOccurrence extends WordOccurrence {
  sentenceIndex: number;
  charStart: number;
  charEnd: number;
}

// ============================================================================
// Story Types
// ============================================================================

export interface StoryParagraphCue {
  paragraphIndex: number;
  sentenceIndex: number;
  startSec: number;
  endSec: number;
}

export interface StoryWithOccurrences {
  paragraphs: string[];
  occurrences: WordOccurrence[];
  noiseOccurrences: WordOccurrence[];
}

export interface TTSSegment {
  startTime: number;
  endTime: number;
  text: string;
}

// ============================================================================
// Assignment Types
// ============================================================================

export type StoryOrder = 'A-first' | 'B-first';
export type HintsStory = 'A' | 'B';
export type ConditionType = 'with-hints' | 'without-hints';
export type StoryLabel = 'A' | 'B' | 'H' | 'N' | '1' | '2' | 'story1' | 'story2';

export interface WordScheduleEntry {
  story?: HintsStory;
  paragraphIndex?: number;
  sentenceIndex?: number;
}

export interface WordScheduleOccurrence {
  story: HintsStory;
  occurrence: number;
  paragraphIndex: number;
  sentenceIndex: number;
}

export interface WordSchedule {
  baseline: WordScheduleEntry;
  learning: WordScheduleEntry;
  reinforcement: WordScheduleEntry;
  recall: WordScheduleEntry;
  occurrences: WordScheduleOccurrence[];
}

// ============================================================================
// Join Response Types
// ============================================================================

export interface JoinResponse {
  assignmentId: string;
  experimentId?: string;
  condition: string;
  storyOrder: StoryOrder;
  hintsEnabledByStory: { A: boolean; B: boolean };
  breakUntil?: string;
  story1: StoryWithOccurrences;
  story2: StoryWithOccurrences;
  tts1Url: string;
  tts2Url: string;
  tts1Segments: TTSSegment[];
  tts2Segments: TTSSegment[];
  cues1: StoryParagraphCue[];
  cues2: StoryParagraphCue[];
  schedule: Record<string, WordSchedule>;
}

// ============================================================================
// Attempt Types
// ============================================================================

export interface AttemptEntry {
  text: string;
  timestamp: Date;
  correctnessByPosition?: number[];
}

export interface AttemptDocument {
  session: string;
  student: string;
  storyTemplate?: string;
  taskType: string;
  targetWord: string;
  phase?: string;
  condition?: string;
  abCondition?: ConditionType;
  attempts: AttemptEntry[];
  score?: number;
  hintCount?: number;
  revealed?: boolean;
  finalText?: string;
  createdAt?: Date;
}

// ============================================================================
// Event Types
// ============================================================================

export interface EventPayload {
  word?: string;
  attempt?: string;
  correct?: boolean;
  story?: StoryLabel;
  occurrenceIndex?: number;
  storyLabel?: string;
  paragraphIndex?: number;
  results?: unknown[];
  scores?: unknown[];
  stage?: string;
  locale?: string;
  [key: string]: unknown;
}

export interface EventDocument {
  session?: string;
  student?: string;
  experiment?: string;
  taskType: string;
  targetWord?: string;
  type: string;
  payload?: EventPayload;
  ts: Date;
}

// ============================================================================
// Hint Types
// ============================================================================

export type HintStage = 'orthographic' | 'phoneme' | 'semantic' | 'morphology';

export interface HintUI {
  type: 'orthographic-highlight';
  indices: number[];
}

export interface HintResponse {
  hint: string;
  stage?: HintStage;
  used?: 'openai' | 'mock';
  ui?: HintUI;
  demo?: boolean;
}

// ============================================================================
// Definition Types
// ============================================================================

export interface DefinitionAnswer {
  word: string;
  definition: string;
}

export interface DefinitionResult {
  word: string;
  correct: boolean | null;
  feedback: string;
  isTarget?: boolean;
}

// ============================================================================
// Recall Types
// ============================================================================

export interface RecallItem {
  targetWord: string;
  text: string;
}

export interface RecallScore {
  targetWord?: string;
  word?: string;
  score: number;
}

export interface RecallListItem {
  word: string;
  audioUrl: string | null;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface AnalyticsTimelineEntry {
  day: string;
  attempts: number;
  correct: number;
  hints: number;
  definitions: number;
  recall: number;
}

export interface AnalyticsStudentEntry {
  studentId: string;
  username: string;
  condition: string;
  attempts: number;
  accuracy: number;
  hints: number;
  definitionAccuracy: number;
  recallAvg: number;
  timeOnTaskMin: number;
}

export interface AnalyticsWordEntry {
  word: string;
  attempts: number;
  accuracy: number;
}

export interface AnalyticsConfusionEntry {
  word: string;
  attempts: number;
  topMisspellings: Array<{ text: string; count: number }>;
}

export interface AnalyticsTimeOnTaskEntry {
  studentId: string;
  username: string;
  minutes: number;
}

// ============================================================================
// LLM Response Types
// ============================================================================

export interface LLMNoiseWordsResponse {
  noiseWords: NoiseWord[];
}

export interface LLMDefinitionResponse {
  correct: boolean;
  feedback: string;
}

export interface LLMWordSuggestionsResponse {
  items: Array<{
    word: string;
    level?: string;
    gloss?: string;
    reason?: string;
  }>;
}

// ============================================================================
// Test Attempt Types
// ============================================================================

export interface TestAttemptRequest {
  assignmentId: string;
  storyLabel: string;
  word: string;
  occurrenceIndex: number;
  text: string;
}

export interface TestAttemptResponse {
  isCorrect: boolean;
  correctnessByPosition: number[];
  canHint: boolean;
}

export interface TestHintRequest {
  targetWord: string;
  latestAttempt?: string;
  occurrenceIndex?: number;
  uiLanguage?: string;
}
