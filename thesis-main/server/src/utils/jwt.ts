import { sign, verify, Secret, SignOptions, JwtPayload } from 'jsonwebtoken';
import { config } from '../config';

export function signAccessToken(payload: Record<string, unknown>, expiresIn = '30m') {
  const options: SignOptions = { expiresIn: expiresIn as any };
  return sign(payload, config.jwtAccessSecret as Secret, options);
}

export function signRefreshToken(payload: Record<string, unknown>, expiresIn = '7d') {
  const options: SignOptions = { expiresIn: expiresIn as any };
  return sign(payload, config.jwtRefreshSecret as Secret, options);
}

export function verifyAccess(token: string): string | JwtPayload {
  return verify(token, config.jwtAccessSecret as Secret);
}

export function verifyRefresh(token: string): string | JwtPayload {
  return verify(token, config.jwtRefreshSecret as Secret);
}
