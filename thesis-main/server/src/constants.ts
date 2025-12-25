/**
 * Server-side constants and configuration values.
 * Centralized to avoid magic numbers scattered throughout the codebase.
 */

// ============================================================================
// Server Configuration
// ============================================================================

export const SERVER = {
  // Default port (can be overridden by PORT env var)
  DEFAULT_PORT: 4000,

  // Environment
  DEFAULT_ENV: 'development',
};

// ============================================================================
// Rate Limiting
// ============================================================================

export const RATE_LIMIT = {
  // Auth endpoints: 10 attempts per 15 minutes
  AUTH_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  AUTH_MAX_ATTEMPTS: 10,

  // Heavy operations (story/TTS generation): 4 jobs per 15 minutes
  HEAVY_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  HEAVY_MAX_JOBS: 4,
};

// ============================================================================
// Story Generation
// ============================================================================

export const STORY = {
  // Standard story structure
  PARAGRAPH_COUNT: 5,
  MIN_SENTENCES_PER_PARAGRAPH: 4,

  // Target words per story
  MAX_TARGET_WORDS: 5,
  TARGET_WORD_OCCURRENCES: 5, // Each word appears exactly 5 times (once per paragraph)

  // Validation
  MIN_TARGET_WORDS: 1,
  MAX_STORIES_VARIANTS: 2, // A & B (hint vs no-hint)

  // Pagination for demo
  DEMO_RECENT_LIMIT: 5,
};

// ============================================================================
// Spelling Exercise Phases
// ============================================================================

export const SPELL_PHASE = {
  // Occurrence index starts at 1
  BASELINE: 1,
  LEARNING_START: 2,
  LEARNING_END: 3,
  RECALL: 4,
  FINAL_REPEAT: 5,

  // Hints disabled from occurrence 5 onwards
  HINTS_DISABLED_FROM: 5,
  HINTS_DISABLED_THRESHOLD: 5,

  // Phase names for logging/tracking
  PHASES: {
    BASELINE: 'baseline',
    LEARNING: 'learning',
    REINFORCEMENT: 'reinforcement',
    RECALL: 'recall',
  } as const,
};

// ============================================================================
// Word Analytics
// ============================================================================

export const WORD = {
  // Difficulty scoring
  DIFFICULTY_MIN: 1,
  DIFFICULTY_MAX: 5,

  // Letter matching
  LEVENSHTEIN_THRESHOLD: 0.8, // 80% similarity for fuzzy match

  // Word validation
  MIN_LENGTH: 1,
  MAX_LENGTH: 100,

  // Feedback scoring
  ENJOYMENT_MIN: 1,
  ENJOYMENT_MAX: 5,
};

// ============================================================================
// Student Answers & Feedback
// ============================================================================

export const ATTEMPT = {
  // Occurrence index validation
  MIN_OCCURRENCE: 1,
  MAX_OCCURRENCE: 5,

  // Scoring
  PERFECT_SCORE: 1.0,
  MIN_SCORE: 0.0,
};

// ============================================================================
// Data Limits
// ============================================================================

export const DATA_LIMITS = {
  // Request body
  JSON_LIMIT: '2mb',

  // Pagination
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,

  // Arrays
  MAX_PARAGRAPHS: 10,
  MAX_WORDS_PER_PROMPT: 10,
  MAX_SUGGESTIONS: 50,

  // Strings
  MAX_TITLE_LENGTH: 255,
  MAX_PASSWORD_LENGTH: 255,
  MAX_USERNAME_LENGTH: 320,
};

// ============================================================================
// Timing & Delays
// ============================================================================

export const TIMING = {
  // Break between lessons (5 minutes)
  DEFAULT_BREAK_DURATION_MS: 5 * 60 * 1000,
  DEFAULT_BREAK_HOURS: 24,

  // Job cleanup
  JOB_RETENTION_MS: 24 * 60 * 60 * 1000, // 24 hours

  // Timeout
  REQUEST_TIMEOUT_MS: 90000, // 90 seconds

  // Polling
  POLLING_INTERVAL_MS: 15000, // 15 seconds
};

// ============================================================================
// File & Storage
// ============================================================================

export const STORAGE = {
  // Audio file paths
  AUDIO_DIR: 'static/audio',
  STATIC_DIR: 'static',

  // File naming conventions
  AUDIO_FILENAME_PATTERN: '{label}_{type}.mp3', // e.g., H_s0.mp3, N_segment_0.mp3

  // TTS providers
  TTS_PROVIDERS: {
    OPENAI: 'openai',
    ELEVENLABS: 'elevenlabs',
    MOCK: 'mock',
  } as const,

  // TTS model defaults
  OPENAI_TTS_MODEL_DEFAULT: 'gpt-4o-mini-tts',
  OPENAI_TTS_VOICE_DEFAULT: 'nova',
};

// ============================================================================
// OpenAI Configuration
// ============================================================================

export const OPENAI = {
  // Chat model
  DEFAULT_MODEL: 'gpt-4o-mini',
  FALLBACK_MODEL: 'gpt-4o-mini',

  // Response generation
  TEMPERATURE: 0.8,
  TEMPERATURE_LOW: 0.6,

  // Retry logic
  MAX_RETRY_ATTEMPTS: 2,

  // Prompts
  WORD_POOL_LIMIT: 50,
  STORY_TOPIC_MAX_LENGTH: 100,
};

// ============================================================================
// Email & Authentication
// ============================================================================

export const AUTH = {
  // Password hashing
  BCRYPT_ROUNDS: 10,

  // JWT lifetimes
  ACCESS_TOKEN_LIFETIME: '15m',
  REFRESH_TOKEN_LIFETIME: '7d',
  DEMO_TOKEN_LIFETIME: '2h',

  // Token validation
  MIN_PASSWORD_LENGTH: 6,
  MIN_USERNAME_LENGTH: 3,
};

// ============================================================================
// Database
// ============================================================================

export const DB = {
  // Connection defaults
  DEFAULT_MONGO_URI: 'mongodb://127.0.0.1:27017/spellwise',

  // Batch operations
  BATCH_SIZE: 100,
};

// ============================================================================
// Validation Schemas
// ============================================================================

export const VALIDATION = {
  // CEFR levels
  CEFR_LEVELS: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const,

  // Experiment status
  STATUS_VALUES: ['draft', 'live', 'closed'] as const,

  // Conditions
  CONDITIONS: ['with-hints', 'without-hints'] as const,

  // Story labels
  STORY_LABELS: ['H', 'N', 'A', 'B', '1', '2'] as const,
  STORY_LABEL_NORMALIZED: {
    H: 'A',
    N: 'B',
    A: 'A',
    B: 'B',
    '1': 'A',
    '2': 'B',
  } as const,
};
