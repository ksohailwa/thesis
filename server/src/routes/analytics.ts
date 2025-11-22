import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { Attempt } from '../models/Attempt';
import { Event } from '../models/Event';
import { EffortResponse } from '../models/EffortResponse';

const router = Router();

router.get('/session/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  const sessionId = req.params.id;
  const attempts = await Attempt.find({ session: sessionId });
  const events = await Event.find({ session: sessionId });
  const efforts = await EffortResponse.find({ session: sessionId });

  const byWord: Record<string, { immediate: number[]; delayed: number[]; attempts: number }> = {};
  for (const a of attempts) {
    const bucket = byWord[a.targetWord] || { immediate: [], delayed: [], attempts: 0 };
    if (a.taskType === 'immediate-recall') bucket.immediate.push(a.score);
    if (a.taskType === 'delayed-recall') bucket.delayed.push(a.score);
    bucket.attempts += a.attempts?.length || 0;
    byWord[a.targetWord] = bucket;
  }

  const wordStats = Object.entries(byWord).map(([word, v]) => ({
    word,
    immediateAvg: v.immediate.length
      ? v.immediate.reduce((s, x) => s + x, 0) / v.immediate.length
      : 0,
    delayedAvg: v.delayed.length ? v.delayed.reduce((s, x) => s + x, 0) / v.delayed.length : 0,
    attempts: v.attempts,
  }));

  const effortDist = efforts.map((e) => ({ position: e.position, score: e.score, ts: e.ts }));
  const audioStats = {
    plays: events.filter((e) => e.type === 'audio_play').length,
    pauses: events.filter((e) => e.type === 'audio_pause').length,
    skips: events.filter((e) => e.type === 'audio_skip').length,
  };

  res.json({
    wordStats,
    effortDist,
    audioStats,
    counts: { attempts: attempts.length, events: events.length, efforts: efforts.length },
  });
});

router.get('/session/:id/csv', requireAuth, requireRole('teacher'), async (req, res) => {
  const sessionId = req.params.id;
  const type = String(req.query.type || 'events');
  if (type === 'events') {
    const events = await Event.find({ session: sessionId });
    const header = ['ts', 'student', 'taskType', 'targetWord', 'type', 'payload'];
    const rows = events.map((e) => [
      e.ts.toISOString(),
      String(e.student),
      e.taskType,
      e.targetWord || '',
      e.type,
      JSON.stringify(e.payload || {}),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(','))
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="session_${sessionId}_events.csv"`);
    return res.send(csv);
  } else {
    const attempts = await Attempt.find({ session: sessionId });
    const header = [
      'createdAt',
      'student',
      'taskType',
      'targetWord',
      'score',
      'revealed',
      'hintCount',
      'attemptsCount',
      'attempts',
    ];
    const rows = attempts.map((a) => [
      a.createdAt.toISOString(),
      String(a.student),
      a.taskType,
      a.targetWord,
      a.score,
      a.revealed,
      a.hintCount,
      a.attempts?.length || 0,
      (a.attempts || []).map((x) => x.text).join('|'),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(','))
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="session_${sessionId}_attempts.csv"`
    );
    return res.send(csv);
  }
});

export default router;
