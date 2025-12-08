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
  const range = idx >= 0
    ? [levels[Math.max(0, idx - 1)], levels[idx], levels[Math.min(5, idx + 1)]]
    : [cefr];
  return JSON.stringify({ levels: range, story, exclude });
}

export function storySystem(paragraphHint?: number): string {
  return `You are an educational story generator.

CONSTRAINTS:
- Use EXACTLY the provided targetWords (no variants).
- Paragraph and sentence counts are flexible; use any lengths that keep the story natural.
- Each target word must appear AT LEAST 4 times (4, 5, or 6 times is acceptable) and never twice in the same sentence.
- VERIFY your counts: If a word appears only 3 times, add another sentence containing it.
- Do NOT put two different target words in the same sentence; spread them across sentences.
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
1. At least 4 occurrences of each word
2. Coherent, readable story
3. Any paragraph count/length is acceptable`;
}

export function storyUser(cefr: string, targetWords: string[], topic: string): string {
  return JSON.stringify({ cefr, targetWords, topic });
}

export function hintSystem(): string {
  return `You are a supportive spelling coach. NEVER reveal the full word.

Given the target word and the student's latest attempt text, produce ONE brief hint
(max 1-2 sentences) in the UI language. Keep it simple (e.g., "watch the double consonant").
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
- Paragraph and sentence counts are COMPLETELY FLEXIBLE. Ignore the paragraphCount hint if you need more space.
- Use as many paragraphs as needed to make the story natural and fit all 4+ occurrences of each word.
- Each target word must appear AT LEAST 4 times (4 to 6 times). **This is a strict requirement.**
- If you struggle to fit a word 4 times, simply add a new sentence containing it.
- NEVER twice in the same sentence.
- Do NOT place two different target words in the same sentence. Spread targets so each sentence contains at most one target word.
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
1. At least 4 occurrences of each target word, bold-marked
2. Coherent, readable story
3. Any paragraph count/length is acceptable`;
}

export function storyUserBold(
  cefr: string,
  targetWords: string[],
  paragraphCount: number
): string {
  return JSON.stringify({
    cefr,
    targetWords,
    paragraphCountHint: paragraphCount,
    instructions:
      'Generate a natural story where each target word appears AT LEAST 4 times (absolute minimum 4; 5 or 6 is fine), marked with **word** format. If a word count is low, append a sentence using it.',
  });
}
