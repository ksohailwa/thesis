/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { requireExperimentOwnership } from '../middleware/ownership';
import { Experiment } from '../models/Experiment';
import { Story } from '../models/Story';
import { Assignment } from '../models/Assignment';
import { Condition } from '../models/Condition';
import { Attempt } from '../models/Attempt';
import { Event } from '../models/Event';
import { getOpenAI, generateSentenceTTS } from '../utils/openai';
import {
  wordPoolSystem,
  wordPoolUser,
  storySystem,
  storyUser,
  storySystemBold,
  storyUserBold,
} from '../prompts';
import { toConditionLabel } from '../utils/labelMapper';
import { parseBoldMarkers } from '../utils/boldParser';
import { generateFallbackStory } from '../utils/fallbackStory';
import logger from '../utils/logger';

const router = Router();
const OPENAI_CHAT_MODEL = 'gpt-5.2-2025-12-11';

function makeCode(n = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function mapToInternalLabel(label: string) {
  const value = (label || '').toString().toUpperCase();
  if (value === 'H' || value === 'A' || value === '1' || value === 'STORY1') return 'A';
  if (value === 'N' || value === 'B' || value === '2' || value === 'STORY2') return 'B';
  return value;
}

function normalizeSet(_value?: string): 'set1' | 'set2' {
  // Single-set design: always collapse to set1
  return 'set1';
}

function normalizeWords(words: unknown[] = []) {
  return words
    .map((w) => (typeof w === 'string' ? w : String(w ?? '')))
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
    .map((w) => w.toLowerCase());
}

function safeWordFile(word: string) {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function collectSetWords(
  exp: { stories?: { story1?: { targetWords?: string[] }; story2?: { targetWords?: string[] } } },
  _set: 'set1' | 'set2'
) {
  const entries = [
    ...(exp.stories?.story1?.targetWords || []),
    ...(exp.stories?.story2?.targetWords || []),
  ];
  return Array.from(new Set(entries.map((w) => w || '').filter(Boolean)));
}

function sentenceIndexAt(paragraph: string, charPos: number) {
  const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);
  let cumulative = 0;
  for (let si = 0; si < sentences.length; si++) {
    const len = sentences[si].length + 1;
    if (charPos < cumulative + len) return si;
    cumulative += len;
  }
  return Math.max(0, sentences.length - 1);
}

function findWordOccurrence(
  paragraph: string,
  word: string,
  targetRanges: { start: number; end: number }[]
) {
  const lower = paragraph.toLowerCase();
  const w = word.toLowerCase();
  let idx = 0;
  while (idx <= lower.length) {
    const at = lower.indexOf(w, idx);
    if (at === -1) return null;
    const before = lower[at - 1] || '';
    const after = lower[at + w.length] || '';
    const isWordBoundary = !/[a-z]/.test(before) && !/[a-z]/.test(after);
    const start = at;
    const end = at + w.length;
    const overlapsTarget = targetRanges.some((r) => !(end <= r.start || start >= r.end));
    if (isWordBoundary && !overlapsTarget) {
      return { start, end };
    }
    idx = at + w.length;
  }
  return null;
}

async function selectNoiseOccurrencesLLM(
  oa: ReturnType<typeof getOpenAI>,
  paragraphs: string[],
  targetOccurrences: {
    word: string;
    paragraphIndex: number;
    charStart?: number;
    charEnd?: number;
  }[],
  targetWords: string[]
) {
  if (!oa) return null;
  try {
    const r = await oa.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Pick exactly 2 non-target words per paragraph from the provided story. Do not choose words in the same sentence as target words, and avoid words adjacent to target words. Only use words that appear in the text. Return JSON only.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            targetWords,
            paragraphs,
            output: '{ "noiseWords": [ { "word": string, "paragraphIndex": number } ] }',
          }),
        },
      ],
    });
    const txt = r.choices?.[0]?.message?.content || '{}';
    const data = JSON.parse(txt);
    if (!Array.isArray(data?.noiseWords)) return null;

    const byParagraph = new Map<number, { word: string }[]>();
    data.noiseWords.forEach((n: { word?: unknown; paragraphIndex?: unknown }) => {
      if (!n || typeof n.word !== 'string' || typeof n.paragraphIndex !== 'number') return;
      const list = byParagraph.get(n.paragraphIndex) || [];
      list.push({ word: n.word });
      byParagraph.set(n.paragraphIndex, list);
    });

    const out: Array<{
      word: string;
      paragraphIndex: number;
      sentenceIndex: number;
      charStart: number;
      charEnd: number;
    }> = [];
    paragraphs.forEach((p, pIdx) => {
      const targetRanges = (targetOccurrences || [])
        .filter((o) => o.paragraphIndex === pIdx)
        .filter((o) => typeof o.charStart === 'number' && typeof o.charEnd === 'number')
        .map((o) => ({ start: o.charStart as number, end: o.charEnd as number }));
      const picks = (byParagraph.get(pIdx) || []).slice(0, 2);
      picks.forEach((pick) => {
        const occ = findWordOccurrence(p, pick.word, targetRanges);
        if (!occ) return;
        out.push({
          word: pick.word,
          paragraphIndex: pIdx,
          sentenceIndex: sentenceIndexAt(p, occ.start),
          charStart: occ.start,
          charEnd: occ.end,
        });
      });
    });
    return out.length ? out : null;
  } catch (e) {
    return null;
  }
}

router.post('/', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  const schema = z.object({
    title: z.string().min(2),
    description: z.string().optional(),
    level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
    cefr: z.enum(['A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { title, description, level, cefr } = parsed.data as any;
  const code = makeCode();
  const doc = await Experiment.create({
    owner: req.user?.sub,
    title,
    description,
    level: level || cefr,
    cefr: cefr || level,
    targetWords: [],
    classCode: code,
    code,
    status: 'draft',
  });
  res.json({ id: doc._id, code: doc.classCode, ...doc.toObject() });
});

router.get(
  '/:id',
  requireAuth,
  requireRole('teacher'),
  requireExperimentOwnership(),
  async (req, res) => {
    const doc = await Experiment.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ id: doc._id, ...doc.toObject() });
  }
);

const targetWordsSchema = z.object({ targetWords: z.array(z.string()).min(1).max(5) });

async function handleTargetWordsUpdate(req: AuthedRequest, res: Response) {
  const parsed = targetWordsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const capped = parsed.data.targetWords.slice(0, 5);
  const exp = await Experiment.findByIdAndUpdate(
    req.params.id,
    { targetWords: capped },
    { new: true }
  );
  if (!exp) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}

router.post('/:id/target-words', requireAuth, requireRole('teacher'), handleTargetWordsUpdate);
router.post('/:id/words', requireAuth, requireRole('teacher'), handleTargetWordsUpdate);

const storyWordsSchema = z.object({
  story: z.enum(['story1', 'story2']),
  targetWords: z.array(z.string()).length(5),
  set: z.enum(['set1', 'set2']).optional(),
});

router.post(
  '/:id/story-words',
  requireAuth,
  requireRole('teacher'),
  requireExperimentOwnership(),
  async (req: AuthedRequest, res: Response) => {
    const parsed = storyWordsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { story, targetWords } = parsed.data;
    const set = normalizeSet((parsed.data as any)?.set);
    const unique = Array.from(
      new Set(targetWords.map((word) => word.trim()).filter((word) => word.length > 0))
    ).slice(0, 5);
    try {
      const exp = await Experiment.findById(req.params.id);
      if (!exp) return res.status(404).json({ error: 'Experiment not found' });

      // Check for word overlap with the other story
      const otherKey = story === 'story1' ? 'story2' : 'story1';
      const otherWords = normalizeWords((exp.stories as any)?.[otherKey]?.targetWords || []);
      const overlap = unique.filter((w) => otherWords.includes(w.toLowerCase()));

      if (overlap.length > 0) {
        logger.warn('Word overlap detected', { experimentId: req.params.id, story, overlap });
        return res.status(400).json({
          error: `Word overlap detected with ${otherKey}; stories must stay disjoint.`,
          overlap,
        });
      }

      const update: Record<string, any> = {};
      update[`stories.${story}.targetWords`] = unique;
      const updated = await Experiment.findByIdAndUpdate(
        req.params.id,
        { $set: update },
        { new: true }
      ).select('stories');
      if (!updated) return res.status(404).json({ error: 'Experiment not found' });
      return res.json({ ok: true, story, set, targetWords: unique, stories: updated.stories });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save story words' });
    }
  }
);

async function handleWordSuggestions(req: AuthedRequest, res: Response) {
  const exp = await Experiment.findById(req.params.id);
  if (!exp) return res.status(404).json({ error: 'Not found' });
  const storyKey = (req.body as any)?.story === 'story2' ? 'story2' : 'story1';
  const otherKey = storyKey === 'story1' ? 'story2' : 'story1';
  const otherWords: string[] = (exp.stories as any)?.[otherKey]?.targetWords || [];
  const used = new Set<string>([...otherWords.map((w: string) => w.toLowerCase())]);

  const oa = getOpenAI();
  if (oa) {
    try {
      const r = await oa.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: wordPoolSystem() },
          {
            role: 'user',
            content: wordPoolUser(exp.cefr || exp.level || 'B1', storyKey, Array.from(used)),
          },
        ],
        temperature: 0.6,
      });
      const text = r.choices?.[0]?.message?.content || '{}';
      const data = JSON.parse(text);
      const itemsRaw = Array.isArray(data?.items) ? data.items.slice(0, 50) : [];
      const items = itemsRaw.filter((i: any) => !used.has((i?.word || '').toLowerCase()));
      return res.json({ suggestions: items.map((i: any) => i.word), items });
    } catch (e) {
      logger.error('Word pool generation failed', {
        experimentId: req.params.id,
        error: (e as any).message,
      });
      // If OpenAI is available but fails, surface the error instead of silently falling back
      const allowFallback = process.env.ALLOW_WORDPOOL_FALLBACK === 'true';
      if (!allowFallback) {
        return res
          .status(500)
          .json({ error: 'LLM word pool generation failed; check OpenAI config/logs.' });
      }
    }
  }

  // Fallback (only if OpenAI unavailable or fallback explicitly allowed)
  if (!oa || process.env.ALLOW_WORDPOOL_FALLBACK === 'true') {
    const fallbackPool = [
      { word: 'rhythm', level: 'B2', gloss: 'pattern of beats', reason: 'Tricky spelling' },
      { word: 'queue', level: 'B2', gloss: 'line of people', reason: 'Tricky spelling' },
      { word: 'pneumonia', level: 'C1', gloss: 'lung infection', reason: 'Tricky spelling' },
      { word: 'occurrence', level: 'B2', gloss: 'event', reason: 'Double letters' },
      { word: 'embarrass', level: 'B2', gloss: 'cause shame', reason: 'Double letters' },
      { word: 'accommodate', level: 'B2', gloss: 'provide lodging', reason: 'Double letters' },
      { word: 'boulevard', level: 'B2', gloss: 'wide street', reason: 'Foreign origin' },
      { word: 'cinnamon', level: 'B1', gloss: 'spice', reason: 'Common misspelling' },
      { word: 'lantern', level: 'B1', gloss: 'portable light', reason: 'Contextual' },
      { word: 'orchard', level: 'B1', gloss: 'fruit trees', reason: 'Contextual' },
      { word: 'meadow', level: 'B1', gloss: 'grassy field', reason: 'Contextual' },
      { word: 'canvas', level: 'B1', gloss: 'cloth for painting', reason: 'Contextual' },
    ];
    const items = fallbackPool.filter((i) => !used.has(i.word.toLowerCase()));
    return res.json({ suggestions: items.map((i) => i.word), items });
  }

  // If we reached here and did not return, an OpenAI failure occurred without fallback
  return res.status(500).json({ error: 'Word pool generation failed' });
}

router.post('/:id/suggestions', requireAuth, requireRole('teacher'), handleWordSuggestions);
router.post('/:id/word-suggestions', requireAuth, requireRole('teacher'), handleWordSuggestions);

// Generate 2 stories (A/B) with each selected word appearing exactly 5x, never twice in the same sentence.
router.post(
  '/:id/generate-stories',
  requireAuth,
  requireRole('teacher'),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      cefr: z.string().optional(),
      targetWords: z.array(z.string()).min(1).max(5).optional(),
      topic: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const exp = await Experiment.findById(req.params.id);
    if (!exp) return res.status(404).json({ error: 'Not found' });

    // Prefer saved per-story target words; fall back to payload
    const story1Saved: string[] = (exp.stories as any)?.story1?.targetWords || [];
    const story2Saved: string[] = (exp.stories as any)?.story2?.targetWords || [];
    const payloadWords = parsed.data.targetWords || [];

    let wordsH = story1Saved.slice(0, 5);
    let wordsN = story2Saved.slice(0, 5);

    if (!wordsH.length || !wordsN.length) {
      const uniquePayload = Array.from(new Set(payloadWords.map((w) => w.trim()))).filter(Boolean);
      if (!uniquePayload.length)
        return res.status(400).json({ error: 'No target words provided.' });
      if (!wordsH.length) wordsH = uniquePayload.slice(0, Math.ceil(uniquePayload.length / 2));
      if (!wordsN.length) {
        const remaining = uniquePayload.filter(
          (w) => !wordsH.some((h) => h.toLowerCase() === w.toLowerCase())
        );
        wordsN = remaining.slice(0, 5);
      }
    }

    // Per user request, wordsH and wordsN are now allowed to overlap.
    // wordsN = wordsN.filter((w) => !wordsH.some((h) => h.toLowerCase() === w.toLowerCase()));

    const oa = getOpenAI();
    const allWords = [...wordsH, ...wordsN];

    const validateStoryCounts = (storyWords: string[], paragraphCount: number, occ: any[]) => {
      if (paragraphCount !== 5) return false;
      for (const w of storyWords) {
        const count = occ.filter((o: any) => o.word === w).length;
        if (count < 5) return false;
      }
      return true;
    };

    async function genOne(label: 'H' | 'N', storyWords: string[]) {
      if (storyWords.length === 0) {
        // Create an empty placeholder story if no words
        const map = label === 'H' ? 'A' : 'B';
        const filter = { experiment: exp._id, label: map };
        return await Story.findOneAndUpdate(
          filter,
          {
            experiment: exp._id,
            storySet: 'set1',
            label: map,
            paragraphs: [],
            targetOccurrences: [],
          },
          { upsert: true, new: true }
        );
      }

      let paragraphs: string[] = [];
      let occ: any[] = [];
      const paragraphCount = 5;
      if (oa) {
        try {
          const r = await oa.chat.completions.create({
            model: OPENAI_CHAT_MODEL,
            response_format: { type: 'json_object' },
            temperature: 0.8,
            messages: [
              { role: 'system', content: storySystem(paragraphCount) },
              {
                role: 'user',
                content: storyUser(
                  (parsed.data?.cefr as any) || (exp.cefr as any) || (exp.level as any) || 'B1',
                  storyWords,
                  (parsed.data as any)?.topic || ''
                ),
              },
            ],
          });
          const text = r.choices?.[0]?.message?.content || '{}';
          const data = JSON.parse(text);
          paragraphs = Array.isArray(data?.story?.paragraphs)
            ? data.story.paragraphs.slice(0, paragraphCount)
            : [];
          occ = Array.isArray(data?.story?.occurrences) ? data.story.occurrences : [];
        } catch (e) {
          logger.warn('Story generation failed; using fallback', { error: (e as any)?.message });
        }
      }
      const valid =
        paragraphs.length === paragraphCount &&
        validateStoryCounts(storyWords, paragraphCount, occ);
      if (!valid) {
        const fallback = generateFallbackStory(storyWords);
        paragraphs = fallback.paragraphs;
        occ = fallback.occurrences;
      }
      const map = label === 'H' ? 'A' : 'B';
      const filter = {
        experiment: exp._id,
        label: map,
        $or: [{ storySet: 'set1' }, { storySet: { $exists: false } }],
      };
      const s = await Story.findOneAndUpdate(
        filter,
        { experiment: exp._id, storySet: 'set1', label: map, paragraphs, targetOccurrences: occ },
        { upsert: true, new: true }
      );
      return s;
    }

    const [sH, sN] = await Promise.all([genOne('H', wordsH), genOne('N', wordsN)]);
    await Experiment.findByIdAndUpdate(exp._id, { stories: { H: sH._id, N: sN._id } });
    return res.json({
      ok: true,
      used: 'openai',
      wordsCount: allWords.length,
      stories: { H: sH._id, N: sN._id },
    });
  }
);

// Per-spec: generate a single story by label 'H'|'N' (alias to our 'A'|'B')
router.post(
  '/:id/generate-story',
  requireAuth,
  requireRole('teacher'),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      label: z.enum(['H', 'N', 'A', 'B', '1', '2', 'story1', 'story2']),
      targetWords: z.array(z.string()).min(1).max(5).optional(),
      topic: z.string().optional(),
      set: z.enum(['set1', 'set2']).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const exp = await Experiment.findById(req.params.id);
    if (!exp) return res.status(404).json({ error: 'Not found' });
    const set = normalizeSet((parsed.data as any).set);
    const map = mapToInternalLabel(parsed.data.label);
    const storyKey = map === 'A' ? 'story1' : 'story2';
    const savedWords = (exp.stories as any)?.[storyKey]?.targetWords || exp.targetWords || [];
    const words = (parsed.data.targetWords || savedWords || []).slice(0, 5);
    const paragraphCount = 5;
    const oa = getOpenAI();
    let paragraphs: string[] = [];
    let occ: any[] = [];
    let noise: any[] = [];
    const buildFallback = (storyWords: string[]) => {
      const sentencesPerParagraph = Math.max(4, storyWords.length);
      const baseSentences: string[][] = Array.from({ length: paragraphCount }, (_, p) =>
        Array.from(
          { length: sentencesPerParagraph },
          (_, s) => `Paragraph ${p + 1}, sentence ${s + 1}.`
        )
      );
      const occLocal: any[] = [];
      const shuffle = (arr: string[]) => arr.sort(() => Math.random() - 0.5);
      let lastOrder: string[] | null = null;
      for (let pIdx = 0; pIdx < paragraphCount; pIdx++) {
        let order = shuffle([...storyWords]);
        if (lastOrder && order.join('|') === lastOrder.join('|')) {
          order = order.slice(1).concat(order[0]);
        }
        lastOrder = order;
        order.forEach((w, sIdx) => {
          const current = baseSentences[pIdx][sIdx];
          const insertion = ` ${w}`;
          const charStart = current.length;
          const charEnd = charStart + insertion.length;
          baseSentences[pIdx][sIdx] = current.replace(/[.!?]+$/, '') + insertion + '.';
          occLocal.push({ word: w, paragraphIndex: pIdx, sentenceIndex: sIdx, charStart, charEnd });
        });
      }
      const paragraphs = baseSentences.map((sentences) => sentences.join(' '));
      return { paragraphs, occ: occLocal };
    };
    if (oa && words.length) {
      try {
        const r = await oa.chat.completions.create({
          model: OPENAI_CHAT_MODEL,
          response_format: { type: 'json_object' },
          temperature: 0.8,
          messages: [
            { role: 'system', content: storySystemBold(paragraphCount) },
            {
              role: 'user',
              content: storyUserBold(exp.cefr || exp.level || 'B1', words, paragraphCount),
            },
          ],
        });
        const text = r.choices?.[0]?.message?.content || '{}';
        const data = JSON.parse(text);
        const rawParas = Array.isArray(data?.story?.paragraphs) ? data.story.paragraphs : [];
        const limitedParas = rawParas.slice(0, paragraphCount);

        if (limitedParas.length > 0) {
          const { cleanParagraphs, occurrences } = parseBoldMarkers(limitedParas);
          paragraphs = cleanParagraphs;
          occ = occurrences;

          // Log if no occurrences found
          if (occurrences.length === 0) {
            logger.warn('No bold markers found in LLM response', {
              experimentId: req.params.id,
              rawParas: limitedParas.slice(0, 2),
              label: parsed.data.label,
            });
          }
        }
      } catch (e) {
        logger.warn('Story generation failed; using fallback', { error: (e as any)?.message });
      }
    }
    // Fallback to local generator if LLM failed
    if (!paragraphs.length) {
      const baseParas = Array.from(
        { length: paragraphCount },
        (_, p) => `${exp.title || 'Story'} - paragraph ${p + 1}.`
      );
      const occLocal: any[] = [];
      for (const w of words) {
        for (let pIdx = 0; pIdx < paragraphCount; pIdx++) {
          const before = baseParas[pIdx];
          const insertion = ` ${w}`;
          const charStart = before.length;
          const charEnd = charStart + insertion.length;
          baseParas[pIdx] = `${before}${insertion}.`;
          occLocal.push({ word: w, paragraphIndex: pIdx, sentenceIndex: 0, charStart, charEnd });
        }
      }
      paragraphs = baseParas;
      occ = occLocal;
    }

    const validateStory = (occList: any[]) => {
      const out = { ok: true, violations: [] as string[] };
      if (occList.length > 0) {
        for (const w of words) {
          const c = occList.filter((o: any) => o.word === w).length;
          if (c < 5) {
            out.ok = false;
            out.violations.push(`Word "${w}" must appear at least 5 times (got ${c}).`);
          }

          // No more than one occurrence of the same word per paragraph
          const byPara: Record<number, number> = {};
          occList
            .filter((o: any) => o.word === w)
            .forEach((o: any) => {
              byPara[o.paragraphIndex] = (byPara[o.paragraphIndex] || 0) + 1;
            });
          Object.entries(byPara).forEach(([p, count]) => {
            if (count > 1) {
              out.ok = false;
              out.violations.push(
                `Word "${w}" appears ${count} times in paragraph ${p}; only 1 allowed.`
              );
            }
          });
        }

        // Check no two target words in same sentence
        const byPos: Record<string, string[]> = {};
        occList.forEach((o: any) => {
          const key = `${o.paragraphIndex}:${o.sentenceIndex}`;
          (byPos[key] ||= []).push(o.word);
        });
        for (const [key, wordList] of Object.entries(byPos)) {
          const unique = Array.from(new Set(wordList));
          if (unique.length > 1) {
            out.ok = false;
            out.violations.push(`Multiple target words in same sentence at ${key}.`);
          }
        }
      }
      return out;
    };

    // Validate only single story being generated (not cross-story check yet)
    if (paragraphs.length > 0) {
      let singleStoryValidation = validateStory(occ);

      if (!singleStoryValidation.ok && oa && words.length) {
        try {
          const r = await oa.chat.completions.create({
            model: OPENAI_CHAT_MODEL,
            response_format: { type: 'json_object' },
            temperature: 0.2,
            messages: [
              {
                role: 'system',
                content:
                  storySystemBold(paragraphCount) +
                  '\nSTRICT: Do not repeat a target word within a paragraph. Only one target word per sentence.',
              },
              {
                role: 'user',
                content: storyUserBold(exp.cefr || exp.level || 'B1', words, paragraphCount),
              },
            ],
          });
          const text = r.choices?.[0]?.message?.content || '{}';
          const data = JSON.parse(text);
          const rawParas = Array.isArray(data?.story?.paragraphs) ? data.story.paragraphs : [];
          const limitedParas = rawParas.slice(0, paragraphCount);
          if (limitedParas.length > 0) {
            const parsedRetry = parseBoldMarkers(limitedParas);
            const retryValidation = validateStory(parsedRetry.occurrences);
            if (retryValidation.ok) {
              paragraphs = parsedRetry.cleanParagraphs;
              occ = parsedRetry.occurrences;
              singleStoryValidation = retryValidation;
            }
          }
        } catch (e) {
          logger.warn('Story strict retry failed; using fallback', { error: (e as any)?.message });
        }
      }

      if (!singleStoryValidation.ok) {
        logger.warn('Story validation failed - using fallback', {
          experimentId: req.params.id,
          label: map,
          violations: singleStoryValidation.violations,
        });
        const fallback = buildFallback(words);
        paragraphs = fallback.paragraphs;
        occ = fallback.occ;
      } else if (occ.length === 0 && paragraphs.length > 0) {
        logger.warn('No word occurrences found in story - using fallback', {
          experimentId: req.params.id,
          label: map,
          paragraphCount: paragraphs.length,
          wordCount: words.length,
        });
        const fallback = buildFallback(words);
        paragraphs = fallback.paragraphs;
        occ = fallback.occ;
      }
    }

    // Derive noise words AFTER story text is finalized (2-3 random non-target words per paragraph)
    if (paragraphs.length === 5) {
      const targetSet = new Set(words.map((w: string) => w.toLowerCase()));

      // Helper to map char positions to sentenceIndex
      const sentencesPerParagraph: string[][] = [];
      paragraphs.forEach((p) => {
        const sentences = p.split(/(?<=[.!?])\s+/).filter(Boolean);
        sentencesPerParagraph.push(sentences.length ? sentences : [p]);
      });

      const localNoise = () => {
        const noiseOccurrences: any[] = [];
        paragraphs.forEach((p, pIdx) => {
          const tokens = p.split(/\b/);
          const wordsInParagraph: {
            word: string;
            start: number;
            end: number;
            sentenceIndex: number;
          }[] = [];
          const targetsInParagraph = (occ || []).filter((o: any) => o.paragraphIndex === pIdx);
          const targetSentenceSet = new Set(
            targetsInParagraph
              .map((o: any) => o.sentenceIndex)
              .filter((v: any) => typeof v === 'number') as number[]
          );
          const targetRanges = targetsInParagraph
            .filter((o: any) => typeof o.charStart === 'number' && typeof o.charEnd === 'number')
            .map((o: any) => ({ start: o.charStart, end: o.charEnd }));

          const sentences = sentencesPerParagraph[pIdx];
          const sentenceIndexAt = (charPos: number) => {
            let cumulative = 0;
            for (let si = 0; si < sentences.length; si++) {
              const len = sentences[si].length + 1;
              if (charPos < cumulative + len) return si;
              cumulative += len;
            }
            return Math.max(0, sentences.length - 1);
          };
          const isAdjacentToTarget = (cand: { start: number; end: number }) => {
            for (const r of targetRanges) {
              if (cand.end <= r.start) {
                const between = p.slice(cand.end, r.start);
                if (between.length <= 3 && !/[A-Za-z]/.test(between)) return true;
              }
              if (r.end <= cand.start) {
                const between = p.slice(r.end, cand.start);
                if (between.length <= 3 && !/[A-Za-z]/.test(between)) return true;
              }
            }
            return false;
          };
          const buildCandidates = (minLen: number) => {
            wordsInParagraph.length = 0;
            let cursor = 0;
            const re = new RegExp(`^[A-Za-z]{${minLen},}$`);
            tokens.forEach((tok) => {
              if (re.test(tok)) {
                if (!targetSet.has(tok.toLowerCase())) {
                  const start = cursor;
                  const end = cursor + tok.length;
                  wordsInParagraph.push({
                    word: tok,
                    start,
                    end,
                    sentenceIndex: sentenceIndexAt(start),
                  });
                }
              }
              cursor += tok.length;
            });
          };
          const buildCandidatesFromRegex = (re: RegExp) => {
            wordsInParagraph.length = 0;
            let match: RegExpExecArray | null;
            while ((match = re.exec(p)) !== null) {
              const tok = match[0];
              if (targetSet.has(tok.toLowerCase())) continue;
              const start = match.index;
              const end = start + tok.length;
              wordsInParagraph.push({
                word: tok,
                start,
                end,
                sentenceIndex: sentenceIndexAt(start),
              });
            }
          };
          buildCandidates(4);
          if (wordsInParagraph.length === 0) buildCandidates(3);
          if (wordsInParagraph.length === 0) buildCandidates(2);
          if (wordsInParagraph.length === 0) buildCandidatesFromRegex(/[A-Za-z]{2,}/g);
          const poolBySentence = wordsInParagraph.filter(
            (w) => !targetSentenceSet.has(w.sentenceIndex)
          );
          const basePool = poolBySentence;
          if (!basePool.length) return;
          const pool = basePool.filter((w) => !isAdjacentToTarget(w));
          if (!pool.length) return;
          pool.sort((a, b) => a.start - b.start);
          pool.slice(0, 2).forEach((pick) => {
            noiseOccurrences.push({
              word: pick.word,
              paragraphIndex: pIdx,
              sentenceIndex: pick.sentenceIndex,
              charStart: pick.start,
              charEnd: pick.end,
            });
          });
        });
        return noiseOccurrences;
      };
      const llmNoise = await selectNoiseOccurrencesLLM(oa, paragraphs, occ, words);
      noise = llmNoise && llmNoise.length ? llmNoise : localNoise();
    }

    const filter = { experiment: exp._id, label: map } as any;
    const s = await Story.findOneAndUpdate(
      filter,
      {
        experiment: exp._id,
        storySet: set,
        set,
        label: map,
        paragraphs,
        targetOccurrences: occ,
        noiseOccurrences: noise,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, strict: false }
    );
    const patch: any = map === 'A' ? { 'storyRefs.story1': s._id } : { 'storyRefs.story2': s._id };
    await Experiment.findByIdAndUpdate(exp._id, { $set: patch });
    return res.json({ ok: true, storyId: s._id, noiseOccurrences: s.noiseOccurrences || [] });
  }
);

router.post('/:id/launch', requireAuth, requireRole('teacher'), async (req, res) => {
  const schema = z.object({ condition: z.enum(['with-hints', 'without-hints']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const exp = await Experiment.findByIdAndUpdate(
    req.params.id,
    { assignedCondition: parsed.data.condition, status: 'live' },
    { new: true }
  );
  if (!exp) return res.status(404).json({ error: 'Not found' });
  return res.json({ code: exp.classCode, condition: exp.assignedCondition, status: exp.status });
});

router.post(
  '/:id/tts',
  requireAuth,
  requireRole('teacher'),
  requireExperimentOwnership(),
  async (req, res) => {
    const schema = z.object({
      label: z.enum(['A', 'B', 'H', 'N', '1', '2', 'story1', 'story2']),
      set: z.enum(['set1', 'set2']).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { label } = parsed.data;
    const set = normalizeSet((parsed.data as any).set);
    const exp = await Experiment.findById(req.params.id);
    if (!exp) return res.status(404).json({ error: 'Not found' });
    const map = mapToInternalLabel(label);
    const normalizedLabel = toConditionLabel(label);
    const story = await Story.findOne({
      experiment: exp._id,
      label: map as any,
      $or: [{ storySet: set }, { storySet: { $exists: false } }],
    });
    if (!story) return res.status(404).json({ error: 'Story not found' });
    const oa = getOpenAI();
    const fs = await import('fs');
    const path = await import('path');
    const outDir = path.join(process.cwd(), 'static', 'audio', String(exp._id));
    fs.mkdirSync(outDir, { recursive: true });
    const fileLabel = set === 'set1' ? normalizedLabel : `${normalizedLabel}-${set}`;
    const outPath = path.join(outDir, `${fileLabel}.mp3`);

    // Cleanup old files to prevent serving stale audio
    try {
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
      const existingFiles = fs.readdirSync(outDir);
      existingFiles.forEach((f) => {
        if (f.startsWith(`${fileLabel}_s`) && f.endsWith('.mp3')) {
          fs.unlinkSync(path.join(outDir, f));
        }
      });
    } catch (e) {
      logger.warn('Failed to cleanup old audio files', { error: e });
    }

    try {
      if (oa) {
        const timestamp = Date.now();
        const tasks: Array<Promise<{ buf: Buffer; segName: string }>> = [];

        for (let pIdx = 0; pIdx < story.paragraphs.length; pIdx++) {
          const paragraph = story.paragraphs[pIdx] || '';
          const sentences = paragraph
            .split(/(?<=[.!?])\s+/)
            .map((s) => s.trim())
            .filter(Boolean);
          if (sentences.length === 0 && paragraph.trim()) sentences.push(paragraph.trim());

          for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
            const segName = `${normalizedLabel}_${pIdx}_${sIdx}.mp3`;
            tasks.push(
              generateSentenceTTS({
                client: oa,
                text: sentences[sIdx],
              }).then((buf) => ({ buf, segName }))
            );
          }
        }

        // If there are no sentences (empty story), fall back to full audio generation
        if (tasks.length === 0) {
          const resp = await oa.audio.speech.create({
            model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
            voice: process.env.OPENAI_TTS_VOICE || 'nova',
            input: story.paragraphs.join('\n\n'),
          } as any);
          const buf = Buffer.from(await resp.arrayBuffer());
          fs.writeFileSync(outPath, buf);
          story.ttsAudioUrl = `/static/audio/${exp._id}/${fileLabel}.mp3?t=${timestamp}`;
          story.ttsSegments = [];
          story.storySet = set;
          await story.save();
          return res.json({ url: story.ttsAudioUrl, segments: [], used: 'openai' });
        }

        const results = await Promise.all(tasks);
        const segBuffers: Buffer[] = [];
        const segUrls: string[] = [];
        results.forEach(({ buf, segName }) => {
          const segPath = path.join(outDir, segName);
          fs.writeFileSync(segPath, buf);
          segBuffers.push(buf);
          segUrls.push(`/static/audio/${exp._id}/${segName}?t=${timestamp}`);
        });

        // Build full audio by concatenating segments (rough but acceptable for sequential playback)
        if (segBuffers.length) {
          const fullBuf = Buffer.concat(segBuffers);
          fs.writeFileSync(outPath, fullBuf);
        } else {
          // fallback to one-shot generation if sentences missing
          const resp = await oa.audio.speech.create({
            model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
            voice: process.env.OPENAI_TTS_VOICE || 'nova',
            input: story.paragraphs.join('\n\n'),
          } as any);
          const buf = Buffer.from(await resp.arrayBuffer());
          fs.writeFileSync(outPath, buf);
        }

        const rel = `/static/audio/${exp._id}/${fileLabel}.mp3?t=${timestamp}`;
        story.ttsAudioUrl = rel;
        story.ttsSegments = segUrls;
        story.storySet = set;
        await story.save();
        return res.json({ url: rel, segments: segUrls, used: 'openai' });
      }
    } catch (e) {
      logger.warn('TTS generation failed; using mock audio', { error: (e as any)?.message });
    }
    // mock beep wav
    const wav = Buffer.alloc(44);
    fs.writeFileSync(outPath, wav);
    const rel = `/static/audio/${exp._id}/${fileLabel}.mp3`;
    story.ttsAudioUrl = rel;
    story.storySet = set;
    await story.save();
    return res.json({ url: rel, used: 'mock' });
  }
);

// Generate per-word TTS for recall test
router.post(
  '/:id/word-tts',
  requireAuth,
  requireRole('teacher'),
  requireExperimentOwnership(),
  async (req, res) => {
    const schema = z.object({
      words: z.array(z.string()).optional(),
      regenerate: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const exp = await Experiment.findById(req.params.id);
    if (!exp) return res.status(404).json({ error: 'Not found' });
    const words = (
      parsed.data.words && parsed.data.words.length
        ? parsed.data.words
        : collectSetWords(exp, 'set1')
    ).filter(Boolean);
    if (!words.length) return res.status(400).json({ error: 'No target words found' });

    const oa = getOpenAI();
    if (!oa) return res.status(503).json({ error: 'TTS unavailable' });

    const fs = await import('fs');
    const path = await import('path');
    const outDir = path.join(process.cwd(), 'static', 'audio', String(exp._id), 'words');
    fs.mkdirSync(outDir, { recursive: true });

    const results: any[] = [];
    for (const w of words) {
      const safe = safeWordFile(w);
      const outPath = path.join(outDir, `${safe}.mp3`);
      const rel = `/static/audio/${exp._id}/words/${safe}.mp3`;
      if (!parsed.data.regenerate && fs.existsSync(outPath)) {
        results.push({ word: w, audioUrl: rel, generated: false });
        continue;
      }
      try {
        const buf = await generateSentenceTTS({ client: oa, text: w });
        fs.writeFileSync(outPath, buf);
        results.push({ word: w, audioUrl: rel, generated: true });
      } catch (e: any) {
        results.push({ word: w, audioUrl: null, error: e?.message || 'TTS failed' });
      }
    }

    return res.json({ items: results });
  }
);

// Get a single story (teacher preview)
router.get('/:id/story/:label', requireAuth, requireRole('teacher'), async (req, res) => {
  const { id, label } = req.params as any;
  const set = normalizeSet((req.query as any)?.set);
  const exp = await Experiment.findById(id);
  if (!exp) return res.status(404).json({ error: 'Not found' });
  const map = mapToInternalLabel(label);
  const story = await Story.findOne({
    experiment: exp._id,
    label: map,
    $or: [{ storySet: set }, { storySet: { $exists: false } }],
  });
  if (!story) return res.status(404).json({ error: 'Story not found' });
  // Try to compute a default tts url path
  const fileLabel = set === 'set1' ? label : `${label}-${set}`;
  const ttsUrl = `/static/audio/${exp._id}/${fileLabel}.mp3`;
  const sentences = story.paragraphs.map((p) =>
    p
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );

  if ((!story.noiseOccurrences || story.noiseOccurrences.length === 0) && story.paragraphs.length) {
    const oa = getOpenAI();
    const targetSet = new Set(
      (story.targetOccurrences || []).map((o) => (o.word || '').toLowerCase())
    );
    const sentencesPerParagraph = story.paragraphs.map((p) => {
      const parts = p.split(/(?<=[.!?])\s+/).filter(Boolean);
      return parts.length ? parts : [p];
    });

    const noiseOccurrences: any[] = [];
    const llmNoise = await selectNoiseOccurrencesLLM(
      oa,
      story.paragraphs,
      story.targetOccurrences || [],
      Array.from(targetSet)
    );
    if (llmNoise && llmNoise.length) {
      story.noiseOccurrences = llmNoise as any;
      await story.save();
    } else {
      story.paragraphs.forEach((p, pIdx) => {
        const tokens = p.split(/\b/);
        const targetsInParagraph = (story.targetOccurrences || []).filter(
          (o) => o.paragraphIndex === pIdx
        );
        const sentenceIndexAt = (charPos: number) => {
          const sentences = sentencesPerParagraph[pIdx];
          let cumulative = 0;
          for (let si = 0; si < sentences.length; si++) {
            const len = sentences[si].length + 1;
            if (charPos < cumulative + len) return si;
            cumulative += len;
          }
          return Math.max(0, sentences.length - 1);
        };
        const targetSentenceSet = new Set<number>();
        const targetRanges = targetsInParagraph
          .filter((o: any) => typeof o.charStart === 'number' && typeof o.charEnd === 'number')
          .map((o: any) => {
            if (typeof o.sentenceIndex === 'number') {
              targetSentenceSet.add(o.sentenceIndex);
            } else if (typeof o.charStart === 'number') {
              targetSentenceSet.add(sentenceIndexAt(o.charStart));
            }
            return { start: o.charStart, end: o.charEnd };
          });
        const isAdjacentToTarget = (cand: { start: number; end: number }) => {
          for (const r of targetRanges) {
            if (cand.end <= r.start) {
              const between = p.slice(cand.end, r.start);
              if (between.length <= 3 && !/[A-Za-z]/.test(between)) return true;
            }
            if (r.end <= cand.start) {
              const between = p.slice(r.end, cand.start);
              if (between.length <= 3 && !/[A-Za-z]/.test(between)) return true;
            }
          }
          return false;
        };
        const candidates: { word: string; start: number; end: number; sentenceIndex: number }[] =
          [];
        const buildCandidates = (minLen: number) => {
          candidates.length = 0;
          let cursor = 0;
          const re = new RegExp(`^[A-Za-z]{${minLen},}$`);
          tokens.forEach((tok) => {
            if (re.test(tok) && !targetSet.has(tok.toLowerCase())) {
              const start = cursor;
              const end = cursor + tok.length;
              candidates.push({ word: tok, start, end, sentenceIndex: sentenceIndexAt(start) });
            }
            cursor += tok.length;
          });
        };
        const buildCandidatesFromRegex = (re: RegExp) => {
          candidates.length = 0;
          let match: RegExpExecArray | null;
          while ((match = re.exec(p)) !== null) {
            const tok = match[0];
            if (targetSet.has(tok.toLowerCase())) continue;
            const start = match.index;
            const end = start + tok.length;
            candidates.push({ word: tok, start, end, sentenceIndex: sentenceIndexAt(start) });
          }
        };
        buildCandidates(4);
        if (candidates.length === 0) buildCandidates(3);
        if (candidates.length === 0) buildCandidates(2);
        if (candidates.length === 0) buildCandidatesFromRegex(/[A-Za-z]{2,}/g);
        const poolBySentence = candidates.filter((c) => !targetSentenceSet.has(c.sentenceIndex));
        const basePool = poolBySentence;
        if (!basePool.length) return;
        const pool = basePool.filter((c) => !isAdjacentToTarget(c));
        if (!pool.length) return;
        pool.sort((a, b) => a.start - b.start);
        pool.slice(0, 2).forEach((pick) => {
          noiseOccurrences.push({
            word: pick.word,
            paragraphIndex: pIdx,
            sentenceIndex: pick.sentenceIndex,
            charStart: pick.start,
            charEnd: pick.end,
          });
        });
      });
      if (noiseOccurrences.length) {
        story.noiseOccurrences = noiseOccurrences as any;
        await story.save();
      }
    }
  }
  return res.json({
    id: story._id,
    label,
    set,
    paragraphs: story.paragraphs,
    occurrences: story.targetOccurrences || [],
    sentences,
    ttsAudioUrl: story.ttsAudioUrl || ttsUrl,
    noiseOccurrences: story.noiseOccurrences || [],
  });
});

router.post('/:id/status', requireAuth, requireRole('teacher'), async (req, res) => {
  const schema = z.object({ status: z.enum(['live', 'closed']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const exp = await Experiment.findByIdAndUpdate(
    req.params.id,
    { status: parsed.data.status },
    { new: true }
  );
  if (!exp) return res.status(404).json({ error: 'Not found' });
  res.json({ id: exp._id, status: exp.status });
});

router.get('/', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  const list = await Experiment.find({ owner: req.user?.sub }).sort({ updatedAt: -1 }).limit(50);
  res.json(
    list.map((x) => ({
      id: x._id,
      title: x.title,
      cefr: x.cefr || x.level,
      status: x.status,
      code: x.classCode,
    }))
  );
});

// Delete an experiment and related data
router.delete(
  '/:id',
  requireAuth,
  requireRole('teacher'),
  requireExperimentOwnership(),
  async (req: AuthedRequest, res) => {
    try {
      const exp = await Experiment.findById(req.params.id);
      if (!exp) return res.status(404).json({ error: 'Not found' });

      // Delete stories and audio
      await Story.deleteMany({ experiment: exp._id });
      try {
        const { default: fs } = await import('fs');
        const { default: path } = await import('path');
        fs.rmSync(path.join(process.cwd(), 'static', 'audio', String(exp._id)), {
          recursive: true,
          force: true,
        });
      } catch (e) {
        logger.warn('Failed to remove experiment audio directory', { error: (e as any)?.message });
      }

      // Delete assignments and conditions for this experiment
      try {
        await Assignment.deleteMany({ experiment: exp._id } as any);
        await Condition.deleteMany({ experiment: exp._id } as any);
      } catch (e) {
        logger.warn('Failed to delete assignments/conditions for experiment', {
          error: (e as any)?.message,
        });
      }

      // Optionally remove events/attempts tied to this experiment if present
      try {
        await Event.deleteMany({ experiment: exp._id } as any);
        await Attempt.deleteMany({ experiment: exp._id } as any);
      } catch (e) {
        logger.warn('Failed to delete events/attempts for experiment', {
          error: (e as any)?.message,
        });
      }

      await exp.deleteOne();
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Delete failed' });
    }
  }
);

// Simple demo endpoints used by client Demo pages
router.get('/demo', async (_req, res) => {
  // Return a synthetic list for now
  const list = await Experiment.find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .select('_id title level targetWords');
  const items = list.map((e) => ({
    id: String(e._id),
    title: e.title,
    level: e.level,
    targetWordsCount: (e.targetWords || []).length,
    description: '',
  }));
  res.json(items);
});

router.post('/:id/demo-start', async (req, res) => {
  const exp = await Experiment.findById(req.params.id);
  if (!exp) return res.status(404).json({ error: 'Not found' });
  const stories = await Story.find({ experiment: exp._id }).sort({ label: 1 });
  const schedule: Record<string, any> = {};
  const allOcc = stories.flatMap((s) =>
    (s.targetOccurrences || []).map((o) => ({ ...o, story: s.label }))
  );
  const byWord = new Map<string, any[]>();
  for (const o of allOcc) {
    const arr = byWord.get(o.word) || [];
    arr.push(o);
    byWord.set(o.word, arr);
  }
  for (const w of exp.targetWords) {
    const arr = (byWord.get(w) || [])
      .slice(0, 5)
      .sort((a, b) => a.paragraphIndex - b.paragraphIndex || a.sentenceIndex - b.sentenceIndex);
    schedule[w] = arr.map((o, i) => ({
      story: o.story,
      occurrence: i + 1,
      paragraphIndex: o.paragraphIndex,
      sentenceIndex: o.sentenceIndex,
    }));
  }
  // Default to with-hints for demo
  return res.json({
    experiment: {
      id: String(exp._id),
      title: exp.title,
      level: exp.level,
      targetWords: exp.targetWords,
    },
    condition: 'with-hints',
    stories,
    schedule,
  });
});

export default router;
