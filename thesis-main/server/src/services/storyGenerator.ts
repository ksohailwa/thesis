import { getOpenAI } from '../utils/openai';
import { parseBoldMarkers, ParsedOccurrence } from '../utils/boldParser';
import { storySystemBold, storyUserBold } from '../prompts';
import logger from '../utils/logger';
import { generateFallbackStory } from '../utils/fallbackStory';

export interface StoryGenerationOptions {
  experimentId: string;
  words: string[];
  cefr: string;
  paragraphCount: number;
  maxAttempts?: number;
}

export interface GeneratedStory {
  paragraphs: string[];
  occurrences: ParsedOccurrence[];
  attempt: number;
  usedFallback: boolean;
}

export async function generateStory(opts: StoryGenerationOptions): Promise<GeneratedStory> {
  const { words, cefr, paragraphCount, maxAttempts = 2 } = opts;

  const oa = getOpenAI();

  if (oa) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const r = await oa.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          temperature: 0.8,
          messages: [
            { role: 'system', content: storySystemBold(paragraphCount) },
            { role: 'user', content: storyUserBold(cefr, words, paragraphCount) },
          ],
        });

        const text = r.choices?.[0]?.message?.content || '{}';
        const data = JSON.parse(text);
        const rawParagraphs = Array.isArray(data?.story?.paragraphs) ? data.story.paragraphs : [];

        if (rawParagraphs.length > 0) {
          const { cleanParagraphs, occurrences } = parseBoldMarkers(rawParagraphs);

          if (cleanParagraphs.length > 0 && occurrences.length > 0) {
            logger.info('Story generated via OpenAI', {
              attempt: attempt + 1,
              paragraphs: cleanParagraphs.length,
              occurrences: occurrences.length,
            });

            return {
              paragraphs: cleanParagraphs,
              occurrences,
              attempt: attempt + 1,
              usedFallback: false,
            };
          }
        }
      } catch (e: unknown) {
        const err = e as { message?: string };
        logger.error('OpenAI story generation attempt failed', {
          attempt: attempt + 1,
          error: err?.message || 'Unknown error',
        });
      }
    }
  }

  logger.warn('Using fallback story generator', { experimentId: opts.experimentId });
  return generateFallbackStoryForOptions(opts);
}

function generateFallbackStoryForOptions(opts: StoryGenerationOptions): GeneratedStory {
  const { words } = opts;
  const fallback = generateFallbackStory(words);
  return {
    paragraphs: fallback.paragraphs,
    occurrences: fallback.occurrences as ParsedOccurrence[],
    attempt: 0,
    usedFallback: true,
  };
}
