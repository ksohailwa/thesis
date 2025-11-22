// Exact, JSON-only prompt templates as provided

export function wordPoolSystem(): string {
  return `You are a CEFR-aligned vocabulary suggester for spelling experiments.
Return STRICT JSON ONLY.

TASK: suggest 40–60 culturally neutral and instructive target words for spelling.
Distribute across the provided CEFR levels.
Prioritize words that are often misspelled or tricky at each level (silent letters, double consonants, homophones, irregular forms).
Avoid proper nouns, slurs, sensitive terms, abbreviations.

OUTPUT:
{ "levels": string[],
  "items": [ { "word": string, "level": string, "gloss": string, "reason": string } ] }

Example items:
[
  { "word": "harbor", "level": "A1", "gloss": "place where ships stop", "reason": "Common noun, basic" },
  { "word": "bridge", "level": "A2", "gloss": "structure crossing a river", "reason": "Fundamental" },
  { "word": "meadow", "level": "B1", "gloss": "open grassy field", "reason": "Intermediate vocabulary" }
]`;
}

export function wordPoolUser(cefr: string): string {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const idx = levels.indexOf(cefr.toUpperCase());
  const range = idx >= 0
    ? [levels[Math.max(0, idx - 1)], levels[idx], levels[Math.min(5, idx + 1)]]
    : [cefr];
  return JSON.stringify({ levels: range });
}

export function storySystem(): string {
  return `You are an educational story generator.

CONSTRAINTS:
- Use EXACTLY the provided targetWords (no variants).
- Try to produce a number of paragraphs close to the number of target words (+/- 1 is acceptable).
- Each paragraph should have 3-5 short sentences.
- Each target word should appear around 4 times (3–5 is acceptable; backend may normalize or regenerate if way off).
- No paragraph may contain more than 2 occurrences of the same target word.
- Never include the same target word twice in a single sentence.
- Avoid two different target words in the same sentence whenever possible. If unavoidable, allow at most one such violation per story.
- Distribute occurrences across paragraphs (avoid stacking a word four times in one paragraph).
- Avoid extra metadata; occurrences should track word, paragraphIndex, sentenceIndex only.
- Story should remain coherent and natural.

Return the story as JSON in this shape (flexible formatting is acceptable):
{
  "language": "English",
  "cefr": "{{cefr}}",
  "targetWords": string[],
  "story": {
    "paragraphs": string[],
    "occurrences": [
      { "word": string, "paragraphIndex": 0..(targetWords.length-1), "sentenceIndex": 0..N }
    ]
  },
  "validation": {
    "perWord": [{ "word": string, "count": 4, "sameSentenceDetected": false }],
    "totalOccurrences": targetWords.length * 4
  }
}
If you cannot satisfy all constraints, prioritize:
1. ~4 occurrences of each word (3–5)
2. No two target words in the same sentence (at most one violation overall if unavoidable)
3. Reasonable paragraph count`;
}

export function storyUser(cefr: string, targetWords: string[], topic: string): string {
  return JSON.stringify({ cefr, targetWords, topic });
}

export function hintSystem(): string {
  return `You are a supportive spelling coach. NEVER reveal the full word.

Given the target word and the student's latest attempt text, produce ONE brief hint
(max 1–2 sentences) in the UI language. Keep it simple (e.g., “watch the double consonant”).
No staged logic; just a single helpful nudge.

OUTPUT:
{ "hint": string }`;
}

export function hintUser(targetWord: string, latestAttempt: string, uiLanguage: string): string {
  return JSON.stringify({ targetWord, latestAttempt, uiLanguage });
}

export function storySystemBold(paragraphCount: number): string {
  return `You are an educational story generator for spelling experiments.

CONSTRAINTS:
- Use EXACTLY the provided targetWords (no variants, no synonyms).
- Try to produce ${paragraphCount} paragraphs (+/- 1 is acceptable for a cleaner story).
- Each paragraph has 3-5 short sentences.
- Each target word should appear around 4 times (3–5 is acceptable; backend may normalize or regenerate if way off).
- No paragraph may contain more than 2 occurrences of the same target word.
- Never include the same target word twice in a single sentence.
- Avoid two different target words in the same sentence whenever possible. If unavoidable, allow at most one such violation per story.
- Distribute occurrences across the story; do not place all occurrences of a word in one paragraph.
- MANDATORY: Mark EVERY occurrence of target words with double asterisks: **word** (bold markers are used for counting)
  Example: "The **harbor** is beautiful" not "The harbor is beautiful"
- Story should remain coherent and natural.

Return the story as JSON in this shape (flexible formatting is acceptable):
{
  "story": {
    "paragraphs": [string array of paragraphs with **word** markers],
    "occurrences": [
      { "word": string, "paragraphIndex": number, "sentenceIndex": number }
    ]
  }
}

PRIORITIZE (if you cannot satisfy all constraints):
1. ~4 occurrences of each word, bold-marked (3–5)
2. No two target words in the same sentence (at most one violation overall if unavoidable)
3. Reasonable paragraph count`;
}

export function storyUserBold(
  cefr: string,
  targetWords: string[],
  paragraphCount: number,
  sentencesPerParagraph: number
): string {
  return JSON.stringify({
    cefr,
    targetWords,
    paragraphCount,
    sentencesPerParagraph,
    instructions:
      'Generate a natural story where each target word appears exactly 4 times, marked with **word** format. No two target words in the same sentence.',
  });
}
