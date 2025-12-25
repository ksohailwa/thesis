import { Router } from 'express';
import { z } from 'zod';
import { Attempt } from '../models/Attempt';
import { Event } from '../models/Event';
import { User } from '../models/User';
import { Assignment } from '../models/Assignment';
import { getPhaseForOccurrence } from '../utils/phaseMapper';
import { StoryLabel, toConditionLabel } from '../utils/labelMapper';
import logger from '../utils/logger';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { getOpenAI } from '../utils/openai';
import { hintSystem, hintUser } from '../prompts';
import { clearAnalyticsCache } from '../utils/analyticsCache';
import {
  StudentAttemptRequest,
  StudentHintRequest,
  StudentEventsRequest,
  StudentFeedbackRequest,
  HintResponse,
} from '../types/requests';

const router = Router();

router.post('/attempt', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({
    experimentId: z.string(),
    story: z.enum(['H', 'N', 'A', 'B']),
    targetWord: z.string(),
    occurrenceIndex: z.number().int().min(1).max(5),
    text: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Type the request body
  const body: StudentAttemptRequest = {
    experimentId: parsed.data.experimentId,
    word: parsed.data.targetWord,
    attempt: parsed.data.text,
    correct: false,
    story: parsed.data.story as 'A' | 'B' | 'H' | 'N',
    occurrenceIndex: parsed.data.occurrenceIndex,
  };

  const { experimentId, word: targetWord, occurrenceIndex, attempt: text } = body;
  const condLabel = toConditionLabel(parsed.data.story as StoryLabel);
  const studentId = String(req.user?.sub || '');

  // Minimal: store attempt entry
  const phase = getPhaseForOccurrence(occurrenceIndex);
  const attempt = await Attempt.create({
    session: studentId,
    experiment: experimentId,
    student: studentId,
    story: undefined,
    taskType: 'gap-fill',
    targetWord,
    condition: condLabel === 'H' ? 'with-hints' : 'without-hints',
    abCondition: condLabel === 'H' ? 'with-hints' : 'without-hints',
    phase,
    attempts: [{ text, timestamp: new Date() }],
    revealed: false,
    hintCount: 0,
    finalText: text,
    score: 0,
  });

  // For H, return positional feedback hints (simple prefix match)
  const allowHints = condLabel === 'H' && occurrenceIndex < 5;
  let correctnessByPosition: boolean[] | undefined = undefined;
  if (allowHints) {
    const target = targetWord;
    const len = Math.max(text.length, target.length);
    correctnessByPosition = Array.from({ length: len }, (_, i) => text[i] === target[i]);
  }

  res.json({ ok: true, attemptId: attempt._id, correctnessByPosition });
});

router.post('/hint', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({
    story: z.enum(['H', 'N', 'A', 'B']),
    targetWord: z.string(),
    occurrenceIndex: z.number().int().min(1).max(5),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Type the request body
  const body: StudentHintRequest = {
    experimentId: '',
    targetWord: parsed.data.targetWord,
    occurrenceIndex: parsed.data.occurrenceIndex,
  };

  const { targetWord, occurrenceIndex } = body;
  const condLabel = toConditionLabel(parsed.data.story as StoryLabel);

  if (condLabel !== 'H') return res.status(400).json({ error: 'Hints disabled' });
  if (occurrenceIndex >= 5)
    return res.status(403).json({ error: 'Hints disabled for 5th occurrence' });

  // Try LLM per exact prompt
  const oa = getOpenAI();
  if (oa) {
    try {
      const r = await oa.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [
          { role: 'system', content: hintSystem() },
          { role: 'user', content: hintUser(targetWord, '', 'English') },
        ],
      });
      const text = r.choices?.[0]?.message?.content || '{}';
      const data = JSON.parse(text);
      if (data?.hint) {
        const response: HintResponse = { hint: data.hint };
        return res.json(response);
      }
    } catch (err) {
      logger.warn('LLM hint failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Fallback simple initial-letter hint
  const hintText = `${targetWord[0] || ''}${'_'.repeat(Math.max(0, targetWord.length - 1))}`;
  const response: HintResponse = { hint: hintText };
  return res.json(response);
});

router.post('/define', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({ word: z.string().min(1).max(64) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid word' });
  const word = parsed.data.word.toLowerCase();
  const definitions: Record<string, string> = {
    example: 'A thing characteristic of its kind or illustrating a general rule.',
    story: 'An account of imaginary or real people and events told for entertainment.',
  };
  const def = definitions[word] || `The word "${word}" - practice spelling it!`;
  return res.json({ word, definition: def });
});

router.post('/consent', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({ version: z.string().max(32).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const version = parsed.data.version || 'v1';
  const updated = await User.findByIdAndUpdate(
    req.user!.sub,
    { $set: { consentAt: new Date(), consentVersion: version } },
    { new: true }
  );
  if (!updated) return res.status(404).json({ error: 'User not found' });
  return res.json({
    ok: true,
    consentAt: updated.consentAt,
    consentVersion: updated.consentVersion,
  });
});

router.post('/events', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({
    events: z.array(
      z.object({
        type: z.string(),
        payload: z.record(z.unknown()).optional(),
        ts: z.number().optional(),
        experimentId: z.string().optional(),
      })
    ),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Type the request body
  const body: StudentEventsRequest = {
    experimentId: '',
    events: parsed.data.events,
  };

  const studentId = String(req.user?.sub || '');
  const docs = await Event.insertMany(
    body.events.map((e) => ({
      session: studentId,
      student: studentId,
      experiment: e.experimentId || undefined,
      taskType: 'gap-fill',
      type: e.type,
      payload: e.payload,
      ts: e.ts ? new Date(e.ts) : new Date(),
    }))
  );
  res.json({ ok: true, saved: docs.length });
});

/**
 * Submit student feedback after completing story
 * POST /api/student/feedback
 */
router.post('/feedback', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({
    experimentId: z.string(),
    storyKey: z.enum(['A', 'B']).optional(),
    condition: z.enum(['with-hints', 'without-hints']).optional(),
    storyIndex: z.number().int().min(0).max(1).optional(),
    difficulty: z.number().int().min(1).max(5).optional(),
    enjoyment: z.number().int().min(1).max(5).optional(),
    comment: z.string().optional(),
    effort: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Type the request body
  const body: StudentFeedbackRequest = parsed.data as StudentFeedbackRequest;
  
  const { experimentId, storyKey, condition, difficulty, enjoyment, comment, effort, storyIndex } = body;
  const studentId = String(req.user?.sub || '');

  await Event.create({
    session: studentId,
    student: studentId,
    experiment: experimentId,
    taskType: 'gap-fill',
    type: 'feedback',
    payload: {
      storyKey,
      condition,
      difficulty,
      enjoyment,
      effort,
      comment: comment || '',
      timestamp: new Date(),
    },
  });
  clearAnalyticsCache();

  logger.info('Student feedback received', {
    studentId: req.user?.sub,
    experimentId,
    storyKey,
    difficulty,
    enjoyment,
  });

  let breakUntil: string | undefined;
  if (storyIndex === 0) {
    const nextBreak = new Date(Date.now() + 5 * 60 * 1000);
    breakUntil = nextBreak.toISOString();
    try {
      await Assignment.findOneAndUpdate(
        { experiment: experimentId, student: studentId },
        { $set: { breakUntil: nextBreak } }
      );
    } catch (err) {
      logger.warn('Failed to update breakUntil', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  res.json({
    ok: true,
    message: 'Feedback received',
    breakUntil,
  });
});

export default router;
