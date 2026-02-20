import { config } from './config';
import logger from './utils/logger';

export type JobType = 'fetch_words' | 'generate_story' | 'generate_tts';
export type JobStatus = 'pending' | 'running' | 'success' | 'error';

export interface Job {
  id: string;
  type: JobType;
  experimentId: string;
  storyLabel?: 'story1' | 'story2';
  set?: 'set1' | 'set2';
  targetWords?: string[];
  model?: 'openai' | 'claude';
  regenerate?: boolean;
  status: JobStatus;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

const jobs: Job[] = [];
let running = false;

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function enqueue(job: Omit<Job, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Job {
  const j: Job = {
    id: genId(),
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...job,
  } as Job;
  jobs.push(j);
  const friendly: Record<string, string> = { generate_story: 'Story generation', generate_tts: 'TTS audio', fetch_words: 'Word fetch' };
  logger.info(`${friendly[j.type] || j.type} queued${j.storyLabel ? ` (${j.storyLabel})` : ''}`);
  tick();
  return j;
}

export function getJob(id: string) {
  return jobs.find((j) => j.id === id);
}
export function getJobsForExperiment(experimentId: string) {
  return jobs.filter((j) => j.experimentId === experimentId).slice(-50);
}

export function cleanupJobs() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const grouped = new Map<string, Job[]>();
  for (const job of jobs) {
    const list = grouped.get(job.experimentId) || [];
    list.push(job);
    grouped.set(job.experimentId, list);
  }
  const next: Job[] = [];
  for (const [, jobList] of grouped) {
    const sorted = jobList.sort((a, b) => b.updatedAt - a.updatedAt);
    const recent = sorted.filter(
      (j) => j.updatedAt > cutoff || j.status === 'pending' || j.status === 'running'
    );
    next.push(...recent.slice(0, 100));
  }
  const removed = jobs.length - next.length;
  jobs.length = 0;
  jobs.push(...next);
  if (removed > 0) logger.info('Job queue cleaned', { kept: next.length, removed });
}

async function runWithRetry(doFetch: () => Promise<Response>, max = 3) {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt < max) {
    try {
      const r = await doFetch();
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) throw new Error(`HTTP ${r.status}`);
        throw new Error(`HTTP ${r.status}`);
      }
      return r;
    } catch (e: unknown) {
      lastErr = e;
      // Early stop on hard failures
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('HTTP 401') || msg.includes('HTTP 403')) break;
      const delay = Math.pow(2, attempt) * 1000;
      if (attempt === max - 1) logger.warn(`Retry ${attempt + 1}/${max} failed: ${msg}`);
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }
  }
  throw lastErr || new Error('Job failed');
}

async function runJob(j: Job) {
  j.status = 'running';
  j.updatedAt = Date.now();
  const friendly: Record<string, string> = { generate_story: 'Story generation', generate_tts: 'TTS audio', fetch_words: 'Word fetch' };
  logger.info(`${friendly[j.type] || j.type} started${j.storyLabel ? ` (${j.storyLabel})` : ''}...`);
  try {
    const basePath = process.env.NODE_ENV === 'production' ? '/SpellWise' : '';
    const base = `http://localhost:${config.port}${basePath}`;
    if (j.type === 'fetch_words') {
      await runWithRetry(() =>
        fetch(`${base}/api/experiments/${j.experimentId}/suggestions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-job': config.internalJobSecret,
          },
          body: JSON.stringify({ set: j.set || 'set1' }),
        })
      );
    } else if (j.type === 'generate_story') {
      const label = j.storyLabel === 'story1' ? 'H' : 'N';
      const targetWords = j.targetWords;
      await runWithRetry(() =>
        fetch(`${base}/api/experiments/${j.experimentId}/generate-story`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-job': config.internalJobSecret,
          },
          body: JSON.stringify({ label, targetWords, set: j.set || 'set1', model: j.model }),
        })
      );
    } else if (j.type === 'generate_tts') {
      const label = j.storyLabel === 'story1' ? 'H' : 'N';
      await runWithRetry(() =>
        fetch(`${base}/api/experiments/${j.experimentId}/tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-job': config.internalJobSecret,
          },
          body: JSON.stringify({ label, set: j.set || 'set1' }),
        })
      );
    }
    j.status = 'success';
    j.updatedAt = Date.now();
    const elapsed = Math.round((Date.now() - j.createdAt) / 1000);
    logger.info(`${friendly[j.type] || j.type} completed${j.storyLabel ? ` (${j.storyLabel})` : ''} in ${elapsed}s`);
  } catch (e: unknown) {
    j.status = 'error';
    j.errorMessage = e instanceof Error ? e.message : String(e);
    j.updatedAt = Date.now();
    logger.error(`${friendly[j.type] || j.type} failed${j.storyLabel ? ` (${j.storyLabel})` : ''}: ${j.errorMessage}`);
  }
}

async function workerLoop() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const next = jobs.find((j) => j.status === 'pending');
      if (!next) {
        running = false;
        return;
      }
      await runJob(next);
    }
  } finally {
    running = false;
  }
}

export function tick() {
  if (!running) void workerLoop();
}

setInterval(
  () => {
    cleanupJobs();
  },
  60 * 60 * 1000
);
