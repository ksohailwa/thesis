import { Response, NextFunction } from 'express';
import { Experiment } from '../models/Experiment';
import { AuthedRequest } from './auth';
import { config } from '../config';

export function requireExperimentOwnership() {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (req.headers['x-internal-job'] === config.internalJobSecret) return next();
    const experimentId = req.params.id;
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const exp = await Experiment.findById(experimentId).select('owner');
      if (!exp) return res.status(404).json({ error: 'Experiment not found' });
      if (exp.owner && exp.owner.toString() !== userId)
        return res.status(403).json({ error: 'You do not own this experiment' });
      next();
    } catch (e) {
      return res.status(500).json({ error: 'Ownership check failed' });
    }
  };
}
