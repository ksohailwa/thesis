import { AuthedRequest } from './auth';
import { Response, NextFunction } from 'express';

const userLimits = new Map<string, { count: number; resetAt: number }>();

export const userRateLimit = (maxRequests: number, windowMinutes: number) => {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.sub;
    if (!userId) return next();
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;
    const record = userLimits.get(userId);
    if (!record || now > record.resetAt) {
      userLimits.set(userId, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (record.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please wait before trying again.',
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      });
    }
    record.count += 1;
    next();
  };
};

setInterval(() => {
  const now = Date.now();
  for (const [userId, limit] of userLimits.entries()) {
    if (now > limit.resetAt + 3600000) userLimits.delete(userId);
  }
}, 3600000);
