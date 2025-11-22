import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { config } from '../config';
import type { AuthedRequest } from './auth';

const defaultWindowMs = 60 * 1000;

export function createHeavyLimiter(options?: { windowMs?: number; max?: number; message?: string }) {
  return rateLimit({
    windowMs: options?.windowMs ?? defaultWindowMs,
    max: options?.max ?? 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: options?.message || 'Please wait before starting another generation task.',
    keyGenerator: (req: AuthedRequest & Request) => req.user?.sub || req.ip || 'anonymous',
    skip: (req) => req.headers['x-internal-job'] === config.internalJobSecret,
  });
}
