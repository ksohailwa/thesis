import { Request, Response, NextFunction } from 'express';
import { verifyAccess } from '../utils/jwt';
import { config } from '../config';

type UserClaims = {
  sub: string;
  role: 'teacher' | 'student';
  email?: string;
  username?: string;
  demo?: boolean;
};

export interface AuthedRequest extends Request {
  user?: UserClaims;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const internalSecret = req.headers['x-internal-job'];
  if (internalSecret && internalSecret === config.internalJobSecret) {
    req.user = { sub: 'internal-job', role: 'teacher', email: 'job@internal' };
    return next();
  }

  if (config.devNoAuth) {
    const roleHeader = String(req.headers['x-dev-role'] || '').toLowerCase();
    const role: UserClaims['role'] = roleHeader === 'student' ? 'student' : 'teacher';
    req.user = { sub: 'dev-user', role, email: `${role}@dev.local` };
    return next();
  }
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });
  const token = auth.replace('Bearer ', '');
  try {
    const payload = verifyAccess(token);
    if (typeof payload === 'string') {
      req.user = { sub: payload, role: 'teacher' };
    } else {
      const role: UserClaims['role'] = payload.role === 'student' ? 'student' : 'teacher';
      const sub = String(payload.sub || '');
      if (!sub) return res.status(401).json({ error: 'Invalid token' });
      req.user = {
        sub,
        role,
        email: payload.email ? String(payload.email) : undefined,
        username: payload.username ? String(payload.username) : undefined,
        demo: payload.demo === true,
      };
    }
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
