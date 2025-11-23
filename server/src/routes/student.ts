import { Router } from 'express';
import { z } from 'zod';
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
import { Experiment } from '../models/Experiment';
import { Story } from '../models/Story';
import { Condition } from '../models/Condition';
import { Assignment } from '../models/Assignment';

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

router.post('/join', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({ code: z.string().min(4).optional(), classCode: z.string().min(4).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const providedCode = parsed.data.code || parsed.data.classCode || '';
  // Try legacy class session first
  const session = await ClassSession.findOne({ code: providedCode }).populate('template');
  if (session && session.status === 'live') {
    const tpl = await StoryTemplate.findById(session.template);
    return res.json({ sessionId: String(session._id), template: tpl, allowDelayedAfterHours: session.allowDelayedAfterHours, sentences: session.sentences || [], gapPlan: session.gapPlan || [] });
  }
  // Experiment join fallback
  const exp = await Experiment.findOne({ classCode: providedCode });
  if (!exp) return res.status(404).json({ error: 'Session not live' });
  const [withHints, withoutHints] = await Promise.all([
    Condition.findOneAndUpdate({ experiment: exp._id, type: 'with-hints' }, { experiment: exp._id, type: 'with-hints' }, { new: true, upsert: true }),
    Condition.findOneAndUpdate({ experiment: exp._id, type: 'without-hints' }, { experiment: exp._id, type: 'without-hints' }, { new: true, upsert: true }),
  ]);
  const existing = await Assignment.findOne({ experiment: exp._id, student: req.user!.sub });
  let chosen = withHints;
  if (!existing) {
    if (exp.assignedCondition === 'with-hints') {
      chosen = withHints;
    } else if (exp.assignedCondition === 'without-hints') {
      chosen = withoutHints;
    } else {
      const [cWith, cWithout] = await Promise.all([
        Assignment.countDocuments({ experiment: exp._id, condition: (withHints as any)._id }),
        Assignment.countDocuments({ experiment: exp._id, condition: (withoutHints as any)._id })
      ]);
      if (cWith > cWithout) chosen = withoutHints; else if (cWith === cWithout) {
        const seed = (exp as any).randomSeed || (exp as any).seed || '';
        const key = `${seed}:${req.user!.sub}`; let h = 0; for (let i = 0; i < key.length; i++) h = (h*31 + key.charCodeAt(i)) >>> 0;
        chosen = (h % 2 === 0) ? withHints : withoutHints;
      }
    }
    await Assignment.create({ experiment: exp._id, student: req.user!.sub, condition: (chosen as any)._id });
  } else {
    chosen = existing.condition.toString() === (withHints as any)._id.toString() ? withHints : withoutHints;
  }
  const condType = ((chosen as any)._id).equals((withHints as any)._id) ? 'with-hints' : 'without-hints';
  const [storyA, storyB] = await Promise.all([
    Story.findOne({ experiment: exp._id, label: 'A' }),
    Story.findOne({ experiment: exp._id, label: 'B' })
  ]);
  type Occ = { story: 'A'|'B'; word: string; paragraphIndex: number; sentenceIndex: number };
  const occ: Occ[] = [];
  (storyA?.targetOccurrences || []).forEach((o: any) => occ.push({ story: 'A', word: o.word, paragraphIndex: o.paragraphIndex, sentenceIndex: o.sentenceIndex }));
  (storyB?.targetOccurrences || []).forEach((o: any) => occ.push({ story: 'B', word: o.word, paragraphIndex: o.paragraphIndex, sentenceIndex: o.sentenceIndex }));
  const byWord = new Map<string, Occ[]>();
  for (const o of occ) { const arr = byWord.get(o.word) || []; arr.push(o); byWord.set(o.word, arr); }
  const schedule: Record<string, any> = {};
  for (const w of (exp.targetWords || [])) {
    const uniq = Array.from(new Map((byWord.get(w) || []).map(x => [`${x.story}:${x.paragraphIndex}:${x.sentenceIndex}`, x])).values());
    uniq.sort((a,b)=> (a.paragraphIndex - b.paragraphIndex) || (a.sentenceIndex - b.sentenceIndex));
    const picks: Occ[] = [];
    for (const u of uniq) { if (!picks.some(p=>p.paragraphIndex===u.paragraphIndex && p.sentenceIndex===u.sentenceIndex)) { picks.push(u); if (picks.length>=4) break; } }
    schedule[w] = {
      baseline: { story: picks[0]?.story, paragraphIndex: picks[0]?.paragraphIndex, sentenceIndex: picks[0]?.sentenceIndex },
      learning: { story: picks[1]?.story, paragraphIndex: picks[1]?.paragraphIndex, sentenceIndex: picks[1]?.sentenceIndex },
      reinforcement: { story: picks[2]?.story, paragraphIndex: picks[2]?.paragraphIndex, sentenceIndex: picks[2]?.sentenceIndex },
      recall: { story: picks[3]?.story, paragraphIndex: picks[3]?.paragraphIndex, sentenceIndex: picks[3]?.sentenceIndex }
    };
  }
  return res.json({
    experiment: { id: String(exp._id), title: exp.title, description: exp.description, level: exp.level, targetWords: exp.targetWords || [] },
    condition: condType,
    stories: { A: { paragraphs: storyA?.paragraphs || [] }, B: { paragraphs: storyB?.paragraphs || [] } },
    schedule
  });
});

router.get('/session/:id/tasks', requireAuth, requireRole('student'), async (req, res) => {
  const session = await ClassSession.findById(req.params.id).populate('template');
  if (!session) return res.status(404).json({ error: 'Not found' });
  const tpl = await StoryTemplate.findById(session.template);
  const unlockAt = dayjs(session.createdAt).add(session.allowDelayedAfterHours, 'hour').toISOString();
  res.json({
    gapFill: { targetWords: tpl?.targetWords || [], condition: tpl?.condition },
    recall: { immediate: true, delayed: { unlockAt } }
  });
});

router.post('/attempt', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({
    sessionId: z.string(),
    storyTemplateId: z.string(),
    taskType: z.enum(['gap-fill','immediate-recall','delayed-recall']),
    targetWord: z.string(),
    text: z.string(),
    attemptIndex: z.number().int().nonnegative().optional(),
    condition: z.string().optional(), // legacy template condition
    phase: z.enum(['baseline','learning','reinforcement','recall']).optional(),
    abCondition: z.enum(['with-hints','without-hints']).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { sessionId, storyTemplateId, taskType, targetWord, text } = parsed.data;
  const tpl = await StoryTemplate.findById(storyTemplateId);
  if (!tpl) return res.status(404).json({ error: 'Template not found' });
  const correctness = positionCorrectness(text, targetWord);
  const score = normalizedLevenshtein(text.toLowerCase(), targetWord.toLowerCase());
  // Demo mode: compute only, do not persist
  if ((req as any).user?.demo) {
    if (tpl.condition === 'self-generate') {
      return res.json({ correctnessByPosition: correctness, score, demo: true });
    } else {
      return res.json({ correctSpelling: targetWord, definition: 'Contextual definition placeholder', score, demo: true });
    }
  }
  const attempt = await Attempt.findOneAndUpdate(
    { session: sessionId, student: req.user!.sub, storyTemplate: storyTemplateId, taskType, targetWord, phase: parsed.data.phase },
    { $push: { attempts: { text, timestamp: new Date(), correctnessByPosition: correctness } }, score, $setOnInsert: { condition: (tpl as any).condition, abCondition: parsed.data.abCondition } },
    { new: true, upsert: true }
  );
  if (tpl.condition === 'self-generate') {
    return res.json({ correctnessByPosition: correctness, score });
  } else {
    return res.json({ correctSpelling: targetWord, definition: 'Contextual definition placeholder', score });
  }
});

router.post('/hint', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({ sessionId: z.string().optional(), targetWord: z.string().optional(), word: z.string().optional(), locale: z.string().default('en'), phase: z.enum(['baseline','learning','reinforcement','recall']).optional(), abCondition: z.enum(['with-hints','without-hints']).optional(), context: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { sessionId, locale } = parsed.data;
  const targetWord = parsed.data.word || parsed.data.targetWord || '';

  // Enforce hint availability by phase and condition
  if (parsed.data.phase === 'baseline' || parsed.data.phase === 'recall') {
    return res.status(403).json({ error: 'Hints disabled for this phase' });
  }
  if (parsed.data.abCondition === 'without-hints') {
    return res.status(403).json({ error: 'Hints disabled for this phase' });
  }

  const att = await Attempt.findOne({ session: sessionId, student: req.user!.sub, taskType: 'gap-fill', targetWord }).sort({ createdAt: -1 });
  const attemptsCount = att?.attempts?.length || 0;
  const lastLen = att?.attempts?.length ?? 0;
  const lastAttemptText = lastLen > 0 ? (att!.attempts[lastLen - 1]?.text || '') : '';
  const correctnessByPosition = positionCorrectness(lastAttemptText, targetWord);
  const highlight = computeHighlightIndices(lastAttemptText, targetWord);
  const stage = attemptsCount >= 9 ? 'morphology' : attemptsCount >= 6 ? 'semantic' : attemptsCount >= 3 ? 'phoneme' : 'orthographic';

  if ((req as any).user?.demo) {
    const fallback = highlight.length > 0 ? 'Focus on the highlighted position(s). Compare letters carefully.' : 'Think of the word meaning in the story context.';
    return res.json({ hint: fallback, stage, used: 'mock', ui: { type: 'orthographic-highlight', indices: highlight }, demo: true });
  }

  // persist hint request and bump hintCount on attempt stub
  await Event.create({ session: sessionId || 'exp', student: req.user!.sub, taskType: 'gap-fill', targetWord, type: 'hint_request', payload: { stage, locale }, ts: new Date() });
  await Attempt.findOneAndUpdate(
    { session: sessionId || 'exp', student: req.user!.sub, storyTemplate: att?.storyTemplate || undefined, taskType: 'gap-fill', targetWord, phase: parsed.data.phase },
    { $inc: { hintCount: 1 } },
    { upsert: true }
  );
  try {
    if (config.openaiApiKey) {
      const openai = new OpenAI({ apiKey: config.openaiApiKey });
      const prompt = `Provide a brief, level-appropriate ${stage} hint for the word "${targetWord}". Language: ${locale}. Do not reveal full spelling. Keep under 20 words. Context: ${(parsed.data.context||'').slice(0,280)}`;
      const completion = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 60 });
      const hint = completion.choices?.[0]?.message?.content?.trim() || 'Think of the context.';
      return res.json({ hint, stage, used: 'openai', ui: { type: 'orthographic-highlight', indices: highlight } });
    }
  } catch {}
  const fallback = highlight.length > 0 ? 'Focus on the highlighted position(s). Compare letters carefully.' : 'Think of the word meaning in the story context.';
  return res.json({ hint: fallback, stage, used: 'mock', ui: { type: 'orthographic-highlight', indices: highlight } });
});
router.post('/reveal', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({ sessionId: z.string(), storyTemplateId: z.string(), targetWord: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const tpl = await StoryTemplate.findById(parsed.data.storyTemplateId);
  if (!tpl) return res.status(404).json({ error: 'Template not found' });
  if ((req as any).user?.demo) { return res.json({ ok: true, demo: true }); }
  const doc = await Attempt.findOneAndUpdate(
    { session: parsed.data.sessionId, storyTemplate: parsed.data.storyTemplateId, student: req.user!.sub, targetWord: parsed.data.targetWord },
    { revealed: true, $setOnInsert: { condition: tpl.condition } },
    { new: true, upsert: true }
  );
  res.json({ ok: true, doc });
});

router.post('/effort', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({ sessionId: z.string(), taskType: z.string(), position: z.enum(['mid','end']), score: z.number().int().min(1).max(9) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { sessionId, taskType, position, score } = parsed.data;
  if ((req as any).user?.demo) { return res.json({ ok: true, demo: true }); }
  const saved = await EffortResponse.create({ session: sessionId, taskType, position, score, student: req.user!.sub });
  res.json(saved);
});

router.post('/events', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({ events: z.array(z.object({ session: z.string(), taskType: z.string(), targetWord: z.string().optional(), type: z.string(), payload: z.any(), ts: z.string().or(z.date()) })) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if ((req as any).user?.demo) { return res.json({ count: 0, demo: true }); }
  const docs = await Event.insertMany(parsed.data.events.map(e => ({ ...e, student: req.user!.sub, ts: new Date(e.ts as any) })));
  res.json({ count: docs.length });
});

router.post('/recall/immediate', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({ sessionId: z.string(), items: z.array(z.object({ targetWord: z.string(), text: z.string() })), storyTemplateId: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const tpl = await StoryTemplate.findById(parsed.data.storyTemplateId);
  if (!tpl) return res.status(404).json({ error: 'Template not found' });
  const scores = parsed.data.items.map(i => ({ targetWord: i.targetWord, score: normalizedLevenshtein(i.text.toLowerCase(), i.targetWord.toLowerCase()) }));
  const avg = scores.reduce((s, i) => s + i.score, 0) / (scores.length || 1);
  if ((req as any).user?.demo) { return res.json({ scores, average: avg, demo: true }); }
  await Promise.all(scores.map(s => Attempt.findOneAndUpdate(
    { session: parsed.data.sessionId, student: req.user!.sub, storyTemplate: parsed.data.storyTemplateId, taskType: 'immediate-recall', targetWord: s.targetWord, phase: 'recall' },
    { score: s.score, finalText: parsed.data.items.find(i=>i.targetWord===s.targetWord)?.text || '', $setOnInsert: { condition: (tpl as any).condition } },
    { upsert: true }
  )));
  res.json({ scores, average: avg });
});

router.post('/recall/delayed', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
  const schema = z.object({ sessionId: z.string(), items: z.array(z.object({ targetWord: z.string(), text: z.string() })), storyTemplateId: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const tpl = await StoryTemplate.findById(parsed.data.storyTemplateId);
  if (!tpl) return res.status(404).json({ error: 'Template not found' });
  const scores = parsed.data.items.map(i => ({ targetWord: i.targetWord, score: normalizedLevenshtein(i.text.toLowerCase(), i.targetWord.toLowerCase()) }));
  const avg = scores.reduce((s, i) => s + i.score, 0) / (scores.length || 1);
  if ((req as any).user?.demo) { return res.json({ scores, average: avg, demo: true }); }
  await Promise.all(scores.map(s => Attempt.findOneAndUpdate(
    { session: parsed.data.sessionId, student: req.user!.sub, storyTemplate: parsed.data.storyTemplateId, taskType: 'delayed-recall', targetWord: s.targetWord, phase: 'recall' },
    { score: s.score, finalText: parsed.data.items.find(i=>i.targetWord===s.targetWord)?.text || '', $setOnInsert: { condition: (tpl as any).condition } },
    { upsert: true }
  )));
  res.json({ scores, average: avg });
});

export default router;





