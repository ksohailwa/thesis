import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { config } from '../config';

const authService = new AuthService();

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['teacher', 'student']),
});

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });
const StudentSchema = z.object({
  username: z
    .string()
    .max(320)
    .regex(/^[A-Za-z0-9_]+$/),
  password: z.string().min(6),
});

export const signup = async (req: Request, res: Response) => {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const result = await authService.signup(
      parsed.data.email,
      parsed.data.password,
      parsed.data.role
    );
    res.json(result);
  } catch (e: any) {
    if (e.message === 'Email already registered') return res.status(409).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
};

export const login = async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid email or password format' });
  try {
    const { accessToken, refreshToken, user } = await authService.login(
      parsed.data.email,
      parsed.data.password
    );

    res.cookie('refresh', refreshToken, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    res.json({
      accessToken,
      refreshToken: config.allowRefreshTokenInResponse ? refreshToken : undefined,
      role: user.role,
      email: user.email,
      username: user.username,
    });
  } catch (e: any) {
    res.status(401).json({ error: e.message });
  }
};

export const refresh = async (req: Request, res: Response) => {
  const headerToken = (req.headers['x-refresh'] || req.headers['x-refresh-token']) as
    | string
    | undefined;
  const token = headerToken || req.cookies?.refresh;
  if (!token) return res.status(401).json({ error: 'Missing refresh' });

  try {
    const { accessToken, refreshToken } = await authService.refresh(token);
    res.cookie('refresh', refreshToken, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    res.json({
      accessToken,
      refreshToken: config.allowRefreshTokenInResponse ? refreshToken : undefined,
    });
  } catch (e: any) {
    res.status(401).json({ error: e.message });
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('refresh');
  res.json({ ok: true });
};

export const demo = async (_req: Request, res: Response) => {
  const result = await authService.demoLogin();
  res.json(result);
};

export const studentSignup = async (req: Request, res: Response) => {
  const parsed = StudentSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: 'Invalid username or password format' });
  try {
    const result = await authService.studentSignup(parsed.data.username, parsed.data.password);
    res.json(result);
  } catch (e: any) {
    if (e.message === 'Username already registered')
      return res.status(409).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
};

export const studentLogin = async (req: Request, res: Response) => {
  const parsed = StudentSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: 'Invalid username or password format' });
  try {
    const { accessToken, refreshToken, role, username, consented, newUser } =
      await authService.studentLogin(parsed.data.username, parsed.data.password);

    res.cookie('refresh', refreshToken, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    res.json({
      accessToken,
      refreshToken: config.allowRefreshTokenInResponse ? refreshToken : undefined,
      role,
      username,
      consented,
      newUser,
    });
  } catch (e: any) {
    res.status(401).json({ error: e.message });
  }
};
