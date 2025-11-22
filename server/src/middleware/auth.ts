import { Request, Response, NextFunction } from 'express';
import { verifyAccess } from '../utils/jwt';
import { config } from '../config';

export interface AuthedRequest extends Request {
  user?: { sub: string; role: 'teacher' | 'student'; email: string } & Record<string, any>;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const internalSecret = req.headers['x-internal-job'];
  if (internalSecret && internalSecret === config.internalJobSecret) {
    req.user = { sub: 'internal-job', role: 'teacher', email: 'job@internal' } as any;
    return next();
  }

  if (config.devNoAuth) {
    const role = (req.headers['x-dev-role'] as any) === 'student' ? 'student' : 'teacher';
    req.user = { sub: 'dev-user', role, email: `${role}@dev.local` } as any;
    return next();
  }
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });
  const token = auth.replace('Bearer ', '');
  try {
    const payload = verifyAccess(token) as any;
    req.user = payload as any;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(role: 'teacher' | 'student') {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (config.devNoAuth) return next();
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}
