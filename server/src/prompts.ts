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
- Use EXACTLY the provided 4 targetWords (no variants).
- Write EXACTLY 4 paragraphs. Paragraph length is flexible but keep the story natural.
- Each target word must appear EXACTLY 4 times total.
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
    "paragraphs": string[4],
    "occurrences": [
      { "word": string, "paragraphIndex": 0..3, "sentenceIndex": 0..N }
    ]
  },
  "validation": {
    "perWord": [{ "word": string, "count": 4, "sameSentenceDetected": false, "sameParagraphDetected": false }],
    "totalOccurrences": 16
  }
}`;
}

export function storyUser(cefr: string, targetWords: string[], topic: string): string {
  return JSON.stringify({
    cefr,
    targetWords,
    topic,
    paragraphs: 4,
    occurrencesPerWord: 4,
    minSentencesPerParagraph: targetWords.length,
  });
}

export function hintSystem(): string {
  return `You are a supportive spelling coach.

CRITICAL RULES - NEVER VIOLATE:
- NEVER reveal the spelling in ANY way
- NEVER write out the word or any part of it
- NEVER break the word into syllables, sounds, or chunks (e.g., NO "con-science", NO "think of 'tion'")
- NEVER use phonetic breakdowns or mnemonics that spell out parts
- NEVER say which specific letters to add, remove, or change
- NEVER mention letter positions (e.g., NO "add an 's' after...", NO "the third letter is...")

ALLOWED hints (vague and indirect ONLY):
- "Check if you have any double letters"
- "There might be a silent letter"
- "Look at the ending carefully"
- "Count your vowels"
- "Think about similar words you know"

Given the target word and the student's latest attempt text, produce ONE brief hint
(max 1 sentence) in the UI language. Keep it VERY vague and indirect.

Hints are disabled for occurrence 4 of a target word; if the user asks at occurrence 4, respond with a short encouragement without revealing letters.

OUTPUT:
{ "hint": string }`;
}

export function hintUser(targetWord: string, latestAttempt: string, uiLanguage: string): string {
  return JSON.stringify({ targetWord, latestAttempt, uiLanguage });
}

// Word metadata generation for intervention exercises
export function wordMetadataSystem(): string {
  return `You are a vocabulary learning assistant. Generate exercise data for spelling intervention.

OUTPUT strict JSON:
{
  "definition": "Clear, simple definition (max 15 words)",
  "partOfSpeech": "noun|verb|adjective|adverb|other",
  "distractorDefinitions": [
    "Plausible but wrong definition 1",
    "Plausible but wrong definition 2",
    "Plausible but wrong definition 3"
  ],
  "commonCollocations": ["word1", "word2", "word3"],
  "exampleSentences": [
    "Example sentence using the word naturally.",
    "Another example sentence."
  ],
  "syllables": ["syl", "la", "bles"]
}

RULES:
- Definition should be level-appropriate and clear
- Distractor definitions must be plausible but clearly incorrect
- Common collocations should be high-frequency verbs/nouns that pair with this word
- Example sentences should demonstrate natural usage BUT use a blank "____" instead of the actual word (e.g., "She felt ____ about the decision.")
- Syllables should show pronunciation breaks`;
}

export function wordMetadataUser(word: string, cefr: string): string {
  return JSON.stringify({
    word,
    cefr,
    task: 'Generate learning exercise metadata for this word at the specified CEFR level',
  });
}

// Sentence validation for intervention exercise 3
export function sentenceValidationSystem(): string {
  return `You are a lenient grammar checker for language learners.

TASK: Check if the student's sentence correctly uses BOTH the target word and base word.

RULES (lenient):
- Accept minor grammar errors (articles, prepositions)
- Accept different word forms (run/running, happy/happily)
- Focus on whether the meaning makes sense
- Both words must be present (or their common forms)

OUTPUT strict JSON:
{
  "isValid": boolean,
  "usedTargetWord": boolean,
  "usedBaseWord": boolean,
  "feedback": "Brief, encouraging feedback (max 20 words)"
}`;
}

export function sentenceValidationUser(
  sentence: string,
  targetWord: string,
  baseWord: string
): string {
  return JSON.stringify({ sentence, targetWord, baseWord });
}

export function storySystemBold(_paragraphCount: number): string {
  return `You are an educational story generator for spelling experiments.

CONSTRAINTS:
- Use EXACTLY the provided targetWords (no variants, no synonyms).
- Write EXACTLY 4 paragraphs (ignore the paragraphCount hint if it differs).
- Each target word must appear EXACTLY 4 times (one per paragraph for that word).
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
    "paragraphs": [exactly 4 paragraphs with **word** markers],
    "occurrences": [
      { "word": string, "paragraphIndex": number, "sentenceIndex": number }
    ]
  }
}

PRIORITIZE (if you cannot satisfy all constraints):
1. Exactly 4 occurrences of each target word, bold-marked
2. Coherent, readable story
3. Keep 4 paragraphs`;
}

export function storyUserBold(
  cefr: string,
  targetWords: string[],
  _paragraphCount: number
): string {
  return JSON.stringify({
    cefr,
    targetWords,
    paragraphCountHint: 4,
    occurrencesPerWord: 4,
    instructions:
      'Generate a natural story in exactly 4 paragraphs where each target word appears EXACTLY 4 times total (one per paragraph), marked with **word**. Do not place the same target word twice in a paragraph. Do not place two different target words in the same sentence. Each paragraph must have at least as many sentences as the number of targetWords.',
    minSentencesPerParagraph: targetWords.length,
  });
}
