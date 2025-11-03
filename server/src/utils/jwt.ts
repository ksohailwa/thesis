import { sign, verify, Secret } from 'jsonwebtoken';
import { config } from '../config';

export function signAccessToken(payload: object, expiresIn = '30m') {
  return sign(payload as any, config.jwtAccessSecret as Secret, { expiresIn } as any);
}

export function signRefreshToken(payload: object, expiresIn = '7d') {
  return sign(payload as any, config.jwtRefreshSecret as Secret, { expiresIn } as any);
}

export function verifyAccess(token: string) {
  return verify(token, config.jwtAccessSecret as Secret);
}

export function verifyRefresh(token: string) {
  return verify(token, config.jwtRefreshSecret as Secret);
}
