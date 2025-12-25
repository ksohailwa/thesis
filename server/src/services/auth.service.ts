import bcrypt from 'bcryptjs';
import { User, IUser } from '../models/User';
import { signAccessToken, signRefreshToken, verifyRefresh } from '../utils/jwt';
import logger from '../utils/logger';
import { config } from '../config';

export class AuthService {
  async signup(email: string, password: string, role: 'teacher' | 'student') {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw new Error('Email already registered');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email: normalizedEmail, passwordHash, role });
    logger.info('User signed up', { userId: user._id, email: user.email, role: user.role });
    return { id: user._id };
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      throw new Error('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new Error('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  async refresh(token: string) {
    try {
      const payload = verifyRefresh(token);
      const sub = typeof payload === 'string' ? payload : payload.sub;
      const user = sub ? await User.findById(sub) : null;
      if (!user) throw new Error('Invalid refresh token');

      const accessToken = signAccessToken({
        sub: String(user._id),
        email: user.email,
        username: user.username,
        role: user.role,
      });
      const newRefreshToken = signRefreshToken({ sub: String(user._id) });

      return { accessToken, refreshToken: newRefreshToken, user };
    } catch (e) {
      logger.warn('Token refresh failed', { error: e });
      throw new Error('Invalid refresh');
    }
  }

  async demoLogin() {
    const payload = {
      sub: 'demo-student',
      email: 'demo@spellwise.local',
      username: 'demo-student',
      role: 'student',
      demo: true,
    };
    const accessToken = signAccessToken(payload, '2h');
    logger.info('Demo login created');
    return {
      accessToken,
      role: 'student',
      email: payload.email,
      username: payload.username,
      demo: true,
    };
  }

  async studentSignup(username: string, password: string) {
    const existing = await User.findOne({ username, role: 'student' });
    if (existing) {
      throw new Error('Username already registered');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash, role: 'student' });
    logger.info('Student signed up', { userId: user._id, username: user.username });
    return { id: user._id, username: user.username, newUser: true, consented: false };
  }

  async studentLogin(username: string, password: string) {
    let user = await User.findOne({ username, role: 'student' });
    let created = false;

    if (!user) {
      try {
        const passwordHash = await bcrypt.hash(password, 10);
        user = await User.create({ username, passwordHash, role: 'student' });
        created = true;
        logger.info('Student auto-created', { userId: user._id, username: user.username });
      } catch (e: any) {
        if (e.code === 11000) {
          // Concurrent creation
          user = await User.findOne({ username, role: 'student' });
        }
        if (!user) {
          throw new Error('Unable to register student');
        }
      }
    }
    // Logic if user was found but might be null if catch block failed?
    // Typescript might complain 'user' is possibly null here if not handled carefully.
    // Re-checking user
    if (!user) throw new Error('Login failed');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new Error('Invalid credentials');

    const tokens = this.generateTokens(user);
    return {
      ...tokens,
      role: user.role,
      username: user.username,
      consented: !!user.consentAt,
      newUser: created,
    };
  }

  private generateTokens(user: IUser) {
    const accessToken = signAccessToken({
      sub: String(user._id),
      email: user.email,
      username: user.username,
      role: user.role,
    });
    const refreshToken = signRefreshToken({ sub: String(user._id) });

    return { accessToken, refreshToken, user };
  }
}
