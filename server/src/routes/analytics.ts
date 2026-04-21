/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { Attempt } from '../models/Attempt';
import { Event } from '../models/Event';
import { EffortResponse } from '../models/EffortResponse';
import { Experiment } from '../models/Experiment';
import { Assignment } from '../models/Assignment';
import { User } from '../models/User';
import { InterventionAttempt } from '../models/InterventionAttempt';
import { getAnalyticsCache, setAnalyticsCache } from '../utils/analyticsCache';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import { PreStudySurvey } from '../models/PreStudySurvey';

function toCsv(rows: (string | number | boolean | null | undefined)[][]) {
  return rows
    .map((r) => r.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(','))
    .join('\n');
}

// Map internal condition values to experiment presentation labels
function toTreatmentControl(raw?: string): 'treatment' | 'control' | 'unknown' {
  if (raw === 'with-hints') return 'treatment';
  if (raw === 'without-hints') return 'control';
  return 'unknown';
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

function pearson(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length);
  if (n === 0) return null;
  const xMean = x.reduce((s, v) => s + v, 0) / n;
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - xMean;
    const dy = y[i] - yMean;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX) * Math.sqrt(denY);
  if (den === 0) return null;
  return Math.round((num / den) * 1000) / 1000;
}

async function computeOffloadingAnalytics(experimentId: string, filters: AnalyticsFilters = {}) {
  // Load assignments and surveys
  const assignments = await Assignment.find({ experiment: experimentId })
    .populate('condition', 'type')
    .lean();

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
  const allowedStudentIds = Array.from(new Set(allowedAssignments.map((a: any) => String(a.student))));

  const [surveys, events, attempts, users] = await Promise.all([
    PreStudySurvey.find({ experiment: experimentId, student: { $in: allowedStudentIds } })
      .select('student offloadingScore offloadingItems completedAt')
      .lean(),
    Event.find({ experiment: experimentId }).lean(),
    Attempt.find({ experiment: experimentId, student: { $in: allowedStudentIds } })
      .select('student revealed')
      .lean(),
    User.find({ _id: { $in: allowedStudentIds } }).select('username email').lean(),
  ]);

  const filteredEvents = filterEvents(events, filters, allowedStudentIds);
  const userMap = new Map(users.map((u: any) => [String(u._id), u]));
  const assignmentMap = new Map(allowedAssignments.map((a: any) => [String(a.student), a]));
  const byStudent: Record<string, {
    offloadingScore?: number;
    attempts: number;
    hints: number;
    revealed: number;
    delayedRecallValues: number[];
  }> = {};
  const ensure = (sid: string) => (byStudent[sid] ||= { attempts: 0, hints: 0, revealed: 0, delayedRecallValues: [] });

  // Offloading scores
  const itemsMatrix: number[][] = [];
  surveys.forEach((s: any) => {
    const sid = String(s.student);
    ensure(sid).offloadingScore = typeof s.offloadingScore === 'number' ? s.offloadingScore : undefined;
    if (Array.isArray(s.offloadingItems) && s.offloadingItems.length >= 5) {
      itemsMatrix.push(s.offloadingItems.map((x: any) => Number(x)));
    }
  });

  // Events: attempts, hints, delayed recall
  for (const e of filteredEvents) {
    const sid = String((e as any).student || '');
    if (!allowedStudentIds.includes(sid)) continue;
    const st = ensure(sid);
    if (e.type === 'attempt') st.attempts += 1;
    if (e.type === 'hint_request') st.hints += 1;
    if (e.type === 'recall-attempt' && ((e as any).taskType === 'delayed-recall' || (e as any).payload?.delayed)) {
      const p = (e as any).payload || {};
      const combined = typeof p.combinedAvg === 'number'
        ? p.combinedAvg
        : Array.isArray(p.scores) && p.scores.length
          ? (p.scores.reduce((s: number, r: any) => s + (typeof r.combinedScore === 'number' ? r.combinedScore : (typeof r.score === 'number' ? r.score : 0)), 0) / p.scores.length)
          : null;
      if (typeof combined === 'number') st.delayedRecallValues.push(combined);
    }
  }

  // Attempt docs: reveal count
  attempts.forEach((a: any) => {
    const sid = String(a.student);
    const st = ensure(sid);
    if (a.revealed) st.revealed += 1;
  });

  // Build per-student rows
  const rows = allowedStudentIds.map((sid) => {
    const a = assignmentMap.get(sid) as any;
    const cRaw = (a?.condition as any)?.type || 'unknown';
    const cLabel = toTreatmentControl(cRaw);
    const s = byStudent[sid] || { attempts: 0, hints: 0, revealed: 0, delayedRecallValues: [] };
    const hintRate = s.attempts ? s.hints / s.attempts : 0;
    // Denominator for reveal rate: use attempts docs length for this student
    const denomReveals = attempts.filter((x: any) => String(x.student) === sid).length || 0;
    const revealRate = denomReveals ? s.revealed / denomReveals : 0;
    const delayedRecallAvg = s.delayedRecallValues.length
      ? Math.round((s.delayedRecallValues.reduce((ss, v) => ss + v, 0) / s.delayedRecallValues.length) * 100) / 100
      : null;
    const user = userMap.get(sid) as any;
    return {
      studentId: sid,
      username: user?.username || user?.email || 'unknown',
      condition: cLabel,
      offloadingScore: typeof s.offloadingScore === 'number' ? s.offloadingScore : null,
      attempts: s.attempts,
      hints: s.hints,
      hintRate: Math.round(hintRate * 1000) / 1000,
      reveals: s.revealed,
      revealRate: Math.round(revealRate * 1000) / 1000,
      delayedRecallAvg,
    };
  });

  // Distribution & correlations
  const offVals = rows.map((r) => r.offloadingScore).filter((v): v is number => typeof v === 'number');
  const distribution = offVals.slice().sort((a, b) => a - b);

  const corr = {
    offloading_hintRate: (() => {
      const xs: number[] = []; const ys: number[] = [];
      rows.forEach((r) => { if (typeof r.offloadingScore === 'number') { xs.push(r.offloadingScore); ys.push(r.hintRate); } });
      return pearson(xs, ys);
    })(),
    offloading_revealRate: (() => {
      const xs: number[] = []; const ys: number[] = [];
      rows.forEach((r) => { if (typeof r.offloadingScore === 'number') { xs.push(r.offloadingScore); ys.push(r.revealRate); } });
      return pearson(xs, ys);
    })(),
    offloading_delayedRecall: (() => {
      const xs: number[] = []; const ys: number[] = [];
      rows.forEach((r) => { if (typeof r.offloadingScore === 'number' && typeof r.delayedRecallAvg === 'number') { xs.push(r.offloadingScore); ys.push(r.delayedRecallAvg); } });
      return pearson(xs, ys);
    })(),
  };

  // Moderation (median split on offloadingScore)
  let moderation: any = null;
  if (offVals.length >= 4) {
    const median = offVals[Math.floor(offVals.length / 2)];
    const group = (g: 'low' | 'high', cond: 'treatment' | 'control') => {
      const subset = rows.filter((r) => r.offloadingScore !== null && r.condition === cond && (g === 'low' ? (r.offloadingScore as number) <= median : (r.offloadingScore as number) > median) && typeof r.delayedRecallAvg === 'number');
      if (!subset.length) return null;
      return subset.reduce((s, r) => s + (r.delayedRecallAvg as number), 0) / subset.length;
    };
    const lowTreat = group('low', 'treatment');
    const lowCtrl = group('low', 'control');
    const highTreat = group('high', 'treatment');
    const highCtrl = group('high', 'control');
    const diffLow = (lowTreat ?? 0) - (lowCtrl ?? 0);
    const diffHigh = (highTreat ?? 0) - (highCtrl ?? 0);
    moderation = { median, low: { treatment: lowTreat, control: lowCtrl, diff: lowTreat !== null && lowCtrl !== null ? diffLow : null }, high: { treatment: highTreat, control: highCtrl, diff: highTreat !== null && highCtrl !== null ? diffHigh : null }, diffInDiff: (lowTreat !== null && lowCtrl !== null && highTreat !== null && highCtrl !== null) ? Math.round((diffHigh - diffLow) * 1000) / 1000 : null };
  }

  // Cronbach's alpha (reliability) across the 5 items
  let cronbachAlpha: number | null = null;
  const k = 5;
  if (itemsMatrix.length >= 2) {
    const n = itemsMatrix.length;
    // Compute item variances
    const itemVars: number[] = [];
    for (let j = 0; j < k; j++) {
      const col = itemsMatrix.map((r) => r[j]);
      const mean = col.reduce((s, v) => s + v, 0) / n;
      const variance = col.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (n - 1);
      itemVars.push(variance);
    }
    // Compute total score variance
    const totals = itemsMatrix.map((r) => r.reduce((s, v) => s + v, 0));
    const meanT = totals.reduce((s, v) => s + v, 0) / n;
    const varT = totals.reduce((s, v) => s + Math.pow(v - meanT, 2), 0) / (n - 1);
    const sumItemVars = itemVars.reduce((s, v) => s + v, 0);
    if (varT > 0) {
      const alpha = (k / (k - 1)) * (1 - sumItemVars / varT);
      cronbachAlpha = Math.round(alpha * 1000) / 1000;
    }
  }

  // Effect size: treatment vs control on delayedRecallAvg (Hedges' g with CI)
  const tVals = rows.filter((r) => r.condition === 'treatment' && typeof r.delayedRecallAvg === 'number').map((r) => r.delayedRecallAvg as number);
  const cVals = rows.filter((r) => r.condition === 'control' && typeof r.delayedRecallAvg === 'number').map((r) => r.delayedRecallAvg as number);
  let effectSize: any = null;
  if (tVals.length >= 2 && cVals.length >= 2) {
    const mean = (a: number[]) => a.reduce((s,v)=>s+v,0)/a.length;
    const sd = (a: number[]) => {
      const m = mean(a); return Math.sqrt(a.reduce((s,v)=> s + Math.pow(v-m,2), 0) / (a.length - 1));
    };
    const mt = mean(tVals), mc = mean(cVals);
    const sdt = sd(tVals), sdc = sd(cVals);
    const nt = tVals.length, nc = cVals.length;
    const sp = Math.sqrt(((nt-1)*sdt*sdt + (nc-1)*sdc*sdc) / (nt + nc - 2));
    const d = sp > 0 ? (mt - mc) / sp : 0;
    const J = 1 - 3 / (4*(nt + nc) - 9); // small-sample correction
    const g = d * J;
    // Variance approximation for Hedges' g
    const varg = (nt + nc)/(nt*nc) + (g*g)/(2*(nt + nc - 2));
    const se = Math.sqrt(Math.max(0, varg));
    const ciLo = g - 1.96 * se;
    const ciHi = g + 1.96 * se;
    effectSize = {
      type: 'hedges_g',
      g: Math.round(g * 1000) / 1000,
      ci: [Math.round(ciLo * 1000) / 1000, Math.round(ciHi * 1000) / 1000],
      treatment: { n: nt, mean: Math.round(mt * 1000) / 1000, sd: Math.round(sdt * 1000) / 1000 },
      control: { n: nc, mean: Math.round(mc * 1000) / 1000, sd: Math.round(sdc * 1000) / 1000 },
    };
  }

  return { perStudent: rows, distribution, correlations: corr, moderation, cronbachAlpha, surveyCount: itemsMatrix.length, effectSize };
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
  const [assignments, events, effortResponses] = await Promise.all([
    Assignment.find({ experiment: experimentId }).populate('condition', 'type').lean(),
    Event.find({ experiment: experimentId }).lean(),
    EffortResponse.find({}).lean(), // Query all, then filter by student
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
  const timePerStory: Record<string, { A: { first?: Date; last?: Date }; B: { first?: Date; last?: Date } }> = {};
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

  // Prepare funnel by condition (treatment/control)
  const byCondInit = { joined: 0, story1: 0, story2: 0, breakDone: 0, recall: 0 };
  const funnelByCondition: Record<'treatment'|'control', typeof byCondInit> = {
    treatment: { ...byCondInit },
    control: { ...byCondInit },
  };
  const studentCondLabel = (sid: string): 'treatment' | 'control' | 'unknown' => {
    const a = assignmentMap.get(sid) as any;
    const raw = (a?.condition as any)?.type || 'unknown';
    const lab = toTreatmentControl(raw);
    return (lab === 'treatment' || lab === 'control') ? lab : 'unknown';
  };
  // Joined per condition
  allowedStudentIds.forEach((sid) => {
    const lab = studentCondLabel(sid);
    if (lab === 'treatment' || lab === 'control') funnelByCondition[lab].joined += 1;
  });

  // Intervention metrics
  let totalInterventions = 0;
  let completedInterventions = 0;
  let totalMcqAttempts = 0;
  let totalJumbleAttempts = 0;
  let totalSentenceAttempts = 0;
  const interventionTimeMs: number[] = [];

  const filteredEvents = filterEvents(events, filters, allowedStudentIds);

  const ensureStudent = (id: string) => {
    if (!perStudent[id]) {
      const user = userMap.get(id) || {};
      const assignment = assignmentMap.get(id) as any;
      perStudent[id] = {
        studentId: id,
        username: (user as any).username || (user as any).email || 'unknown',
        condition: (assignment?.condition as any)?.type || 'unknown',
        // Story assignment details
        storyOrder: assignment?.storyOrder || null,
        hintsStory: assignment?.hintsStory || null,
        // Per-story tracking
        storyAAttempts: 0,
        storyACorrect: 0,
        storyBAttempts: 0,
        storyBCorrect: 0,
        attempts: 0,
        correct: 0,
        hints: 0,
        defTotal: 0,
        defCorrect: 0,
        recallScores: [],
        delayedTestCompleted: false,
        delayedTestScore: null as number | null,
        // Intervention metrics per student
        interventions: 0,
        interventionsCompleted: 0,
        mcqAttempts: 0,
        jumbleAttempts: 0,
        sentenceAttempts: 0,
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

      // Track time per story
      const storyLabel = normalizeStoryLabel((e.payload as any)?.story);
      if (storyLabel === 'A' || storyLabel === 'B') {
        timePerStory[sid] = timePerStory[sid] || { A: {}, B: {} };
        const st = timePerStory[sid][storyLabel];
        if (!st.first || ts < st.first) st.first = ts;
        if (!st.last || ts > st.last) st.last = ts;
      }
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
      // Track per-story attempts
      if (story === 'A') {
        student.storyAAttempts += 1;
        if (correct) student.storyACorrect += 1;
      } else if (story === 'B') {
        student.storyBAttempts += 1;
        if (correct) student.storyBCorrect += 1;
      }
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
      const isDelayed = (e.taskType as any) === 'delayed-recall' || (e.payload as any)?.delayed;
      if (Array.isArray(scores) && scores.length) {
        const avg = scores.reduce((s: number, i: any) => s + (i.score || 0), 0) / scores.length;
        recallScores.push(avg);
        student.recallScores.push(avg);
        bucket.recall += scores.length;
        funnel.recall += 1;
        // Track delayed test completion
        if (isDelayed) {
          student.delayedTestCompleted = true;
          student.delayedTestScore = Math.round(avg * 100) / 100;
        }
      }
    }

    // Intervention events
    if (e.type === 'intervention_started') {
      totalInterventions += 1;
      student.interventions += 1;
    }

    if (e.type === 'intervention_completed') {
      completedInterventions += 1;
      student.interventionsCompleted += 1;
      const timeMs = (e.payload as any)?.totalTimeMs;
      if (typeof timeMs === 'number' && timeMs > 0) {
        interventionTimeMs.push(timeMs);
      }
    }

    if (e.type === 'mcq_attempt') {
      totalMcqAttempts += 1;
      student.mcqAttempts += 1;
    }

    if (e.type === 'jumble_attempt') {
      totalJumbleAttempts += 1;
      student.jumbleAttempts += 1;
    }

    if (e.type === 'sentence_attempt') {
      totalSentenceAttempts += 1;
      student.sentenceAttempts += 1;
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
  const story1Set = new Set<string>();
  const story2Set = new Set<string>();
  const recallSet = new Set<string>();
  filteredEvents.forEach((e: any) => {
    if (e.type === 'feedback' && typeof e.payload?.storyIndex === 'number') {
      const sid = String(e.student || '');
      if (e.payload.storyIndex === 0) {
        if (!story1Set.has(sid)) {
          story1Set.add(sid);
          funnel.story1 += 1;
          const lab = studentCondLabel(sid);
          if (lab === 'treatment' || lab === 'control') funnelByCondition[lab].story1 += 1;
        }
      }
      if (e.payload.storyIndex === 1) {
        if (!story2Set.has(sid)) {
          story2Set.add(sid);
          funnel.story2 += 1;
          const lab = studentCondLabel(sid);
          if (lab === 'treatment' || lab === 'control') funnelByCondition[lab].story2 += 1;
        }
      }
    }
    if (e.type === 'recall-attempt') {
      const sid = String(e.student || '');
      if (!recallSet.has(sid)) {
        recallSet.add(sid);
        funnel.recall += 1;
        const lab = studentCondLabel(sid);
        if (lab === 'treatment' || lab === 'control') funnelByCondition[lab].recall += 1;
      }
    }
  });
  const assignmentsWithBreak = allowedAssignments.filter((a: any) => !!a.breakUntil).length;
  funnel.breakDone = assignmentsWithBreak;
  // Break by condition
  const breakByCond = new Map<'treatment'|'control', number>([
    ['treatment', 0],
    ['control', 0],
  ]);
  allowedAssignments.forEach((a: any) => {
    if (a.breakUntil) {
      const lab = toTreatmentControl((a.condition as any)?.type || 'unknown');
      if (lab === 'treatment' || lab === 'control') {
        breakByCond.set(lab, (breakByCond.get(lab) || 0) + 1);
      }
    }
  });
  funnelByCondition.treatment.breakDone = breakByCond.get('treatment') || 0;
  funnelByCondition.control.breakDone = breakByCond.get('control') || 0;

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

  // Build effort response map per student
  const effortByStudent: Record<string, number[]> = {};
  effortResponses.forEach((e: any) => {
    const sid = String(e.student);
    if (!allowedStudentIds.includes(sid)) return;
    effortByStudent[sid] = effortByStudent[sid] || [];
    effortByStudent[sid].push(e.score);
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

    // Time per story
    const storyTimes = timePerStory[s.studentId] || { A: {}, B: {} };
    const timeStoryAMin = storyTimes.A.first && storyTimes.A.last
      ? Math.max(0, Math.round((storyTimes.A.last.getTime() - storyTimes.A.first.getTime()) / 60000))
      : 0;
    const timeStoryBMin = storyTimes.B.first && storyTimes.B.last
      ? Math.max(0, Math.round((storyTimes.B.last.getTime() - storyTimes.B.first.getTime()) / 60000))
      : 0;

    // Mental effort average
    const efforts = effortByStudent[s.studentId] || [];
    const avgMentalEffort = efforts.length
      ? Math.round((efforts.reduce((sum, e) => sum + e, 0) / efforts.length) * 10) / 10
      : null;

    // Determine phase conditions based on storyOrder and hintsStory
    let phase1Condition = null;
    let phase1Story = null;
    let phase2Condition = null;
    let phase2Story = null;

    if (s.storyOrder && s.hintsStory) {
      const firstStory = s.storyOrder === 'A-first' ? 'A' : 'B';
      const secondStory = s.storyOrder === 'A-first' ? 'B' : 'A';
      phase1Story = firstStory;
      phase2Story = secondStory;
      phase1Condition = s.hintsStory === firstStory ? 'treatment' : 'control';
      phase2Condition = s.hintsStory === secondStory ? 'treatment' : 'control';
    }

    return {
      studentId: s.studentId,
      username: s.username,
      condition: toTreatmentControl(s.condition),
      // Phase details
      storyOrder: s.storyOrder,
      hintsStory: s.hintsStory,
      phase1Condition,
      phase1Story,
      phase2Condition,
      phase2Story,
      // Per-story metrics
      storyAAccuracy: s.storyAAttempts ? Math.round((s.storyACorrect / s.storyAAttempts) * 100) : 0,
      storyBAccuracy: s.storyBAttempts ? Math.round((s.storyBCorrect / s.storyBAttempts) * 100) : 0,
      timeStoryAMin,
      timeStoryBMin,
      // Overall metrics
      attempts: s.attempts,
      accuracy: s.attempts ? Math.round((s.correct / s.attempts) * 100) : 0,
      hints: s.hints,
      definitionAccuracy,
      recallAvg,
      timeOnTaskMin: minutes,
      // Mental effort
      avgMentalEffort,
      // Delayed test
      delayedTestCompleted: s.delayedTestCompleted,
      delayedTestScore: s.delayedTestScore,
      // Intervention metrics
      interventions: s.interventions,
      interventionsCompleted: s.interventionsCompleted,
      interventionExercises: s.mcqAttempts + s.jumbleAttempts + s.sentenceAttempts,
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
      condition: toTreatmentControl(condition),
      story,
      attempts: v.attempts,
      accuracy: v.attempts ? Math.round((v.correct / v.attempts) * 100) : 0,
      hints: v.hints,
    };
  });

  // Calculate average intervention time
  const avgInterventionTimeMs = interventionTimeMs.length
    ? Math.round(interventionTimeMs.reduce((s, x) => s + x, 0) / interventionTimeMs.length)
    : 0;

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
      // Intervention metrics
      interventions: totalInterventions,
      interventionsCompleted: completedInterventions,
      interventionCompletionRate: totalInterventions
        ? Math.round((completedInterventions / totalInterventions) * 100)
        : 0,
      avgInterventionTimeSec: Math.round(avgInterventionTimeMs / 1000),
      exerciseAttempts: {
        mcq: totalMcqAttempts,
        jumble: totalJumbleAttempts,
        sentence: totalSentenceAttempts,
      },
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
    funnelByCondition,
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

router.get('/experiment/:id/offloading', requireAuth, requireRole('teacher'), async (req, res) => {
  const filters = parseFilters(req);
  try {
    const data = await computeOffloadingAnalytics(req.params.id, filters);
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to compute offloading analytics' });
  }
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
  if (type === 'offloading') {
    const off = await computeOffloadingAnalytics(req.params.id, filters);
    const header = [
      'studentId', 'username', 'condition', 'offloadingScore', 'attempts', 'hints', 'hintRate', 'reveals', 'revealRate', 'delayedRecallAvg'
    ];
    const rows = off.perStudent.map((r: any) => [
      r.studentId, r.username, r.condition, r.offloadingScore ?? '', r.attempts, r.hints, r.hintRate, r.reveals, r.revealRate, r.delayedRecallAvg ?? ''
    ]);
    const csv = toCsv([header, ...rows]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="experiment_${req.params.id}_offloading.csv"`);
    return res.send(csv);
  }
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

// One-click research export: bundle key CSVs + codebook as a ZIP
router.get('/experiment/:id/research-export', requireAuth, requireRole('teacher'), async (req, res) => {
  const expId = req.params.id;
  try {
    const filters = parseFilters(req);
    const [summaryData, offloading] = await Promise.all([
      computeExperimentAnalytics(expId, filters),
      computeOffloadingAnalytics(expId, filters),
    ]);

    // Build CSV strings using existing toCsv helper
    const studentsHeader = [
      'studentId','username','condition','attempts','accuracy','hints','definitionAccuracy','recallAvg','timeOnTaskMin','avgMentalEffort','delayedTestCompleted','delayedTestScore','phase1Condition','phase1Story','phase2Condition','phase2Story'
    ];
    const studentsRows = summaryData.students.map((s: any) => [
      s.studentId, s.username, s.condition, s.attempts, s.accuracy, s.hints, s.definitionAccuracy, s.recallAvg, s.timeOnTaskMin ?? '', s.avgMentalEffort ?? '', s.delayedTestCompleted, s.delayedTestScore ?? '', s.phase1Condition ?? '', s.phase1Story ?? '', s.phase2Condition ?? '', s.phase2Story ?? ''
    ]);
    const studentsCsv = toCsv([studentsHeader, ...studentsRows]);

    const wordsHeader = ['word','attempts','accuracy'];
    const wordsRows = summaryData.words.map((w: any) => [w.word, w.attempts, w.accuracy]);
    const wordsCsv = toCsv([wordsHeader, ...wordsRows]);

    const timelineHeader = ['day','attempts','correct','hints','definitions','recall'];
    const timelineRows = summaryData.timeline.map((t: any) => [t.day, t.attempts, t.correct, t.hints, t.definitions, t.recall]);
    const timelineCsv = toCsv([timelineHeader, ...timelineRows]);

    // Events CSV (reuse mapping from route)
    const [assignments, events] = await Promise.all([
      Assignment.find({ experiment: expId }).populate('condition', 'type').lean(),
      Event.find({ experiment: expId }).lean(),
    ]);
    const allowedAssignments = assignments;
    const allowedStudentIds = Array.from(new Set(allowedAssignments.map((a: any) => String(a.student))));
    const users = await User.find({ _id: { $in: allowedStudentIds } }).select('username email').lean();
    const userMap = new Map(users.map((u: any) => [String(u._id), u]));
    const assignmentMap = new Map(allowedAssignments.map((a: any) => [String(a.student), a]));
    const filtered = filterEvents(events, filters, allowedStudentIds);
    const eventsHeader = ['ts','student','username','condition','type','taskType','story','word','attempt','correct','payload'];
    const eventsRows = filtered.map((e: any) => {
      const storyRaw = e.payload?.story || e.payload?.storyLabel || e.payload?.storyKey;
      const story = normalizeStoryLabel(storyRaw) || '';
      const user = userMap.get(String(e.student)) as any;
      const assignment = assignmentMap.get(String(e.student)) as any;
      return [
        e.ts ? new Date(e.ts).toISOString() : '',
        String(e.student || ''),
        user?.username || user?.email || 'unknown',
        toTreatmentControl((assignment?.condition as any)?.type || 'unknown'),
        e.type || '',
        e.taskType || '',
        story,
        e.payload?.word || e.targetWord || '',
        e.payload?.attempt || '',
        e.payload?.correct ?? '',
        JSON.stringify(e.payload || {}),
      ];
    });
    const eventsCsv = toCsv([eventsHeader, ...eventsRows]);

    // Offloading CSV (reuse existing export schema)
    const offHeader = ['studentId','username','condition','offloadingScore','attempts','hints','hintRate','reveals','revealRate','delayedRecallAvg'];
    const offRows = offloading.perStudent.map((r: any) => [r.studentId, r.username, r.condition, r.offloadingScore ?? '', r.attempts, r.hints, r.hintRate, r.reveals, r.revealRate, r.delayedRecallAvg ?? '']);
    const offCsv = toCsv([offHeader, ...offRows]);

    // Codebook (markdown) - concise and practical
    const codebook = `# Research Export Codebook\n\n- students.csv: One row per student in the experiment.\n  - studentId: MongoDB ObjectId as string\n  - username: pseudonymized username/email\n  - condition: treatment|control (presentation layer)\n  - attempts: total gap-fill attempts (events)\n  - accuracy: % correct (attempt-level)\n  - hints: hints requested (events)\n  - definitionAccuracy: % correct on definition checks (targets only)\n  - recallAvg: mean of recall scores (0-1)\n  - timeOnTaskMin: minutes between first and last event per student\n  - avgMentalEffort: 1–9 Paas average (if present)\n  - delayedTestCompleted: boolean\n  - delayedTestScore: average combined delayed recall (0-1)\n  - phase1Condition/phase2Condition: treatment|control by story order\n  - phase1Story/phase2Story: A|B\n\n- words.csv: Per-word aggregates.\n  - accuracy: % correct on attempts containing that word\n\n- timeline.csv: Daily aggregates.\n  - attempts, correct, hints, definitions, recall: daily counts\n\n- events.csv: Event log filtered by current UI filters.\n  - type: attempt|hint_request|definition|recall-attempt|...\n  - story: A|B (if applicable)\n  - payload: JSON with event-specific details\n\n- offloading.csv: Per-student offloading analytics.\n  - offloadingScore: 1–6 (Barr 5-item average)\n  - hintRate: hints/attempts; revealRate: revealed/attempt docs\n  - delayedRecallAvg: combined delayed recall (0-1)\n\nNotes:\n- Condition labels map internal with-hints/without-hints to treatment/control.\n- Recall averages are 0-1; multiply by 100 for %.\n- Offloading score computed from pre-survey (EN/DE items).\n`;

    // Stream ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="experiment_${expId}_research_export.zip"`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => { try { res.status(500).end(`Archive error: ${String(err)}`); } catch {} });
    archive.pipe(res);
    archive.append(Buffer.from(studentsCsv, 'utf8'), { name: 'students.csv' });
    archive.append(Buffer.from(wordsCsv, 'utf8'), { name: 'words.csv' });
    archive.append(Buffer.from(timelineCsv, 'utf8'), { name: 'timeline.csv' });
    archive.append(Buffer.from(eventsCsv, 'utf8'), { name: 'events.csv' });
    archive.append(Buffer.from(offCsv, 'utf8'), { name: 'offloading.csv' });
    archive.append(Buffer.from(codebook, 'utf8'), { name: 'codebook.md' });
    archive.finalize();
  } catch (e) {
    return res.status(500).json({ error: 'Failed to build research export' });
  }
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
      condition: toTreatmentControl((assignment?.condition as any)?.type || 'unknown'),
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
      toTreatmentControl((assignment?.condition as any)?.type || 'unknown'),
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
