# SpellWise Thesis Final Prep

This document consolidates the earlier thesis notes with the current implementation of SpellWise. It is intended as the working reference for writing the thesis so the system description, measures, and analysis plan reflect the app as it exists now.

## 1. Thesis Framing

SpellWise is best described in the thesis as a contextual spelling intervention platform for non-native English speakers. The core research design is a two-story, counterbalanced, treatment/control study with repeated word exposure, sentence-level audio, timed breaks, effort ratings, and delayed recall testing.

The older thesis documents remain the conceptual base:

- [THESIS_SUMMARY.md](./THESIS_SUMMARY.md)
- [THESIS_ANALYSIS.md](./THESIS_ANALYSIS.md)
- [THESIS_ANALYSIS_ENHANCED.md](./THESIS_ANALYSIS_ENHANCED.md)
- [THESIS_FRAMEWORK.md](./THESIS_FRAMEWORK.md)

The current codebase should override any older wording that no longer matches the app. In particular:

- The student experience is now read-mode only.
- Sentence-level audio buttons are used instead of a top audio bar.
- The visible project language has shifted from hints to interventions and practice windows.
- The delayed recall path is explicitly gated by a 12-hour unlock.
- Spelling scoring now uses normalized Levenshtein similarity, not only binary correctness.

## 2. What The App Currently Does

### 2.1 Student Flow

The student flow begins after consent and a tutorial. Students then join with a code and enter the reading/spelling session. The main exercise flow is in [RunFull.tsx](C:\Users\acer\SpellWise\client\src\routes\student\RunFull.tsx).

Current behavior:

- Students stay in read mode.
- The reader shows sentence-level audio buttons.
- Students complete blank-based spelling tasks inside stories.
- Correct letters remain fixed after retries in spelling interventions.
- Interventions can be triggered when the learner struggles.
- Mental effort ratings are collected during the story flow.
- A break separates the two stories.
- Delayed recall is available only after the 12-hour unlock time.

Relevant code:

- [RunFull.tsx](C:\Users\acer\SpellWise\client\src\routes\student\RunFull.tsx)
- [StoryReader.tsx](C:\Users\acer\SpellWise\client\src\routes\student\components\StoryReader.tsx)
- [StudentTutorial.tsx](C:\Users\acer\SpellWise\client\src\routes\student\StudentTutorial.tsx)
- [App.tsx](C:\Users\acer\SpellWise\client\src\routes\App.tsx)

### 2.2 Read Mode And Audio

The interface no longer relies on a top audio control bar. Instead, each sentence in the story has its own audio button. This is important for the thesis because the delivery mode is now closer to sentence-level guided reading than to global story playback.

Thesis wording should reflect:

- sentence-level audio support
- focused reading and spelling
- no top-level story audio player

### 2.3 Intervention And Control Language

The visible app language now uses intervention-oriented terminology. Even when some internal fields still carry legacy names, the thesis should present the study as treatment/control:

- treatment condition
- control condition
- intervention window
- practice window
- intervention completion

Do not describe the study as a hint study in the thesis unless you are explicitly discussing legacy code naming. The current user-facing design is intervention-based.

### 2.4 Delayed Recall

The app now enforces delayed recall through a 12-hour unlock. This makes the delayed test a true follow-up measure rather than an immediate continuation of the learning session.

Relevant code:

- [student.ts](C:\Users\acer\SpellWise\server\src\routes\student.ts)

## 3. Conceptual Model For The Thesis

SpellWise can be framed as a research platform that tests whether contextual, repeated, and scaffolded spelling practice improves orthographic and semantic retention in non-native English speakers.

### 3.1 Core Learning Logic

The platform operationalizes:

- retrieval practice
- spacing within a session
- contextual encoding
- adaptive remediation
- delayed retention measurement
- metacognitive effort reporting

### 3.2 Four-Occurrence Word Model

Each target word is used four times:

1. Baseline
2. Learning
3. Reinforcement
4. Recall

This structure supports:

- baseline spelling measurement
- in-session learning progression
- reinforcement of spelling patterns
- immediate recall without support at the final occurrence

### 3.3 Intervention Structure

When an intervention is triggered, the learner moves through three activities:

1. Multiple-choice meaning check
2. Jumbled-letter reconstruction
3. Sentence production

This is the thesis-visible intervention model. It should be described as a short, contextual corrective sequence that supports orthographic and semantic encoding.

## 4. Research Questions And What The App Provides

### RQ1
Does active retrieval lead to stronger delayed orthographic retention?

Use:

- `baselineAccuracy`
- `immediateOrthographicScore`
- `delayedOrthographicScore`
- `learningGain`

Interpretation:

- Compare treatment vs control on delayed spelling retention.
- Treat normalized Levenshtein similarity as the spelling outcome metric.

### RQ2
Does active retrieval lead to stronger delayed semantic retention?

Use:

- `delayedSemanticScore`
- `definitionAccuracy`
- delayed recall event payloads

Interpretation:

- This is the semantic side of delayed recall.
- If you discuss “immediate semantic score,” note that the current app does not expose a clearly separate immediate semantic variable in the same way it exposes immediate orthographic scoring.

### RQ3
Is mental effort indicative of immediate retention and delayed retention performance?

Use:

- `avgMentalEffort`
- `avgMentalEffortIntervention`
- `avgMentalEffortControl`
- `immediateOrthographicScore`
- `delayedOrthographicScore`
- `delayedSemanticScore`

Interpretation:

- Mental effort should be analyzed as a predictor or correlate of learning outcomes.
- The app filters out `taskType === 'difficulty'` from the average effort calculation in analytics, so the thesis can treat the reported effort averages as the operative Paas-style measure.

### RQ4
Do participants with higher cognitive offloading tendencies report lower mental effort in the intervention condition, and does this mediate their weaker learning gains?

Use:

- `offloadingScore`
- `avgMentalEffortIntervention`
- `avgMentalEffortControl`
- `learningGain`
- `condition`

Interpretation:

- This is the individual-differences question.
- The app already exports offloading data and condition-specific effort.
- Mediation can be discussed if the sample size supports it, otherwise report it as an exploratory analysis.

## 5. Current Data Sources

The current research export is generated from [analytics.ts](C:\Users\acer\SpellWise\server\src\routes\analytics.ts) and bundles the thesis-relevant files into a ZIP archive:

- `students.csv`
- `words.csv`
- `timeline.csv`
- `events.csv`
- `offloading.csv`
- `codebook.md`

### 5.1 Students CSV

This is the main thesis-level file. It includes:

- participant and condition identifiers
- story order and treatment/control mapping
- phase mapping
- performance scores
- effort scores
- offloading score
- delayed test status

Important columns now include:

- `studentId`
- `username`
- `condition`
- `storyOrder`
- `hintsStory`
- `phase1Condition`
- `phase1Story`
- `phase2Condition`
- `phase2Story`
- `attempts`
- `accuracy`
- `baselineAccuracy`
- `immediateOrthographicScore`
- `delayedOrthographicScore`
- `delayedSemanticScore`
- `learningGain`
- `hints`
- `definitionAccuracy`
- `recallAvg`
- `timeOnTaskMin`
- `avgMentalEffort`
- `avgMentalEffortIntervention`
- `avgMentalEffortControl`
- `offloadingScore`
- `delayedTestCompleted`
- `delayedTestScore`

Relevant code:

- [analytics.ts](C:\Users\acer\SpellWise\server\src\routes\analytics.ts#L1402)

### 5.2 Words CSV

Per-word aggregates are available for word-level analysis:

- `word`
- `attempts`
- `accuracy`

Use this for item difficulty analysis and word-level summary tables.

### 5.3 Timeline CSV

Daily aggregates are available for progress over time:

- `day`
- `attempts`
- `correct`
- `hints`
- `definitions`
- `recall`

Use this for session timelines and study flow summaries.

### 5.4 Events CSV

The event log includes process data such as:

- attempts
- hint requests
- reveals
- audio play/pause/skip
- intervention start/completion
- mental effort events
- paragraph completion
- break completion

The events export also includes `spellingScore`, which is the normalized Levenshtein similarity score for the attempt.

Relevant code:

- [student.ts](C:\Users\acer\SpellWise\server\src\routes\student.ts#L681)
- [analytics.ts](C:\Users\acer\SpellWise\server\src\routes\analytics.ts#L1432)

### 5.5 Offloading CSV

The offloading export supports the individual differences analysis:

- `studentId`
- `username`
- `condition`
- `offloadingScore`
- `attempts`
- `hints`
- `hintRate`
- `reveals`
- `revealRate`
- `delayedRecallAvg`

## 6. Scoring Logic

### 6.1 Orthographic Scoring

The app currently uses normalized Levenshtein similarity for spelling scoring.

This is important because it means the thesis can report spelling as a continuous similarity measure rather than only as a binary right/wrong measure.

Relevant code:

- [student.ts](C:\Users\acer\SpellWise\server\src\routes\student.ts#L681)
- [student.ts](C:\Users\acer\SpellWise\server\src\routes\student.ts#L1526)

### 6.2 Immediate Recall Scoring

Immediate recall now computes spelling similarity and can also include definition scoring in recall contexts.

Use:

- `immediateOrthographicScore`
- `definitionAccuracy`
- `recallAvg`

### 6.3 Delayed Recall Scoring

Delayed recall computes:

- spelling similarity for each item
- definition correctness
- combined score

This provides direct support for orthographic and semantic retention analysis.

## 7. How To Write The Methods Section

### 7.1 Design

Describe the study as:

- a classroom-based spelling intervention study
- two-story counterbalanced design
- treatment/control comparison
- repeated measures across four target-word occurrences
- delayed recall follow-up after 12 hours

### 7.2 Participants

State:

- non-native English speakers
- classroom deployment
- likely mixed proficiency
- teacher-managed experiment with consent-based student access

### 7.3 Procedure

The current procedure is:

1. Student logs in.
2. Student accepts consent.
3. Student receives the tutorial.
4. Student joins using the experiment code.
5. Student enters read-mode story flow.
6. Sentence audio is used as needed.
7. Student fills spelling blanks.
8. Intervention windows may appear when the learner struggles.
9. Mental effort ratings are collected.
10. A break separates the two stories.
11. The second story is completed.
12. Immediate recall is scored.
13. Delayed recall becomes available after 12 hours.

### 7.4 Measures

Primary measures:

- normalized Levenshtein spelling similarity
- delayed orthographic retention
- delayed semantic retention
- learning gain

Secondary measures:

- mental effort
- offloading score
- hint/reveal behavior
- intervention engagement
- time on task
- audio interaction

## 8. How To Write The Results Section

Report results in this order:

1. Sample and completion
2. Condition balance and story order
3. Baseline performance
4. Immediate orthographic retention
5. Delayed orthographic retention
6. Delayed semantic retention
7. Mental effort results
8. Offloading relationships
9. Intervention usage
10. Word-level patterns

Suggested tables:

- participant characteristics
- condition split
- descriptive statistics for all main outcomes
- correlation matrix for effort, offloading, and learning gain
- intervention usage summary
- word difficulty table

Suggested figures:

- story/session timeline
- orthographic score progression across phases
- delayed orthographic vs delayed semantic comparison
- effort by condition
- offloading vs learning gain scatterplot

## 9. Statistical Analysis Plan

### 9.1 Recommended Main Analyses

Use:

- paired or mixed-effects models for repeated word exposure
- condition as a fixed effect
- student as a random effect if the sample allows it
- story order as a covariate
- offloading as a moderator or predictor

### 9.2 Outcome Modeling

For orthographic outcomes:

- `baselineAccuracy`
- `immediateOrthographicScore`
- `delayedOrthographicScore`
- `learningGain`

For semantic outcomes:

- `delayedSemanticScore`
- `definitionAccuracy`

For effort outcomes:

- `avgMentalEffort`
- `avgMentalEffortIntervention`
- `avgMentalEffortControl`

For individual differences:

- `offloadingScore`

### 9.3 Suggested Hypothesis Tests

1. Treatment vs control on delayed orthographic retention.
2. Treatment vs control on delayed semantic retention.
3. Mental effort predicting orthographic and semantic outcomes.
4. Offloading predicting effort and weaker learning gains.
5. Intervention engagement predicting better retention.

## 10. What Is Legacy And What Is Current

### Legacy Terms That Still Exist In Code

These may still appear in internal field names or route names:

- `hints`
- `with-hints`
- `without-hints`
- `hintRate`
- some helper messages

### Current Thesis Wording

Use this wording in the thesis:

- intervention
- treatment
- control
- practice window
- sentence audio
- read mode
- delayed recall
- orthographic similarity
- semantic retention
- cognitive offloading

## 11. Key Current Code Anchors

Use these files when checking the current app state:

- [RunFull.tsx](C:\Users\acer\SpellWise\client\src\routes\student\RunFull.tsx)
- [StoryReader.tsx](C:\Users\acer\SpellWise\client\src\routes\student\components\StoryReader.tsx)
- [App.tsx](C:\Users\acer\SpellWise\client\src\routes\App.tsx)
- [StudentTutorial.tsx](C:\Users\acer\SpellWise\client\src\routes\student\StudentTutorial.tsx)
- [student.ts](C:\Users\acer\SpellWise\server\src\routes\student.ts)
- [analytics.ts](C:\Users\acer\SpellWise\server\src\routes\analytics.ts)

## 12. Thesis Positioning Summary

The final thesis should present SpellWise as a current, working intervention platform that:

- teaches spelling through contextual reading
- uses sentence-level audio for support
- keeps the learner in read mode
- distinguishes treatment and control conditions
- collects continuous orthographic scores with normalized Levenshtein
- measures delayed orthographic and semantic retention
- records mental effort and offloading tendencies
- exports analysis-ready CSVs for thesis statistics

That is the current state of the app and the most accurate basis for the thesis.
