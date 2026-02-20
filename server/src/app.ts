import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'path';
import mongoose from 'mongoose';
import { config, validateConfig } from './config';
import logger from './utils/logger';
import { AppError, isAppError } from './utils/AppError';
import { RATE_LIMIT, DATA_LIMITS } from './constants';

import authRouter from './routes/auth';
import storiesRouter from './routes/stories';
import experimentsRouter from './routes/experiments';
import simpleRouter from './routes/simple';
import studentRouter from './routes/student';
import studentExtraRouter from './routes/studentExtra';
import analyticsRouter from './routes/analytics';
import demoRouter from './routes/demo';
import demoLoginRouter from './routes/demoLogin';
import jobsRouter from './routes/jobs';
import { setupSwagger } from './swagger';

const env = process.env.NODE_ENV || 'development';
// Base path for production deployment (e.g., /SpellWise)
const BASE_PATH = env === 'production' ? '/SpellWise' : '';

const configValidation = validateConfig();
if (!configValidation.ok) {
  logger.error('Configuration errors', { errors: configValidation.errors });
  process.exit(1);
}
configValidation.warnings.forEach((w) => logger.warn(w));
const app = express();

// Security headers (must be first)
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled for Vite dev (inline scripts). Production should enable CSP.
    crossOriginEmbedderPolicy: false, // Allow audio file loading from /static
  })
);

app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-refresh', 'x-refresh-token'],
  })
);
app.use(express.json({ limit: DATA_LIMITS.JSON_LIMIT }));
app.use(cookieParser());

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: RATE_LIMIT.AUTH_WINDOW_MS,
  max: RATE_LIMIT.AUTH_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: false,
});

if (env !== 'development') {
  app.use(`${BASE_PATH}/api/auth/`, authLimiter);
}

// HTTP request logging (clean, readable format; skip noisy polling requests)
app.use(
  morgan(
    (tokens, req, res) => {
      const method = tokens.method(req, res);
      const url = tokens.url(req, res);
      const status = tokens.status(req, res);
      const time = tokens['response-time'](req, res);
      return `${method} ${url} → ${status} (${Math.round(Number(time))}ms)`;
    },
    {
      stream: { write: (message: string) => logger.info(message.trim()) },
      skip: (req) => req.method === 'GET' && req.url?.startsWith('/api/jobs/'),
    }
  )
);

app.get(`${BASE_PATH}/api/health`, (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus =
    ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';

  const health = {
    ok: dbState === 1,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: env,
    version: process.env.npm_package_version || '0.1.0',
    database: {
      connected: dbState === 1,
      status: dbStatus,
    },
    services: {
      openai: !!config.openaiApiKey,
      tts: config.ttsProvider,
    },
    memory: {
      usedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      totalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      percentage: Math.round(
        (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
      ),
    },
  };

  res.status(health.ok ? 200 : 503).json(health);
});

app.use(`${BASE_PATH}/api/auth`, authRouter);
app.use(`${BASE_PATH}/api/stories`, storiesRouter);
app.use(`${BASE_PATH}/api/experiments`, experimentsRouter);
app.use(`${BASE_PATH}/api/simple`, simpleRouter);
app.use(`${BASE_PATH}/api/student`, studentRouter);
app.use(`${BASE_PATH}/api/student`, studentExtraRouter);
app.use(`${BASE_PATH}/api/analytics`, analyticsRouter);
app.use(`${BASE_PATH}/api`, demoRouter);
app.use(`${BASE_PATH}/api`, demoLoginRouter);
app.use(`${BASE_PATH}/api/jobs`, jobsRouter);

// API Documentation
setupSwagger(app);

// Static audio hosting
const audioDir = path.join(process.cwd(), 'static', 'audio');
const staticDir = path.join(process.cwd(), 'static');

app.use(
  `${BASE_PATH}/static/audio`,
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(audioDir, { acceptRanges: true, fallthrough: true })
);
app.use(`${BASE_PATH}/static`, express.static(staticDir));

// Serve client build in production
const clientDir = path.join(process.cwd(), 'server', 'static', 'client');
if (env === 'production') {
  app.use(`${BASE_PATH}`, express.static(clientDir));

  // SPA fallback - serve index.html for client-side routes
  app.get(`${BASE_PATH}/*`, (req, res, next) => {
    // Skip API and static routes
    if (req.path.includes('/api') || req.path.includes('/static')) {
      return next();
    }
    res.sendFile(path.join(clientDir, 'index.html'));
  });

  // Redirect root to /SpellWise/
  app.get('/', (_req, res) => {
    res.redirect(`${BASE_PATH}/`);
  });
}

// 404 handler for unknown API routes
app.use((req, res) => {
  logger.warn('Route not found', { method: req.method, path: req.path });
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler (must be last)
app.use(
  (err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const isDev = process.env.NODE_ENV !== 'production';
    let appErr: AppError;

    if (isAppError(err)) {
      appErr = err;
    } else if (err instanceof Error) {
      appErr = new AppError(err.message, 500, isDev);
    } else {
      appErr = new AppError('Unknown error', 500, isDev);
    }

    logger.error('Unhandled error', {
      error: appErr.message,
      stack: appErr.stack,
      statusCode: appErr.statusCode,
      method: req.method,
      path: req.path,
    });

    res.status(appErr.statusCode).json(appErr.toJSON());
  }
);

export { app };
