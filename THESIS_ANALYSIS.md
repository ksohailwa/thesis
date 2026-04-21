# SpellWise: Comprehensive Codebase Analysis for Master's Thesis
## Focus: Pedagogical Approach with Secondary Focus on Architecture & Implementation

**Date**: April 17, 2026  
**Scope**: Full-stack analysis of research spelling learning platform

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Project Overview](#1-project-overview)
3. [Core Pedagogical Features](#2-core-pedagogical-features)
4. [Architecture & Tech Stack](#3-architecture--tech-stack)
5. [Data Models & Learning Structures](#4-data-models--learning-structures)
6. [User Workflows](#5-user-workflows)
7. [Learning Adaptation Logic](#6-learning-adaptation-logic)
8. [Analytics & Insights](#7-analytics--insights)
9. [Critical Implementation Files](#8-critical-files-to-review)

---

## Executive Summary

**SpellWise** is an AI-powered, full-stack spelling experiment platform designed for linguistic research and language learning assessment. The system implements a sophisticated **phase-based learning architecture** combined with **adaptive intervention mechanisms** and **A/B testing methodology** to investigate the effectiveness of hints and personalized feedback in spelling acquisition.

### Key Innovation Points
- **Phased word occurrence model**: Each target word appears 4 times across a contextual story, each occurrence serving a distinct pedagogical purpose (baseline → learning → reinforcement → recall)
- **Condition-based A/B testing**: Systematic comparison of "with-hints" vs "without-hints" conditions
- **LLM-integrated story generation**: Context-aware, CEFR-aligned story creation with automatic validation
- **Multi-stage intervention system**: Three-part remedial exercises triggered contextually within the learning flow
- **Comprehensive effort tracking**: 9-point mental effort scale to measure cognitive load and engagement
- **Dual-story methodology**: Balanced condition assignment with timed breaks and delayed recall testing

### Research Design Pattern
The platform implements a **randomized controlled trial** (RCT) structure with:
- Balanced condition assignment per student
- Counterbalanced story order (A-first vs B-first)
- Controlled 5-minute inter-story break
- Immediate and delayed recall testing phases

---

## 1. Project Overview

### Purpose & Target Users

**Primary Purpose**
SpellWise is a research platform for investigating spelling acquisition, learning mechanics, and the effectiveness of computer-assisted intervention strategies in vocabulary learning. The system bridges educational linguistics, cognitive psychology, and learning technology.

**Target Users**
1. **Teachers/Researchers**: Create spelling experiments, configure CEFR levels (A1-C2), select target words, generate contextual stories, and monitor student progress
2. **Students**: Complete interactive spelling exercises within contextual narratives, receive adaptive feedback, perform self-assessment of cognitive effort
3. **Administrators**: System configuration, analytics aggregation, experiment management

### Learning Objectives

**For Students:**
- Acquire accurate spelling patterns in context (not isolated drill)
- Develop metacognitive awareness through effort self-rating
- Experience adaptive scaffolding (interventions triggered based on performance)
- Build explicit knowledge of word patterns through multi-occurrence exposure

**For Researchers:**
- Quantify the effect of hints/feedback on spelling acquisition (experimental hypothesis testing)
- Analyze learning progression across four phases (baseline → recall)
- Measure cognitive load (effort) correlation with performance
- Identify word difficulty patterns and individual learning trajectories
- Compare immediate vs delayed retention effects

### CEFR Alignment

The system supports 6 proficiency levels aligned to the **Common European Framework of Reference**:
- **A1** (Beginner): Fundamental vocabulary, basic letter patterns
- **A2** (Elementary): Common words, more complex patterns
- **B1** (Intermediate): Formal vocabulary, morphological complexity
- **B2** (Upper-Intermediate): Academic/technical vocabulary
- **C1** (Advanced): Low-frequency, complex derivations
- **C2** (Mastery): Rare, nuanced vocabulary

Each level has associated word pools, contextual demands, and difficulty calibration.

---

## 2. Core Pedagogical Features

### 2.1 How the System Teaches Spelling

#### **Contextual Gap-Fill Methodology**

The primary learning mechanism is **embedded contextual spelling** rather than isolated drilling:

```
STORY (4-5 paragraphs, ~400-800 words)
├── Target Word 1 (4 occurrences across story)
│   ├── Occurrence 1: BASELINE phase [with-hints: hints available]
│   ├── Occurrence 2: LEARNING phase [with-hints: hints available]
│   ├── Occurrence 3: REINFORCEMENT phase [with-hints: hints available]
│   └── Occurrence 4: RECALL phase [ALWAYS no hints - immediate retention test]
├── Target Word 2 (4 occurrences)
└── Noise Words (distraction, 1-2 occurrences each)
```

**Pedagogical Rationale:**
- **Context enrichment**: Words learned in meaningful narrative context, not decontextualized lists
- **Spaced repetition**: 4 strategically-placed occurrences within ~10 minutes (massed practice within session)
- **Distributed phases**: Different sentence contexts for each occurrence, preventing pattern-matching shortcuts
- **Active production**: Student types spelling, not passive recognition
- **Immediate feedback**: Correctness indicated per letter position

#### **Audio-Assisted Learning**

Each story is converted to speech (OpenAI TTS):
- Per-sentence audio segments (~5-10 segments per story)
- Student can pause/resume at word level
- Multimodal reinforcement: visual (text) + auditory (pronunciation)
- Aligns with research on phonological activation and spelling

#### **Phase Architecture**

| Phase | Occurrence | Goal | Hints | Feedback | Research Purpose |
|-------|-----------|------|-------|----------|-----------------|
| **Baseline** | 1st | Assess prior knowledge | Available (w-h only) | Per-letter | Baseline ability |
| **Learning** | 2nd | Initial acquisition | Available (w-h only) | Per-letter | Learning curve |
| **Reinforcement** | 3rd | Consolidation | Available (w-h only) | Per-letter | Consolidation |
| **Recall** | 4th | Retention without support | **NEVER** | Delayed | Short-term retention |

**Pedagogical Design:**
- Each student encounters each word 4x within ~10-15 minute exercise
- 5-minute break after Story A (rest + memory consolidation window)
- Story B (other condition) 5+ minutes later
- Delayed recall test available after 12+ hours

### 2.2 Adaptive & Personalization Mechanisms

#### **Dynamic Difficulty Assessment**

The system maintains a **composite difficulty score** per word:

```typescript
// From server/src/utils/wordAnalytics.ts
difficultyScore = 
    (1 - avgScore) * 40           // Inverse accuracy (higher error = harder)
  + revealRate * 30               // % times student asked for reveal
  + (avgHintCount / 3) * 20       // Hint dependency
  + (avgLatency / 10000) * 10     // Processing time needed
```

**Adaptation Strategy:**
- **Smart Word Recommendations**: For future experiments, words are recommended based on:
  - Past difficulty (targeting "sweet spot" ~50/100)
  - Engagement signals (inverse reveal rate)
  - Individual student learning profiles
- **Difficulty Balancing**: System can suggest words at multiple CEFR levels to maintain engagement

#### **Intervention Triggers**

Interventions are triggered based on **contextual performance signals**:

```
IF (reveal || hintCount >= 2) AND occurrence < 4:
  → Trigger intervention popup AFTER paragraph completed
  → 3-part mini-lesson on the word
ELSE IF occurrence == 4:
  → NO intervention (recall test phase)
```

**Conditional Logic** (server/src/routes/student.ts):
- Reveals = student explicitly asked to see answer
- High hint count = struggling with orthography
- Only for with-hints condition (experimental rigor)
- Never for recall phase (testing pure retention)

#### **Effort-Based Adaptation (Emerging Feature)**

While not fully implemented in current codebase, infrastructure exists for:
- 9-point mental effort scale collection (post-paragraph)
- Effort correlations with performance
- Potential difficulty adjustment based on effort reports
- Cognitive load theory alignment (effort as proxy for working memory demand)

### 2.3 Student Engagement Strategies

#### **Gamification Elements**

1. **Streak System**
   - Consecutive correct spellings across word-occurrences
   - Visual feedback: green highlights, sound effects
   - Psychology: intrinsic motivation, flow state

2. **Progress Visualization**
   - Current paragraph number / total paragraphs
   - Blanks filled / total blanks
   - Story completion percentage
   - Countdown timer for break period

3. **Immediate Positive Reinforcement**
   - Correct answer: green border, checkmark, sound ✓
   - Incorrect: red border, shake animation, letter-by-letter feedback
   - Confetti animation on streak milestones

#### **Accessibility & Inclusion**
- **Text scaling**: Ctrl/Cmd +/- for visual accessibility (stored in localStorage)
- **Keyboard shortcuts**: H for help overlay, standard browser shortcuts
- **Color-blind friendly**: Tested color combinations (blue/orange highlighting)
- **Consent-based**: GDPR consent collection before student participation

#### **Narrative Engagement**
- Stories are coherent, meaningful narratives (not random word sequences)
- Teacher can preview stories before launch
- Stories contextualize words naturally (no forced, unnatural usage)
- Multiple story variants possible (though current: 2 stories per experiment)

### 2.4 Intervention Approaches

#### **Three-Part Intervention System**

Triggered contextually when student struggles with a word (reveal or multiple hints):

##### **Exercise 1: Multiple Choice Definition (MCQ)**
- **Goal**: Ensure lexical understanding (not just spelling mechanics)
- **Format**: 1 correct definition + 3 plausible distractors
- **LLM Generation**: Distractor definitions are semantically plausible but incorrect
- **Pedagogical Link**: Spelling + semantics integration (encoding enrichment)
- **Constraints**: Must use provided definition from WordMetadata

##### **Exercise 2: Jumbled Letter Rearrangement**
- **Goal**: Orthographic pattern recognition and motor planning
- **Format**: Letters shuffled; click/tap to rearrange
- **Mechanics**: 
  - Correct letters lock in place (green highlight)
  - Student can retry unlimited times
  - Shows cumulative progress: "X of Y letters correct"
- **Pedagogical Link**: Decompose spelling into letter sequencing, pattern recognition

##### **Exercise 3: Sentence Writing with Collocations**
- **Goal**: Productive use in context, syntactic integration
- **Format**: Write a sentence using target word + a suggested base word (collocation)
- **Examples**: If target="anxious", base words might be ["always", "feel", "become"]
- **Validation**: LLM validates sentence quality
  - Must include both target word AND base word
  - Must be grammatically sound (or nearly so - lenient for L2)
  - Encouragement-focused feedback
- **Pedagogical Link**: Integrate spelling with production context, collocational patterns

#### **Intervention Metadata**

```typescript
// From InterventionAttempt model
{
  targetWord: string
  occurrenceIndex: number          // 1-3 only (not 4)
  paragraphIndex: number           // Where triggered
  
  // Exercise tracking
  mcqAttempts: [{selectedAnswer, correctAnswer, isCorrect, timestamp}]
  jumbleAttempts: [{arrangement, isCorrect, timestamp}]
  sentenceAttempts: [{sentence, usedTargetWord, usedBaseWord, feedback}]
  
  // Performance metadata
  allExercisesCompleted: boolean
  totalTimeMs: number              // Time spent in intervention
  completedAt: Date
}
```

**Critical Distinction**: Interventions are **only for with-hints condition** and **never for recall phase** (occurrence 4). This maintains experimental rigor by isolating hint effects.

### 2.5 Effort Tracking & Motivation Systems

#### **9-Point Mental Effort Scale**

Implemented in: `client/src/components/EffortPrompt.tsx` and `client/src/routes/student/components/MentalEffortView.tsx`

```typescript
const EFFORT_SCALE = [
  { value: 1, emoji: '😌', label: 'Very, very low effort' },
  { value: 2, emoji: '😊', label: 'Very low effort' },
  { value: 3, emoji: '🙂', label: 'Low effort' },
  { value: 4, emoji: '😐', label: 'Rather low effort' },
  { value: 5, emoji: '😶', label: 'Neither low nor high effort' },
  { value: 6, emoji: '🤔', label: 'Rather high effort' },
  { value: 7, emoji: '😓', label: 'High effort' },
  { value: 8, emoji: '😫', label: 'Very high effort' },
  { value: 9, emoji: '😤', label: 'Very, very high effort' },
]
```

**Collection Points:**
- **Mid-story** (after 2-3 paragraphs): Effort checkpoint
- **End-of-story** (after all paragraphs): Final effort assessment

**Data Recorded:**
```typescript
interface IEffortResponse {
  experiment: ObjectId
  student: ObjectId
  taskType: string                 // 'gap-fill' | 'immediate-recall' | 'delayed-recall'
  storyLabel: 'A' | 'B'            // Which condition
  paragraphIndex: number
  position: 'mid' | 'end'
  score: number                    // 1-9
  ts: Date
}
```

**Pedagogical Rationale (Cognitive Load Theory):**
- **Effort ↔ Performance correlation**: Analysis of whether high effort predicts:
  - Lower accuracy (task too hard)
  - Higher learning gains (optimal challenge)
  - Intervention effectiveness (does support reduce effort?)
- **Metacognitive development**: Student self-awareness of cognitive state
- **Individual differences**: Tracks variability in learning efficiency

**Motivation Mechanisms:**
- Non-judgmental 1-9 scale (not "good/bad" dichotomy)
- Emoji visual anchors aid understanding
- Effort data used for adaptive sequencing (future: adjust word difficulty)
- Transparent feedback: "Your effort level shows you're challenged - let's help!"

---

## 3. Architecture & Tech Stack

### 3.1 Frontend Architecture

#### **Technology Stack**
```
React 18 + TypeScript + Vite
├── State Management: Zustand (persistent stores)
├── Data Fetching: TanStack Query (React Query)
├── Styling: Tailwind CSS + PostCSS
├── Routing: React Router v6
├── Internationalization: i18next (en, de)
├── Icons: Lucide React
└── HTTP Client: Axios
```

#### **Key Stores (Zustand)**

1. **Auth Store** (`store/auth.ts`)
   - User credentials, roles (teacher/student)
   - JWT tokens (access + refresh)
   - Auto-refresh on 401
   - Session persistence

2. **Intervention Store** (`store/intervention.ts`)
   - Active intervention state
   - Exercise progress (MCQ/Jumble/Sentence completion flags)
   - Selected base words for sentence exercise
   - Persisted to sessionStorage for recovery

3. **Toast Notifications** (`store/toasts.ts`)
   - Ephemeral success/error messages
   - Non-blocking UI feedback

#### **Component Architecture**

```
App Router
├── Student Routes
│   ├── /student/login        → StudentLogin.tsx
│   ├── /student/consent      → StudentConsentForm.tsx
│   ├── /student/join         → StudentJoin.tsx (join by class code)
│   └── /student/run/full     → RunFull.tsx (MAIN EXERCISE FLOW)
│       ├── StoryReader       → Renders paragraphs with audio
│       ├── BlankInput        → Gap-fill input component
│       ├── MentalEffortView  → Effort scale prompt
│       ├── BreakTimeView     → 5-min countdown timer
│       ├── CorrectAnswerModal→ Reveal correct + definition
│       ├── FeedbackModal     → Post-story feedback collection
│       ├── InterventionPopup → Three-part mini-lesson
│       │   ├── MCQExercise
│       │   ├── JumbleExercise
│       │   └── SentenceExercise
│       └── Confetti          → Success animation
├── Teacher Routes
│   ├── /teacher/create       → TeacherCreate.tsx
│   ├── /teacher/experiments/:id → TeacherManage.tsx
│   ├── /teacher/stories/:id  → StoryManager.tsx
│   └── /teacher/analytics/:id → TeacherAnalytics.tsx
└── Shared Components
    ├── AppHeader             → Nav + login status
    ├── Layout                → Page wrapper
    ├── LanguageSwitcher      → i18n toggle
    ├── ErrorBoundary         → Error UI
    └── EffortPrompt          → Modal effort collector
```

#### **State Management Flow**

```
Student takes attempt
  ↓
POST /api/student/test-attempt {text, word, phase}
  ↓
Backend computes score, checks for reveal/hints
  ↓
Response: {score, correctSpelling, definition}
  ↓
Frontend updates:
  - blanksState[word] = {attempts, score, revealed}
  - attemptsByWord[word]++
  - timeByWordMs[word] += elapsed
  - If performance < threshold: trigger intervention
  ↓
Persist to sessionStorage (recovery on refresh)
  ↓
Advance to next blank or request effort rating
```

### 3.2 Backend Architecture

#### **Technology Stack**
```
Node.js + Express.js + TypeScript
├── Database: MongoDB + Mongoose
├── AI Integration: OpenAI API (GPT-4o-mini) + Claude (Anthropic)
├── Validation: Zod schemas
├── Job Queue: Node-based async queue (TBD full implementation)
├── Authentication: JWT (HS256)
├── Documentation: Swagger/OpenAPI
└── Testing: Jest (coverage reports present)
```

#### **Server Architecture**

```
src/
├── app.ts                   → Express app setup, middleware
├── index.ts                 → Server entry, listen()
├── config.ts                → Environment variables, secrets
├── db.ts                    → MongoDB connection
├── prompts.ts               → LLM prompt templates
├── queue.ts                 → Async job queue (story gen, TTS)
├── swagger.ts               → API documentation
│
├── middleware/
│   ├── auth.ts              → JWT verification, role-based access
│   └── ownership.ts         → Experiment ownership validation
│
├── routes/
│   ├── auth.ts              → /api/auth/* (login, signup, refresh)
│   ├── experiments.ts        → /api/experiments/* (CRUD, story gen, TTS)
│   ├── student.ts            → /api/student/* (join, attempt, hint, intervention)
│   ├── studentExtra.ts       → /api/student/* (feedback, consent, extra endpoints)
│   ├── analytics.ts          → /api/analytics/* (aggregated data, reports)
│   └── jobs.ts               → /api/jobs/* (async tasks, status)
│
├── controllers/
│   └── auth.controller.ts   → Shared auth logic
│
├── models/                  → Mongoose schemas
│   ├── User.ts
│   ├── Experiment.ts
│   ├── Story.ts
│   ├── Attempt.ts
│   ├── Assignment.ts
│   ├── Condition.ts
│   ├── Event.ts
│   ├── EffortResponse.ts
│   ├── InterventionAttempt.ts
│   ├── WordMetadata.ts
│   ├── ClassSession.ts (legacy)
│   ├── StudentFeedback.ts
│   ├── TeacherNote.ts
│   └── ExperimentTemplate.ts (legacy)
│
├── services/                → Business logic
│   └── (TBD: currently logic in routes)
│
├── utils/
│   ├── openai.ts            → OpenAI client + TTS
│   ├── anthropic.ts         → Claude client wrapper
│   ├── levenshtein.ts       → String similarity + letter feedback
│   ├── boldParser.ts        → Parse **target** and ++noise++ markers
│   ├── fallbackStory.ts     → Default story if LLM fails
│   ├── phaseMapper.ts       → Map occurrence index → phase label
│   ├── phaseScheduler.ts    → Schedule word occurrences
│   ├── wordAnalytics.ts     → Compute word difficulty scores
│   ├── smartRecommendations.ts → Suggest words based on history
│   ├── analyticsCache.ts    → Cache aggregated analytics
│   ├── logger.ts            → Structured logging
│   ├── labelMapper.ts       → Story label (A/B ↔ H/N) mappings
│   └── ...
│
├── data/
│   └── wordLists.ts         → Precomputed CEFR word pools
│
├── __tests__/               → Jest test suites
│   └── ...
│
└── static/
    └── audio/{expId}/       → Generated TTS MP3 files
```

#### **Request/Response Flow: Student Attempt**

```
Client: POST /api/student/test-attempt
{
  experimentId: string
  storyLabel: 'A' | 'B'
  targetWord: string
  occurrenceIndex: number
  text: string (student's attempt)
  taskType: 'gap-fill' | 'immediate-recall' | 'delayed-recall'
  phase: 'baseline' | 'learning' | 'reinforcement' | 'recall'
}
  ↓
Route: requireAuth → requireRole('student')
  ↓
Backend Logic:
  1. Fetch Attempt record (or create new)
  2. Compute correctness (normalizedLevenshtein, positionCorrectness)
  3. Determine score (0-1 range)
  4. Check: revealed? hintCount?
  5. Save to MongoDB
  6. Clear analytics cache
  ↓
Response:
{
  score: number (0-1)
  correctSpelling: string
  definition: string
  correctnessByPosition: boolean[]  // Per-letter correctness
}
```

#### **Critical Middleware**

1. **Authentication** (`middleware/auth.ts`)
   - Extracts JWT from Authorization header
   - Verifies signature, expiration
   - Populates `req.user` with `{sub: userId, role: 'teacher'|'student'}`
   - Caches decoded token for performance

2. **Role-Based Access Control** (`requireRole('student')` | `requireRole('teacher')`)
   - Ensures only teachers can create experiments
   - Only students can submit attempts
   - Prevents unauthorized data access

3. **Experiment Ownership** (`requireExperimentOwnership`)
   - Verifies teacher owns the experiment
   - Prevents cross-teacher data access
   - Protects research data integrity

### 3.3 Database (MongoDB + Mongoose)

#### **Schema Design Patterns**

1. **Normalized References**
   ```typescript
   // Assignment references Experiment, Student, Condition
   const AssignmentSchema = {
     experiment: { type: ObjectId, ref: 'Experiment' }
     student: { type: ObjectId, ref: 'User' }
     condition: { type: ObjectId, ref: 'Condition' }
     story1: { type: ObjectId, ref: 'Story' }
     story2: { type: ObjectId, ref: 'Story' }
   }
   ```

2. **Embedded Documents** (for denormalization)
   ```typescript
   // Attempt embeds array of attempt items
   attempts: [{
     text: string
     timestamp: Date
     correctnessByPosition: boolean[]
   }]
   ```

3. **Unique Indexes** (for data integrity)
   ```typescript
   // One attempt per (session, student, word, phase)
   Attempt.index({
     session: 1,
     student: 1,
     storyTemplate: 1,
     taskType: 1,
     targetWord: 1,
     phase: 1
   }, { unique: true })
   ```

#### **Indexes for Performance**
```typescript
// Fast queries by student
Attempt.index({ student: 1, createdAt: -1 })

// Session analytics
Attempt.index({ session: 1, taskType: 1 })

// Experiment analytics
Attempt.index({ experiment: 1, student: 1 })

// Event timeline
Event.index({ session: 1, ts: 1 })

// Student actions by type
Event.index({ student: 1, type: 1 })
```

#### **Data Retention & Cleanup**
- No explicit deletion (research data preservation)
- Status field supports archiving: draft → live → closed → archived
- Could add TTL indexes for demo data
- All queries filtered by `experiment` for multi-tenant safety

### 3.4 AI Integration

#### **OpenAI Integration** (`utils/openai.ts`)

```typescript
// Story Generation
POST https://api.openai.com/v1/chat/completions {
  model: 'gpt-4o-mini'
  messages: [
    {role: 'system', content: storySystemBold(4)},  // Prompt template
    {role: 'user', content: storyUserBold(cefr, targetWords, ...)}
  ]
  temperature: 0.7
  response_format: {type: 'json_object'}  // Structured output
}
← Returns: {story: {paragraphs: [...]}}

// Text-to-Speech
POST https://api.openai.com/v1/audio/speech {
  model: 'tts-1'
  voice: 'nova'  // or configured voice
  input: sentence text
  response_format: 'mp3'
}
← Returns: MP3 bytes → saved to /static/audio/{expId}/

// Hint Generation
POST .../chat/completions {
  model: 'gpt-4o-mini'
  messages: [
    {role: 'system', content: hintSystem()},
    {role: 'user', content: hintUser(targetWord, latestAttempt, lang)}
  ]
  temperature: 0.2  // Lower = more deterministic
}
← Returns: {hint: "Check for double letters"}

// Word Metadata Generation
POST .../chat/completions {
  model: 'gpt-4o-mini'
  messages: [
    {role: 'system', content: wordMetadataSystem()},
    {role: 'user', content: wordMetadataUser(word, cefr)}
  ]
}
← Returns: {
    definition: string,
    distractorDefinitions: [string, string, string],
    companionWords: [string, string, ...],
    exampleSentences: [string, string]
  }

// Sentence Validation (Intervention Exercise 3)
POST .../chat/completions {
  model: 'gpt-4o-mini'
  messages: [
    {role: 'system', content: sentenceValidationSystem()},
    {role: 'user', content: sentenceValidationUser(sentence, targetWord, baseWord)}
  ]
}
← Returns: {
    isValid: boolean,
    usedTargetWord: boolean,
    usedBaseWord: boolean,
    feedback: string
  }
```

#### **Claude Integration** (`utils/anthropic.ts`)

Fallback option for story generation:
```typescript
POST https://api.anthropic.com/v1/messages {
  model: 'claude-opus' | 'claude-sonnet'
  max_tokens: 2000
  messages: [{role: 'user', content: storyUserBold(...)}]
  system: storySystemBold(...)
}
← Returns: {content: [{type: 'text', text: '...json...'}]}
```

**Failover Logic** (from `routes/experiments.ts`):
```typescript
// Try Claude first (if config.claudeApiKey)
if (model === 'claude' && ANTHROPIC_ENABLED) {
  result = await claudeStoryGen(...)
}
// Fall back to OpenAI
else if (OPENAI_ENABLED) {
  result = await openaiStoryGen(...)
}
// Last resort: fallback story
else {
  result = generateFallbackStory(...)
}
```

### 3.5 Infrastructure

#### **Docker Deployment**

```dockerfile
# Multi-stage build (Dockerfile)
FROM node:18-alpine AS builder
WORKDIR /build
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

FROM node:18-alpine
EXPOSE 4000
ENV NODE_ENV=production
COPY --from=builder /build/node_modules node_modules
COPY --from=builder /build/server/src server/src
COPY --from=builder /build/dist dist
CMD ["node", "dist/server/src/index.js"]
```

#### **Docker Compose** (`docker-compose.yml`)

```yaml
services:
  mongodb:
    image: mongo:6.0
    ports: ["27017:27017"]
    volumes: ["mongo_data:/data/db"]
    environment:
      MONGO_INITDB_DATABASE: spellwise
  
  app:
    build: .
    ports: ["4000:4000"]
    environment:
      MONGO_URI: mongodb://mongodb:27017/spellwise
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      JWT_ACCESS_SECRET: ${JWT_SECRET}
    depends_on: [mongodb]
    volumes: [./static:/app/static]
  
  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    volumes: [./nginx.conf:/etc/nginx/nginx.conf]
    depends_on: [app]
```

#### **Nginx Reverse Proxy** (`nginx.conf`)

```nginx
upstream backend {
  server app:4000;
}

server {
  listen 80;
  
  location /api {
    proxy_pass http://backend;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
  
  location / {
    # Serve React frontend
    root /app/client/dist;
    try_files $uri $uri/ /index.html;
  }
}
```

---

## 4. Data Models & Learning Structures

### 4.1 Core Entities

#### **User Model**

```typescript
interface IUser {
  _id: ObjectId
  email?: string              // Teachers
  username?: string           // Students
  passwordHash: string        // Bcrypt
  role: 'teacher' | 'student'
  consentAt?: Date           // GDPR consent timestamp
  consentVersion?: string    // Consent doc version
  createdAt: Date
}
```

**Relationships:**
- Teacher: 1 → Many Experiments
- Student: 1 → Many Attempts
- Student: 1 → Many Assignments

#### **Experiment Model**

```typescript
interface IExperiment {
  _id: ObjectId
  owner: string              // Teacher ID
  classCode: string          // Join code (e.g., "XK7M2P")
  title: string
  description?: string
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  targetWords: string[]      // Selected target words
  noiseWords?: string[]      // Distraction words
  
  // Word selection state (complex)
  wordSelection?: {
    targetCurrent: string[]  // 4 words from current level
    targetHigher: string[]   // 4 words from higher level
    targetLower: string[]    // 2 words from lower level
    noiseCurrent: string[]
    noiseHigher: string[]
    noiseLower: string[]
  }
  
  // Story references
  storyRefs?: {
    story1: ObjectId         // A = with-hints
    story2: ObjectId         // B = without-hints
  }
  
  status: 'draft' | 'live' | 'closed' | 'archived'
  storiesConfirmed?: boolean // Teacher approved stories
  createdAt: Date
  updatedAt: Date
}
```

**Pedagogical Purpose:**
- Tracks complete experiment lifecycle
- Balances word distribution across CEFR levels
- Maintains bidirectional reference to stories

#### **Story Model**

```typescript
interface IStory {
  _id: ObjectId
  experiment: ObjectId       // Parent experiment
  label: 'A' | 'B'          // Condition label
  
  paragraphs: string[]       // 4-5 paragraphs, cleaned text
  
  // Word occurrence positions (from LLM parsing)
  targetOccurrences: [{
    word: string
    paragraphIndex: number
    sentenceIndex: number
    charStart?: number
    charEnd?: number
  }]
  
  noiseOccurrences?: [{
    word: string
    paragraphIndex: number
    sentenceIndex: number
    charStart?: number
    charEnd?: number
  }]
  
  // TTS audio
  ttsAudioUrl?: string       // Fallback single URL
  ttsSegments?: string[]     // Per-sentence URLs [s0.mp3, s1.mp3, ...]
  
  createdAt: Date
}
```

**Pedagogical Purpose:**
- Stores validated story content with explicit word positions
- Supports audio-assisted learning
- Maintains condition-specific narratives

#### **Condition Model**

```typescript
interface ICondition {
  _id: ObjectId
  experiment: ObjectId
  type: 'with-hints' | 'without-hints'
  createdAt: Date
}
```

**Design Note:** Kept separate from Experiment for flexibility:
- Allows multiple conditions per experiment (future)
- Simplifies A/B test logic
- Enables condition-specific analytics

#### **Assignment Model**

```typescript
interface IAssignment {
  _id: ObjectId
  experiment: ObjectId
  student: ObjectId
  condition: ObjectId
  
  // Story order randomization
  storyOrder: 'A-first' | 'B-first'
  
  // Story references
  story1: ObjectId           // Reference to Story with label A
  story2: ObjectId           // Reference to Story with label B
  
  // Timed breaks & delays
  breakUntil?: Date          // When 5-min break ends
  recallUnlockAt?: Date      // When 12-hour delay expires
  
  story1CompletedAt?: Date
  story2CompletedAt?: Date
  
  createdAt: Date
}
```

**Pedagogical Purpose:**
- One assignment per (experiment, student, condition) pair
- Balances presentation order (A-first vs B-first)
- Manages critical timing: break duration, recall delay

#### **Attempt Model** (Core Learning Data)

```typescript
interface IAttempt {
  _id: ObjectId
  
  // Relationships
  experiment: ObjectId       // v2 reference
  student: ObjectId
  story: ObjectId
  
  // Task identity
  taskType: 'gap-fill' | 'immediate-recall' | 'delayed-recall'
  targetWord: string
  phase: 'baseline' | 'learning' | 'reinforcement' | 'recall'
  abCondition: 'with-hints' | 'without-hints'
  
  // Attempt history (array of attempts)
  attempts: [{
    text: string             // Student's spelling attempt
    timestamp: Date
    correctnessByPosition: boolean[]  // Letter-by-letter feedback
  }]
  
  // Performance metrics
  revealed: boolean          // Student asked to see answer
  hintCount: number          // Number of hints requested
  finalText: string          // Last attempt text
  score: number              // 0-1 normalized score
  
  // Timing
  latencyMsFirst?: number    // Time to first attempt
  totalTimeMs?: number       // Total time on word
  
  createdAt: Date
}
```

**Critical Design Decisions:**
- **Array of attempts**: Captures learning trajectory (not just final answer)
- **Per-letter correctness**: Enables detailed error analysis
- **Phase tracking**: Correlates performance with learning stage
- **Unique constraint**: One Attempt per (experiment, student, word, phase) ensures data integrity

#### **Event Model**

```typescript
interface IEvent {
  _id: ObjectId
  
  experiment: ObjectId
  student: ObjectId
  
  // Event classification
  type: 'audio_play' | 'audio_pause' | 'audio_skip' 
      | 'key' | 'hint_request' | 'reveal' 
      | 'focus' | 'blur' | 'effort'
      | 'intervention_started' | 'intervention_completed'
  
  taskType: string           // Context
  targetWord?: string
  
  // Flexible payload
  payload: unknown           // Event-specific data
  ts: Date                   // Timestamp
}
```

**Analytical Purpose:**
- Supports detailed behavioral trace analysis
- Tracks engagement: audio patterns, help-seeking behavior
- Enables learning sequence reconstruction

#### **EffortResponse Model**

```typescript
interface IEffortResponse {
  _id: ObjectId
  
  experiment: ObjectId
  student: ObjectId
  
  // Context
  taskType?: string
  storyLabel?: 'A' | 'B'
  paragraphIndex?: number
  
  // The rating
  position: 'mid' | 'end'
  score: number              // 1-9 scale
  
  ts: Date
}
```

**Research Purpose:**
- Correlates effort with performance
- Tests cognitive load theory predictions
- Individual differences in learning efficiency

#### **InterventionAttempt Model**

```typescript
interface IInterventionAttempt {
  _id: ObjectId
  
  experiment: ObjectId
  student: ObjectId
  story: ObjectId
  
  targetWord: string
  occurrenceIndex: number    // 1-3 only
  paragraphIndex: number
  
  // Exercise 1: MCQ
  mcqAttempts: [{
    selectedAnswer: string
    correctAnswer: string
    isCorrect: boolean
    timestamp: Date
  }]
  mcqCompleted: boolean
  
  // Exercise 2: Jumble
  jumbleAttempts: [{
    arrangement: string
    isCorrect: boolean
    timestamp: Date
  }]
  jumbleCompleted: boolean
  
  // Exercise 3: Sentence
  sentenceAttempts: [{
    sentence: string
    usedTargetWord: boolean
    usedBaseWord: boolean
    baseWord: string
    isValid: boolean
    feedback: string
    timestamp: Date
  }]
  sentenceCompleted: boolean
  
  // Performance
  allExercisesCompleted: boolean
  totalTimeMs: number
  completedAt: Date | null
  
  createdAt: Date
}
```

**Pedagogical Significance:**
- Captures remedial intervention engagement
- Tracks exercise difficulty (e.g., why sentence writing is hard)
- Enables intervention effectiveness analysis

#### **WordMetadata Model**

```typescript
interface IWordMetadata {
  _id: ObjectId
  
  experiment: ObjectId
  word: string
  
  // Lexical information
  definition: string
  partOfSpeech: string
  
  // Exercise support
  distractorDefinitions: string[]  // MCQ distractors
  commonCollocations: string[]     // Sentence exercise base words
  exampleSentences: string[]       // Reference examples
  syllables: string[]              // Pronunciation breakdown
  
  createdAt: Date
}
```

**Relationship**: One WordMetadata per unique word per experiment

### 4.2 Entity Relationships

```
User (teacher)
  ↓ owns
Experiment
  ├─ has → Story (A: with-hints, B: without-hints)
  ├─ has → Condition (with-hints, without-hints)
  ├─ has → WordMetadata (per target word)
  └─ has → Assignment (per enrolled student)

Assignment
  ├─ references → Experiment
  ├─ references → User (student)
  ├─ references → Condition
  ├─ references → Story1 (label A)
  └─ references → Story2 (label B)

User (student)
  ↓ completes
Attempt
  ├─ references → Experiment
  ├─ references → Story
  ├─ references → User (student)
  └─ contains → phase (baseline → learning → reinforcement → recall)

Attempt (during story)
  ↓ may trigger
InterventionAttempt
  ├─ references → Experiment
  ├─ references → Story
  ├─ contains → 3 exercises (MCQ, Jumble, Sentence)
  └─ tracked in analytics

Event (behavioral trace)
  ├─ references → Experiment
  ├─ references → User (student)
  └─ captures interaction timestamps

EffortResponse
  ├─ references → Experiment
  ├─ references → User (student)
  └─ contains 1-9 effort rating
```

### 4.3 Pedagogical Data Structures

#### **Word Occurrence Phase Schedule**

```typescript
interface WordSchedule {
  [word: string]: {
    baseline: PhasePlacement      // Occurrence 1
    learning: PhasePlacement      // Occurrence 2
    reinforcement: PhasePlacement // Occurrence 3
    recall: PhasePlacement        // Occurrence 4
  }
}

interface PhasePlacement {
  phase: 'baseline' | 'learning' | 'reinforcement' | 'recall'
  paragraphIndex?: number
  sentenceIndex?: number
}
```

**Implementation**: `utils/phaseScheduler.ts`

Ensures each word:
1. Appears in different paragraphs/sentences (learning contexts)
2. Has baseline assessment (prior knowledge)
3. Has recall test (retention without support)
4. Maintains pedagogical validity (not clustered)

#### **Blank State Tracker** (Client-side)

```typescript
interface BlankState {
  filled: boolean             // Is blank filled?
  correct: boolean
  attempts: string[]          // Student attempts
  revealed: boolean
  hintCount: number
  score: number
  locked: boolean             // Prevent further edits
  feedbackGiven: boolean
  revealed_at?: Date
  intervention_triggered?: boolean
}
```

Tracks fine-grained learning trajectory per word occurrence.

---

## 5. User Workflows

### 5.1 Student Learning Flow

#### **Complete Student Journey**

```
LOGIN
  ↓ (credentials verify, JWT issued)
CONSENT
  ↓ (GDPR: record consentAt)
JOIN BY CLASS CODE
  ↓ (POST /api/student/join → creates Assignment, balanced condition)
INITIAL STORY (Story A or B, randomized by storyOrder)
  ├─ Load story + audio segments
  ├─ Render 4-5 paragraphs with blanks
  ├─ For each target word (4 occurrences):
  │   ├─ Blank 1 (BASELINE):
  │   │   ├─ Student types → POST /api/student/test-attempt
  │   │   ├─ Feedback: letter-by-letter correctness
  │   │   ├─ If struggling: offer hints (with-hints condition only)
  │   │   ├─ If hint requested: LLM generates vague hint
  │   │   ├─ If revealed: show correct spelling + definition
  │   │   └─ Log attempt + timing
  │   ├─ Blank 2 (LEARNING): repeat with hints available
  │   ├─ Blank 3 (REINFORCEMENT): repeat with hints available
  │   └─ Blank 4 (RECALL): NO HINTS, test immediate retention
  │       └─ If failed: trigger intervention (with-hints only)
  │
  ├─ After each paragraph: POST /api/student/effort (1-9 scale)
  ├─ After story completion: POST /api/student/feedback
  │   └─ Collect: difficulty (1-5), enjoyment (1-5), comment, effort
  └─ POST /api/student/story-completed → unlock break timer
      ↓
  BREAK (5 minutes)
      ↓
  SECOND STORY (Other condition)
      ├─ Identical flow to Story A
      └─ If condition swapped: different hint availability
      ↓
  RECALL TEST (after 12+ hours)
      ├─ All target words appear once more
      ├─ NO hints (immediate test to measure retention)
      └─ Score compared to recall phase from initial stories
      ↓
  SESSION COMPLETE
```

#### **Intervention Trigger & Flow**

```
During gap-fill, student attempts word occurrence:
  ├─ If REVEAL button clicked:
  │   └─ SET revealed = true
  ├─ IF hint requested >= 2 times:
  │   └─ Hint count accumulates
  └─ If (revealed OR hintCount >= 2) AND occurrence < 4:
      └─ POST /api/student/intervention/start
          ↓
          INTERVENTION POPUP (3 exercises)
          ├─ Exercise 1: MCQ
          │   └─ "Select the correct definition"
          │       POST /api/student/intervention/mcq
          ├─ Exercise 2: Jumble
          │   └─ "Arrange letters to spell word"
          │       POST /api/student/intervention/jumble
          └─ Exercise 3: Sentence
              └─ "Write sentence using target + base word"
                  POST /api/student/intervention/sentence
                  ↓
              POST /api/student/intervention/complete
              ↓
          CLOSE POPUP, return to story
```

#### **Audio-Assisted Reading**

```
Story displayed with integrated TTS audio:
  ├─ Play button: Start audio from current sentence
  ├─ Pause button: Pause audio (student can read ahead)
  ├─ Skip +3s: Jump forward 3 seconds
  ├─ Skip -3s: Jump back 3 seconds
  └─ Audio pauses automatically at word boundaries for clarity
```

### 5.2 Teacher Experiment Management Flow

#### **Complete Teacher Journey**

```
LOGIN
  ↓ (email + password)
CREATE EXPERIMENT
  ├─ Title: "Present Tense Verbs B1"
  ├─ Level: B1
  ├─ Status: "draft"
  └─ ClassCode: auto-generated (e.g., "XK7M2P")
      ↓
SELECT TARGET WORDS
  ├─ Manual entry OR
  ├─ Smart recommendations (from word pool)
  │   └─ Grouped by level (current, higher, lower)
  │   └─ Sorted by difficulty/engagement from past experiments
  └─ Save word selection
      ↓
GENERATE STORIES
  ├─ POST /api/experiments/:id/generate-stories
  ├─ LLM generates two stories:
  │   ├─ Story A (with-hints condition): Natural narrative
  │   └─ Story B (without-hints condition): Different narrative
  ├─ Validate: Each word 4+ occurrences
  ├─ Save stories to MongoDB
  └─ Teacher previews in UI (highlighted words)
      ↓
GENERATE TTS AUDIO
  ├─ POST /api/experiments/:id/tts
  ├─ OpenAI TTS converts each sentence to MP3
  ├─ Save to /static/audio/{expId}/{label}_s{index}.mp3
  └─ Generate audio URLs
      ↓
REVIEW & CONFIRM
  ├─ Teacher listens to audio
  ├─ Reads stories
  ├─ Checks word highlights
  ├─ POST /api/experiments/:id/confirm-stories
  └─ Status → "live"
      ↓
LAUNCH EXPERIMENT
  ├─ Share classCode with students (email, paper, display)
  ├─ Students join via /student/join
  └─ Assignments created automatically (balanced condition)
      ↓
MONITOR PROGRESS
  ├─ GET /api/analytics/experiment/:id
  ├─ Real-time dashboards:
  │   ├─ Student enrollment
  │   ├─ Per-word difficulty
  │   ├─ Condition comparison (A vs B performance)
  │   ├─ Effort correlations
  │   └─ Intervention engagement
  └─ CSV export for further analysis
      ↓
CLOSE & ANALYZE
  ├─ POST /api/experiments/:id/close
  ├─ No new enrollments accepted
  ├─ Generate final report
  └─ Archive experiment (status → "archived")
```

### 5.3 Admin/System Workflows (Emerging)

Currently limited, but infrastructure supports:

```
SYSTEM CONFIGURATION
├─ API key management (OpenAI, Claude, etc.)
├─ Word pool curation (CEFR levels)
├─ Prompt template tuning
├─ Analytics cache management
└─ Audit logging

MONITORING
├─ Error rates
├─ API latency (LLM response time)
├─ Database size
└─ User activity logs
```

---

## 6. Learning Adaptation Logic

### 6.1 Difficulty & Content Personalization

#### **Word Difficulty Scoring Algorithm**

From `utils/wordAnalytics.ts`:

```typescript
async function analyzeWordDifficulty(experimentId, words): Promise<WordMetrics[]> {
  for (const word of words) {
    // Fetch all attempts for this word across all students
    const attempts = await Attempt.find({
      experiment: experimentId,
      targetWord: word
    })
    
    if (!attempts.length) continue
    
    // Calculate metrics
    const totalAttempts = attempts.length
    const avgScore = attempts.reduce((s, a) => s + a.score, 0) / totalAttempts
    const avgLatency = attempts.reduce((s, a) => s + (a.latencyMsFirst || 0), 0) / totalAttempts
    const avgHintCount = attempts.reduce((s, a) => s + a.hintCount, 0) / totalAttempts
    const revealRate = attempts.filter(a => a.revealed).length / totalAttempts
    
    // Composite difficulty score (0-100)
    const difficultyScore = Math.round(
      (1 - avgScore) * 40           // Inverse accuracy: harder if low score
      + revealRate * 30             // Reveal seeking indicates confusion
      + (avgHintCount / 3) * 20     // Hint dependency
      + (avgLatency / 10000) * 10   // Processing time
    )
    
    metrics.push({
      word,
      totalAttempts,
      avgScore: Math.round(avgScore * 100) / 100,
      avgLatency: Math.round(avgLatency),
      avgHintCount: Math.round(avgHintCount * 10) / 10,
      revealRate: Math.round(revealRate * 100),
      difficultyScore: Math.min(100, Math.max(0, difficultyScore))
    })
  }
  
  return metrics.sort((a, b) => b.difficultyScore - a.difficultyScore)
}
```

**Interpretation:**
- Score 0-30: Easy word (80%+ accuracy, minimal help needed)
- Score 30-60: Medium difficulty ("sweet spot" for challenge)
- Score 60-100: Hard word (persistent struggles, high help-seeking)

#### **Smart Word Recommendation System**

From `utils/smartRecommendations.ts`:

```typescript
export async function getSmartRecommendations(
  cefr: string,
  excludeWords: string[],
  teacherId: string
): Promise<SmartRecommendation[]> {
  const recommendations: SmartRecommendation[] = []
  
  // Analyze past experiments by this teacher
  const pastExperiments = await Experiment.find({
    owner: teacherId
  })
  
  for (const pastExp of pastExperiments) {
    const metrics = await analyzeWordDifficulty(pastExp._id, pastExp.targetWords)
    
    for (const metric of metrics) {
      if (excludeWords.includes(metric.word)) continue
      
      // Score recommendation
      const avgDifficulty = metric.difficultyScore
      const avgEngagement = 100 - metric.revealRate
      
      // Prefer words near "difficulty sweetspot" (50/100)
      const difficultyBonus = Math.abs(avgDifficulty - 50) < 20 ? 20 : 0
      
      // Prefer words with high engagement
      const engagementBonus = avgEngagement * 0.5
      
      const score = Math.round(difficultyBonus + engagementBonus)
      
      recommendations.push({
        word: metric.word,
        reason: `Used ${metrics.length}x before (difficulty: ${Math.round(avgDifficulty)}/100)`,
        score,
        pastDifficulty: Math.round(avgDifficulty)
      })
    }
  }
  
  // Combine with static word pool and return top N
  return recommendations.sort((a, b) => b.score - a.score)
}
```

**Adaptation Logic:**
- Tracks teacher's word usage patterns across multiple experiments
- Recommends words that created "optimal challenge" (near 50 difficulty)
- Deprioritizes words that were too hard (>70) or too easy (<30)
- Filters out recently-used words

### 6.2 Phase-Based Progression

#### **Phase Scheduling Algorithm**

From `utils/phaseScheduler.ts`:

```typescript
export function scheduleWordPhases(
  word: string,
  occurrences: TargetOccurrence[],
  paragraphCount: number
): Record<Phase, PhasePlacement> {
  
  const out: Record<Phase, PhasePlacement> = {
    baseline: { phase: 'baseline' },
    learning: { phase: 'learning' },
    reinforcement: { phase: 'reinforcement' },
    recall: { phase: 'recall' }
  }
  
  // Deduplicate by paragraph + sentence
  const uniqByKey = new Map()
  occurrences.forEach(o => {
    uniqByKey.set(`${o.paragraphIndex}:${o.sentenceIndex}`, o)
  })
  const uniq = Array.from(uniqByKey.values())
  
  // Sort by paragraph (prefer variety)
  uniq.sort((a, b) => 
    a.paragraphIndex - b.paragraphIndex || 
    a.sentenceIndex - b.sentenceIndex
  )
  
  // Select 3 unique locations for baseline, learning, reinforcement
  const picks = []
  for (const o of uniq) {
    if (picks.length === 0 || 
        !picks.some(p => p.paragraphIndex === o.paragraphIndex && 
                         p.sentenceIndex === o.sentenceIndex)) {
      picks.push(o)
    }
    if (picks.length >= 3) break
  }
  
  // If fewer than 3 unique occurrences, synthesize additional placements
  let cursor = 0
  while (picks.length < 3 && cursor < paragraphCount) {
    const pi = cursor % Math.max(1, paragraphCount)
    if (!picks.some(p => p.paragraphIndex === pi)) {
      picks.push({ word, paragraphIndex: pi, sentenceIndex: 0 })
    }
    cursor++
  }
  
  // Assign phases to selected placements
  out.baseline = {
    phase: 'baseline',
    paragraphIndex: picks[0]?.paragraphIndex,
    sentenceIndex: picks[0]?.sentenceIndex
  }
  out.learning = {
    phase: 'learning',
    paragraphIndex: picks[1]?.paragraphIndex,
    sentenceIndex: picks[1]?.sentenceIndex
  }
  out.reinforcement = {
    phase: 'reinforcement',
    paragraphIndex: picks[2]?.paragraphIndex,
    sentenceIndex: picks[2]?.sentenceIndex
  }
  out.recall = { phase: 'recall' }
  
  return out
}
```

**Pedagogical Design:**
- Ensures each phase has distinct context (different paragraph/sentence)
- Prevents student from "guessing" word position
- Maintains optimal spacing within ~10-15 minute session
- Recall phase location random (tests retention without positional memory)

#### **Occurrence Index → Phase Mapping**

From `utils/phaseMapper.ts`:

```typescript
export function getPhaseForOccurrence(occurrenceIndex: number): Phase | undefined {
  switch (occurrenceIndex) {
    case 1: return 'baseline'      // First encounter
    case 2: return 'learning'      // After initial feedback
    case 3: return 'reinforcement' // After learning
    case 4: return 'recall'        // No hints, retention test
    default: return undefined      // Extra occurrences ignored
  }
}
```

### 6.3 Intervention Triggering Logic

#### **When Interventions Are Activated**

From `routes/student.ts` (test-attempt endpoint):

```typescript
// After student completes a blank attempt:

if (revealed || hintCount >= 2) {
  // Student asked for reveal OR used multiple hints
  
  if (occurrenceIndex < 4) {
    // Not the recall phase
    
    if (abCondition === 'with-hints') {
      // Only in with-hints condition
      
      // Fetch/create InterventionAttempt
      let intervention = await InterventionAttempt.findOne({
        experiment,
        student,
        story,
        targetWord,
        occurrenceIndex
      })
      
      if (!intervention) {
        intervention = await InterventionAttempt.create({
          experiment,
          student,
          story,
          targetWord,
          occurrenceIndex,
          paragraphIndex,
          startedAt: new Date()
        })
      }
      
      // Client receives intervention ID
      return res.json({
        shouldShowIntervention: true,
        interventionId: intervention._id
      })
    }
  }
}
```

**Critical Conditions:**
1. Performance signal: reveal OR hint_count >= 2
2. Learning window: occurrence < 4 (never on recall phase)
3. Condition check: with-hints condition only (experimental control)

### 6.4 Hint Generation (Staged Adaptation)

From `routes/student.ts` (test-hint endpoint):

```typescript
const effectiveAttemptCount = hintCount + (revealed ? 1 : 0)
const timeSpentMs = Date.now() - attemptStart

// Determine hint stage based on time and attempts
const stageByAttempts =
  effectiveAttemptCount >= 9 ? 'morphology'
  : effectiveAttemptCount >= 6 ? 'semantic'
  : effectiveAttemptCount >= 3 ? 'phoneme'
  : 'orthographic'

const stageByTime =
  timeSpentMs >= 120000 ? 'semantic'      // 2+ minutes
  : timeSpentMs >= 45000 ? 'phoneme'     // 45+ seconds
  : 'orthographic'

// Use worst case (requires most support)
const stageRank = {
  orthographic: 1,
  phoneme: 2,
  semantic: 3,
  morphology: 4
}
const stage = stageRank[stageByTime] > stageRank[stageByAttempts]
  ? stageByTime
  : stageByAttempts
```

**Hint Stages:**
- **Orthographic** (early): "Check for double letters", "Look at the vowels"
- **Phoneme** (medium): "Say it out loud slowly", "Listen for silent sounds"
- **Semantic** (advanced): "Think about similar words", "Consider the meaning"
- **Morphology** (late): "Check the prefix/suffix", "How does the base word change?"

### 6.5 Condition Assignment (Balanced Randomization)

When student joins with class code:

```typescript
router.post('/join', async (req, res) => {
  const { classCode } = req.body
  
  // Fetch experiment
  const exp = await Experiment.findOne({ classCode })
  
  // Check existing assignment
  let assignment = await Assignment.findOne({
    experiment: exp._id,
    student: req.user.sub
  })
  
  if (!assignment) {
    // Random condition + story order
    const conditions = await Condition.find({ experiment: exp._id })
    const condition = conditions[Math.random() < 0.5 ? 0 : 1]
    
    const storyOrder = Math.random() < 0.5 ? 'A-first' : 'B-first'
    
    assignment = await Assignment.create({
      experiment: exp._id,
      student: req.user.sub,
      condition: condition._id,
      storyOrder,
      // Calculate break/recall times
      breakUntil: new Date(Date.now() + 5 * 60 * 1000),
      recallUnlockAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      story1: storyA._id,
      story2: storyB._id
    })
  }
  
  return res.json({ assignment })
})
```

**Randomization Features:**
- Balanced condition assignment (50/50 with-hints vs without-hints)
- Counterbalanced story order (A-first vs B-first)
- Prevents ordering confounds

---

## 7. Analytics & Insights

### 7.1 Metrics Tracked

#### **Attempt-Level Metrics**

```typescript
interface AttemptMetrics {
  score: number                    // 0-1 (normalized Levenshtein)
  correctnessByPosition: boolean[] // Per-letter accuracy
  hintCount: number               // Times hint requested
  revealed: boolean               // Times answer revealed
  latencyMsFirst: number          // Time to first attempt
  totalTimeMs: number             // Total time on blank
  attempts: number                // Total attempts
  phase: 'baseline' | 'learning' | 'reinforcement' | 'recall'
  abCondition: 'with-hints' | 'without-hints'
}
```

#### **Event-Level Metrics**

```typescript
interface EventMetrics {
  audio_play: number             // Times audio started
  audio_pause: number            // Times paused
  audio_skip: number             // Times skipped
  hint_request: number           // Hint requests
  reveal: number                 // Answer reveals
  focus: number                  // Times focused on window
  blur: number                   // Times unfocused
  intervention_started: number
  intervention_completed: number
}
```

#### **Effort-Level Metrics**

```typescript
interface EffortMetrics {
  effortScores: number[]         // [1-9, 1-9, ...] per mid/end
  meanEffort: number             // Average cognitive load
  effortByPhase: Record<Phase, number[]>  // Effort per phase
}
```

#### **Word-Level Aggregate Metrics**

```typescript
interface WordDifficulty {
  word: string
  totalAttempts: number
  avgScore: number               // 0-1
  avgLatency: number            // ms
  avgHintCount: number
  revealRate: number            // 0-1
  difficultyScore: number       // 0-100 composite
}
```

#### **Condition Comparison Metrics**

```typescript
interface ConditionComparison {
  condition: 'with-hints' | 'without-hints'
  
  // Accuracy by phase
  baselineAccuracy: number
  learningAccuracy: number
  reinforcementAccuracy: number
  recallAccuracy: number
  
  // Help-seeking
  avgHintsPerWord: number
  revealRate: number
  
  // Engagement
  avgEffort: number
  interventionTriggerRate: number
  
  // Efficiency
  avgTimePerWord: number
  sessionDuration: number
}
```

### 7.2 Data Collection Points

#### **Frontend Event Collection**

```typescript
// In RunFull.tsx (main exercise component)

// When student submits attempt
POST /api/student/test-attempt {
  experimentId, storyLabel, targetWord, 
  occurrenceIndex, text, taskType, phase
}

// When student requests hint
POST /api/student/test-hint {
  targetWord, latestAttempt, occurrenceIndex, uiLanguage
}
+ Event created: type: 'hint_request'

// When student rates effort
POST /api/student/effort {
  experimentId, position: 'mid'|'end', score: 1-9, taskType
}

// When student reveals answer
Event created: type: 'reveal'

// Audio player interactions
Event created: type: 'audio_play', 'audio_pause', 'audio_skip'

// Window focus/blur
Event created: type: 'focus', 'blur'
```

#### **Backend Event Collection**

```typescript
// In routes/student.ts

// After each attempt
await Attempt.create({
  experiment, student, story, taskType, targetWord, phase,
  attempts: [{text, timestamp, correctnessByPosition}],
  score, revealed, hintCount, latencyMsFirst, totalTimeMs
})

// After effort submission
await EffortResponse.create({
  experiment, student, position, score, taskType, ts
})

// After intervention triggered
await Event.create({
  type: 'intervention_started',
  payload: {targetWord, occurrenceIndex, paragraphIndex, storyLabel}
})

// After intervention complete
await Event.create({
  type: 'intervention_completed',
  payload: {
    targetWord, occurrenceIndex,
    mcqAttempts, jumbleAttempts, sentenceAttempts
  }
})
```

### 7.3 Analytics Used for Personalization

#### **Analytics Dashboard** (TeacherAnalytics.tsx)

```typescript
// Experiment-level aggregates
const analytics = {
  // Enrollment
  totalStudents: number
  completionRate: number
  
  // Performance
  averageAccuracy: number
  averageRecallAccuracy: number
  
  // Per-word analysis
  wordDifficulty: WordDifficulty[]
  
  // Condition comparison
  conditionComparison: ConditionComparison
  
  // Timeline
  completionTimeline: [{day, attempts, correct, hints}]
  
  // Engagement
  effortCorrelation: number        // Effort ↔ Accuracy correlation
  interventionImpact: number       // Do interventions improve recall?
}
```

#### **Personalization Triggers**

1. **Word Recommendation** (for next experiment)
   - Input: This teacher's past experiments, exclusion list
   - Analysis: Word difficulty, engagement, CEFR level
   - Output: Top 10 recommended words with reasoning

2. **Condition Effectiveness** (for research hypothesis)
   - Input: All students' performance by condition
   - Analysis: Accuracy improvement from with-hints vs without
   - Output: Statistical comparison (t-test ready)

3. **Effort-Performance Correlation**
   - Input: All effort ratings + attempt scores
   - Analysis: Spearman correlation
   - Output: Learning difficulty perception vs actual performance

### 7.4 CSV Export Functionality

From `routes/analytics.ts`:

```typescript
router.get('/experiment/:id/csv', async (req, res) => {
  // Fetch all attempts, efforts, events for experiment
  
  // Generate CSV rows:
  // studentId, word, phase, condition, 
  // score, hintCount, revealed, effortScore, interventionCompleted
  
  const csv = toCsv(rows)
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="analytics-${expId}.csv"`)
  res.send(csv)
})
```

**Use Cases:**
- Import into R/Python for statistical analysis
- Visualize in Excel/Tableau
- Generate publication-ready tables

---

## 8. Critical Files to Review

### 8.1 Pedagogical Core

| Feature | Primary Files | Purpose |
|---------|--------------|---------|
| **Story Generation** | `routes/experiments.ts` | LLM integration, validation, story creation |
| **Phase Architecture** | `utils/phaseScheduler.ts`, `utils/phaseMapper.ts` | Word occurrence scheduling, phase assignment |
| **Gap-Fill Exercise** | `routes/student.ts` (test-attempt), `RunFull.tsx` | Core spelling practice, feedback |
| **Hint System** | `routes/student.ts` (test-hint), `prompts.ts` | Contextual hint generation |
| **Interventions** | `routes/student.ts` (intervention/*), `InterventionPopup.tsx` | 3-part remedial exercises |
| **Effort Tracking** | `models/EffortResponse.ts`, `EffortPrompt.tsx` | Cognitive load assessment |
| **A/B Testing** | `models/Condition.ts`, `models/Assignment.ts` | Condition assignment, randomization |

### 8.2 Data Management

| Layer | Key Files | Purpose |
|-------|-----------|---------|
| **Models** | `models/*.ts` | Mongoose schemas (Attempt, Story, Intervention, etc.) |
| **Analytics** | `routes/analytics.ts`, `utils/wordAnalytics.ts` | Aggregation, reporting, CSV export |
| **Database** | `db.ts` | MongoDB connection, indexes |
| **Cache** | `utils/analyticsCache.ts` | Performance optimization |

### 8.3 AI Integration

| Service | Files | Purpose |
|---------|-------|---------|
| **OpenAI** | `utils/openai.ts`, `prompts.ts` | GPT-4o-mini story gen, TTS, hints, word metadata |
| **Claude** | `utils/anthropic.ts`, `prompts.ts` | Fallback story generation |
| **Prompts** | `prompts.ts` | LLM system + user prompts (story, hint, MCQ, validation) |
| **Fallback** | `utils/fallbackStory.ts` | Hardcoded story if LLM fails |

### 8.4 Frontend Components

| Component | File | Purpose |
|-----------|------|---------|
| **Main Exercise** | `RunFull.tsx` | Central student learning interface |
| **Gap-Fill Input** | `BlankInput.tsx` | Spelling input + feedback |
| **Audio Player** | `StoryReader.tsx` | Audio + text synchronized |
| **Interventions** | `InterventionPopup.tsx`, `exercises/*.tsx` | 3-part mini-lessons |
| **Effort Rating** | `MentalEffortView.tsx` | 9-point effort scale |
| **Teacher Dashboard** | `TeacherAnalytics.tsx` | Analytics visualization |

### 8.5 Utility Functions

| Utility | File | Purpose |
|---------|------|---------|
| **Scoring** | `utils/levenshtein.ts` | Normalized Levenshtein, letter feedback |
| **Parsing** | `utils/boldParser.ts` | Extract **target** and ++noise++ markers |
| **Phase Mapping** | `utils/phaseMapper.ts` | Occurrence → phase conversion |
| **Recommendations** | `utils/smartRecommendations.ts` | Word suggestion algorithm |

---

## Critical Implementation Insights

### Pedagogical Strengths
1. **Evidence-Based Design**: Phase-based model aligns with memory consolidation research (spacing effects, retrieval practice)
2. **Systematic A/B Testing**: Enables causal inference about hints (with-hints vs without-hints)
3. **Multimodal Learning**: Combines visual, auditory, kinesthetic (typing) modalities
4. **Metacognitive Integration**: Effort ratings promote self-awareness
5. **Contextual Learning**: Words in narrative context, not isolated drill

### Technical Strengths
1. **Scalable Architecture**: Mongoose indexes, caching layer, async job queue
2. **Robust Error Handling**: Fallback story generator, LLM retry logic
3. **Type Safety**: Full TypeScript across stack
4. **Data Integrity**: Unique indexes, validation schemas
5. **Flexible Persistence**: Zustand stores, sessionStorage, MongoDB

### Research Capability
1. **Rich Event Logging**: Behavioral trace reconstruction possible
2. **Learner Analytics**: Per-student learning curves extractable
3. **Word Difficulty Profiling**: Comparative difficulty analysis
4. **Intervention Effectiveness**: A/B test intervention impact
5. **Publication-Ready Exports**: CSV for statistical analysis

---

## Appendix: Common Queries & Analytics

### A1. Student Performance Analysis

```sql
-- Average accuracy by phase
SELECT phase, AVG(score) as avgAccuracy
FROM attempts
WHERE experiment = ?
GROUP BY phase

-- Learning gains (baseline → recall)
SELECT student,
  AVG(CASE WHEN phase='baseline' THEN score END) as baselineAccuracy,
  AVG(CASE WHEN phase='recall' THEN score END) as recallAccuracy
FROM attempts
WHERE experiment = ?
GROUP BY student

-- Condition effect
SELECT abCondition, 
  AVG(score) as accuracy,
  AVG(hintCount) as avgHints,
  AVG(CASE WHEN revealed=1 THEN 1 ELSE 0 END) as revealRate
FROM attempts
WHERE experiment = ?
GROUP BY abCondition
```

### A2. Intervention Effectiveness

```sql
-- Do interventions improve outcomes?
SELECT 
  (SELECT AVG(score) FROM attempts 
   WHERE experiment=? AND phase='recall' AND targetWord IN 
    (SELECT DISTINCT targetWord FROM interventionattempts 
     WHERE experiment=? AND allExercisesCompleted=1))
  as recallWithIntervention,
  
  (SELECT AVG(score) FROM attempts 
   WHERE experiment=? AND phase='recall' AND targetWord NOT IN 
    (SELECT DISTINCT targetWord FROM interventionattempts 
     WHERE experiment=?))
  as recallWithoutIntervention
```

### A3. Effort-Performance Correlation

```sql
-- Spearman correlation: effort ↔ accuracy
SELECT CORR(effortresponse.score, attempt.score) as effortCorrelation
FROM effortresponses
JOIN attempts ON effortresponses.student = attempts.student
  AND effortresponses.experiment = attempts.experiment
WHERE effortresponses.experiment = ?
```

---

## Conclusion

SpellWise represents a **pedagogically-grounded, data-rich platform** for spelling acquisition research. Its architecture balances:

- **Learning science** (phase-based exposure, spacing effects, retrieval practice)
- **User experience** (gamification, accessibility, multimodal engagement)
- **Research rigor** (RCT design, controlled conditions, detailed event logging)
- **Technical scalability** (cloud-ready, LLM-integrated, analytics-optimized)

The system is well-positioned for thesis work focused on:
1. Effectiveness of hints in spelling acquisition
2. Individual differences in learning efficiency (effort-performance correlations)
3. Vocabulary retention (immediate vs delayed recall patterns)
4. Intervention impact (do 3-part mini-lessons improve outcomes?)
5. Learning trajectories (how do phases progress for different learners?)

---

**Document Generated**: April 17, 2026  
**Codebase Version**: v2 (Experiments + Stories model)  
**Analysis Depth**: Thorough (all core systems reviewed)
