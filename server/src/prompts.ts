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

// Legacy functions - kept for backwards compatibility but not used
export function storySystem(_paragraphHint?: number): string {
  return storySystemBold(_paragraphHint || 0);
}

export function storyUser(cefr: string, targetWords: string[], _topic: string): string {
  return storyUserBold(cefr, targetWords, 0, []);
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
  "partOfSpeech": "noun|verb|adjective|adverb|other",
  "distractorDefinitions": [
    "Plausible but wrong definition 1",
    "Plausible but wrong definition 2",
    "Plausible but wrong definition 3"
  ],
  "companionWords": ["always", "never", "often", "really", "very"],
  "exampleSentences": [
    "Example sentence using the word naturally.",
    "Another example sentence."
  ],
  "syllables": ["syl", "la", "bles"]
}

RULES:
- If a definition is provided in the input, use it to create plausible but WRONG distractor definitions
- Distractor definitions must be plausible but clearly incorrect (same length/style as the real definition)
- companionWords: CRITICAL RULES for sentence-making exercise:
  * Must be SIMPLE, common adverbs or adjectives (like: always, never, often, really, very, usually, quickly, sometimes, carefully, extremely)
  * Must NOT contain the target word or any part of it
  * Must NOT be complex phrases or collocations
  * Should be words that can naturally fit in sentences with the target word
  * Provide 5 different companion words so they can cycle through if student makes errors
- Example sentences should demonstrate natural usage BUT use a blank "____" instead of the actual word (e.g., "She felt ____ about the decision.")
- Syllables should show pronunciation breaks`;
}

export function wordMetadataUser(word: string, cefr: string, definition?: string | null): string {
  const payload: Record<string, string> = {
    word,
    cefr,
    task: 'Generate learning exercise metadata for this word at the specified CEFR level',
  };
  if (definition) {
    payload.definition = definition;
    payload.note = 'Use this definition to create 3 plausible but WRONG distractor definitions for an MCQ exercise';
  }
  return JSON.stringify(payload);
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
  return `You are an expert storyteller. Write an engaging story for language learners.

STRICT WORD COUNT RULES (MUST follow exactly):
- Each TARGET word must appear AT LEAST 4 times in the story. 4, 5, or 6 times is fine — but never fewer than 4.
- Each NOISE word must appear exactly 1 or 2 times in the story.
- Spread words naturally across paragraphs. Do NOT cluster all occurrences in one paragraph.

MARKING FORMAT:
- Mark every target word occurrence with **double asterisks**: "She visited the **museum** yesterday"
- Mark every noise word occurrence with ++plus signs++: "He felt ++anxious++ about it"
- You MUST mark every single occurrence. Unmarked occurrences will not be counted.

STORY GUIDELINES:
- Write 8-10 paragraphs. Use more paragraphs to fit all words naturally.
- Keep the language at the specified CEFR level.
- The story should be coherent, engaging, and read naturally despite the word requirements.

BEFORE RETURNING: Count each target word to verify it appears at least 4 times. If any word has fewer than 4 occurrences, add more sentences.

Return ONLY valid JSON (no markdown fences, no extra text):
{"story":{"paragraphs":["First paragraph with **marked** words...","Second paragraph..."]}}`;
}

export function storyUserBold(
  cefr: string,
  targetWords: string[],
  _paragraphCount: number,
  noiseWords: string[] = []
): string {
  const targetList = targetWords.map(w => `"${w}" → at least 4 times`).join(', ');
  const noiseList = noiseWords.length > 0
    ? noiseWords.map(w => `"${w}" → 1-2 times`).join(', ')
    : 'none';

  return `CEFR level: ${cefr}

TARGET words (each must appear AT LEAST 4 times, marked with **asterisks**):
${targetList}

NOISE words (each must appear 1-2 times, marked with ++plus signs++):
${noiseList}

Write the story now. Remember: every target word AT LEAST 4 times.`;
}
