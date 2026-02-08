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
  return `You are an expert storyteller. Create an engaging story for language learners.

CRITICAL COUNTING REQUIREMENT:
Each target word MUST appear EXACTLY 4 times in the story. Not 3, not 5 - exactly 4.
Before finalizing, COUNT each target word's occurrences and verify = 4.

STRUCTURE:
- Write 3-6 paragraphs as needed for a natural narrative flow
- No strict paragraph count - use as many as the story needs
- Each paragraph: varied sentence lengths for natural reading
- Create a complete narrative arc (beginning, middle, end)

TARGET WORD RULES:
1. Each target word appears EXACTLY 4 times total (count carefully!)
2. Mark EVERY occurrence with **double asterisks**: "The **museum** was old"
3. NEVER put two DIFFERENT target words in the same sentence
4. Same word CAN appear multiple times in one paragraph

NOISE WORDS (if provided):
- Each noise word: 1-2 times total
- Mark with ++plus signs++: "She was ++anxious++"

VERIFICATION STEP (do this before responding):
For each target word, count occurrences in your story. If any word ≠ 4, revise until all = 4.

Return JSON:
{
  "story": {
    "paragraphs": ["paragraph with **target** and ++noise++ markers", ...],
    "wordCounts": { "word1": 4, "word2": 4, ... },
    "occurrences": [{ "word": "x", "paragraphIndex": 0, "sentenceIndex": 0 }, ...]
  }
}`;
}

export function storyUserBold(
  cefr: string,
  targetWords: string[],
  _paragraphCount: number,
  noiseWords: string[] = []
): string {
  const wordList = targetWords.map(w => `"${w}": exactly 4 times`).join(', ');

  const payload: Record<string, any> = {
    cefr,
    targetWords,
    requiredCounts: wordList,
    criticalRule: 'COUNT CAREFULLY: Each target word must appear EXACTLY 4 times. Verify your counts before responding.',
    instructions: 'Write an engaging story with natural paragraph structure. Mark each target word with **asterisks**. Never put two different target words in the same sentence.',
  };

  if (noiseWords.length > 0) {
    payload.noiseWords = noiseWords;
    payload.noiseRule = 'Each noise word: 1-2 times, marked with ++plus signs++';
  }

  return JSON.stringify(payload);
}
