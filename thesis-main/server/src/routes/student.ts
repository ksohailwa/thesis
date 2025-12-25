import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { ClassSession } from '../models/ClassSession';
import { StoryTemplate } from '../models/StoryTemplate';
import { Attempt } from '../models/Attempt';
import { Event } from '../models/Event';
import { EffortResponse } from '../models/EffortResponse';
import { normalizedLevenshtein, positionCorrectness } from '../utils/levenshtein';
import dayjs from 'dayjs';
import OpenAI from 'openai';
import { config } from '../config';
import { getOpenAI } from '../utils/openai';
import { Experiment } from '../models/Experiment';
import { Story } from '../models/Story';
import { Condition } from '../models/Condition';
import { Assignment } from '../models/Assignment';
import { User } from '../models/User';
import { toDbLabel } from '../utils/labelMapper';
import { clearAnalyticsCache } from '../utils/analyticsCache';
import type {
  WordOccurrence,
  NoiseOccurrence,
  NoiseWord,
  StoryParagraphCue,
  StoryOrder,
  HintsStory,
  WordSchedule,
  WordScheduleEntry,
  HintStage,
  RecallScore,
  LLMNoiseWordsResponse,
} from '../types/requests';

function safeWordFile(word: string) {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function computeHighlightIndices(guess: string, target: string): number[] {
  // If equal length: mark mismatched positions
  if (guess.length === target.length) {
    const arr: number[] = [];
    for (let i = 0; i < guess.length; i++) if (guess[i] !== target[i]) arr.push(i);
    return arr;
  }
  // If different length: find the first index where they diverge
  const min = Math.min(guess.length, target.length);
  for (let i = 0; i < min; i++) {
    if (guess[i] !== target[i]) return [i];
  }
  // otherwise highlight trailing difference index
  return [min];
}

const router = Router();

function splitParagraphSentences(paragraph: string): string[] {
  const parts: string[] = [];
  const re = /([^.!?]*[.!?])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(paragraph))) parts.push(m[1].trim());
  if (parts.length === 0 && paragraph.trim()) parts.push(paragraph.trim());
  return parts;
}

function sentenceIndexAt(paragraph: string, charPos: number) {
  const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (!sentences.length) return 0;
  let cumulative = 0;
  for (let i = 0; i < sentences.length; i++) {
    const len = sentences[i].length + 1;
    if (charPos < cumulative + len) return i;
    cumulative += len;
  }
  return Math.max(0, sentences.length - 1);
}

function deriveNoiseOccurrences(
  paragraphs: string[],
  occurrences: WordOccurrence[]
): NoiseOccurrence[] {
  const targetSet = new Set((occurrences || []).map((o) => (o.word || '').toLowerCase()));
  const sentencesPerParagraph = paragraphs.map((p) => {
    const parts = p.split(/(?<=[.!?])\s+/).filter(Boolean);
    return parts.length ? parts : [p];
  });

  const noiseOccurrences: NoiseOccurrence[] = [];
  paragraphs.forEach((p, pIdx) => {
    const tokens = p.split(/\b/);
    const targetsInParagraph = (occurrences || []).filter((o) => o.paragraphIndex === pIdx);
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
      .filter((o) => typeof o.charStart === 'number' && typeof o.charEnd === 'number')
      .map((o) => {
        if (typeof o.sentenceIndex === 'number') {
          targetSentenceSet.add(o.sentenceIndex);
        } else if (typeof o.charStart === 'number') {
          targetSentenceSet.add(sentenceIndexAt(o.charStart));
        }
        return { start: o.charStart as number, end: o.charEnd as number };
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

    const candidates: { word: string; start: number; end: number; sentenceIndex: number }[] = [];
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
    const basePool = poolBySentence.length ? poolBySentence : candidates;
    let pool = basePool.filter((c) => !isAdjacentToTarget(c));
    if (!pool.length) pool = basePool;
    pool.sort((a, b) => a.start - b.start);
    pool.slice(0, 3).forEach((pick) => {
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
}

async function selectNoiseOccurrencesLLM(
  paragraphs: string[],
  targetOccurrences: WordOccurrence[],
  targetWords: string[]
): Promise<NoiseOccurrence[] | null> {
  const oa = getOpenAI();
  if (!oa) return null;
  try {
    const r = await oa.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Pick 2-3 non-target words per paragraph from the provided story. Prefer a word in a different sentence than the target word in that paragraph, and avoid words adjacent to target words. Only use words that appear in the text. Return JSON only.',
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
    const data = JSON.parse(txt) as LLMNoiseWordsResponse;
    if (!Array.isArray(data?.noiseWords)) return null;

    const byParagraph = new Map<number, { word: string }[]>();
    data.noiseWords.forEach((n: NoiseWord) => {
      if (!n || typeof n.word !== 'string' || typeof n.paragraphIndex !== 'number') return;
      const list = byParagraph.get(n.paragraphIndex) || [];
      list.push({ word: n.word });
      byParagraph.set(n.paragraphIndex, list);
    });

    const out: NoiseOccurrence[] = [];
    paragraphs.forEach((p, pIdx) => {
      const targetRanges = (targetOccurrences || [])
        .filter((o) => o.paragraphIndex === pIdx)
        .filter((o) => typeof o.charStart === 'number' && typeof o.charEnd === 'number')
        .map((o) => ({ start: o.charStart as number, end: o.charEnd as number }));
      const picks = (byParagraph.get(pIdx) || []).slice(0, 3);
      picks.forEach((pick) => {
        const occ = (() => {
          const lower = p.toLowerCase();
          const w = pick.word.toLowerCase();
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
            if (isWordBoundary && !overlapsTarget) return { start, end };
            idx = at + w.length;
          }
          return null;
        })();
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
  } catch {
    return null;
  }
}

router.post('/join', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({
    code: z.string().min(4).optional(),
    classCode: z.string().min(4).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!(req as any).user?.demo) {
    const user = await User.findById(req.user!.sub).select('consentAt');
    if (!user?.consentAt)
      return res.status(403).json({ error: 'Consent required', code: 'CONSENT_REQUIRED' });
  }
  const providedCode = parsed.data.code || parsed.data.classCode || '';
  // Try legacy class session first
  const session = await ClassSession.findOne({ code: providedCode }).populate('template');
  if (session && session.status === 'live') {
    const tpl = await StoryTemplate.findById(session.template);
    return res.json({
      sessionId: String(session._id),
      template: tpl,
      allowDelayedAfterHours: session.allowDelayedAfterHours,
      sentences: session.sentences || [],
      gapPlan: session.gapPlan || [],
    });
  }
  // Experiment join fallback
  const exp = await Experiment.findOne({ classCode: providedCode });
  if (!exp) return res.status(404).json({ error: 'Session not live' });
  const [withHints, withoutHints] = await Promise.all([
    Condition.findOneAndUpdate(
      { experiment: exp._id, type: 'with-hints' },
      { experiment: exp._id, type: 'with-hints' },
      { new: true, upsert: true }
    ),
    Condition.findOneAndUpdate(
      { experiment: exp._id, type: 'without-hints' },
      { experiment: exp._id, type: 'without-hints' },
      { new: true, upsert: true }
    ),
  ]);
  const existing = await Assignment.findOne({ experiment: exp._id, student: req.user!.sub });
  let assignmentDoc = existing;
  let chosen = withHints;
  let storyOrder: StoryOrder | undefined = existing?.storyOrder as StoryOrder | undefined;
  let hintsStory: HintsStory | undefined = existing?.hintsStory as HintsStory | undefined;
  if (!existing) {
    if (exp.assignedCondition === 'with-hints') {
      chosen = withHints;
    } else if (exp.assignedCondition === 'without-hints') {
      chosen = withoutHints;
    } else {
      const [cWith, cWithout] = await Promise.all([
        Assignment.countDocuments({ experiment: exp._id, condition: (withHints as any)._id }),
        Assignment.countDocuments({ experiment: exp._id, condition: (withoutHints as any)._id }),
      ]);
      if (cWith > cWithout) chosen = withoutHints;
      else if (cWith === cWithout) {
        const seed = (exp as any).randomSeed || (exp as any).seed || '';
        const key = `${seed}:${req.user!.sub}`;
        let h = 0;
        for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
        chosen = h % 2 === 0 ? withHints : withoutHints;
      }
    }
    const [countAFirst, countBFirst] = await Promise.all([
      Assignment.countDocuments({ experiment: exp._id, storyOrder: 'A-first' }),
      Assignment.countDocuments({ experiment: exp._id, storyOrder: 'B-first' }),
    ]);
    if (countAFirst > countBFirst) storyOrder = 'B-first';
    else if (countBFirst > countAFirst) storyOrder = 'A-first';
    else {
      const seed = (exp as any).randomSeed || (exp as any).seed || '';
      const key = `${seed}:order:${req.user!.sub}`;
      let h = 0;
      for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
      storyOrder = h % 2 === 0 ? 'A-first' : 'B-first';
    }
    hintsStory = (chosen as any)._id.toString() === (withHints as any)._id.toString() ? 'A' : 'B';
    assignmentDoc = await Assignment.create({
      experiment: exp._id,
      student: req.user!.sub,
      condition: (chosen as any)._id,
      storyOrder,
      hintsStory,
    });
  } else {
    chosen =
      existing.condition.toString() === (withHints as any)._id.toString()
        ? withHints
        : withoutHints;
    if (!storyOrder) {
      storyOrder = 'A-first';
      await Assignment.findByIdAndUpdate(existing._id, { $set: { storyOrder } });
    }
    if (!hintsStory) {
      hintsStory = (chosen as any)._id.toString() === (withHints as any)._id.toString() ? 'A' : 'B';
      await Assignment.findByIdAndUpdate(existing._id, { $set: { hintsStory } });
    }
  }
  const condType = (chosen as any)._id.equals((withHints as any)._id)
    ? 'with-hints'
    : 'without-hints';
  const [storyA, storyB] = await Promise.all([
    Story.findOne({ experiment: exp._id, label: 'A' }),
    Story.findOne({ experiment: exp._id, label: 'B' }),
  ]);
  if (
    storyA &&
    (!storyA.noiseOccurrences || storyA.noiseOccurrences.length === 0) &&
    storyA.paragraphs.length
  ) {
    const llmNoise = await selectNoiseOccurrencesLLM(
      storyA.paragraphs || [],
      storyA.targetOccurrences || [],
      Array.from(new Set((storyA.targetOccurrences || []).map((o: any) => o.word)))
    );
    storyA.noiseOccurrences = (
      llmNoise && llmNoise.length
        ? llmNoise
        : deriveNoiseOccurrences(storyA.paragraphs || [], storyA.targetOccurrences || [])
    ) as any;
    if ((storyA.noiseOccurrences || []).length) await storyA.save();
  }
  if (
    storyB &&
    (!storyB.noiseOccurrences || storyB.noiseOccurrences.length === 0) &&
    storyB.paragraphs.length
  ) {
    const llmNoise = await selectNoiseOccurrencesLLM(
      storyB.paragraphs || [],
      storyB.targetOccurrences || [],
      Array.from(new Set((storyB.targetOccurrences || []).map((o: any) => o.word)))
    );
    storyB.noiseOccurrences = (
      llmNoise && llmNoise.length
        ? llmNoise
        : deriveNoiseOccurrences(storyB.paragraphs || [], storyB.targetOccurrences || [])
    ) as any;
    if ((storyB.noiseOccurrences || []).length) await storyB.save();
  }
  type Occ = { story: 'A' | 'B'; word: string; paragraphIndex: number; sentenceIndex: number };
  const occ: Occ[] = [];
  (storyA?.targetOccurrences || []).forEach((o: any) =>
    occ.push({
      story: 'A',
      word: o.word,
      paragraphIndex: o.paragraphIndex,
      sentenceIndex: o.sentenceIndex,
    })
  );
  (storyB?.targetOccurrences || []).forEach((o: any) =>
    occ.push({
      story: 'B',
      word: o.word,
      paragraphIndex: o.paragraphIndex,
      sentenceIndex: o.sentenceIndex,
    })
  );
  const byWord = new Map<string, Occ[]>();
  for (const o of occ) {
    const arr = byWord.get(o.word) || [];
    arr.push(o);
    byWord.set(o.word, arr);
  }
  const schedule: Record<string, any> = {};
  for (const w of exp.targetWords || []) {
    const uniq = Array.from(
      new Map(
        (byWord.get(w) || []).map((x) => [`${x.story}:${x.paragraphIndex}:${x.sentenceIndex}`, x])
      ).values()
    );
    uniq.sort((a, b) => a.paragraphIndex - b.paragraphIndex || a.sentenceIndex - b.sentenceIndex);
    const picks: Occ[] = [];
    for (const u of uniq) {
      if (
        !picks.some(
          (p) => p.paragraphIndex === u.paragraphIndex && p.sentenceIndex === u.sentenceIndex
        )
      ) {
        picks.push(u);
        if (picks.length >= 5) break;
      }
    }
    const occurrences = picks.slice(0, 5).map((o, i) => ({
      story: o.story,
      occurrence: i + 1,
      paragraphIndex: o.paragraphIndex,
      sentenceIndex: o.sentenceIndex,
    }));
    schedule[w] = {
      baseline: {
        story: picks[0]?.story,
        paragraphIndex: picks[0]?.paragraphIndex,
        sentenceIndex: picks[0]?.sentenceIndex,
      },
      learning: {
        story: picks[1]?.story,
        paragraphIndex: picks[1]?.paragraphIndex,
        sentenceIndex: picks[1]?.sentenceIndex,
      },
      reinforcement: {
        story: picks[2]?.story,
        paragraphIndex: picks[2]?.paragraphIndex,
        sentenceIndex: picks[2]?.sentenceIndex,
      },
      recall: {
        story: picks[3]?.story,
        paragraphIndex: picks[3]?.paragraphIndex,
        sentenceIndex: picks[3]?.sentenceIndex,
      },
      occurrences,
    };
  }
  const cuesFromStory = (story?: { paragraphs?: string[] }): StoryParagraphCue[] => {
    if (!story?.paragraphs) return [];
    const cues: StoryParagraphCue[] = [];
    story.paragraphs.forEach((p: string, pIdx: number) => {
      const parts = splitParagraphSentences(p);
      parts.forEach((_, sIdx) => {
        const startSec = pIdx * 12 + sIdx * 3;
        cues.push({ paragraphIndex: pIdx, sentenceIndex: sIdx, startSec, endSec: startSec + 2.5 });
      });
    });
    return cues;
  };

  if ((req as any).user?.demo) {
    const demoParas = [
      'The **castle** stands tall. The **castle** walls are strong. A **castle** has many rooms. In the **castle** lives a family.',
      'The **forest** is quiet. The **forest** has paths. The **forest** trees sway. Animals roam the **forest**.',
    ];
    const demoStory = {
      paragraphs: demoParas,
      occurrences: [] as any[],
      noiseOccurrences: [] as any[],
    };
    return res.json({
      assignmentId: 'demo-assignment',
      condition: condType.replace('-', '_'),
      storyOrder: 'A-first',
      hintsEnabledByStory: { A: true, B: false },
      story1: demoStory,
      story2: demoStory,
      tts1Url: '/static/audio/demo/H.mp3',
      tts2Url: '/static/audio/demo/N.mp3',
      tts1Segments: [],
      tts2Segments: [],
      cues1: cuesFromStory(demoStory),
      cues2: cuesFromStory(demoStory),
      schedule,
    });
  }

  return res.json({
    assignmentId: String(assignmentDoc?._id || existing?._id),
    experimentId: String(exp._id),
    condition: condType.replace('-', '_'),
    storyOrder: storyOrder || 'A-first',
    hintsEnabledByStory: { A: hintsStory === 'A', B: hintsStory === 'B' },
    breakUntil: assignmentDoc?.breakUntil ? assignmentDoc.breakUntil.toISOString() : undefined,
    story1: {
      paragraphs: storyA?.paragraphs || [],
      occurrences: storyA?.targetOccurrences || [],
      noiseOccurrences: storyA?.noiseOccurrences || [],
    },
    story2: {
      paragraphs: storyB?.paragraphs || [],
      occurrences: storyB?.targetOccurrences || [],
      noiseOccurrences: storyB?.noiseOccurrences || [],
    },
    tts1Url: storyA?.ttsAudioUrl || `/static/audio/${exp._id}/H.mp3`,
    tts2Url: storyB?.ttsAudioUrl || `/static/audio/${exp._id}/N.mp3`,
    tts1Segments: storyA?.ttsSegments || [],
    tts2Segments: storyB?.ttsSegments || [],
    cues1: cuesFromStory(storyA),
    cues2: cuesFromStory(storyB),
    schedule,
  });
});

router.get('/session/:id/tasks', requireAuth, requireRole('student'), async (req, res) => {
  const session = await ClassSession.findById(req.params.id).populate('template');
  if (!session) return res.status(404).json({ error: 'Not found' });
  const tpl = await StoryTemplate.findById(session.template);
  const unlockAt = dayjs(session.createdAt)
    .add(session.allowDelayedAfterHours, 'hour')
    .toISOString();
  res.json({
    gapFill: { targetWords: tpl?.targetWords || [], condition: tpl?.condition },
    recall: { immediate: true, delayed: { unlockAt } },
  });
});

router.post('/attempt', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const legacySchema = z.object({
    sessionId: z.string(),
    storyTemplateId: z.string(),
    taskType: z.enum(['gap-fill', 'immediate-recall', 'delayed-recall']),
    targetWord: z.string(),
    text: z.string(),
    attemptIndex: z.number().int().nonnegative().optional(),
    condition: z.string().optional(), // legacy template condition
    phase: z.enum(['baseline', 'learning', 'reinforcement', 'recall']).optional(),
    abCondition: z.enum(['with-hints', 'without-hints']).optional(),
  });
  const experimentSchema = z.object({
    experimentId: z.string(),
    word: z.string(),
    attempt: z.string(),
    correct: z.boolean().optional(),
    story: z.enum(['A', 'B', 'H', 'N']).optional(),
    occurrenceIndex: z.number().int().min(1).optional(),
  });
  const parsedLegacy = legacySchema.safeParse(req.body);
  const parsedExp = experimentSchema.safeParse(req.body);
  if (!parsedLegacy.success && !parsedExp.success)
    return res.status(400).json({ error: 'Invalid attempt payload' });

  if (parsedExp.success) {
    const { experimentId, word, attempt, correct, story, occurrenceIndex } = parsedExp.data;
    try {
      await Event.create({
        session: req.user?.sub as any,
        student: req.user?.sub as any,
        experiment: experimentId as any,
        taskType: 'gap-fill',
        type: 'attempt',
        payload: { word, attempt, correct, story, occurrenceIndex },
        ts: new Date(),
      });
      clearAnalyticsCache();
    } catch {
      // ignore logging failures
    }
    return res.json({ ok: true });
  }

  if (!parsedLegacy.success) return res.status(400).json({ error: 'Invalid payload' });
  const { sessionId, storyTemplateId, taskType, targetWord, text } = parsedLegacy.data;
  const tpl = await StoryTemplate.findById(storyTemplateId);
  if (!tpl) return res.status(404).json({ error: 'Template not found' });
  const correctness = positionCorrectness(text, targetWord);
  const score = normalizedLevenshtein(text.toLowerCase(), targetWord.toLowerCase());
  // Demo mode: compute only, do not persist
  if ((req as any).user?.demo) {
    if (tpl.condition === 'self-generate') {
      return res.json({ correctnessByPosition: correctness, score, demo: true });
    } else {
      return res.json({
        correctSpelling: targetWord,
        definition: 'Contextual definition placeholder',
        score,
        demo: true,
      });
    }
  }
  await Attempt.findOneAndUpdate(
    {
      session: sessionId,
      student: req.user!.sub,
      storyTemplate: storyTemplateId,
      taskType,
      targetWord,
      phase: parsedLegacy.data.phase,
    },
    {
      $push: { attempts: { text, timestamp: new Date(), correctnessByPosition: correctness } },
      score,
      $setOnInsert: {
        condition: (tpl as any).condition,
        abCondition: parsedLegacy.data.abCondition,
      },
    },
    { new: true, upsert: true }
  );
  if (tpl.condition === 'self-generate') {
    return res.json({ correctnessByPosition: correctness, score });
  } else {
    return res.json({
      correctSpelling: targetWord,
      definition: 'Contextual definition placeholder',
      score,
    });
  }
});

// Evaluate short definitions for target words (adaptive, tolerant)
router.post('/define', async (req: AuthedRequest, res) => {
  const schema = z.object({
    experimentId: z.string(),
    storyLabel: z.enum(['A', 'B', '1', '2', 'story1', 'story2']).optional(),
    paragraphIndex: z.number().int().min(0).optional(),
    answers: z.array(z.object({ word: z.string(), definition: z.string() })).min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { experimentId, storyLabel, paragraphIndex, answers } = parsed.data;

  const exp = await Experiment.findById(experimentId);
  if (!exp) return res.status(404).json({ error: 'Experiment not found' });
  const oa = getOpenAI();
  let targetSet = new Set<string>();
  try {
    if (storyLabel) {
      const label = toDbLabel(storyLabel as any);
      const story = await Story.findOne({ experiment: exp._id, label });
      const words = (story?.targetOccurrences || []).map((o: any) => String(o.word || ''));
      targetSet = new Set(words.map((w) => w.toLowerCase()).filter(Boolean));
    } else {
      targetSet = new Set((exp.targetWords || []).map((w: string) => w.toLowerCase()));
    }
  } catch {
    // ignore errors building target set
  }

  async function scoreOne(word: string, definition: string) {
    if (!definition || definition.trim().length < 2) {
      return { word, correct: false, feedback: 'Definition is required.' };
    }
    if (!oa) return { word, correct: null, feedback: 'LLM unavailable; try again later.' };
    try {
      const r = await oa.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You grade short definitions for vocabulary learning. Return JSON {"correct":boolean,"feedback":string}. Accept partial/approximate meanings; be concise.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              targetWord: word,
              studentDefinition: definition,
              tolerance: 'approximate meaning ok',
            }),
          },
        ],
      });
      const txt = r.choices?.[0]?.message?.content || '{}';
      const data = JSON.parse(txt);
      return { word, correct: !!data?.correct, feedback: data?.feedback || '' };
    } catch (e) {
      return { word, correct: null, feedback: 'Scoring failed; please retry.' };
    }
  }

  const resultsRaw = await Promise.all(answers.map((a) => scoreOne(a.word, a.definition)));
  const results = resultsRaw.map((r) => ({
    ...r,
    isTarget: targetSet.size ? targetSet.has(String(r.word || '').toLowerCase()) : true,
  }));

  // Log results (lightweight)
  try {
    await Event.create({
      experiment: experimentId,
      student: req.user!.sub,
      taskType: 'definition',
      payload: { storyLabel, paragraphIndex, results },
      ts: new Date(),
    });
    clearAnalyticsCache();
  } catch {
    // ignore logging failures
  }

  return res.json({ results });
});

router.post('/hint', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({
    sessionId: z.string().optional(),
    experimentId: z.string().optional(),
    targetWord: z.string().optional(),
    word: z.string().optional(),
    locale: z.string().default('en'),
    phase: z.enum(['baseline', 'learning', 'reinforcement', 'recall']).optional(),
    abCondition: z.enum(['with-hints', 'without-hints']).optional(),
    occurrenceIndex: z.number().int().min(1).optional(),
    context: z.string().optional(),
    attemptCount: z.number().int().min(0).optional(),
    timeSpentMs: z.number().int().min(0).optional(),
    latestAttempt: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { sessionId, locale, experimentId } = parsed.data;
  const targetWord = parsed.data.word || parsed.data.targetWord || '';
  const sessionKey =
    (sessionId && Types.ObjectId.isValid(sessionId) ? sessionId : null) ||
    (experimentId && Types.ObjectId.isValid(experimentId) ? experimentId : null);
  if (!sessionKey) {
    return res.status(400).json({ error: 'Missing session/experiment id' });
  }

  // Enforce hint availability by phase and condition
  if (parsed.data.phase === 'baseline' || parsed.data.phase === 'recall') {
    return res.status(403).json({ error: 'Hints disabled for this phase' });
  }
  if (typeof parsed.data.occurrenceIndex === 'number' && parsed.data.occurrenceIndex >= 5) {
    return res.status(403).json({ error: 'Hints disabled for 5th occurrence' });
  }
  if (parsed.data.abCondition === 'without-hints') {
    return res.status(403).json({ error: 'Hints disabled for this phase' });
  }

  const att = await Attempt.findOne({
    session: sessionId,
    student: req.user!.sub,
    taskType: 'gap-fill',
    targetWord,
  }).sort({ createdAt: -1 });
  const attemptsCount = att?.attempts?.length || 0;
  const lastLen = att?.attempts?.length ?? 0;
  const lastAttemptText = lastLen > 0 ? att!.attempts[lastLen - 1]?.text || '' : '';
  const effectiveAttemptCount = Math.max(attemptsCount, parsed.data.attemptCount || 0);
  const timeSpentMs = parsed.data.timeSpentMs || 0;
  const latestAttempt = parsed.data.latestAttempt || lastAttemptText || '';
  const attemptForHint = latestAttempt || lastAttemptText || '';
  const highlight = computeHighlightIndices(attemptForHint, targetWord);
  const stageByAttempts =
    effectiveAttemptCount >= 9
      ? 'morphology'
      : effectiveAttemptCount >= 6
        ? 'semantic'
        : effectiveAttemptCount >= 3
          ? 'phoneme'
          : 'orthographic';
  const stageByTime =
    timeSpentMs >= 120000 ? 'semantic' : timeSpentMs >= 45000 ? 'phoneme' : 'orthographic';
  const stageRank = { orthographic: 1, phoneme: 2, semantic: 3, morphology: 4 } as const;
  const stage = stageRank[stageByTime] > stageRank[stageByAttempts] ? stageByTime : stageByAttempts;

  if ((req as any).user?.demo) {
    const fallback =
      highlight.length > 0
        ? 'Focus on the highlighted position(s). Compare letters carefully.'
        : 'Think of the word meaning in the story context.';
    return res.json({
      hint: fallback,
      stage,
      used: 'mock',
      ui: { type: 'orthographic-highlight', indices: highlight },
      demo: true,
    });
  }

  // persist hint request and bump hintCount on attempt stub
  await Event.create({
    session: sessionKey as any,
    experiment:
      experimentId && Types.ObjectId.isValid(experimentId) ? (experimentId as any) : undefined,
    student: req.user!.sub,
    taskType: 'gap-fill',
    targetWord,
    type: 'hint_request',
    payload: { stage, locale },
    ts: new Date(),
  });
  clearAnalyticsCache();
  await Attempt.findOneAndUpdate(
    {
      session: sessionKey as any,
      student: req.user!.sub,
      storyTemplate: att?.storyTemplate || undefined,
      taskType: 'gap-fill',
      targetWord,
      phase: parsed.data.phase,
    },
    { $inc: { hintCount: 1 } },
    { upsert: true }
  );
  try {
    if (config.openaiApiKey) {
      const openai = new OpenAI({ apiKey: config.openaiApiKey });
      const prompt = `Provide a brief, level-appropriate ${stage} hint for the word "${targetWord}". Language: ${locale}. Do not reveal full spelling or include the target word. Keep under 20 words. Context: ${(parsed.data.context || '').slice(0, 280)}. Student attempt: "${latestAttempt.slice(0, 120)}".`;
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 60,
      });
      const rawHint = completion.choices?.[0]?.message?.content?.trim() || 'Think of the context.';
      const safeHint = rawHint.replace(new RegExp(targetWord, 'ig'), 'this word');
      return res.json({
        hint: safeHint,
        stage,
        used: 'openai',
        ui: { type: 'orthographic-highlight', indices: highlight },
      });
    }
  } catch {
    // ignore hint failures and fall back
  }
  const fallback =
    stage === 'orthographic'
      ? 'Focus on the spelling pattern and letter order.'
      : stage === 'phoneme'
        ? 'Think about the sounds and syllable breaks.'
        : stage === 'semantic'
          ? 'Recall the meaning and use it to guide spelling.'
          : 'Look for a common prefix or suffix in the word.';
  return res.json({
    hint: fallback,
    stage,
    used: 'mock',
    ui: { type: 'orthographic-highlight', indices: highlight },
  });
});
router.post('/reveal', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({
    sessionId: z.string(),
    storyTemplateId: z.string(),
    targetWord: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const tpl = await StoryTemplate.findById(parsed.data.storyTemplateId);
  if (!tpl) return res.status(404).json({ error: 'Template not found' });
  if ((req as any).user?.demo) {
    return res.json({ ok: true, demo: true });
  }
  const doc = await Attempt.findOneAndUpdate(
    {
      session: parsed.data.sessionId,
      storyTemplate: parsed.data.storyTemplateId,
      student: req.user!.sub,
      targetWord: parsed.data.targetWord,
    },
    { revealed: true, $setOnInsert: { condition: tpl.condition } },
    { new: true, upsert: true }
  );
  res.json({ ok: true, doc });
});

router.post('/effort', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({
    sessionId: z.string(),
    taskType: z.string(),
    position: z.enum(['mid', 'end']),
    score: z.number().int().min(1).max(9),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { sessionId, taskType, position, score } = parsed.data;
  if ((req as any).user?.demo) {
    return res.json({ ok: true, demo: true });
  }
  const saved = await EffortResponse.create({
    session: sessionId,
    taskType,
    position,
    score,
    student: req.user!.sub,
  });
  res.json(saved);
});

router.post('/events', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({
    events: z.array(
      z.object({
        session: z.string(),
        taskType: z.string(),
        targetWord: z.string().optional(),
        type: z.string(),
        payload: z.any(),
        ts: z.string().or(z.date()),
      })
    ),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if ((req as any).user?.demo) {
    return res.json({ count: 0, demo: true });
  }
  const docs = await Event.insertMany(
    parsed.data.events.map((e) => ({ ...e, student: req.user!.sub, ts: new Date(e.ts as any) }))
  );
  res.json({ count: docs.length });
});

router.post(
  '/recall/immediate',
  requireAuth,
  requireRole('student'),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      sessionId: z.string(),
      items: z.array(z.object({ targetWord: z.string(), text: z.string() })),
      storyTemplateId: z.string(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const tpl = await StoryTemplate.findById(parsed.data.storyTemplateId);
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    const scores = parsed.data.items.map((i) => ({
      targetWord: i.targetWord,
      score: normalizedLevenshtein(i.text.toLowerCase(), i.targetWord.toLowerCase()),
    }));
    const avg = scores.reduce((s, i) => s + i.score, 0) / (scores.length || 1);
    if ((req as any).user?.demo) {
      return res.json({ scores, average: avg, demo: true });
    }
    await Promise.all(
      scores.map((s) =>
        Attempt.findOneAndUpdate(
          {
            session: parsed.data.sessionId,
            student: req.user!.sub,
            storyTemplate: parsed.data.storyTemplateId,
            taskType: 'immediate-recall',
            targetWord: s.targetWord,
            phase: 'recall',
          },
          {
            score: s.score,
            finalText: parsed.data.items.find((i) => i.targetWord === s.targetWord)?.text || '',
            $setOnInsert: { condition: (tpl as any).condition },
          },
          { upsert: true }
        )
      )
    );
    res.json({ scores, average: avg });
  }
);

router.post(
  '/recall/delayed',
  requireAuth,
  requireRole('student'),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      sessionId: z.string(),
      items: z.array(z.object({ targetWord: z.string(), text: z.string() })),
      storyTemplateId: z.string(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const tpl = await StoryTemplate.findById(parsed.data.storyTemplateId);
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    const scores = parsed.data.items.map((i) => ({
      targetWord: i.targetWord,
      score: normalizedLevenshtein(i.text.toLowerCase(), i.targetWord.toLowerCase()),
    }));
    const avg = scores.reduce((s, i) => s + i.score, 0) / (scores.length || 1);
    if ((req as any).user?.demo) {
      return res.json({ scores, average: avg, demo: true });
    }
    await Promise.all(
      scores.map((s) =>
        Attempt.findOneAndUpdate(
          {
            session: parsed.data.sessionId,
            student: req.user!.sub,
            storyTemplate: parsed.data.storyTemplateId,
            taskType: 'delayed-recall',
            targetWord: s.targetWord,
            phase: 'recall',
          },
          {
            score: s.score,
            finalText: parsed.data.items.find((i) => i.targetWord === s.targetWord)?.text || '',
            $setOnInsert: { condition: (tpl as any).condition },
          },
          { upsert: true }
        )
      )
    );
    res.json({ scores, average: avg });
  }
);

// Lightweight attempt check for new student test flow
router.post(
  '/test-attempt',
  requireAuth,
  requireRole('student'),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      assignmentId: z.string(),
      storyLabel: z.string(),
      word: z.string(),
      occurrenceIndex: z.number().int().min(1),
      text: z.string(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { assignmentId, word, occurrenceIndex, text } = parsed.data;
    const assignment = await Assignment.findById(assignmentId).populate('condition');
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    const isCorrect = text.trim().toLowerCase() === word.trim().toLowerCase();
    const correctnessByPosition = positionCorrectness(text, word);
    const cond = ((assignment as any).condition?.type as string) || 'with-hints';
    const requestedStory = toDbLabel(parsed.data.storyLabel as any);
    const hintsEnabledForStory = (assignment as any).hintsStory
      ? (assignment as any).hintsStory === requestedStory
      : cond === 'with-hints';
    const canHint = hintsEnabledForStory && occurrenceIndex < 5;
    return res.json({ isCorrect, correctnessByPosition, canHint });
  }
);

router.post('/test-hint', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({
    targetWord: z.string(),
    latestAttempt: z.string().optional(),
    occurrenceIndex: z.number().int().optional(),
    uiLanguage: z.string().default('en'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { targetWord, latestAttempt, uiLanguage, occurrenceIndex } = parsed.data;
  if (typeof occurrenceIndex === 'number' && occurrenceIndex >= 5) {
    return res.status(403).json({ error: 'Hints disabled for 5th occurrence' });
  }
  const base = `Focus on the tricky part of "${targetWord}". Check vowels/consonants and length.`;
  if (!config.openaiApiKey) return res.json({ hint: base, used: 'mock' });
  try {
    const openai = new OpenAI({ apiKey: config.openaiApiKey });
    const prompt = `Provide a brief, non-revealing hint for spelling "${targetWord}". Attempt: "${(latestAttempt || '').slice(0, 80)}". Language: ${uiLanguage}. Keep under 20 words.`;
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 60,
    });
    const hint = r.choices?.[0]?.message?.content?.trim() || base;
    return res.json({ hint, used: 'openai' });
  } catch {
    return res.json({ hint: base, used: 'mock' });
  }
});

// Delayed recall list (audio-only)
router.post(
  '/recall-list',
  requireAuth,
  requireRole('student'),
  async (req: AuthedRequest, res) => {
    const schema = z.object({ assignmentId: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const assignment = await Assignment.findById(parsed.data.assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (assignment.breakUntil && new Date() < assignment.breakUntil) {
      return res
        .status(403)
        .json({ error: 'Break not complete', breakUntil: assignment.breakUntil.toISOString() });
    }
    const expId = assignment.experiment;
    const [storyA, storyB] = await Promise.all([
      Story.findOne({ experiment: expId, label: 'A' }),
      Story.findOne({ experiment: expId, label: 'B' }),
    ]);
    const words = Array.from(
      new Set([
        ...(storyA?.targetOccurrences || []).map((o: any) => o.word),
        ...(storyB?.targetOccurrences || []).map((o: any) => o.word),
      ])
    )
      .filter(Boolean)
      .slice(0, 10);

    const { default: fs } = await import('fs');
    const { default: path } = await import('path');
    const items = words.map((word) => {
      const safe = safeWordFile(word);
      const rel = `/static/audio/${expId}/words/${safe}.mp3`;
      const abs = path.join(
        process.cwd(),
        'static',
        'audio',
        String(expId),
        'words',
        `${safe}.mp3`
      );
      const available = fs.existsSync(abs);
      return { word, audioUrl: available ? rel : null };
    });

    return res.json({ items });
  }
);

// Delayed recall scoring
router.post(
  '/recall-attempt',
  requireAuth,
  requireRole('student'),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      assignmentId: z.string(),
      items: z.array(z.object({ word: z.string(), text: z.string() })).min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const assignment = await Assignment.findById(parsed.data.assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (assignment.breakUntil && new Date() < assignment.breakUntil) {
      return res
        .status(403)
        .json({ error: 'Break not complete', breakUntil: assignment.breakUntil.toISOString() });
    }
    const scores = parsed.data.items.map((i) => ({
      word: i.word,
      score: normalizedLevenshtein(i.text.toLowerCase(), i.word.toLowerCase()),
    }));
    const avg = scores.reduce((s, i) => s + i.score, 0) / (scores.length || 1);
    try {
      await Event.create({
        session: req.user?.sub as any,
        student: req.user?.sub as any,
        experiment: assignment.experiment as any,
        taskType: 'delayed-recall',
        type: 'recall-attempt',
        payload: { scores },
        ts: new Date(),
      });
      clearAnalyticsCache();
    } catch {
      // ignore logging failures
    }
    return res.json({ scores, average: avg });
  }
);

export default router;
