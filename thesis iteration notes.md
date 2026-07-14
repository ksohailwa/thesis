# SpellWise Thesis Iteration Notes

This short note records the main changes that led to the current version of the app. It is meant as a simple history of what was removed, what was added, and how major issues were resolved.

## 1. What Changed Over Time

### Removed From The Student Flow

- The read-mode toggle was removed.
- The top/main audio bar was removed.
- Generic hint language was removed from the visible UI.
- The old “hints” framing was replaced with intervention and practice-window framing.

### Added To The Student Flow

- Sentence-level audio buttons were added at the start of each sentence.
- A fuller tutorial was added after consent on the student join path.
- The help text was updated to match the current intervention-based design.
- The student flow now stays in read mode by default.

### Refined Behavior

- Wrong letters in the jumble/spelling intervention are now removed without shifting the correct letters.
- Delayed recall is only available after the 12-hour unlock time.
- The student returning later goes directly to the recall/test path instead of repeating the story exercises.
- Spelling scoring now uses normalized Levenshtein similarity for better thesis analysis.

## 2. Major Issues And How They Were Solved

### Issue 1: Students Could Re-enter The Story Instead Of Recall

Problem:

- After 12 hours, a student could return with the experiment code but still get routed back to the story exercises.

Fix:

- The join and run flow was updated so students who already completed the second story are sent to the recall path instead of restarting the full exercise.

### Issue 2: The Spelling Intervention Shifted Correct Letters

Problem:

- After a wrong attempt, removing red letters caused the remaining letters to shift left, which made the task harder than intended.

Fix:

- The jumble/spelling intervention was changed to use fixed slots so only wrong letters are cleared and correct letters stay in place.

### Issue 3: The Main Audio Control Was Redundant

Problem:

- The top audio bar duplicated functionality once sentence audio was available.

Fix:

- The top player was removed and the app now uses sentence-level audio buttons only.

### Issue 4: The Tutorial Was Too Sparse

Problem:

- Students did not get enough guidance before starting.

Fix:

- A more detailed tutorial was added after consent, while still avoiding any explanation of the research purpose.

### Issue 5: The App Language Did Not Match The Final Study Design

Problem:

- The UI and help text still used hint language even though the study had shifted to interventions and modified conditions.

Fix:

- Visible labels and help text were updated to intervention/practice-window wording.

## 3. Fix Sequence Used For The Main Problems

For the major changes, the general approach was:

1. Inspect the current student flow and identify where the old behavior still remained.
2. Update the route or component that controlled the user-facing state.
3. Remove redundant UI elements instead of hiding them behind extra toggles.
4. Align visible wording with the actual study design.
5. Verify the analysis layer so the exported variables matched the thesis questions.

## 4. Thesis Use

This note can be used to explain how the app evolved into its current form:

- from optional read mode to always-read mode
- from top-level audio playback to sentence-level audio
- from hint language to intervention language
- from binary spelling scoring to normalized similarity scoring
- from story replay on return to delayed recall routing

