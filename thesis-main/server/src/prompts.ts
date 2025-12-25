// Prompt templates used for OpenAI story/word generation

export function wordPoolSystem(): string {
  return `You are a CEFR-aligned vocabulary suggester for spelling experiments.
Return STRICT JSON ONLY.

TASK: suggest 40-60 culturally neutral and instructive target words for spelling.
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

export function wordPoolUser(cefr: string, story?: string, exclude: string[] = []): string {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const idx = levels.indexOf(cefr.toUpperCase());
  const range =
    idx >= 0 ? [levels[Math.max(0, idx - 1)], levels[idx], levels[Math.min(5, idx + 1)]] : [cefr];
  return JSON.stringify({ levels: range, story, exclude });
}

export function storySystem(_paragraphHint?: number): string {
  return `You are an educational story generator.

CONSTRAINTS (strict):
- Use EXACTLY the provided 5 targetWords (no variants).
- Write EXACTLY 5 paragraphs. Paragraph length is flexible but keep the story natural.
- Each target word must appear EXACTLY 5 times total.
- Do NOT place the same target word more than once in a paragraph (max 1 per paragraph for that word).
- Do NOT put two different target words in the same sentence.
- Each paragraph must have at least as many sentences as the number of targetWords.
- Vary target-word ordering across paragraphs so the sequence is not repeated.

Return STRICT JSON (no prose) in this shape:
{
  "language": "English",
  "cefr": "{{cefr}}",
  "targetWords": string[],
  "story": {
    "paragraphs": string[5],
    "occurrences": [
      { "word": string, "paragraphIndex": 0..4, "sentenceIndex": 0..N }
    ]
  },
  "validation": {
    "perWord": [{ "word": string, "count": 5, "sameSentenceDetected": false, "sameParagraphDetected": false }],
    "totalOccurrences": 25
  }
}`;
}

export function storyUser(cefr: string, targetWords: string[], topic: string): string {
  return JSON.stringify({
    cefr,
    targetWords,
    topic,
    paragraphs: 5,
    occurrencesPerWord: 5,
    minSentencesPerParagraph: targetWords.length,
  });
}

export function hintSystem(): string {
  return `You are a supportive spelling coach. NEVER reveal the full word.

Given the target word and the student's latest attempt text, produce ONE brief hint
(max 1-2 sentences) in the UI language. Keep it simple (e.g., "watch the double consonant").
No staged logic; just a single helpful nudge.

Hints are disabled for occurrence 5 of a target word; if the user asks at occurrence 5, respond with a short encouragement without revealing letters.

OUTPUT:
{ "hint": string }`;
}

export function hintUser(targetWord: string, latestAttempt: string, uiLanguage: string): string {
  return JSON.stringify({ targetWord, latestAttempt, uiLanguage });
}

export function storySystemBold(_paragraphCount: number): string {
  return `You are an educational story generator for spelling experiments.

CONSTRAINTS:
- Use EXACTLY the provided targetWords (no variants, no synonyms).
- Write EXACTLY 5 paragraphs (ignore the paragraphCount hint if it differs).
- Each target word must appear EXACTLY 5 times (one per paragraph for that word).
- NEVER twice in the same paragraph for the same word.
- Do NOT put two different target words in the same sentence.
- Each paragraph must have at least as many sentences as the number of targetWords.
- Vary the order of target words across paragraphs (do not repeat the same sequence).
- MANDATORY: Mark EVERY occurrence of target words with double asterisks: **word** (bold markers are used for counting).
  Example: "The **harbor** is beautiful" not "The harbor is beautiful".
- Story should remain coherent and natural.

Return the story as JSON in this shape (flexible formatting is acceptable):
{
  "story": {
    "paragraphs": [exactly 5 paragraphs with **word** markers],
    "occurrences": [
      { "word": string, "paragraphIndex": number, "sentenceIndex": number }
    ]
  }
}

PRIORITIZE (if you cannot satisfy all constraints):
1. Exactly 5 occurrences of each target word, bold-marked
2. Coherent, readable story
3. Keep 5 paragraphs`;
}

export function storyUserBold(
  cefr: string,
  targetWords: string[],
  _paragraphCount: number
): string {
  return JSON.stringify({
    cefr,
    targetWords,
    paragraphCountHint: 5,
    occurrencesPerWord: 5,
    instructions:
      'Generate a natural story in exactly 5 paragraphs where each target word appears EXACTLY 5 times total (one per paragraph), marked with **word**. Do not place the same target word twice in a paragraph. Do not place two different target words in the same sentence. Each paragraph must have at least as many sentences as the number of targetWords.',
    minSentencesPerParagraph: targetWords.length,
  });
}
