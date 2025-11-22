import { getOpenAI } from '../utils/openai'
import { parseBoldMarkers } from '../utils/boldParser'
import { storySystemBold, storyUserBold } from '../prompts'
import logger from '../utils/logger'

export interface StoryGenerationOptions {
  experimentId: string
  words: string[]
  cefr: string
  paragraphCount: number
  maxAttempts?: number
}

export interface GeneratedStory {
  paragraphs: string[]
  occurrences: any[]
  attempt: number
  usedFallback: boolean
}

export async function generateStory(opts: StoryGenerationOptions): Promise<GeneratedStory> {
  const { words, cefr, paragraphCount, maxAttempts = 2 } = opts
  const sentencesPerParagraph = Math.max(3, Math.ceil((4 * words.length) / paragraphCount))

  const oa = getOpenAI()

  if (oa) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const r = await oa.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          temperature: 0.8,
          messages: [
            { role: 'system', content: storySystemBold(paragraphCount) },
            { role: 'user', content: storyUserBold(cefr, words, paragraphCount, sentencesPerParagraph) },
          ],
        })

        const text = r.choices?.[0]?.message?.content || '{}'
        const data = JSON.parse(text)
        const rawParagraphs = Array.isArray(data?.story?.paragraphs)
          ? data.story.paragraphs.slice(0, paragraphCount)
          : []

        if (rawParagraphs.length > 0) {
          const { cleanParagraphs, occurrences } = parseBoldMarkers(rawParagraphs)

          if (cleanParagraphs.length === paragraphCount && occurrences.length > 0) {
            logger.info('Story generated via OpenAI', {
              attempt: attempt + 1,
              paragraphs: cleanParagraphs.length,
              occurrences: occurrences.length,
            })

            return {
              paragraphs: cleanParagraphs,
              occurrences,
              attempt: attempt + 1,
              usedFallback: false,
            }
          }
        }
      } catch (e: any) {
        logger.error('OpenAI story generation attempt failed', {
          attempt: attempt + 1,
          error: e.message,
        })
      }
    }
  }

  logger.warn('Using fallback story generator', { experimentId: opts.experimentId })
  return generateFallbackStory(opts)
}

function generateFallbackStory(opts: StoryGenerationOptions): GeneratedStory {
  const { words, paragraphCount } = opts
  const sentencesPerParagraph = Math.max(3, Math.ceil((4 * words.length) / paragraphCount))

  // TODO: reuse local fallback logic currently in experiments.ts
  return {
    paragraphs: Array.from({ length: paragraphCount }, (_, p) =>
      Array.from(
        { length: sentencesPerParagraph },
        (_, s) => `Paragraph ${p + 1}, sentence ${s + 1}.`
      ).join(' ')
    ),
    occurrences: [],
    attempt: 0,
    usedFallback: true,
  }
}
