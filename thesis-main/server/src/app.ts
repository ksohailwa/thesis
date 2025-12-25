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

const env = process.env.NODE_ENV || 'development';
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
  app.use('/api/auth/', authLimiter);
}

// HTTP request logging
app.use(
  morgan('combined', {
    stream: { write: (message: string) => logger.info(message.trim()) },
  })
);

app.get('/api/health', (_req, res) => {
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

app.use('/api/auth', authRouter);
app.use('/api/stories', storiesRouter);
app.use('/api/experiments', experimentsRouter);
app.use('/api/simple', simpleRouter);
app.use('/api/student', studentRouter);
app.use('/api/student', studentExtraRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api', demoRouter);
app.use('/api', demoLoginRouter);
app.use('/api/jobs', jobsRouter);

// Static audio hosting
const audioDir = path.join(process.cwd(), 'static', 'audio');
const staticDir = path.join(process.cwd(), 'static');

app.use(
  '/static/audio',
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(audioDir, { acceptRanges: true, fallthrough: true })
);
app.use('/static', express.static(staticDir));

// 404 handler for unknown routes
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
