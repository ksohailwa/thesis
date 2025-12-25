import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { signAccessToken, signRefreshToken, verifyRefresh } from '../utils/jwt';
import logger from '../utils/logger';
import { config } from '../config';

const router = Router();

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['teacher', 'student']),
});

router.post('/signup', async (req, res) => {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { password, role, email } = parsed.data;
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email: normalizedEmail, passwordHash, role });
  logger.info('User signed up', { userId: user._id, email: user.email, role: user.role });
  return res.json({ id: user._id });
});

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

router.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid email or password format' });
  const email = String(parsed.data.email || '')
    .trim()
    .toLowerCase();
  const password = String(parsed.data.password || '');
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const accessToken = signAccessToken({
    sub: String(user._id),
    email: user.email,
    username: user.username,
    role: user.role,
  });
  const refreshToken = signRefreshToken({ sub: String(user._id) });
  res.cookie('refresh', refreshToken, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  logger.info('User logged in', { userId: user._id, email: user.email, role: user.role });
  return res.json({
    accessToken,
    refreshToken: config.allowRefreshTokenInResponse ? refreshToken : undefined,
    role: user.role,
    email: user.email,
    username: user.username,
  });
});

router.post('/refresh', async (req, res) => {
  const headerToken = (req.headers['x-refresh'] || req.headers['x-refresh-token']) as
    | string
    | undefined;
  const token = headerToken || req.cookies?.refresh;
  if (!token) return res.status(401).json({ error: 'Missing refresh' });
  try {
    const payload = verifyRefresh(token);
    const sub = typeof payload === 'string' ? payload : payload.sub;
    const user = sub ? await User.findById(sub) : null;
    if (!user) return res.status(401).json({ error: 'Invalid refresh' });
    const accessToken = signAccessToken({
      sub: String(user._id),
      email: user.email,
      username: user.username,
      role: user.role,
    });
    const newRefreshToken = signRefreshToken({ sub: String(user._id) });
    res.cookie('refresh', newRefreshToken, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    logger.debug('Token refreshed', { userId: user._id });
    return res.json({
      accessToken,
      refreshToken: config.allowRefreshTokenInResponse ? newRefreshToken : undefined,
    });
  } catch (e) {
    logger.warn('Token refresh failed', { error: e });
    return res.status(401).json({ error: 'Invalid refresh' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('refresh');
  logger.debug('User logged out');
  res.json({ ok: true });
});

// Demo login (no signup) - short-lived student token with demo flag
router.post('/demo', async (_req, res) => {
  const payload = {
    sub: 'demo-student',
    email: 'demo@spellwise.local',
    username: 'demo-student',
    role: 'student',
    demo: true,
  };
  const accessToken = signAccessToken(payload, '2h');
  logger.info('Demo login created');
  return res.json({
    accessToken,
    role: 'student',
    email: payload.email,
    username: payload.username,
    demo: true,
  });
});

// Student-specific signup/login with username instead of email
const Username = z
  .string()
  .max(320)
  .regex(/^[A-Za-z0-9_]+$/);
const StudentSignupSchema = z.object({ username: Username, password: z.string().min(6) });
const StudentLoginSchema = z.object({ username: Username, password: z.string().min(6) });

// Student self-signup via username (no email)
router.post('/student/signup', async (_req, res) => {
  const parsed = StudentSignupSchema.safeParse(_req.body);
  if (!parsed.success)
    return res.status(400).json({ error: 'Invalid username or password format' });
  const { username, password } = parsed.data;
  const existing = await User.findOne({ username, role: 'student' });
  if (existing) return res.status(409).json({ error: 'Username already registered' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, passwordHash, role: 'student' });
  logger.info('Student signed up', { userId: user._id, username: user.username });
  return res.json({ id: user._id, username: user.username, newUser: true, consented: false });
});

router.post('/student/login', async (req, res) => {
  const parsed = StudentLoginSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: 'Invalid username or password format' });
  const { username, password } = parsed.data;

  let user = await User.findOne({ username, role: 'student' });
  let created = false;
  if (!user) {
    try {
      const passwordHash = await bcrypt.hash(password, 10);
      user = await User.create({ username, passwordHash, role: 'student' });
      created = true;
      logger.info('Student auto-created', { userId: user._id, username: user.username });
    } catch (e: unknown) {
      // Handle race: if username created concurrently, refetch and proceed
      const err = e as { code?: number };
      const dup = typeof err?.code === 'number' && err.code === 11000;
      if (!dup) {
        logger.error('Student registration failed', { error: err, username });
        return res.status(500).json({ error: 'Unable to register student' });
      }
      user = await User.findOne({ username, role: 'student' });
      if (!user) {
        logger.error('Student registration race condition failed', { username });
        return res.status(500).json({ error: 'Unable to register student' });
      }
      logger.warn('Student registration race condition recovered', { username });
    }
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const accessToken = signAccessToken({
    sub: String(user._id),
    username: user.username,
    role: user.role,
  });
  const refreshToken = signRefreshToken({ sub: String(user._id) });
  res.cookie('refresh', refreshToken, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  logger.info('Student logged in', { userId: user._id, username: user.username });
  return res.json({
    accessToken,
    refreshToken: config.allowRefreshTokenInResponse ? refreshToken : undefined,
    role: user.role,
    username: user.username,
    consented: !!user.consentAt,
    newUser: created,
  });
});

export default router;
