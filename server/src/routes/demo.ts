import { Router } from 'express';
import { Experiment } from '../models/Experiment';

const router = Router();

router.get('/demo', async (_req, res) => {
  const list = await Experiment.find({}).sort({ createdAt: -1 }).limit(5).select('_id title level targetWords');
  const items = list.map(e => ({ id: String(e._id), title: e.title, level: e.level, targetWordsCount: (e.targetWords || []).length, description: '' }));
  res.json(items);
});

export default router;

