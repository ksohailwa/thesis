/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { Attempt } from '../models/Attempt';
import { Event } from '../models/Event';
import { EffortResponse } from '../models/EffortResponse';
import { Experiment } from '../models/Experiment';
import { Assignment } from '../models/Assignment';
import { User } from '../models/User';
import { getAnalyticsCache, setAnalyticsCache } from '../utils/analyticsCache';

function toCsv(rows: (string | number | boolean | null | undefined)[][]) {
  return rows
    .map((r) => r.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(','))
    .join('\n');
}

type AnalyticsFilters = {
  from?: Date;
  to?: Date;
  story?: 'A' | 'B';
  condition?: string;
  studentId?: string;
};

type AuthenticatedRequest = Request & { user?: { sub?: string } };

function parseFilters(req: Request): AnalyticsFilters {
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  if (from && !isNaN(from.getTime())) {
    from.setHours(0, 0, 0, 0);
  }
  if (to && !isNaN(to.getTime())) {
    to.setHours(23, 59, 59, 999);
  }
  const storyRaw = String(req.query.story || '').toUpperCase();
  const story = storyRaw === 'A' || storyRaw === 'B' ? (storyRaw as 'A' | 'B') : undefined;
  const condition = req.query.condition ? String(req.query.condition) : undefined;
  const studentId = req.query.studentId ? String(req.query.studentId) : undefined;
  return {
    from: from && !isNaN(from.getTime()) ? from : undefined,
    to: to && !isNaN(to.getTime()) ? to : undefined,
    story,
    condition: condition || undefined,
    studentId: studentId || undefined,
  };
}

function normalizeStoryLabel(raw?: string) {
  if (!raw) return undefined;
  const v = String(raw).toLowerCase();
  if (v === 'a' || v === 'h' || v === '1' || v === 'story1') return 'A';
  if (v === 'b' || v === 'n' || v === '2' || v === 'story2') return 'B';
  return undefined;
}

function filterEvents(events: any[], filters: AnalyticsFilters, allowedStudentIds: string[]) {
  return events.filter((e: any) => {
    const sid = String(e.student || '');
    if ((filters.condition || filters.studentId) && !allowedStudentIds.includes(sid)) return false;
    if ((filters.from || filters.to) && !e.ts) return false;
    if (filters.from && e.ts && new Date(e.ts) < filters.from) return false;
    if (filters.to && e.ts && new Date(e.ts) > filters.to) return false;
    if (filters.story) {
      const storyRaw = e.payload?.story || e.payload?.storyLabel || e.payload?.storyKey;
      const mapped = normalizeStoryLabel(storyRaw);
      if (!mapped || mapped !== filters.story) return false;
    }
    return true;
  });
}

function bucketDay(ts: Date) {
  const y = ts.getUTCFullYear();
  const m = String(ts.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ts.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildDemoAnalytics(exp: any) {
  const today = new Date();
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (6 - i));
    return bucketDay(d);
  });
  const timeline = days.map((day, i) => ({
    day,
    attempts: 5 + i * 3,
    correct: 3 + i * 2,
    hints: 1 + (i % 3),
    definitions: 2 + (i % 2),
    recall: 2 + (i % 4),
  }));
  const students = [
    {
      studentId: 'demo-1',
      username: 'student-one',
      condition: 'with-hints',
      attempts: 22,
      accuracy: 77,
      hints: 6,
      definitionAccuracy: 80,
      recallAvg: 0.72,
      timeOnTaskMin: 18,
    },
    {
      studentId: 'demo-2',
      username: 'student-two',
      condition: 'without-hints',
      attempts: 18,
      accuracy: 72,
      hints: 2,
      definitionAccuracy: 68,
      recallAvg: 0.65,
      timeOnTaskMin: 14,
    },
    {
      studentId: 'demo-3',
      username: 'student-three',
      condition: 'with-hints',
      attempts: 26,
      accuracy: 81,
      hints: 8,
      definitionAccuracy: 86,
      recallAvg: 0.79,
      timeOnTaskMin: 22,
    },
  ];
  const words = [
    { word: 'embarrass', attempts: 8, accuracy: 75 },
    { word: 'castle', attempts: 7, accuracy: 71 },
    { word: 'separate', attempts: 9, accuracy: 78 },
    { word: 'courage', attempts: 6, accuracy: 83 },
    { word: 'journey', attempts: 7, accuracy: 69 },
  ];
  const confusions = [
    {
      word: 'embarrass',
      attempts: 5,
      topMisspellings: [
        { text: 'embarass', count: 3 },
        { text: 'embarras', count: 2 },
      ],
    },
    { word: 'separate', attempts: 4, topMisspellings: [{ text: 'seperate', count: 4 }] },
  ];
  const timeOnTask = [
    {
      studentId: 'demo-1',
      username: 'student-one',
      minutes: 18,
      firstTs: days[0] + 'T10:00:00.000Z',
      lastTs: days[0] + 'T10:18:00.000Z',
    },
    {
      studentId: 'demo-2',
      username: 'student-two',
      minutes: 14,
      firstTs: days[1] + 'T11:00:00.000Z',
      lastTs: days[1] + 'T11:14:00.000Z',
    },
    {
      studentId: 'demo-3',
      username: 'student-three',
      minutes: 22,
      firstTs: days[2] + 'T09:00:00.000Z',
      lastTs: days[2] + 'T09:22:00.000Z',
    },
  ];
  const comparisons = [
    { condition: 'with-hints', story: 'A', attempts: 20, accuracy: 78, hints: 5 },
    { condition: 'with-hints', story: 'B', attempts: 21, accuracy: 81, hints: 3 },
    { condition: 'without-hints', story: 'A', attempts: 16, accuracy: 70, hints: 1 },
    { condition: 'without-hints', story: 'B', attempts: 14, accuracy: 73, hints: 1 },
  ];
  return {
    experiment: exp,
    counts: {
      students: students.length,
      attempts: students.reduce((s, v) => s + v.attempts, 0),
      correctRate: 76,
      hints: students.reduce((s, v) => s + v.hints, 0),
      definitionAccuracy: 78,
      recallAvg: 0.72,
    },
    byStory: {
      A: { attempts: 32, accuracy: 74 },
      B: { attempts: 34, accuracy: 78 },
    },
    funnel: { joined: 3, story1: 3, story2: 2, breakDone: 3, recall: 2 },
    students,
    words,
    timeline,
    timeOnTask,
    confusions,
    dataQuality: {
      totalEvents: 120,
      missingExperiment: 0,
      missingStudent: 0,
      missingStory: 4,
      missingTimestamp: 0,
    },
    comparisons,
  };
}

async function computeExperimentAnalytics(experimentId: string, filters: AnalyticsFilters = {}) {
  const [assignments, events] = await Promise.all([
    Assignment.find({ experiment: experimentId }).populate('condition', 'type').lean(),
    Event.find({ experiment: experimentId }).lean(),
  ]);
  let allowedAssignments = assignments.slice();
  if (filters.condition) {
    allowedAssignments = allowedAssignments.filter(
      (a: any) => String((a.condition as any)?.type || '') === filters.condition
    );
  }
  if (filters.studentId) {
    allowedAssignments = allowedAssignments.filter(
      (a: any) => String(a.student) === filters.studentId
    );
  }
  const allowedStudentIds = Array.from(
    new Set(allowedAssignments.map((a: any) => String(a.student)))
  );
  const studentIds = allowedStudentIds;
  const users = await User.find({ _id: { $in: studentIds } })
    .select('username email')
    .lean();
  const userMap = new Map(users.map((u: any) => [String(u._id), u]));
  const assignmentMap = new Map(allowedAssignments.map((a: any) => [String(a.student), a]));

  const perStudent: Record<string, any> = {};
  const perWord: Record<string, { total: number; correct: number }> = {};
  const perStory: Record<string, { total: number; correct: number }> = {
    A: { total: 0, correct: 0 },
    B: { total: 0, correct: 0 },
  };
  const timeline: Record<
    string,
    { attempts: number; correct: number; hints: number; definitions: number; recall: number }
  > = {};
  const timeOnTask: Record<string, { first?: Date; last?: Date }> = {};
  const confusion: Record<string, Record<string, number>> = {};
  const comparisons: Record<
    string,
    { story: string; attempts: number; correct: number; hints: number }
  > = {};

  let totalAttempts = 0;
  let totalCorrect = 0;
  let totalHints = 0;
  let defTotal = 0;
  let defCorrect = 0;
  const recallScores: number[] = [];
  const funnel = {
    joined: allowedStudentIds.length,
    story1: 0,
    story2: 0,
    breakDone: 0,
    recall: 0,
  };

  const filteredEvents = filterEvents(events, filters, allowedStudentIds);

  const ensureStudent = (id: string) => {
    if (!perStudent[id]) {
      const user = userMap.get(id) || {};
      const assignment = assignmentMap.get(id) as any;
      perStudent[id] = {
        studentId: id,
        username: (user as any).username || (user as any).email || 'unknown',
        condition: (assignment?.condition as any)?.type || 'unknown',
        attempts: 0,
        correct: 0,
        hints: 0,
        defTotal: 0,
        defCorrect: 0,
        recallScores: [],
      };
    }
    return perStudent[id];
  };

  allowedStudentIds.forEach((id) => ensureStudent(id));

  for (const e of filteredEvents) {
    const sid = String((e as any).student || '');
    const student = ensureStudent(sid);
    const day = bucketDay(new Date(e.ts || Date.now()));
    const bucket = timeline[day] || {
      attempts: 0,
      correct: 0,
      hints: 0,
      definitions: 0,
      recall: 0,
    };
    if (e.ts) {
      const t = timeOnTask[sid] || {};
      const ts = new Date(e.ts);
      if (!t.first || ts < t.first) t.first = ts;
      if (!t.last || ts > t.last) t.last = ts;
      timeOnTask[sid] = t;
    }

    if (e.type === 'attempt') {
      const correct = !!(e.payload as any)?.correct;
      const word = (e.payload as any)?.word;
      const story = normalizeStoryLabel((e.payload as any)?.story);
      totalAttempts += 1;
      if (correct) totalCorrect += 1;
      student.attempts += 1;
      if (correct) student.correct += 1;
      bucket.attempts += 1;
      if (correct) bucket.correct += 1;
      if (word) {
        const w = String(word).toLowerCase();
        perWord[w] = perWord[w] || { total: 0, correct: 0 };
        perWord[w].total += 1;
        if (correct) perWord[w].correct += 1;
        if (!correct) {
          const attemptText = String((e.payload as any)?.attempt || '').trim();
          if (attemptText) {
            confusion[w] = confusion[w] || {};
            confusion[w][attemptText] = (confusion[w][attemptText] || 0) + 1;
          }
        }
      }
      if (story === 'A' || story === 'B') {
        perStory[story].total += 1;
        if (correct) perStory[story].correct += 1;
      }
      const assignment = assignmentMap.get(sid) as any;
      const cond = (assignment?.condition as any)?.type || 'unknown';
      const cmpKey = `${cond}:${story || 'unknown'}`;
      comparisons[cmpKey] = comparisons[cmpKey] || {
        story: story || 'unknown',
        attempts: 0,
        correct: 0,
        hints: 0,
      };
      comparisons[cmpKey].attempts += 1;
      if (correct) comparisons[cmpKey].correct += 1;
    }

    if (e.type === 'hint_request') {
      totalHints += 1;
      student.hints += 1;
      bucket.hints += 1;
      const assignment = assignmentMap.get(sid) as any;
      const cond = (assignment?.condition as any)?.type || 'unknown';
      const story = normalizeStoryLabel((e.payload as any)?.story);
      const cmpKey = `${cond}:${story || 'unknown'}`;
      comparisons[cmpKey] = comparisons[cmpKey] || {
        story: story || 'unknown',
        attempts: 0,
        correct: 0,
        hints: 0,
      };
      comparisons[cmpKey].hints += 1;
    }

    if (e.taskType === 'definition') {
      const results = (e.payload as any)?.results || [];
      if (Array.isArray(results)) {
        let targetCount = 0;
        for (const r of results) {
          const isTarget = Object.prototype.hasOwnProperty.call(r, 'isTarget')
            ? !!r.isTarget
            : true;
          if (!isTarget) continue;
          targetCount += 1;
          defTotal += 1;
          if (r?.correct) defCorrect += 1;
          student.defTotal += 1;
          if (r?.correct) student.defCorrect += 1;
        }
        bucket.definitions += targetCount;
      }
    }

    if (e.type === 'recall-attempt') {
      const scores = (e.payload as any)?.scores || [];
      if (Array.isArray(scores) && scores.length) {
        const avg = scores.reduce((s: number, i: any) => s + (i.score || 0), 0) / scores.length;
        recallScores.push(avg);
        student.recallScores.push(avg);
        bucket.recall += scores.length;
        funnel.recall += 1;
      }
    }

    timeline[day] = bucket;
  }

  const dataQuality = {
    totalEvents: filteredEvents.length,
    missingExperiment: filteredEvents.filter((e: any) => !e.experiment).length,
    missingStudent: filteredEvents.filter((e: any) => !e.student).length,
    missingStory: filteredEvents.filter((e: any) => {
      if (e.type !== 'attempt' && e.type !== 'hint_request') return false;
      const storyRaw = e.payload?.story || e.payload?.storyLabel || e.payload?.storyKey;
      return !normalizeStoryLabel(storyRaw);
    }).length,
    missingTimestamp: filteredEvents.filter((e: any) => !e.ts).length,
  };

  // Funnel: joined from assignments, story completion based on feedback events
  filteredEvents.forEach((e: any) => {
    if (e.type === 'feedback' && typeof e.payload?.storyIndex === 'number') {
      if (e.payload.storyIndex === 0) funnel.story1 += 1;
      if (e.payload.storyIndex === 1) funnel.story2 += 1;
    }
  });
  const assignmentsWithBreak = allowedAssignments.filter((a: any) => !!a.breakUntil).length;
  funnel.breakDone = assignmentsWithBreak;

  const timeOnTaskRows = Object.entries(timeOnTask).map(([studentId, v]) => {
    const first = v.first ? new Date(v.first) : null;
    const last = v.last ? new Date(v.last) : null;
    const minutes =
      first && last ? Math.max(0, Math.round((last.getTime() - first.getTime()) / 60000)) : 0;
    const user = userMap.get(studentId) as any;
    return {
      studentId,
      username: user?.username || user?.email || 'unknown',
      minutes,
      firstTs: first ? first.toISOString() : null,
      lastTs: last ? last.toISOString() : null,
    };
  });

  const students = Object.values(perStudent).map((s: any) => {
    const definitionAccuracy = s.defTotal ? Math.round((s.defCorrect / s.defTotal) * 100) : 0;
    const recallAvg = s.recallScores.length
      ? Math.round(
          (s.recallScores.reduce((sum: number, score: number) => sum + score, 0) /
            s.recallScores.length) *
            100
        ) / 100
      : 0;
    const tot = timeOnTask[s.studentId] || {};
    const minutes =
      tot.first && tot.last
        ? Math.max(0, Math.round((tot.last.getTime() - tot.first.getTime()) / 60000))
        : 0;
    return {
      studentId: s.studentId,
      username: s.username,
      condition: s.condition,
      attempts: s.attempts,
      accuracy: s.attempts ? Math.round((s.correct / s.attempts) * 100) : 0,
      hints: s.hints,
      definitionAccuracy,
      recallAvg,
      timeOnTaskMin: minutes,
    };
  });

  const words = Object.entries(perWord).map(([word, v]) => ({
    word,
    attempts: v.total,
    accuracy: v.total ? Math.round((v.correct / v.total) * 100) : 0,
  }));

  const confusionRows = Object.entries(confusion).map(([word, attempts]) => {
    const top = Object.entries(attempts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([text, count]) => ({ text, count }));
    const total = Object.values(attempts).reduce((s, v) => s + v, 0);
    return { word, attempts: total, topMisspellings: top };
  });

  const timelineRows = Object.entries(timeline)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, v]) => ({ day, ...v }));

  const comparisonRows = Object.entries(comparisons).map(([key, v]) => {
    const [condition, story] = key.split(':');
    return {
      condition,
      story,
      attempts: v.attempts,
      accuracy: v.attempts ? Math.round((v.correct / v.attempts) * 100) : 0,
      hints: v.hints,
    };
  });

  return {
    counts: {
      students: allowedStudentIds.length,
      attempts: totalAttempts,
      correctRate: totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
      hints: totalHints,
      definitionAccuracy: defTotal ? Math.round((defCorrect / defTotal) * 100) : 0,
      recallAvg: recallScores.length
        ? Math.round((recallScores.reduce((s, x) => s + x, 0) / recallScores.length) * 100) / 100
        : 0,
    },
    byStory: {
      A: {
        attempts: perStory.A.total,
        accuracy: perStory.A.total ? Math.round((perStory.A.correct / perStory.A.total) * 100) : 0,
      },
      B: {
        attempts: perStory.B.total,
        accuracy: perStory.B.total ? Math.round((perStory.B.correct / perStory.B.total) * 100) : 0,
      },
    },
    students,
    words,
    timeline: timelineRows,
    timeOnTask: timeOnTaskRows,
    funnel,
    confusions: confusionRows,
    dataQuality,
    comparisons: comparisonRows,
  };
}

async function computeStudentAnalytics(
  experimentId: string,
  studentId: string,
  filters: AnalyticsFilters = {}
) {
  const data = await computeExperimentAnalytics(experimentId, { ...filters, studentId });
  const student = data.students[0] || null;
  return { ...data, student };
}

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

router.get('/experiment/:id/summary', requireAuth, requireRole('teacher'), async (req, res) => {
  const exp = await Experiment.findById(req.params.id).select('_id title status');
  if (!exp) return res.status(404).json({ error: 'Not found' });
  if (String(req.query.demo || '') === '1') {
    return res.json(buildDemoAnalytics(exp));
  }
  const filters = parseFilters(req);
  const cacheKey = `exp-summary:${String(exp._id)}:${JSON.stringify(filters)}`;
  const cached = getAnalyticsCache(cacheKey);
  if (cached) return res.json({ experiment: exp, ...cached });
  const data = await computeExperimentAnalytics(String(exp._id), filters);
  setAnalyticsCache(cacheKey, data);
  res.json({ experiment: exp, ...data });
});

router.get('/experiment/:id/students', requireAuth, requireRole('teacher'), async (req, res) => {
  const filters = parseFilters(req);
  const cacheKey = `exp-students:${req.params.id}:${JSON.stringify(filters)}`;
  const cached = getAnalyticsCache(cacheKey);
  if (cached) return res.json({ students: cached });
  const data = await computeExperimentAnalytics(req.params.id, filters);
  setAnalyticsCache(cacheKey, data.students);
  res.json({ students: data.students });
});

router.get('/experiment/:id/timeline', requireAuth, requireRole('teacher'), async (req, res) => {
  const filters = parseFilters(req);
  const cacheKey = `exp-timeline:${req.params.id}:${JSON.stringify(filters)}`;
  const cached = getAnalyticsCache(cacheKey);
  if (cached) return res.json({ timeline: cached });
  const data = await computeExperimentAnalytics(req.params.id, filters);
  setAnalyticsCache(cacheKey, data.timeline);
  res.json({ timeline: data.timeline });
});

router.get('/experiment/:id/words', requireAuth, requireRole('teacher'), async (req, res) => {
  const filters = parseFilters(req);
  const cacheKey = `exp-words:${req.params.id}:${JSON.stringify(filters)}`;
  const cached = getAnalyticsCache(cacheKey);
  if (cached) return res.json({ words: cached });
  const data = await computeExperimentAnalytics(req.params.id, filters);
  setAnalyticsCache(cacheKey, data.words);
  res.json({ words: data.words });
});

router.get('/experiment/:id/csv', requireAuth, requireRole('teacher'), async (req, res) => {
  const type = String(req.query.type || 'students');
  if (String(req.query.demo || '') === '1') {
    const demo = buildDemoAnalytics({ _id: req.params.id, title: 'Demo', status: 'demo' });
    const data = demo as any;
    if (type === 'timeline') {
      const header = ['day', 'attempts', 'correct', 'hints', 'definitions', 'recall'];
      const rows = data.timeline.map((t: any) => [
        t.day,
        t.attempts,
        t.correct,
        t.hints,
        t.definitions,
        t.recall,
      ]);
      const csv = toCsv([header, ...rows]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="experiment_${req.params.id}_timeline.csv"`
      );
      return res.send(csv);
    }
    if (type === 'words') {
      const header = ['word', 'attempts', 'accuracy'];
      const rows = data.words.map((w: any) => [w.word, w.attempts, w.accuracy]);
      const csv = toCsv([header, ...rows]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="experiment_${req.params.id}_words.csv"`
      );
      return res.send(csv);
    }
    if (type === 'summary') {
      const header = [
        'students',
        'attempts',
        'correctRate',
        'hints',
        'definitionAccuracy',
        'recallAvg',
      ];
      const c = data.counts;
      const rows = [
        [c.students, c.attempts, c.correctRate, c.hints, c.definitionAccuracy, c.recallAvg],
      ];
      const csv = toCsv([header, ...rows]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="experiment_${req.params.id}_summary.csv"`
      );
      return res.send(csv);
    }
    const header = [
      'student',
      'condition',
      'attempts',
      'accuracy',
      'hints',
      'definitionAccuracy',
      'recallAvg',
    ];
    const rows = data.students.map((s: any) => [
      s.username,
      s.condition,
      s.attempts,
      s.accuracy,
      s.hints,
      s.definitionAccuracy,
      s.recallAvg,
    ]);
    const csv = toCsv([header, ...rows]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="experiment_${req.params.id}_students.csv"`
    );
    return res.send(csv);
  }
  const filters = parseFilters(req);
  const data = await computeExperimentAnalytics(req.params.id, filters);
  if (type === 'timeline') {
    const header = ['day', 'attempts', 'correct', 'hints', 'definitions', 'recall'];
    const rows = data.timeline.map((t: any) => [
      t.day,
      t.attempts,
      t.correct,
      t.hints,
      t.definitions,
      t.recall,
    ]);
    const csv = toCsv([header, ...rows]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="experiment_${req.params.id}_timeline.csv"`
    );
    return res.send(csv);
  }
  if (type === 'words') {
    const header = ['word', 'attempts', 'accuracy'];
    const rows = data.words.map((w: any) => [w.word, w.attempts, w.accuracy]);
    const csv = toCsv([header, ...rows]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="experiment_${req.params.id}_words.csv"`
    );
    return res.send(csv);
  }
  if (type === 'summary') {
    const header = [
      'students',
      'attempts',
      'correctRate',
      'hints',
      'definitionAccuracy',
      'recallAvg',
    ];
    const c = data.counts;
    const rows = [
      [c.students, c.attempts, c.correctRate, c.hints, c.definitionAccuracy, c.recallAvg],
    ];
    const csv = toCsv([header, ...rows]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="experiment_${req.params.id}_summary.csv"`
    );
    return res.send(csv);
  }
  const header = [
    'student',
    'condition',
    'attempts',
    'accuracy',
    'hints',
    'definitionAccuracy',
    'recallAvg',
  ];
  const rows = data.students.map((s: any) => [
    s.username,
    s.condition,
    s.attempts,
    s.accuracy,
    s.hints,
    s.definitionAccuracy,
    s.recallAvg,
  ]);
  const csv = toCsv([header, ...rows]);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="experiment_${req.params.id}_students.csv"`
  );
  return res.send(csv);
});

router.get('/experiment/:id/events', requireAuth, requireRole('teacher'), async (req, res) => {
  const exp = await Experiment.findById(req.params.id).select('_id title status');
  if (!exp) return res.status(404).json({ error: 'Not found' });
  if (String(req.query.demo || '') === '1') {
    return res.json({
      events: [
        {
          ts: new Date().toISOString(),
          student: 'demo-1',
          username: 'student-one',
          condition: 'with-hints',
          type: 'attempt',
          taskType: 'gap-fill',
          story: 'A',
          word: 'castle',
          attempt: 'castel',
          correct: false,
        },
        {
          ts: new Date().toISOString(),
          student: 'demo-2',
          username: 'student-two',
          condition: 'without-hints',
          type: 'hint_request',
          taskType: 'gap-fill',
          story: 'B',
          word: 'journey',
          attempt: '',
          correct: null,
        },
      ],
      total: 2,
    });
  }
  const filters = parseFilters(req);
  const [assignments, events] = await Promise.all([
    Assignment.find({ experiment: req.params.id }).populate('condition', 'type').lean(),
    Event.find({ experiment: req.params.id }).lean(),
  ]);
  const allowedAssignments = filters.condition
    ? assignments.filter((a: any) => String((a.condition as any)?.type || '') === filters.condition)
    : assignments;
  const allowedStudentIds = Array.from(
    new Set(allowedAssignments.map((a: any) => String(a.student)))
  );
  const userIds = allowedStudentIds.length
    ? allowedStudentIds
    : Array.from(new Set(assignments.map((a: any) => String(a.student))));
  const users = await User.find({ _id: { $in: userIds } })
    .select('username email')
    .lean();
  const userMap = new Map(users.map((u: any) => [String(u._id), u]));
  const assignmentMap = new Map(allowedAssignments.map((a: any) => [String(a.student), a]));
  const filtered = filterEvents(events, filters, allowedStudentIds);
  const limitRaw = parseInt(String(req.query.limit || '200'), 10);
  const offsetRaw = parseInt(String(req.query.offset || '0'), 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 200;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
  const pageItems = filtered.slice(offset, offset + limit);
  const payload = pageItems.map((e: any) => {
    const storyRaw = e.payload?.story || e.payload?.storyLabel || e.payload?.storyKey;
    const story = normalizeStoryLabel(storyRaw) || '';
    const user = userMap.get(String(e.student)) as any;
    const assignment = assignmentMap.get(String(e.student)) as any;
    return {
      ts: e.ts ? new Date(e.ts).toISOString() : null,
      student: String(e.student || ''),
      username: user?.username || user?.email || 'unknown',
      condition: (assignment?.condition as any)?.type || 'unknown',
      type: e.type || '',
      taskType: e.taskType || '',
      story,
      word: e.payload?.word || e.targetWord || '',
      attempt: e.payload?.attempt || '',
      correct: e.payload?.correct ?? null,
    };
  });
  res.json({ events: payload, total: filtered.length, limit, offset });
});

router.get('/experiment/:id/events/csv', requireAuth, requireRole('teacher'), async (req, res) => {
  const filters = parseFilters(req);
  const [assignments, events] = await Promise.all([
    Assignment.find({ experiment: req.params.id }).populate('condition', 'type').lean(),
    Event.find({ experiment: req.params.id }).lean(),
  ]);
  const allowedAssignments = filters.condition
    ? assignments.filter((a: any) => String((a.condition as any)?.type || '') === filters.condition)
    : assignments;
  const allowedStudentIds = Array.from(
    new Set(allowedAssignments.map((a: any) => String(a.student)))
  );
  const userIds = allowedStudentIds.length
    ? allowedStudentIds
    : Array.from(new Set(assignments.map((a: any) => String(a.student))));
  const users = await User.find({ _id: { $in: userIds } })
    .select('username email')
    .lean();
  const userMap = new Map(users.map((u: any) => [String(u._id), u]));
  const assignmentMap = new Map(allowedAssignments.map((a: any) => [String(a.student), a]));
  const filtered = filterEvents(events, filters, allowedStudentIds);
  const header = [
    'ts',
    'student',
    'username',
    'condition',
    'type',
    'taskType',
    'story',
    'word',
    'attempt',
    'correct',
    'payload',
  ];
  const rows = filtered.map((e: any) => {
    const storyRaw = e.payload?.story || e.payload?.storyLabel || e.payload?.storyKey;
    const story = normalizeStoryLabel(storyRaw) || '';
    const user = userMap.get(String(e.student)) as any;
    const assignment = assignmentMap.get(String(e.student)) as any;
    return [
      e.ts ? new Date(e.ts).toISOString() : '',
      String(e.student || ''),
      user?.username || user?.email || 'unknown',
      (assignment?.condition as any)?.type || 'unknown',
      e.type || '',
      e.taskType || '',
      story,
      e.payload?.word || e.targetWord || '',
      e.payload?.attempt || '',
      e.payload?.correct ?? '',
      JSON.stringify(e.payload || {}),
    ];
  });
  const csv = toCsv([header, ...rows]);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="experiment_${req.params.id}_events.csv"`
  );
  return res.send(csv);
});

router.get(
  '/experiment/:id/student/:studentId',
  requireAuth,
  requireRole('teacher'),
  async (req, res) => {
    const exp = await Experiment.findById(req.params.id).select('_id title status');
    if (!exp) return res.status(404).json({ error: 'Not found' });
    if (String(req.query.demo || '') === '1') {
      const demo = buildDemoAnalytics(exp);
      const student = demo.students[0] || null;
      return res.json({
        experiment: exp,
        student,
        words: demo.words,
        timeline: demo.timeline,
        counts: demo.counts,
        byStory: demo.byStory,
      });
    }
    const filters = parseFilters(req);
    const cacheKey = `exp-student:${req.params.id}:${req.params.studentId}:${JSON.stringify(filters)}`;
    const cached = getAnalyticsCache(cacheKey);
    if (cached) return res.json(cached);
    const data = await computeStudentAnalytics(req.params.id, req.params.studentId, filters);
    const payload = {
      experiment: exp,
      student: data.student,
      words: data.words,
      timeline: data.timeline,
      counts: data.counts,
      byStory: data.byStory,
      confusions: data.confusions,
    };
    setAnalyticsCache(cacheKey, payload);
    res.json(payload);
  }
);

router.get(
  '/experiment/:id/student/:studentId/csv',
  requireAuth,
  requireRole('teacher'),
  async (req, res) => {
    const type = String(req.query.type || 'words');
    const filters = parseFilters(req);
    const data = await computeStudentAnalytics(req.params.id, req.params.studentId, filters);
    if (type === 'timeline') {
      const header = ['day', 'attempts', 'correct', 'hints', 'definitions', 'recall'];
      const rows = data.timeline.map((t: any) => [
        t.day,
        t.attempts,
        t.correct,
        t.hints,
        t.definitions,
        t.recall,
      ]);
      const csv = toCsv([header, ...rows]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="experiment_${req.params.id}_student_${req.params.studentId}_timeline.csv"`
      );
      return res.send(csv);
    }
    if (type === 'summary') {
      const s = data.student || {};
      const header = [
        'student',
        'condition',
        'attempts',
        'accuracy',
        'hints',
        'definitionAccuracy',
        'recallAvg',
      ];
      const rows = [
        [
          s.username || '',
          s.condition || '',
          s.attempts || 0,
          s.accuracy || 0,
          s.hints || 0,
          s.definitionAccuracy || 0,
          s.recallAvg || 0,
        ],
      ];
      const csv = toCsv([header, ...rows]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="experiment_${req.params.id}_student_${req.params.studentId}_summary.csv"`
      );
      return res.send(csv);
    }
    const header = ['word', 'attempts', 'accuracy'];
    const rows = data.words.map((w: any) => [w.word, w.attempts, w.accuracy]);
    const csv = toCsv([header, ...rows]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="experiment_${req.params.id}_student_${req.params.studentId}_words.csv"`
    );
    return res.send(csv);
  }
);

router.get(
  '/experiments/summary',
  requireAuth,
  requireRole('teacher'),
  async (req: AuthenticatedRequest, res) => {
    const cacheKey = `experiments-summary:${String(req.user?.sub || 'teacher')}`;
    const cached = getAnalyticsCache(cacheKey);
    if (cached) return res.json({ experiments: cached });
    const experiments = await Experiment.find({ owner: req.user?.sub })
      .select('_id title status')
      .lean();
    const expIds = experiments.map((e) => e._id);
    const [assignments, events] = await Promise.all([
      Assignment.find({ experiment: { $in: expIds } }).lean(),
      Event.find({ experiment: { $in: expIds } }).lean(),
    ]);
    const byExperiment: Record<string, any> = {};
    experiments.forEach((e: any) => {
      byExperiment[String(e._id)] = {
        experimentId: String(e._id),
        title: e.title,
        status: e.status,
        students: 0,
        attempts: 0,
        correctRate: 0,
        recallAvg: 0,
      };
    });
    const studentsByExp = new Map<string, Set<string>>();
    assignments.forEach((a: any) => {
      const id = String(a.experiment);
      const set = studentsByExp.get(id) || new Set<string>();
      set.add(String(a.student));
      studentsByExp.set(id, set);
    });
    for (const [id, set] of studentsByExp) {
      if (byExperiment[id]) byExperiment[id].students = set.size;
    }
    const totalsByExp: Record<
      string,
      { attempts: number; correct: number; recallScores: number[] }
    > = {};
    events.forEach((e: any) => {
      const expId = String(e.experiment || '');
      if (!expId || !byExperiment[expId]) return;
      totalsByExp[expId] = totalsByExp[expId] || { attempts: 0, correct: 0, recallScores: [] };
      if (e.type === 'attempt') {
        totalsByExp[expId].attempts += 1;
        if (e.payload?.correct) totalsByExp[expId].correct += 1;
      }
      if (e.type === 'recall-attempt' && Array.isArray(e.payload?.scores)) {
        const scores = e.payload.scores;
        const avg =
          scores.reduce((s: number, i: any) => s + (i.score || 0), 0) / (scores.length || 1);
        totalsByExp[expId].recallScores.push(avg);
      }
    });
    Object.entries(totalsByExp).forEach(([id, v]) => {
      if (!byExperiment[id]) return;
      byExperiment[id].attempts = v.attempts;
      byExperiment[id].correctRate = v.attempts ? Math.round((v.correct / v.attempts) * 100) : 0;
      byExperiment[id].recallAvg = v.recallScores.length
        ? Math.round((v.recallScores.reduce((s, x) => s + x, 0) / v.recallScores.length) * 100) /
          100
        : 0;
    });
    const result = Object.values(byExperiment);
    setAnalyticsCache(cacheKey, result);
    res.json({ experiments: result });
  }
);

router.get(
  '/experiments/csv',
  requireAuth,
  requireRole('teacher'),
  async (req: AuthenticatedRequest, res) => {
    const experiments = await Experiment.find({ owner: req.user?.sub })
      .select('_id title status')
      .lean();
    const expIds = experiments.map((e) => e._id);
    const [assignments, events] = await Promise.all([
      Assignment.find({ experiment: { $in: expIds } }).lean(),
      Event.find({ experiment: { $in: expIds } }).lean(),
    ]);
    const byExperiment: Record<string, any> = {};
    experiments.forEach((e: any) => {
      byExperiment[String(e._id)] = {
        experimentId: String(e._id),
        title: e.title,
        status: e.status,
        students: 0,
        attempts: 0,
        correctRate: 0,
        recallAvg: 0,
      };
    });
    const studentsByExp = new Map<string, Set<string>>();
    assignments.forEach((a: any) => {
      const id = String(a.experiment);
      const set = studentsByExp.get(id) || new Set<string>();
      set.add(String(a.student));
      studentsByExp.set(id, set);
    });
    for (const [id, set] of studentsByExp) {
      if (byExperiment[id]) byExperiment[id].students = set.size;
    }
    const totalsByExp: Record<
      string,
      { attempts: number; correct: number; recallScores: number[] }
    > = {};
    events.forEach((e: any) => {
      const expId = String(e.experiment || '');
      if (!expId || !byExperiment[expId]) return;
      totalsByExp[expId] = totalsByExp[expId] || { attempts: 0, correct: 0, recallScores: [] };
      if (e.type === 'attempt') {
        totalsByExp[expId].attempts += 1;
        if (e.payload?.correct) totalsByExp[expId].correct += 1;
      }
      if (e.type === 'recall-attempt' && Array.isArray(e.payload?.scores)) {
        const scores = e.payload.scores;
        const avg =
          scores.reduce((s: number, i: any) => s + (i.score || 0), 0) / (scores.length || 1);
        totalsByExp[expId].recallScores.push(avg);
      }
    });
    Object.entries(totalsByExp).forEach(([id, v]) => {
      if (!byExperiment[id]) return;
      byExperiment[id].attempts = v.attempts;
      byExperiment[id].correctRate = v.attempts ? Math.round((v.correct / v.attempts) * 100) : 0;
      byExperiment[id].recallAvg = v.recallScores.length
        ? Math.round((v.recallScores.reduce((s, x) => s + x, 0) / v.recallScores.length) * 100) /
          100
        : 0;
    });
    const header = [
      'experimentId',
      'title',
      'status',
      'students',
      'attempts',
      'correctRate',
      'recallAvg',
    ];
    const rows = Object.values(byExperiment).map((e: any) => [
      e.experimentId,
      e.title,
      e.status,
      e.students,
      e.attempts,
      e.correctRate,
      e.recallAvg,
    ]);
    const csv = toCsv([header, ...rows]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="experiments_summary.csv"`);
    return res.send(csv);
  }
);

export default router;
