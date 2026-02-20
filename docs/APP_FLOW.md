# SpellWise - Complete Application Flow

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [File Structure](#3-file-structure)
4. [Authentication Flow](#4-authentication-flow)
5. [Experiment Lifecycle](#5-experiment-lifecycle)
6. [Story Generation Pipeline](#6-story-generation-pipeline)
7. [Student Exercise Flow](#7-student-exercise-flow)
8. [Analytics System](#8-analytics-system)
9. [Data Models](#9-data-models)
10. [API Reference](#10-api-reference)
11. [Infrastructure](#11-infrastructure)
12. [State Management](#12-state-management)

---

## 1. System Overview

SpellWise is a full-stack spelling experiment platform for linguistic research. Teachers create experiments with target words, the system generates stories using LLM, and students complete gap-fill exercises under two conditions: **with-hints** and **without-hints** (A/B testing).

**Stack:** React 18 + TypeScript + Vite | Express.js + MongoDB | OpenAI/Claude APIs | Docker + Nginx

---

## 2. Architecture Diagram

```
 INFRASTRUCTURE
 ==============

 +-----------+       +-------------------+       +-------------------+
 |  Browser  | <---> |   Nginx (proxy)   | <---> |   Express (4000)  |
 |  (React)  |       |   /SpellWise/*    |       |   /api/*          |
 +-----------+       +-------------------+       +--------+----------+
                                                          |
                              +---------------------------+---------------------------+
                              |                           |                           |
                     +--------v--------+         +--------v--------+         +--------v--------+
                     |    MongoDB      |         |   OpenAI API    |         |  Anthropic API  |
                     |  (spellwise)    |         | (GPT-4o-mini)   |         |   (Claude)      |
                     +-----------------+         | Story Gen + TTS |         | Story Gen (alt) |
                                                 +-----------------+         +-----------------+
```

```
 CLIENT-SERVER COMMUNICATION
 ============================

 React SPA (Vite)                          Express API Server
 ================                          ==================

 +-----------------+   axios + JWT         +------------------+
 | Zustand Stores  | -------------------> | Auth Middleware   |
 | (auth, game,    |                       | (JWT verify)     |
 |  intervention)  |                       +--------+---------+
 +-----------------+                                |
         |                                          v
 +-----------------+                       +------------------+
 | React Router    |   GET/POST /api/*     | Route Handlers   |
 | (pages/routes)  | -------------------> | (experiments,    |
 +-----------------+                       |  student, auth,  |
         |                                 |  analytics)      |
 +-----------------+                       +--------+---------+
 | TanStack Query  |   polling/refetch             |
 | (data fetching) | <-------------------          v
 +-----------------+                       +------------------+
                                           | Mongoose Models  |
                                           | (User, Story,    |
                                           |  Attempt, Event) |
                                           +--------+---------+
                                                    |
                                                    v
                                           +------------------+
                                           |    MongoDB       |
                                           +------------------+
```

---

## 3. File Structure

```
SpellWise/
|
+-- client/                             # React SPA (Vite + Tailwind)
|   +-- src/
|   |   +-- routes/                     # Pages
|   |   |   +-- App.tsx                 # Router definition
|   |   |   +-- Landing.tsx             # Homepage
|   |   |   +-- Login.tsx               # Teacher login
|   |   |   +-- Signup.tsx              # Teacher/student signup
|   |   |   +-- StudentLogin.tsx        # Student login
|   |   |   +-- StudentConsentForm.tsx  # GDPR consent
|   |   |   +-- student/
|   |   |   |   +-- RunFull.tsx         # Main exercise flow (gap-fill)
|   |   |   |   +-- StudentJoin.tsx     # Join by class code
|   |   |   |   +-- StudentTest.tsx     # Lightweight test mode
|   |   |   |   +-- components/         # BlankInput, StoryReader, etc.
|   |   |   +-- teacher/
|   |   |       +-- TeacherCreate.tsx   # Create experiment
|   |   |       +-- TeacherManage.tsx   # Manage experiment settings
|   |   |       +-- StoryManager.tsx    # Story generation UI
|   |   |       +-- TeacherAnalytics.tsx# Analytics dashboard
|   |   |       +-- TeacherEmpty.tsx    # No experiments state
|   |   +-- components/                 # Shared UI (Button, Spinner, etc.)
|   |   +-- store/                      # Zustand stores (auth, toasts, game)
|   |   +-- lib/                        # API client, session helpers
|   |   +-- constants.ts                # All client constants
|   |   +-- styles.css                  # Global CSS + Tailwind
|   |   +-- main.tsx                    # App entry point
|   +-- vite.config.ts
|   +-- tailwind.config.js
|
+-- server/                             # Express API
|   +-- src/
|   |   +-- routes/
|   |   |   +-- auth.ts                 # /api/auth/*
|   |   |   +-- experiments.ts          # /api/experiments/*
|   |   |   +-- student.ts             # /api/student/* (core)
|   |   |   +-- studentExtra.ts        # /api/student/* (feedback, consent)
|   |   |   +-- analytics.ts           # /api/analytics/*
|   |   |   +-- jobs.ts                # /api/jobs/*
|   |   |   +-- demo.ts, stories.ts    # Demo & story endpoints
|   |   +-- models/                     # Mongoose schemas
|   |   |   +-- User.ts, Experiment.ts, Story.ts
|   |   |   +-- Assignment.ts, Attempt.ts, Event.ts
|   |   |   +-- WordMetadata.ts, InterventionAttempt.ts
|   |   |   +-- EffortResponse.ts
|   |   +-- middleware/                 # Auth, ownership, rate limiting
|   |   +-- utils/                      # Helpers (boldParser, levenshtein, etc.)
|   |   +-- prompts.ts                 # LLM prompt templates
|   |   +-- queue.ts                   # Job queue (story gen, TTS)
|   |   +-- app.ts                     # Express app setup
|   |   +-- db.ts                      # MongoDB connection
|   |   +-- config.ts                  # Environment config
|   +-- static/audio/                   # Generated TTS audio files
|
+-- Dockerfile                          # Multi-stage build
+-- docker-compose.yml                  # MongoDB + app services
+-- nginx.conf                          # Reverse proxy config
+-- .env                                # Environment variables
```

---

## 4. Authentication Flow

### Teacher Login
```
 Browser                          Server                          MongoDB
 =======                          ======                          =======

 Login form
 (email + password)
      |
      +-- POST /api/auth/login ------>  Validate credentials
                                        bcrypt.compare()
                                              |
                                              +--- Find user ---------> User.findOne({email})
                                              |                              |
                                              | <------- user doc -----------+
                                              |
                                        Generate tokens:
                                        - accessToken (15min)
                                        - refreshToken (7d)
                                              |
      | <---- { tokens, role, email } -------+
      |
 Store in Zustand (useAuth)
 Persist to sessionStorage
 Set axios Authorization header
      |
      +-- Redirect to /teacher
```

### Student Login
```
 Browser                          Server                          MongoDB
 =======                          ======                          =======

 Student login form
 (username + password)
      |
      +-- POST /api/auth/student/login ->  Validate credentials
                                                  |
                                                  +--- Find user ---> User.findOne({username})
                                                  |
                                           Generate JWT tokens
                                                  |
      | <---- { tokens, role, consentAt } -------+
      |
      +-- if (!consentAt) --> Redirect to /student/consent
      +-- else            --> Redirect to /student
```

### JWT Refresh (Automatic)
```
 Any API call returns 401
      |
 Axios interceptor triggers
      |
      +-- POST /api/auth/refresh ------>  Verify refresh token
      |                                   Issue new access token
      | <---- { accessToken } -----------+
      |
 Update Zustand store
 Retry original request
```

---

## 5. Experiment Lifecycle

```
 +=======================================================================+
 |                    EXPERIMENT LIFECYCLE                                |
 +=======================================================================+
 |                                                                       |
 |   TEACHER SIDE                           STUDENT SIDE                 |
 |   ============                           ============                 |
 |                                                                       |
 |   [1] CREATE EXPERIMENT                                               |
 |       POST /api/experiments                                           |
 |       -> generates classCode (e.g. "XK7M2P")                         |
 |       -> status: "draft"                                              |
 |            |                                                          |
 |            v                                                          |
 |   [2] SELECT WORDS                                                    |
 |       POST /api/experiments/:id/suggestions                           |
 |       -> fetches word pool for CEFR level                             |
 |       POST /api/experiments/:id/story-words                           |
 |       -> assigns target + noise words per story                       |
 |            |                                                          |
 |            v                                                          |
 |   [3] GENERATE STORIES                                                |
 |       POST /api/experiments/:id/generate-stories                      |
 |       -> calls LLM (OpenAI/Claude)                                    |
 |       -> parses bold markers (**target**, ++noise++)                   |
 |       -> validates: each target word >= 4 occurrences                 |
 |       -> stores Story docs in MongoDB                                 |
 |       -> generates WordMetadata (definitions, distractors)            |
 |            |                                                          |
 |            v                                                          |
 |   [4] GENERATE TTS AUDIO                                              |
 |       POST /api/experiments/:id/tts                                   |
 |       -> splits story into sentences                                  |
 |       -> OpenAI TTS -> per-sentence MP3 files                         |
 |       -> stores in /static/audio/{expId}/                             |
 |            |                                                          |
 |            v                                                          |
 |   [5] REVIEW & LAUNCH                                                 |
 |       Teacher previews stories + audio                                |
 |       POST /api/experiments/:id/launch                                |
 |       -> validates stories + TTS exist                                |
 |       -> status: "live"                                               |
 |       -> shares classCode with students                               |
 |            |                                                          |
 |            +------ classCode shared ------+                           |
 |                                           |                           |
 |                                           v                           |
 |                                  [6] STUDENT JOINS                    |
 |                                      POST /api/student/join           |
 |                                      -> creates Assignment            |
 |                                      -> balanced condition assign     |
 |                                      -> returns stories + TTS URLs    |
 |                                           |                           |
 |                                           v                           |
 |                                  [7] EXERCISE (Story 1)               |
 |                                      -> gap-fill with audio           |
 |                                      -> hints (if with-hints)         |
 |                                      -> interventions                 |
 |                                      -> effort ratings                |
 |                                           |                           |
 |                                           v                           |
 |                                  [8] 5-MINUTE BREAK                   |
 |                                      -> timer countdown               |
 |                                           |                           |
 |                                           v                           |
 |                                  [9] EXERCISE (Story 2)               |
 |                                      -> same flow, other condition    |
 |                                           |                           |
 |                                           v                           |
 |                                  [10] RECALL TEST                     |
 |                                      -> immediate: right after        |
 |                                      -> delayed: 12h later            |
 |                                                                       |
 |   [11] VIEW ANALYTICS                                                 |
 |       GET /api/analytics/experiment/:id                               |
 |       -> aggregated scores, funnels, word difficulty                  |
 |       -> CSV export                                                   |
 |                                                                       |
 +=======================================================================+
```

---

## 6. Story Generation Pipeline

### LLM Story Generation
```
 POST /api/experiments/:id/generate-story
      |
      v
 +------------------+
 | Build LLM Prompt |
 +------------------+
      |
      |  System prompt:
      |  - "Write 8-10 paragraphs at CEFR level X"
      |  - "Mark targets with **word**, noise with ++word++"
      |  - "Each target word must appear >= 4 times"
      |  - "Return valid JSON only"
      |
      |  User prompt:
      |  - targetWords: ["castle", "embarrass", ...]
      |  - noiseWords: ["anxious", ...]
      |  - cefr: "B1"
      |
      v
 +--------------------+       +-------------------+
 | OpenAI / Claude    | ----> | Raw JSON Response |
 | (gpt-4o-mini or    |       | {"story": {       |
 |  claude-sonnet)    |       |   "paragraphs":   |
 +--------------------+       |   ["She saw the   |
                              |    **castle**..."] |
                              | }}                 |
                              +--------+----------+
                                       |
                                       v
                              +-------------------+
                              | Bold Parser       |
                              | (boldParser.ts)   |
                              +-------------------+
                                       |
                  +--------------------+--------------------+
                  |                                         |
                  v                                         v
         Extract **target**                        Extract ++noise++
         occurrences                               occurrences
                  |                                         |
                  +--------------------+--------------------+
                                       |
                                       v
                              +-------------------+
                              | Story Validator   |
                              +-------------------+
                                       |
                       +---------------+---------------+
                       |                               |
                       v                               v
                  PASS: each target              FAIL: word count
                  word >= 4 occurrences          too low
                       |                               |
                       v                               v
              +------------------+            +------------------+
              | Store Story doc  |            | Retry (up to 2x) |
              | in MongoDB       |            | or fallback story|
              +------------------+            +------------------+
                       |
                       v
              +------------------+
              | Generate Word    |
              | Metadata (async) |
              | - definitions    |
              | - distractors    |
              | - collocations   |
              +------------------+
```

### Bold Parser Detail
```
 Input paragraph (from LLM):
 "She visited the **museum** on Monday. The ++anxious++ guide
  showed us the **museum** collection."

                    |
                    v

 Output:
 {
   cleanParagraph: "She visited the museum on Monday. The anxious
                    guide showed us the museum collection.",

   targetOccurrences: [
     { word: "museum", paragraphIndex: 0, sentenceIndex: 0,
       charStart: 16, charEnd: 22 },
     { word: "museum", paragraphIndex: 0, sentenceIndex: 1,
       charStart: 53, charEnd: 59 }
   ],

   noiseOccurrences: [
     { word: "anxious", paragraphIndex: 0, sentenceIndex: 1,
       charStart: 32, charEnd: 39 }
   ]
 }
```

### Job Queue
```
 +----------------------------------------------------------+
 |  In-Memory Job Queue (queue.ts)                          |
 +----------------------------------------------------------+
 |                                                          |
 |  Job Types:                                              |
 |  - fetch_words  (get word suggestions for CEFR level)    |
 |  - generate_story (LLM story generation)                 |
 |  - generate_tts  (text-to-speech audio)                  |
 |                                                          |
 |  Processing: SEQUENTIAL (one job at a time)              |
 |  Retry: up to 2 attempts with exponential backoff        |
 |  Status: pending -> running -> completed/failed          |
 |                                                          |
 +----------------------------------------------------------+
```

---

## 7. Student Exercise Flow

### Complete Student Journey
```
 +===============================================================+
 |                    STUDENT JOURNEY                             |
 +===============================================================+

 [LOGIN] --> [CONSENT] --> [JOIN] --> [STORY 1] --> [BREAK] --> [STORY 2] --> [RECALL]
                                         |                          |
                                    with-hints OR              without-hints
                                    without-hints              OR with-hints
```

### Detailed Gap-Fill Exercise Flow
```
 Student opens /student/run
      |
      v
 +---------------------+
 | Load session data   |
 | from sessionStorage |
 +---------------------+
      |
      v
 +---------------------+     +------------------------+
 | Render Story        |     | Audio Player           |
 | - paragraphs        | <-> | - TTS segments         |
 | - blanks for        |     | - play/pause/seek      |
 |   target + noise    |     | - auto-advance         |
 +---------------------+     +------------------------+
      |
      v
 Student encounters a BLANK
      |
      v
 +---------------------+
 | Type answer in      |
 | BlankInput field    |
 +---------------------+
      |
      v (on submit / Enter)
 +---------------------+
 | POST /api/student/  |
 | test-attempt        |
 +---------------------+
      |
      +---------- Response -----------+
      |                               |
      v                               v
 CORRECT                         INCORRECT
 - green border                  - red border
 - sound effect                  - shake animation
 - streak++                      - show letter feedback
 - move to next blank            |
      |                          v
      |                    +-------------------+
      |                    | Hints available?  |
      |                    | (with-hints AND   |
      |                    |  occurrence < 4)  |
      |                    +--------+----------+
      |                             |
      |                    +--------+--------+
      |                    |                 |
      |                    v                 v
      |               YES: Show          NO: Retry
      |               hint button        or reveal
      |                    |
      |                    v
      |               POST /api/student/test-hint
      |               -> LLM generates vague hint
      |               -> "Think about double letters"
      |
      v
 All blanks in paragraph filled?
      |
      +--- YES ---> +-------------------+
                    | Mental Effort     |
                    | Prompt (1-9)      |
                    +-------------------+
                         |
                         v
                    POST /api/student/effort
                         |
                         v
                    +-------------------+
                    | Intervention      |    (if with-hints condition)
                    | triggered?        |
                    +--------+----------+
                             |
                    +--------+--------+
                    |                 |
                    v                 v
               YES: Popup        NO: Next
               3 exercises       paragraph
                    |
                    v
               +-----------------------+
               | Exercise 1: MCQ       |
               | (pick correct         |
               |  definition)          |
               +-----------------------+
                    |
                    v
               +-----------------------+
               | Exercise 2: Jumble    |
               | (rearrange letters    |
               |  to spell word)       |
               +-----------------------+
                    |
                    v
               +-----------------------+
               | Exercise 3: Sentence  |
               | (write sentence using |
               |  word + collocate)    |
               +-----------------------+
                    |
                    v
               Continue to next
               paragraph
```

### Word Occurrence Phases
```
 Each target word appears 4 times across the story:

 Occurrence 1 (BASELINE)
 +----------------------------------------------------------+
 | First encounter. No prior knowledge.                     |
 | Measures: baseline spelling ability                      |
 | Hints: available (if with-hints condition)               |
 +----------------------------------------------------------+
      |
      v
 Occurrence 2 (LEARNING)
 +----------------------------------------------------------+
 | Second encounter. Learning from first attempt.           |
 | Measures: initial learning effect                        |
 | Hints: available (if with-hints condition)               |
 +----------------------------------------------------------+
      |
      v
 Occurrence 3 (REINFORCEMENT)
 +----------------------------------------------------------+
 | Third encounter. Reinforcing the spelling.               |
 | Measures: reinforcement/consolidation                    |
 | Hints: available (if with-hints condition)               |
 +----------------------------------------------------------+
      |
      v
 Occurrence 4 (RECALL)
 +----------------------------------------------------------+
 | Fourth encounter. Testing retention.                     |
 | Measures: short-term recall without support              |
 | Hints: DISABLED (even in with-hints condition)           |
 +----------------------------------------------------------+
```

### Break & Recall Flow
```
 Story 1 Complete
      |
      v
 +-------------------+
 | Feedback Form     |
 | - difficulty (1-5)|
 | - enjoyment (1-5) |
 | - comments        |
 +-------------------+
      |
      v
 POST /api/student/feedback
      |
      v
 +-------------------+
 | 5-MINUTE BREAK    |
 | Countdown timer   |
 | Cannot skip       |
 +-------------------+
      |
      v (timer expires)
 Story 2 begins
 (opposite condition)
      |
      v
 Story 2 Complete
      |
      v
 +-------------------+
 | Feedback Form     |
 +-------------------+
      |
      v
 +-----------------------------+
 | IMMEDIATE RECALL TEST       |
 | - All target words from     |
 |   both stories              |
 | - No context, no audio      |
 | - Type from memory          |
 | POST /api/student/          |
 |   recall/immediate          |
 +-----------------------------+
      |
      v
 +-----------------------------+
 | 12-HOUR WAIT                |
 | Student must return later   |
 +-----------------------------+
      |
      v (12 hours later)
 +-----------------------------+
 | DELAYED RECALL TEST         |
 | - Same words, from memory   |
 | - Measures long-term        |
 |   retention                 |
 | POST /api/student/          |
 |   recall/delayed            |
 +-----------------------------+
```

---

## 8. Analytics System

### Data Collection Points
```
 +==============================================================+
 |  DATA COLLECTION                                             |
 +==============================================================+
 |                                                              |
 |  Attempt (per word, per occurrence)                          |
 |  +-------------------------------------------------------+  |
 |  | student, word, phase, score, hintCount, revealed,     |  |
 |  | attempts[], latencyMs, totalTimeMs                    |  |
 |  +-------------------------------------------------------+  |
 |                                                              |
 |  Event (granular actions)                                    |
 |  +-------------------------------------------------------+  |
 |  | audio_play, audio_pause, hint_request, reveal,        |  |
 |  | paragraph_completed, break_completed, focus, blur     |  |
 |  +-------------------------------------------------------+  |
 |                                                              |
 |  EffortResponse (mental effort ratings)                      |
 |  +-------------------------------------------------------+  |
 |  | student, paragraph, position (mid/end), score (1-9)   |  |
 |  +-------------------------------------------------------+  |
 |                                                              |
 |  InterventionAttempt (exercise results)                      |
 |  +-------------------------------------------------------+  |
 |  | mcqAttempts, jumbleAttempts, sentenceAttempts,         |  |
 |  | completion status, totalTimeMs                        |  |
 |  +-------------------------------------------------------+  |
 |                                                              |
 +==============================================================+
```

### Analytics Aggregation
```
 GET /api/analytics/experiment/:id
      |
      v
 +---------------------------+
 | Aggregate from MongoDB    |
 +---------------------------+
      |
      +--> Overview
      |    - total students, attempts, correct rate
      |    - total hints used, reveals
      |    - average recall score
      |
      +--> By Story (A vs B)
      |    - attempts & accuracy per story
      |    - hint usage comparison
      |
      +--> Funnel
      |    - joined -> story1 -> break -> story2 -> recall
      |    - dropout at each stage
      |
      +--> Per Student
      |    - username, condition, accuracy, hints, time
      |
      +--> Per Word
      |    - word, attempts, accuracy, common misspellings
      |
      +--> Timeline
      |    - daily: attempts, correct, hints, definitions
      |
      +--> Data Quality
           - missing fields, orphaned records
```

### CSV Export
```
 GET /api/analytics/experiment/:id/csv
      |
      v
 +-------------------------------------------+
 | CSV Headers:                              |
 | student, condition, word, phase,          |
 | score, hints, revealed, latencyMs,        |
 | effortRating, recallImmediate,            |
 | recallDelayed                             |
 +-------------------------------------------+
```

---

## 9. Data Models

### Entity Relationship
```
 +----------+       +------------+       +---------+
 |   User   | 1---N | Experiment | 1---2 |  Story  |
 | (teacher)|       |            |       |         |
 +----------+       +-----+------+       +----+----+
                          |                    |
                     1    |               N    |
                     |    |               |    |
                     N    v               |    |
                  +-------+------+        |    |
                  | Assignment   | -------+    |
                  | (student to  |             |
 +----------+    |  experiment) |             |
 |   User   | ---+              |             |
 | (student)|    +--------------+             |
 +----+-----+         |                      |
      |                |                      |
      | 1         N    |                 N    |
      |           |    v                 |    v
      |    +------+-------+      +------+----------+
      +--- |   Attempt    |      | WordMetadata    |
      |    | (gap-fill,   |      | (definitions,   |
      |    |  recall)     |      |  distractors)   |
      |    +--------------+      +-----------------+
      |
      |    +--------------+      +-----------------+
      +--- |    Event     |      | EffortResponse  |
      |    | (all actions)|      | (mental effort) |
      |    +--------------+      +-----------------+
      |
      |    +--------------------+
      +--- | InterventionAtmpt  |
           | (MCQ, jumble,      |
           |  sentence)         |
           +--------------------+
```

### Key Fields Summary
```
 User
 ----
 _id, email?, username?, passwordHash, role (teacher|student),
 consentAt?, consentVersion?

 Experiment
 ----------
 _id, owner (User._id), classCode, title, cefr (A2-C2),
 targetWords[], noiseWords[], status (draft|live|closed),
 stories {story1: {targetWords[], noiseWords[]},
          story2: {targetWords[], noiseWords[]}},
 storyRefs {story1: Story._id, story2: Story._id}

 Story
 -----
 _id, experiment, label (A|B), paragraphs[],
 targetOccurrences [{word, paragraphIndex, sentenceIndex,
                     charStart, charEnd}],
 noiseOccurrences [...],
 ttsSegments[] (audio URLs)

 Assignment
 ----------
 _id, experiment, student, condition,
 story1, story2, storyOrder, hintsStory (A|B),
 breakUntil?, recallUnlockAt?,
 story1CompletedAt?, story2CompletedAt?

 Attempt
 -------
 _id, experiment, student, targetWord,
 taskType (gap-fill|immediate-recall|delayed-recall),
 phase (baseline|learning|reinforcement|recall),
 abCondition (with-hints|without-hints),
 attempts [{text, timestamp, correctnessByPosition[]}],
 score (0-1), hintCount, revealed, finalText

 Event
 -----
 _id, experiment, student, type, payload, ts

 WordMetadata
 ------------
 _id, experiment, word, definition, partOfSpeech,
 distractorDefinitions[], commonCollocations[],
 exampleSentences[], syllables[]
```

---

## 10. API Reference

### Auth (`/api/auth`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/login` | No | Teacher login (email + password) |
| POST | `/student/login` | No | Student login (username + password) |
| POST | `/student/signup` | No | Student registration |
| POST | `/refresh` | Refresh token | Issue new access token |
| POST | `/logout` | Yes | Clear session |

### Experiments (`/api/experiments`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/` | Teacher | Create experiment |
| GET | `/:id` | Teacher | Get experiment details |
| PATCH | `/:id` | Teacher+Owner | Update title/level |
| POST | `/:id/target-words` | Teacher+Owner | Set target words |
| POST | `/:id/story-words` | Teacher+Owner | Set per-story words |
| POST | `/:id/suggestions` | Teacher+Owner | Get word pool for level |
| POST | `/:id/generate-stories` | Teacher+Owner | Generate both stories |
| POST | `/:id/generate-story` | Teacher+Owner | Generate one story |
| GET | `/:id/story/:label` | Teacher+Owner | Preview story |
| POST | `/:id/tts` | Teacher+Owner | Generate TTS audio |
| POST | `/:id/launch` | Teacher+Owner | Launch experiment |
| GET | `/:id/status` | Teacher+Owner | Get generation status |

### Student (`/api/student`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/join` | Student | Join experiment by code |
| POST | `/attempt` | Student | Log word attempt |
| POST | `/test-attempt` | Student | Check answer (lightweight) |
| POST | `/test-hint` | Student | Get hint for word |
| POST | `/reveal` | Student | Reveal correct answer |
| POST | `/define` | Student | Score definition answer |
| POST | `/effort` | Student | Log mental effort (1-9) |
| POST | `/paragraph-progress` | Student | Log paragraph completion |
| POST | `/feedback` | Student | Submit story feedback |
| POST | `/events` | Student | Batch log events |
| POST | `/consent` | Student | Record consent |
| POST | `/recall/immediate` | Student | Submit immediate recall |
| POST | `/recall/delayed` | Student | Submit delayed recall |
| GET | `/word-metadata/:expId/:word` | Student | Get word exercises |

### Analytics (`/api/analytics`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/experiment/:id` | Teacher | Full analytics data |
| GET | `/experiment/:id/csv` | Teacher | CSV export |
| GET | `/experiment/:id/students` | Teacher | Per-student stats |
| GET | `/experiment/:id/words` | Teacher | Per-word analysis |
| GET | `/experiment/:id/timeline` | Teacher | Daily metrics |

### System
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | No | Health check |
| GET | `/api/jobs/:expId` | Teacher | Job queue status |

---

## 11. Infrastructure

### Docker Deployment
```
 docker-compose.yml
 ==================

 +------------------+          +------------------+
 |    mongodb       |          |      app         |
 |  (mongo:7.0)     |          | (node:20-slim)   |
 |                  |          |                  |
 |  Port: 27017     | <-----  |  Port: 4000      |
 |  Volume: data    |  mongo  |                  |
 |  Auth: enabled   |  conn   |  Serves:         |
 +------------------+         |  - Express API   |
                               |  - Static client |
                               |  - TTS audio     |
                               +------------------+
```

### Nginx Reverse Proxy (Production)
```
 Client Request                 Nginx                    Express
 ==============                 =====                    =======

 GET /SpellWise/           -->  Serve static files
                                (client/dist/)

 GET /SpellWise/api/...    -->  proxy_pass          -->  /api/...
                                (strip /SpellWise)

 GET /SpellWise/static/... -->  proxy_pass          -->  /static/...
                                (audio files)
```

### Environment Variables
```
 +-- Database ---------+  +-- Auth ---------------+  +-- LLM ----------------+
 | MONGO_URI            |  | JWT_ACCESS_SECRET     |  | OPENAI_API_KEY        |
 | MONGO_USERNAME       |  | JWT_REFRESH_SECRET    |  | OPENAI_MODEL          |
 | MONGO_PASSWORD       |  | INTERNAL_JOB_SECRET   |  | ANTHROPIC_API_KEY     |
 +----------------------+  +-----------------------+  | ANTHROPIC_MODEL       |
                                                       +-----------------------+
 +-- Server -----------+  +-- Client (build) -----+  +-- TTS ----------------+
 | NODE_ENV             |  | VITE_API_BASE_URL     |  | TTS_PROVIDER          |
 | PORT (4000)          |  | VITE_BASE_PATH        |  | OPENAI_TTS_MODEL      |
 | CORS_ORIGIN          |  |  (/SpellWise/)        |  | OPENAI_TTS_VOICE      |
 | DEV_NO_AUTH           |  +-----------------------+  | ELEVENLABS_API_KEY    |
 +----------------------+                              +-----------------------+
```

### Dev vs Production
```
 Development                          Production
 ===========                          ==========
 VITE_API_BASE_URL=                   VITE_API_BASE_URL=
   http://localhost:4000                /SpellWise
 VITE_BASE_PATH=/spellwise/           VITE_BASE_PATH=/SpellWise/
 DEV_NO_AUTH=true (optional)          DEV_NO_AUTH=false
 Rate limiting: OFF                   Rate limiting: ON
 CORS: permissive                     CORS: restricted
 Logs: debug level                    Logs: info level
 Vite dev server: port 3000           Nginx serves built files
```

---

## 12. State Management

### Client-Side Stores (Zustand)
```
 useAuth (store/auth.ts)
 +----------------------------------------------+
 | accessToken, refreshToken, role, username     |
 | Persisted to: sessionStorage                  |
 | setAuth(), clear()                            |
 +----------------------------------------------+

 useIntervention (store/intervention.ts)
 +----------------------------------------------+
 | interventionWords[], wordMetadata{}           |
 | exerciseState per word                        |
 | Tracks: MCQ, jumble, sentence completion      |
 +----------------------------------------------+

 useGameify (store/gamify.ts)
 +----------------------------------------------+
 | streak, maxStreak, confettiTriggered          |
 | incrementStreak(), resetStreak()              |
 +----------------------------------------------+

 useToasts (store/toasts.ts)
 +----------------------------------------------+
 | toasts[], add(), remove()                     |
 | Auto-dismiss after 3s                         |
 +----------------------------------------------+
```

### Session Storage (Student Session)
```
 Key                         Value
 ---                         -----
 exp.experimentId            "64a1b2c3..."
 exp.condition               "with-hints"
 exp.storyOrder              "A-first"
 exp.story1                  {paragraphs, occurrences, ...}
 exp.story2                  {paragraphs, occurrences, ...}
 exp.tts1                    ["url1.mp3", "url2.mp3", ...]
 exp.tts2                    ["url1.mp3", "url2.mp3", ...]
 exp.breakUntil              "2024-01-15T10:30:00Z"
 exp.story1Complete          "true"
 exp.story2Complete          "true"
 exp.recallUnlockAt          "2024-01-15T22:30:00Z"
```

---

## Quick Reference: Request Flow

```
 Browser -> Axios -> JWT Header -> Nginx -> Express -> Auth Middleware
                                                            |
                                                    Route Handler
                                                            |
                                                    Mongoose Query
                                                            |
                                                       MongoDB
                                                            |
                                                    JSON Response
                                                            |
 Browser <- Axios interceptor <- Nginx <- Express <---------+
```
