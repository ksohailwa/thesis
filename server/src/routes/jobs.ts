import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { enqueue, getJob, getJobsForExperiment, JobType } from '../queue';
import { createHeavyLimiter } from '../middleware/rateLimiters';

const router = Router();
const jobLimiter = createHeavyLimiter({
  max: 4,
  message: 'Please wait a few seconds before queuing another generation job.',
});

router.post('/', requireAuth, requireRole('teacher'), jobLimiter, async (req: AuthedRequest, res) => {
  const schema = z.object({
    type: z.enum(['fetch_words', 'generate_story', 'generate_tts']),
    experimentId: z.string(),
    storyLabel: z.enum(['story1', 'story2']).optional(),
    targetWords: z.array(z.string()).min(1).max(10).optional(),
    regenerate: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const job = enqueue({
    type: parsed.data.type as JobType,
    experimentId: parsed.data.experimentId,
    storyLabel: parsed.data.storyLabel,
    targetWords: parsed.data.targetWords,
    regenerate: parsed.data.regenerate,
  });
  return res.json({ id: job.id, status: job.status });
});

router.get('/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  const j = getJob(req.params.id);
  if (!j) return res.status(404).json({ error: 'Not found' });
  return res.json(j);
});

router.get('/experiment/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  const list = getJobsForExperiment(req.params.id);
  return res.json(list);
});

// Summarized per-experiment status for frontend polling
router.get('/experiment/:id/status', requireAuth, requireRole('teacher'), async (req, res) => {
  const list = getJobsForExperiment(req.params.id);
  function latestStatus(filter: (j: any) => boolean): 'idle' | 'generating' | 'success' | 'error' {
    const j = [...list].reverse().find(filter);
    if (!j) return 'idle';
    if (j.status === 'success') return 'success';
    if (j.status === 'error') return 'error';
    return 'generating';
  }
  const words = latestStatus((j) => j.type === 'fetch_words');
  const s1 = latestStatus((j) => j.type === 'generate_story' && j.storyLabel === 'story1');
  const s2 = latestStatus((j) => j.type === 'generate_story' && j.storyLabel === 'story2');
  const tts1 = latestStatus((j) => j.type === 'generate_tts' && j.storyLabel === 'story1');
  const tts2 = latestStatus((j) => j.type === 'generate_tts' && j.storyLabel === 'story2');
  res.json({ words, s1, s2, tts1, tts2 });
});

export default router;
