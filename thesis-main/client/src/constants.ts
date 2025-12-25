/**
 * Client-side constants and configuration values.
 * Centralized to avoid magic numbers scattered throughout the codebase.
 */

// ============================================================================
// API Configuration
// ============================================================================

export const API = {
  // Default base URL (can be overridden by VITE_API_BASE_URL env var)
  DEFAULT_BASE_URL: 'http://localhost:4000',

  // Request timeout
  TIMEOUT_MS: 90000, // 90 seconds

  // Retry logic
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,

  // Polling
  POLLING_INTERVAL_MS: 15000, // 15 seconds for experiment status
};

// ============================================================================
// Story & Exercise
// ============================================================================

export const STORY = {
  // Standard story structure
  PARAGRAPH_COUNT: 5,

  // Target words
  MAX_TARGET_WORDS: 5,
  TARGET_WORD_OCCURRENCES: 5, // Each word appears 5 times

  // Pagination
  DEMO_RECENT_LIMIT: 5,
};

// ============================================================================
// Spelling Phases
// ============================================================================

export const SPELL_PHASE = {
  // Occurrence indices
  BASELINE: 1,
  LEARNING_START: 2,
  LEARNING_END: 3,
  RECALL: 4,
  FINAL_REPEAT: 5,

  // Hints disabled from occurrence 5+
  HINTS_DISABLED_FROM: 5,
};

// ============================================================================
// Audio
// ============================================================================

export const AUDIO = {
  // Player controls
  SEEK_STEP_SECONDS: 3, // ±3 seconds per button press
  AUTO_PLAY_AFTER_MS: 300, // Auto-play after 300ms

  // File patterns
  SEGMENT_FILENAME_PATTERN: '{label}_s{index}.mp3', // H_s0.mp3, N_s1.mp3

  // Volume and playback
  DEFAULT_VOLUME: 1.0,
  MIN_VOLUME: 0.0,
  MAX_VOLUME: 1.0,
};

// ============================================================================
// UI & Display
// ============================================================================

export const UI = {
  // Text scaling
  TEXT_SCALE_MIN: 0.8, // 80%
  TEXT_SCALE_MAX: 1.5, // 150%
  TEXT_SCALE_STEP: 0.1,
  TEXT_SCALE_DEFAULT: 1.0,

  // Modal delays
  TOAST_DURATION_MS: 3000, // 3 seconds
  CONFETTI_DURATION_MS: 2000, // 2 seconds
  FEEDBACK_MODAL_DELAY_MS: 500, // 0.5 seconds

  // Animations
  SMOOTH_SCROLL_BEHAVIOR: 'smooth' as const,

  // Theme
  THEMES: ['light', 'dark'] as const,
  DEFAULT_THEME: 'light' as const,

  // Help overlay
  HELP_OVERLAY_VISIBLE_BY_DEFAULT: false,
};

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

export const KEYBOARD = {
  // Global shortcuts
  SHOW_HELP: 'h',
  TOGGLE_THEME: 't',
  INCREASE_TEXT_SIZE: ['+', '='], // Plus or equals
  DECREASE_TEXT_SIZE: '-',

  // Student run
  PLAY_AUDIO: 'space',
  SUBMIT_ANSWER: 'enter',
};

// ============================================================================
// Storage Keys
// ============================================================================

export const STORAGE_KEYS = {
  // Auth
  AUTH_TOKEN_KEY: 'spellwise-auth',
  ACCESS_TOKEN_KEY: 'accessToken',
  REFRESH_TOKEN_KEY: 'refreshToken',
  USER_ROLE_KEY: 'role',
  USER_EMAIL_KEY: 'email',
  DEMO_MODE_KEY: 'demo',

  // Experiment session
  EXPERIMENT_SESSION_PREFIX: 'exp',
  EXPERIMENT_BREAK_KEY: 'exp.breakUntil',
  STORY_1_COMPLETE_KEY: 'exp.story1Complete',
  STORY_2_COMPLETE_KEY: 'exp.story2Complete',

  // Preferences
  THEME_PREFERENCE_KEY: 'theme-preference',
  TEXT_SCALE_KEY: 'text-scale',
  SHOW_HELP_KEY: 'show-help',
};

// ============================================================================
// Validation
// ============================================================================

export const VALIDATION = {
  // Experiment
  MIN_TITLE_LENGTH: 1,
  MAX_TITLE_LENGTH: 255,

  // Student
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 320,
  MIN_PASSWORD_LENGTH: 6,

  // CEFR levels
  CEFR_LEVELS: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const,
  DEFAULT_CEFR: 'B1' as const,

  // Status
  EXPERIMENT_STATUS: ['draft', 'live', 'closed'] as const,

  // Conditions
  CONDITIONS: ['with-hints', 'without-hints'] as const,

  // Difficulty score
  DIFFICULTY_MIN: 1,
  DIFFICULTY_MAX: 5,
  ENJOYMENT_MIN: 1,
  ENJOYMENT_MAX: 5,
};

// ============================================================================
// Patterns & Limits
// ============================================================================

export const LIMITS = {
  // Input validation
  USERNAME_PATTERN: /^[A-Za-z0-9_]+$/,
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // Arrays
  MAX_SUGGESTIONS: 50,
  MAX_PARAGRAPHS: 10,

  // Strings
  MAX_WORD_LENGTH: 100,
};

// ============================================================================
// Routes
// ============================================================================

export const ROUTES = {
  // Public
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  DEMO: '/demo',

  // Teacher
  TEACHER_HOME: '/teacher',
  TEACHER_EXPERIMENTS: '/teacher/experiments',
  TEACHER_EXPERIMENT_DETAIL: '/teacher/experiments/:id',
  TEACHER_WORDS: '/teacher/experiments/:id/words',
  TEACHER_ANALYTICS: '/teacher/experiments/:id/analytics',

  // Student
  STUDENT_HOME: '/student',
  STUDENT_JOIN: '/student/join',
  STUDENT_RUN: '/student/run',
};

// ============================================================================
// API Endpoints
// ============================================================================

export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/auth/login',
  SIGNUP: '/api/auth/signup',
  REFRESH: '/api/auth/refresh',
  LOGOUT: '/api/auth/logout',
  DEMO: '/api/auth/demo',
  DEMO_LOGIN: '/api/demo/login',

  // Experiments
  EXPERIMENTS_LIST: '/api/experiments',
  EXPERIMENT_GET: (id: string) => `/api/experiments/${id}`,
  EXPERIMENT_CREATE: '/api/experiments',
  EXPERIMENT_UPDATE: (id: string) => `/api/experiments/${id}`,
  EXPERIMENT_LAUNCH: (id: string) => `/api/experiments/${id}/launch`,
  EXPERIMENT_STATUS: (id: string) => `/api/experiments/${id}/status`,

  // Stories & Generation
  SUGGESTIONS: (id: string) => `/api/experiments/${id}/suggestions`,
  TARGET_WORDS: (id: string) => `/api/experiments/${id}/target-words`,
  GENERATE_STORIES: (id: string) => `/api/experiments/${id}/generate-stories`,
  GENERATE_STORY: (id: string) => `/api/experiments/${id}/generate-story`,
  STORY_PREVIEW: (id: string, label: string) => `/api/experiments/${id}/story/${label}`,

  // TTS
  GENERATE_TTS: (id: string) => `/api/experiments/${id}/tts`,

  // Student
  STUDENT_JOIN: '/api/student/join',
  STUDENT_ATTEMPT: '/api/student/attempt',
  STUDENT_HINT: '/api/student/hint',
  STUDENT_EVENTS: '/api/student/events',

  // Analytics
  ANALYTICS_OVERVIEW: (id: string) => `/api/analytics/experiment/${id}`,
  ANALYTICS_STUDENTS: (id: string) => `/api/analytics/experiment/${id}/students`,
  ANALYTICS_EVENTS: (id: string) => `/api/analytics/experiment/${id}/events`,

  // Health
  HEALTH: '/api/health',
};

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_MESSAGES = {
  // Network
  NETWORK_ERROR: 'Network error - check your connection',
  TIMEOUT: 'Request timed out. Please try again.',
  UNAUTHORIZED: 'Unauthorized. Please log in.',
  FORBIDDEN: 'You do not have permission to access this resource.',
  NOT_FOUND: 'Resource not found.',

  // Validation
  INVALID_EMAIL: 'Invalid email address.',
  INVALID_PASSWORD: 'Password must be at least 6 characters.',
  INVALID_USERNAME: 'Username can only contain letters, numbers, and underscores.',
  TITLE_REQUIRED: 'Please enter a title.',
  WORDS_REQUIRED: 'Please provide 1-10 target words.',

  // Operations
  EXPERIMENT_NOT_FOUND: 'Experiment not found.',
  STORY_NOT_FOUND: 'Story not found.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',

  // Server
  SERVER_ERROR: 'An error occurred on the server. Please try again later.',
};

// ============================================================================
// Success Messages
// ============================================================================

export const SUCCESS_MESSAGES = {
  EXPERIMENT_CREATED: 'Experiment created successfully.',
  EXPERIMENT_LAUNCHED: 'Experiment launched successfully.',
  EXPERIMENT_CLOSED: 'Experiment closed.',
  STORY_GENERATED: 'Stories generated successfully.',
  TTS_GENERATED: 'Audio generated successfully.',
  ANSWER_SUBMITTED: 'Answer submitted.',
  HINT_PROVIDED: 'Hint generated.',
};
