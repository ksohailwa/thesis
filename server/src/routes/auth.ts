import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { signAccessToken, signRefreshToken, verifyRefresh } from '../utils/jwt';

const router = Router();

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['teacher', 'student'])
});

router.post('/signup', async (req, res) => {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { password, role } = parsed.data as any;
  const email = String((parsed.data as any).email || '').trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash, role });
  return res.json({ id: user._id });
});

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

router.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid email or password format' });
  const email = String((parsed.data as any).email || '').trim().toLowerCase();
  const password = String((parsed.data as any).password || '');
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const accessToken = signAccessToken({ sub: String(user._id), email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ sub: String(user._id) });
  res.cookie('refresh', refreshToken, { httpOnly: true, sameSite: 'lax' });
  return res.json({ accessToken, role: user.role, email: user.email });
});

router.post('/refresh', async (req, res) => {
  const token = req.cookies?.refresh;
  if (!token) return res.status(401).json({ error: 'Missing refresh' });
  try {
    const payload = verifyRefresh(token) as any;
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Invalid refresh' });
    const accessToken = signAccessToken({ sub: String(user._id), email: user.email, role: user.role });
    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('refresh');
  res.json({ ok: true });
});

// Demo login (no signup) — short-lived student token with demo flag
router.post('/demo', async (_req, res) => {
  const payload = { sub: 'demo-student', email: 'demo@spellwise.local', role: 'student', demo: true } as any;
  const accessToken = signAccessToken(payload, '2h');
  return res.json({ accessToken, role: 'student', email: payload.email, demo: true });
});

export default router;
