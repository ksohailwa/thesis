import bcrypt from 'bcryptjs';
import { AuthService } from '../services/auth.service';
import { User } from '../models/User';
import { verifyAccess, verifyRefresh } from '../utils/jwt';

// Mock dependencies
jest.mock('../models/User');
jest.mock('../utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockLogger,
  };
});

const mockUser = {
  _id: 'user123',
  email: 'test@example.com',
  username: 'testuser',
  passwordHash: '',
  role: 'teacher' as const,
  consentAt: null,
};

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('should create a new user with hashed password', async () => {
      const email = 'new@example.com';
      const password = 'password123';
      const role = 'teacher' as const;

      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.create as jest.Mock).mockResolvedValue({
        _id: 'newuser123',
        email: email.toLowerCase(),
        role,
      });

      const result = await authService.signup(email, password, role);

      expect(User.findOne).toHaveBeenCalledWith({ email: email.toLowerCase() });
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: email.toLowerCase(),
          role,
          passwordHash: expect.any(String),
        })
      );
      expect(result).toEqual({ id: 'newuser123' });
    });

    it('should normalize email to lowercase and trim whitespace', async () => {
      const email = '  TEST@EXAMPLE.COM  ';

      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.create as jest.Mock).mockResolvedValue({
        _id: 'user123',
        email: 'test@example.com',
        role: 'teacher',
      });

      await authService.signup(email, 'password', 'teacher');

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });

    it('should throw error if email already registered', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);

      await expect(authService.signup('test@example.com', 'password', 'teacher')).rejects.toThrow(
        'Email already registered'
      );
    });
  });

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);

      (User.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
      });

      const result = await authService.login('test@example.com', password);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
    });

    it('should throw error for non-existent user', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);

      await expect(authService.login('nonexistent@example.com', 'password')).rejects.toThrow(
        'Invalid credentials'
      );
    });

    it('should throw error for wrong password', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);

      (User.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
      });

      await expect(authService.login('test@example.com', 'wrongpassword')).rejects.toThrow(
        'Invalid credentials'
      );
    });

    it('should normalize email to lowercase', async () => {
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);

      (User.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
      });

      await authService.login('TEST@EXAMPLE.COM', password);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });
  });

  describe('refresh', () => {
    it('should return new tokens for valid refresh token', async () => {
      // First login to get a valid refresh token
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);

      (User.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
      });

      const loginResult = await authService.login('test@example.com', password);

      // Now test refresh
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      const refreshResult = await authService.refresh(loginResult.refreshToken);

      expect(refreshResult).toHaveProperty('accessToken');
      expect(refreshResult).toHaveProperty('refreshToken');
      expect(refreshResult).toHaveProperty('user');
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(authService.refresh('invalid-token')).rejects.toThrow('Invalid refresh');
    });

    it('should throw error if user not found', async () => {
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);

      (User.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
      });

      const loginResult = await authService.login('test@example.com', password);

      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(authService.refresh(loginResult.refreshToken)).rejects.toThrow('Invalid refresh');
    });
  });

  describe('demoLogin', () => {
    it('should return demo token with correct payload', async () => {
      const result = await authService.demoLogin();

      expect(result).toHaveProperty('accessToken');
      expect(result.role).toBe('student');
      expect(result.email).toBe('demo@spellwise.local');
      expect(result.username).toBe('demo-student');
      expect(result.demo).toBe(true);

      // Verify the token contains demo flag
      const decoded = verifyAccess(result.accessToken) as any;
      expect(decoded.demo).toBe(true);
      expect(decoded.role).toBe('student');
    });
  });

  describe('studentSignup', () => {
    it('should create a new student user', async () => {
      const username = 'newstudent';
      const password = 'password123';

      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.create as jest.Mock).mockResolvedValue({
        _id: 'student123',
        username,
        role: 'student',
      });

      const result = await authService.studentSignup(username, password);

      expect(User.findOne).toHaveBeenCalledWith({ username, role: 'student' });
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username,
          role: 'student',
          passwordHash: expect.any(String),
        })
      );
      expect(result).toEqual({
        id: 'student123',
        username,
        newUser: true,
        consented: false,
      });
    });

    it('should throw error if username already exists', async () => {
      (User.findOne as jest.Mock).mockResolvedValue({
        _id: 'existing123',
        username: 'existingstudent',
        role: 'student',
      });

      await expect(authService.studentSignup('existingstudent', 'password')).rejects.toThrow(
        'Username already registered'
      );
    });
  });

  describe('studentLogin', () => {
    it('should auto-create student if not exists', async () => {
      const username = 'newstudent';
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);

      (User.findOne as jest.Mock)
        .mockResolvedValueOnce(null) // First call - user doesn't exist
        .mockResolvedValueOnce(null); // Not used in this path

      (User.create as jest.Mock).mockResolvedValue({
        _id: 'student123',
        username,
        passwordHash: hashedPassword,
        role: 'student',
        consentAt: null,
      });

      const result = await authService.studentLogin(username, password);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.newUser).toBe(true);
      expect(result.role).toBe('student');
    });

    it('should login existing student with valid password', async () => {
      const username = 'existingstudent';
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);

      const existingUser = {
        _id: 'student123',
        username,
        passwordHash: hashedPassword,
        role: 'student',
        consentAt: new Date(),
      };

      // Reset and set up fresh mock - user exists so no creation needed
      (User.findOne as jest.Mock).mockReset();
      (User.create as jest.Mock).mockReset();
      (User.findOne as jest.Mock).mockResolvedValue(existingUser);

      const result = await authService.studentLogin(username, password);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.newUser).toBe(false);
      expect(result.consented).toBe(true);
      expect(result.role).toBe('student');
      // Verify no user was created since user already existed
      expect(User.create).not.toHaveBeenCalled();
    });

    it('should throw error for wrong password on existing student', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);

      (User.findOne as jest.Mock).mockResolvedValue({
        _id: 'student123',
        username: 'student',
        passwordHash: hashedPassword,
        role: 'student',
      });

      await expect(authService.studentLogin('student', 'wrongpassword')).rejects.toThrow(
        'Invalid credentials'
      );
    });
  });

  describe('token validation', () => {
    it('should generate valid access tokens', async () => {
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);

      (User.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
      });

      const result = await authService.login('test@example.com', password);
      const decoded = verifyAccess(result.accessToken) as any;

      expect(decoded.sub).toBe('user123');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.role).toBe('teacher');
    });

    it('should generate valid refresh tokens', async () => {
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);

      (User.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
      });

      const result = await authService.login('test@example.com', password);
      const decoded = verifyRefresh(result.refreshToken) as any;

      expect(decoded.sub).toBe('user123');
    });
  });
});
