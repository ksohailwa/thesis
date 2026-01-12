/**
 * Label Mapping Utilities for Story/Condition Labels
 *
 * The SpellWise system has evolved through different naming conventions for stories:
 *
 * | Format | Values | Context | Description |
 * |--------|--------|---------|-------------|
 * | Legacy | H / N  | TTS files, old code | H=Hints, N=No-hints (condition-based) |
 * | Standard | A / B | Database, API | Neutral labels for A/B testing |
 * | Numeric | 1 / 2 | Some API responses | Simple numeric identifiers |
 * | Key | story1 / story2 | Session storage | Full key format |
 *
 * CANONICAL FORMAT: Use 'A' / 'B' (DbLabel) for all new code.
 * These mappers exist for backwards compatibility with existing data and clients.
 */

// Accepted input formats
export type StoryLabel = '1' | '2' | 'H' | 'N' | 'A' | 'B' | 'story1' | 'story2';

// Output formats
export type StoryKey = 'story1' | 'story2';
export type DbLabel = 'A' | 'B';
export type LegacyLabel = 'H' | 'N';
export type NumericLabel = '1' | '2';

/**
 * Labels that map to Story A (first story, typically with hints)
 */
export const STORY_A_LABELS = new Set(['1', 'H', 'A', 'story1']);

/**
 * Labels that map to Story B (second story, typically without hints)
 */
export const STORY_B_LABELS = new Set(['2', 'N', 'B', 'story2']);

/**
 * Check if a label refers to Story A
 */
export function isStoryA(label: StoryLabel): boolean {
  return STORY_A_LABELS.has(label);
}

/**
 * Check if a label refers to Story B
 */
export function isStoryB(label: StoryLabel): boolean {
  return STORY_B_LABELS.has(label);
}

/**
 * Convert any label format to the storage key format (story1/story2)
 */
export function toStoryKey(label: StoryLabel): StoryKey {
  return isStoryA(label) ? 'story1' : 'story2';
}

/**
 * Convert any label format to the canonical database format (A/B)
 * This is the PREFERRED format for all new code.
 */
export function toDbLabel(label: StoryLabel): DbLabel {
  return isStoryA(label) ? 'A' : 'B';
}

/**
 * Convert any label format to numeric format (1/2)
 * Used in some legacy API responses.
 */
export function toApiLabel(label: StoryLabel): NumericLabel {
  return isStoryA(label) ? '1' : '2';
}

/**
 * Convert any label format to legacy condition format (H/N)
 * Used for TTS file paths and some legacy code.
 * H = Hints enabled, N = No hints
 */
export function toConditionLabel(label: StoryLabel): LegacyLabel {
  return isStoryA(label) ? 'H' : 'N';
}

/**
 * Normalize any label to the canonical DbLabel format.
 * Throws if the label is not recognized.
 */
export function normalizeLabel(label: string): DbLabel {
  const normalized = label.trim().toUpperCase();
  if (normalized === 'A' || normalized === '1' || normalized === 'H' || normalized === 'STORY1') {
    return 'A';
  }
  if (normalized === 'B' || normalized === '2' || normalized === 'N' || normalized === 'STORY2') {
    return 'B';
  }
  throw new Error(`Invalid story label: ${label}`);
}

/**
 * Safely normalize a label, returning undefined for invalid inputs
 */
export function safeNormalizeLabel(label: string | undefined | null): DbLabel | undefined {
  if (!label) return undefined;
  try {
    return normalizeLabel(label);
  } catch {
    return undefined;
  }
}

/**
 * Get the TTS audio path for a story
 * @param experimentId - The experiment ID
 * @param label - Any valid story label
 * @returns The path to the TTS audio file
 */
export function getTtsPath(experimentId: string, label: StoryLabel): string {
  const legacyLabel = toConditionLabel(label);
  return `/static/audio/${experimentId}/${legacyLabel}.mp3`;
}

/**
 * Get the TTS segment path for a specific sentence
 * @param experimentId - The experiment ID
 * @param label - Any valid story label
 * @param segmentIndex - The sentence/segment index
 * @returns The path to the TTS segment file
 */
export function getTtsSegmentPath(
  experimentId: string,
  label: StoryLabel,
  segmentIndex: number
): string {
  const legacyLabel = toConditionLabel(label);
  return `/static/audio/${experimentId}/${legacyLabel}_s${segmentIndex}.mp3`;
}
