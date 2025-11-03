// Exact, JSON-only prompt templates as provided

export function wordPoolSystem(): string {
  return `You are a CEFR-aligned vocabulary suggester for spelling experiments.
Return STRICT JSON ONLY.

INPUT: { "cefr":"A2|B1|B2|C1|C2" }
TASK: suggest 15–20 culturally neutral and instructive target words for spelling at that level.
Avoid proper nouns, slurs, sensitive terms.

OUTPUT:
{ "cefr": string,
  "items": [ { "word": string, "gloss": string } ] }`;
}

export function wordPoolUser(cefr: string): string {
  return JSON.stringify({ cefr });
}

export function storySystem(): string {
  return `You are an educational story generator.

CONSTRAINTS:
- Use EXACTLY the provided targetWords (no variants).
- Produce ONE story with 5 paragraphs; each paragraph has 3–6 short sentences.
- Each target word MUST appear EXACTLY 4 times in this story.
- Never include the same target word twice in a single sentence.
- Return precise charStart/charEnd for each occurrence (indexes within paragraph string).

OUTPUT (STRICT JSON):
{
  "language": "English",
  "cefr": "{{cefr}}",
  "targetWords": string[],
  "story": {
    "paragraphs": string[5],
    "occurrences": [
      { "word": string, "paragraphIndex": 0..4, "sentenceIndex": 0..N, "charStart": number, "charEnd": number }
    ]
  },
  "validation": {
    "perWord": [{ "word": string, "count": 4, "sameSentenceDetected": false }],
    "totalOccurrences": targetWords.length * 4
  }
}
Return ONLY the JSON.`;
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

