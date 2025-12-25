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
