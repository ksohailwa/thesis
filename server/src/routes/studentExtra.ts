import { Router } from 'express';
import { z } from 'zod';
import { Attempt } from '../models/Attempt';
import { Event } from '../models/Event';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { getOpenAI } from '../utils/openai';
import { hintSystem, hintUser } from '../prompts';

const router = Router();

router.post('/attempt', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({
    experimentId: z.string(),
    story: z.enum(['H','N']),
    targetWord: z.string(),
    occurrenceIndex: z.number().int().min(1).max(4),
    text: z.string()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { experimentId, story, targetWord, occurrenceIndex, text } = parsed.data;
  // Minimal: store attempt entry
  const attempt = await Attempt.create({
    session: req.user?.sub as any,
    experiment: experimentId as any,
    student: req.user?.sub as any,
    story: undefined,
    taskType: 'gap-fill',
    targetWord,
    condition: story === 'H' ? 'with-hints' : 'without-hints',
    abCondition: story === 'H' ? 'with-hints' : 'without-hints',
    attempts: [ { text, timestamp: new Date() } ],
    revealed: false,
    hintCount: 0,
    finalText: text,
    score: 0
  } as any);
  // For H, return positional feedback hints (simple prefix match)
  const allowHints = story === 'H' && occurrenceIndex <= 3;
  let correctnessByPosition: boolean[] | undefined = undefined;
  if (allowHints) {
    const target = targetWord;
    const len = Math.max(text.length, target.length);
    correctnessByPosition = Array.from({ length: len }, (_, i) => text[i] === target[i]);
  }
  res.json({ ok: true, attemptId: attempt._id, correctnessByPosition });
});

router.post('/hint', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({ story: z.enum(['H','N']), targetWord: z.string(), occurrenceIndex: z.number().int().min(1).max(3) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { story, targetWord } = parsed.data;
  if (story !== 'H') return res.status(400).json({ error: 'Hints disabled' });
  // Try LLM per exact prompt
  const oa = getOpenAI();
  if (oa) {
    try {
      const r = await oa.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [ { role:'system', content: hintSystem() }, { role:'user', content: hintUser(targetWord, '', 'English') } ]
      });
      const text = r.choices?.[0]?.message?.content || '{}';
      const data = JSON.parse(text);
      if (data?.hint) return res.json({ hint: data.hint });
    } catch {}
  }
  // Fallback simple initial-letter hint
  return res.json({ hint: `${targetWord[0] || ''}${'_'.repeat(Math.max(0, targetWord.length - 1))}` });
});

router.post('/events', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({ events: z.array(z.object({ type: z.string(), payload: z.any().optional(), ts: z.number().optional() })) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const docs = await Event.insertMany((parsed.data.events || []).map(e => ({ session: req.user?.sub as any, student: req.user?.sub as any, taskType: 'gap-fill', type: e.type as any, payload: e.payload, ts: e.ts ? new Date(e.ts) : new Date() })));
  res.json({ ok: true, saved: docs.length });
});

export default router;
