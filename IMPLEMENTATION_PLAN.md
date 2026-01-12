# SpellWise - Intervention Feature Implementation Plan

## Overview

This plan implements differentiated feedback mechanisms for the two experimental groups:

| Group | Current Behavior | New Behavior |
|-------|-----------------|--------------|
| **Control (without-hints)** | Letter-by-letter feedback only | Show correct spelling + definition, then move on |
| **With-Hints (intervention)** | Text-based hints | Popup intervention with 3 sequential exercises |

---

## Phase 1: Data Layer & Backend Preparation

### 1.1 Extend Word Data Model

**File:** `server/src/models/Word.ts` (new) or extend `Story.ts`

Add required data fields for intervention exercises:

```typescript
interface WordMetadata {
  word: string;
  definition: string;                    // Required for control group feedback
  meanings: string[];                    // Multiple meanings for MCQ distractors
  commonCollocations: string[];          // Base words for sentence exercise (e.g., "make a decision")
  syllables: string[];                   // For jumble exercise hints
  partOfSpeech: string;                  // noun, verb, adjective, etc.
}
```

**Tasks:**
- [ ] Create/extend schema with definition, meanings, collocations fields
- [ ] Create migration script for existing experiments
- [ ] Add word metadata generation to story creation pipeline (OpenAI)

### 1.2 Create Intervention Attempt Model

**File:** `server/src/models/InterventionAttempt.ts` (new)

Track student performance on each intervention exercise:

```typescript
interface InterventionAttempt {
  experiment: ObjectId;
  student: ObjectId;
  story: ObjectId;
  targetWord: string;
  occurrenceIndex: number;

  // Exercise 1: MCQ/Definition Match
  mcqAttempts: {
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    timestamp: Date;
  }[];

  // Exercise 2: Jumbled Spelling
  jumbleAttempts: {
    arrangement: string[];
    isCorrect: boolean;
    timestamp: Date;
  }[];

  // Exercise 3: Sentence Making
  sentenceAttempts: {
    sentence: string;
    usedTargetWord: boolean;
    usedBaseWord: boolean;
    isValid: boolean;
    feedback: string;
    timestamp: Date;
  }[];

  completedAt: Date | null;
  totalTimeMs: number;
}
```

**Tasks:**
- [ ] Create InterventionAttempt model
- [ ] Add indexes for efficient querying
- [ ] Create API endpoints for recording attempts

### 1.3 API Endpoints

**File:** `server/src/routes/student.ts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/student/intervention/start` | POST | Initialize intervention session |
| `/api/student/intervention/mcq` | POST | Submit MCQ answer |
| `/api/student/intervention/jumble` | POST | Submit jumble arrangement |
| `/api/student/intervention/sentence` | POST | Submit sentence for validation |
| `/api/student/intervention/complete` | POST | Mark intervention complete |
| `/api/student/word-metadata/:word` | GET | Fetch word data for exercises |

**Tasks:**
- [ ] Implement `/intervention/start` - returns exercise data
- [ ] Implement `/intervention/mcq` - validate MCQ answer
- [ ] Implement `/intervention/jumble` - validate spelling arrangement
- [ ] Implement `/intervention/sentence` - LLM-validate sentence usage
- [ ] Implement `/intervention/complete` - finalize and unlock next word

---

## Phase 2: Control Group Enhancement

### 2.1 Correct Answer Reveal Component

**File:** `client/src/routes/student/components/CorrectAnswerModal.tsx` (new)

Simple modal showing:
- ❌ "Incorrect" header
- ✓ Correct spelling (highlighted)
- 📖 Word definition
- "Continue" button to proceed

```
┌─────────────────────────────────────┐
│           ❌ Incorrect              │
├─────────────────────────────────────┤
│                                     │
│   The correct spelling is:          │
│                                     │
│        ✨ NECESSARY ✨              │
│                                     │
│   Definition:                       │
│   Required to be done; essential    │
│                                     │
│          [ Continue → ]             │
│                                     │
└─────────────────────────────────────┘
```

**Tasks:**
- [ ] Create `CorrectAnswerModal.tsx` component
- [ ] Style with Tailwind (consistent with existing modals)
- [ ] Add animation for smooth appearance
- [ ] Integrate into `RunFull.tsx` for control group

### 2.2 Control Group Logic Update

**File:** `client/src/routes/student/RunFull.tsx`

Modify `handleCheck` function:

```typescript
// After incorrect answer detected
if (condition === 'without-hints' && !isCorrect) {
  // Show correct answer modal instead of just letter feedback
  setShowCorrectAnswerModal({
    word: targetWord,
    definition: wordMetadata.definition,
  });
  // Auto-lock blank after modal dismissed
}
```

**Tasks:**
- [ ] Add state for `showCorrectAnswerModal`
- [ ] Modify check logic to trigger modal for control group
- [ ] Auto-lock blank and move to next after modal dismissed
- [ ] Record attempt with "revealed" flag in database

---

## Phase 3: Intervention Popup System (With-Hints Group)

### 3.1 Intervention Container Component

**File:** `client/src/routes/student/components/InterventionPopup.tsx` (new)

Main popup that orchestrates the 3 exercises:

```
┌─────────────────────────────────────────────────┐
│  🎯 Let's Practice: "NECESSARY"                 │
│  ─────────────────────────────────────────────  │
│  Progress: ● ○ ○  (Exercise 1 of 3)            │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │                                         │   │
│  │    [Current Exercise Component]         │   │
│  │                                         │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│              [ Skip ] [ Submit ]                │
└─────────────────────────────────────────────────┘
```

**State Management:**
```typescript
interface InterventionState {
  isOpen: boolean;
  targetWord: string;
  currentExercise: 1 | 2 | 3;
  exerciseData: {
    mcq: MCQData;
    jumble: JumbleData;
    sentence: SentenceData;
  };
  completedExercises: boolean[];
}
```

**Tasks:**
- [ ] Create `InterventionPopup.tsx` container
- [ ] Implement progress indicator (3 dots)
- [ ] Handle exercise transitions
- [ ] Add skip functionality (optional - discuss with user)
- [ ] Implement completion callback

### 3.2 Exercise 1: MCQ/Definition Match

**File:** `client/src/routes/student/components/exercises/MCQExercise.tsx` (new)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   What does "NECESSARY" mean?                   │
│                                                 │
│   ○ A. Required to be done; essential          │
│   ○ B. Optional or voluntary                   │
│   ○ C. Happening by chance                     │
│   ○ D. Related to nature                       │
│                                                 │
│                  [ Check Answer ]               │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Data Generation:**
- Correct answer: Word's actual definition
- Distractors: Generated via OpenAI from similar words or confusing meanings

**Tasks:**
- [ ] Create `MCQExercise.tsx` component
- [ ] Implement answer selection UI
- [ ] Add visual feedback (correct = green, wrong = red + show correct)
- [ ] Generate distractor definitions via OpenAI prompt
- [ ] Allow retry on incorrect answer before proceeding

### 3.3 Exercise 2: Jumbled Spelling

**File:** `client/src/routes/student/components/exercises/JumbleExercise.tsx` (new)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   Arrange the letters to spell the word:        │
│                                                 │
│   ┌───┬───┬───┬───┬───┬───┬───┬───┬───┐       │
│   │ S │ E │ N │ A │ Y │ R │ C │ E │ S │       │
│   └───┴───┴───┴───┴───┴───┴───┴───┴───┘       │
│                                                 │
│   Your arrangement:                             │
│   ┌───┬───┬───┬───┬───┬───┬───┬───┬───┐       │
│   │ N │ E │ C │ E │ S │ S │ A │ R │ Y │       │
│   └───┴───┴───┴───┴───┴───┴───┴───┴───┘       │
│                                                 │
│           [ Reset ] [ Check Spelling ]          │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Interaction:**
- Drag-and-drop OR click-to-move letters
- Visual feedback on position
- Allow reset to start over

**Tasks:**
- [ ] Create `JumbleExercise.tsx` component
- [ ] Implement drag-and-drop functionality (react-dnd or custom)
- [ ] Add click-to-select alternative for accessibility
- [ ] Implement shuffle algorithm (ensure not accidentally correct)
- [ ] Add visual feedback on submit
- [ ] Allow retry until correct

### 3.4 Exercise 3: Sentence Making

**File:** `client/src/routes/student/components/exercises/SentenceExercise.tsx` (new)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   Make a sentence using both words:             │
│                                                 │
│   Target word:  NECESSARY                       │
│   Base word:    MAKE                            │
│                                                 │
│   Example: "It is necessary to make a plan."    │
│                                                 │
│   ┌─────────────────────────────────────────┐   │
│   │                                         │   │
│   │  [Your sentence here...]                │   │
│   │                                         │   │
│   └─────────────────────────────────────────┘   │
│                                                 │
│              [ Check Sentence ]                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Validation Logic (Server-side LLM):**
1. Check if target word is present (exact or inflected form)
2. Check if base word is present
3. Validate grammatical correctness
4. Validate semantic coherence

**Tasks:**
- [ ] Create `SentenceExercise.tsx` component
- [ ] Implement text input with word highlighting
- [ ] Create server endpoint for sentence validation
- [ ] Design LLM prompt for sentence grading
- [ ] Show helpful feedback on invalid sentences
- [ ] Allow retry until valid sentence submitted

---

## Phase 4: Word Metadata Generation

### 4.1 OpenAI Prompt for Word Data

**File:** `server/src/prompts.ts`

Add prompt for generating intervention exercise data:

```typescript
export const WORD_METADATA_PROMPT = `
Generate learning exercise data for the word "{word}" at CEFR level {level}.

Return JSON:
{
  "definition": "Clear, level-appropriate definition",
  "meanings": ["meaning1", "meaning2", "meaning3"],
  "distractorDefinitions": [
    "Plausible but wrong definition 1",
    "Plausible but wrong definition 2",
    "Plausible but wrong definition 3"
  ],
  "commonCollocations": ["word1", "word2", "word3"],
  "exampleSentences": ["sentence1", "sentence2"],
  "partOfSpeech": "noun|verb|adjective|adverb"
}

Requirements:
- Definition should be understandable at {level} level
- Distractor definitions should be plausible but clearly wrong
- Common collocations should be high-frequency words
- Example sentences should demonstrate natural usage
`;
```

**Tasks:**
- [ ] Create word metadata generation prompt
- [ ] Implement batch generation for target words
- [ ] Add caching to avoid regeneration
- [ ] Handle generation failures gracefully

### 4.2 Integration with Story Generation

**File:** `server/src/routes/experiments.ts`

Modify story generation pipeline to include word metadata:

```typescript
// After story generation
for (const word of targetWords) {
  const metadata = await generateWordMetadata(word, cefrLevel);
  await WordMetadata.create({ experiment: exp._id, ...metadata });
}
```

**Tasks:**
- [ ] Hook into existing story generation flow
- [ ] Generate metadata for all target words
- [ ] Store in database linked to experiment
- [ ] Add retry logic for API failures

---

## Phase 5: State Management & Flow Control

### 5.1 Intervention State Store

**File:** `client/src/store/intervention.ts` (new)

```typescript
interface InterventionStore {
  // State
  isActive: boolean;
  targetWord: string | null;
  currentExercise: number;
  exerciseResults: {
    mcq: { attempts: number; completed: boolean };
    jumble: { attempts: number; completed: boolean };
    sentence: { attempts: number; completed: boolean };
  };

  // Actions
  startIntervention: (word: string, metadata: WordMetadata) => void;
  completeExercise: (type: 'mcq' | 'jumble' | 'sentence') => void;
  nextExercise: () => void;
  finishIntervention: () => void;
  reset: () => void;
}
```

**Tasks:**
- [ ] Create Zustand store for intervention state
- [ ] Implement all actions
- [ ] Add persistence for recovery on page refresh
- [ ] Integrate with RunFull.tsx

### 5.2 Modified Spelling Check Flow

**File:** `client/src/routes/student/RunFull.tsx`

```typescript
const handleCheck = async () => {
  const isCorrect = checkSpelling(userInput, targetWord);

  if (isCorrect) {
    // Existing success flow
    lockBlank();
    incrementStreak();
    moveToNextBlank();
  } else {
    // NEW: Condition-based handling
    if (condition === 'without-hints') {
      // Control group: Show answer + definition
      showCorrectAnswerModal(targetWord, definition);
    } else {
      // With-hints group: Start intervention
      startIntervention(targetWord, wordMetadata);
    }
  }
};

const handleInterventionComplete = () => {
  // After all 3 exercises done
  lockBlank();
  moveToNextBlank();
};
```

**Tasks:**
- [ ] Modify handleCheck to branch by condition
- [ ] Add intervention trigger for with-hints group
- [ ] Implement intervention completion callback
- [ ] Ensure blank is locked after intervention
- [ ] Handle edge cases (page refresh during intervention)

---

## Phase 6: Analytics & Telemetry

### 6.1 Event Logging

**File:** `server/src/models/Event.ts`

Add new event types:

```typescript
type EventType =
  | 'correct_answer_revealed'    // Control group saw answer
  | 'intervention_started'       // With-hints intervention began
  | 'mcq_attempt'               // MCQ answer submitted
  | 'jumble_attempt'            // Jumble arrangement submitted
  | 'sentence_attempt'          // Sentence submitted
  | 'intervention_completed'    // All 3 exercises done
  | 'intervention_skipped';     // User skipped (if allowed)
```

**Tasks:**
- [ ] Add event types to Event model
- [ ] Log events at each interaction point
- [ ] Include timing data for research analysis
- [ ] Add aggregate queries for analytics dashboard

### 6.2 Analytics Dashboard Updates

**File:** `client/src/routes/teacher/Analytics.tsx`

Add intervention metrics:
- Intervention completion rate
- Average time per exercise
- MCQ accuracy
- Jumble attempts distribution
- Sentence validation pass rate

**Tasks:**
- [ ] Create intervention analytics queries
- [ ] Add intervention section to dashboard
- [ ] Visualize exercise performance
- [ ] Compare control vs intervention outcomes

---

## Phase 7: Testing & Validation

### 7.1 Unit Tests

**Files:** `server/src/__tests__/`, `client/src/__tests__/`

| Test Suite | Coverage |
|------------|----------|
| Word metadata generation | Prompt output validation |
| MCQ distractor quality | Distinctness from correct answer |
| Jumble shuffle algorithm | Never starts correct |
| Sentence validation | LLM grading accuracy |
| Intervention flow | State transitions |
| Control flow | Modal display & progression |

**Tasks:**
- [ ] Write unit tests for each exercise component
- [ ] Test state management store
- [ ] Test API endpoints
- [ ] Test edge cases (refresh, timeout, skip)

### 7.2 Integration Tests

- [ ] Full flow: Control group wrong answer → reveal → continue
- [ ] Full flow: With-hints wrong answer → 3 exercises → continue
- [ ] Cross-paragraph intervention consistency
- [ ] Multiple wrong answers in sequence

### 7.3 User Acceptance Testing

- [ ] Test with sample students (both groups)
- [ ] Verify exercise clarity and usability
- [ ] Check mobile responsiveness
- [ ] Validate accessibility (keyboard navigation)

---

## Implementation Order & Dependencies

```
Week 1: Data Layer
├── 1.1 Word metadata schema
├── 1.2 InterventionAttempt model
├── 1.3 API endpoints (stubs)
└── 4.1 Word metadata generation prompt

Week 2: Control Group
├── 2.1 CorrectAnswerModal component
├── 2.2 Control group logic in RunFull
└── Testing control flow

Week 3: Intervention Exercises
├── 3.2 MCQ Exercise component
├── 3.3 Jumble Exercise component
└── 3.4 Sentence Exercise component

Week 4: Intervention System
├── 3.1 InterventionPopup container
├── 5.1 Intervention state store
├── 5.2 Modified spelling check flow
└── Integration testing

Week 5: Polish & Analytics
├── 4.2 Integration with story generation
├── 6.1 Event logging
├── 6.2 Analytics dashboard
└── 7.x Testing & validation
```

---

## File Structure Summary

```
client/src/
├── routes/student/
│   ├── RunFull.tsx                    # Modified
│   └── components/
│       ├── CorrectAnswerModal.tsx     # NEW
│       ├── InterventionPopup.tsx      # NEW
│       └── exercises/
│           ├── MCQExercise.tsx        # NEW
│           ├── JumbleExercise.tsx     # NEW
│           └── SentenceExercise.tsx   # NEW
├── store/
│   └── intervention.ts                # NEW

server/src/
├── models/
│   ├── WordMetadata.ts                # NEW
│   └── InterventionAttempt.ts         # NEW
├── routes/
│   └── student.ts                     # Modified (new endpoints)
└── prompts.ts                         # Modified (new prompts)
```

---

## Design Decisions (Finalized)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Skip Option** | Mandatory | Students must complete all 3 exercises - no skipping allowed |
| **Trigger Point** | 1st wrong attempt | Intervention starts immediately after first incorrect answer |
| **Sentence Validation** | Lenient | Accept minor grammar errors, focus on correct word usage |
| **Base Words Source** | AI Generated | OpenAI generates common collocations for each target word |
| **Progress Persistence** | Yes | Save intervention state for recovery on page refresh |

---

## Success Criteria

- [ ] Control group sees correct spelling + definition on wrong answer
- [ ] With-hints group completes all 3 exercises before proceeding
- [ ] Exercises function correctly (MCQ validates, jumble checks, sentence grades)
- [ ] All interactions are logged for research analysis
- [ ] System works across all 5 paragraphs consistently
- [ ] No regression in existing functionality
