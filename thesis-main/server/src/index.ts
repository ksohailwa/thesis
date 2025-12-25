import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'path';
import { Server } from 'http';
import mongoose from 'mongoose';
import { config, validateConfig } from './config';
import { connectDB } from './db';
import logger from './utils/logger';

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
    contentSecurityPolicy: false, // Disabled for Vite dev (inline scripts)
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
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Stricter rate limiting for auth endpoints - 10 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 auth attempts
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
    const errObj = err as {
      message?: string;
      stack?: string;
      statusCode?: number;
      status?: number;
    };
    const errMessage = errObj?.message || 'Unknown error';
    logger.error('Unhandled error', {
      error: errMessage,
      stack: errObj?.stack,
      method: req.method,
      path: req.path,
      body: req.body,
    });

    const statusCode = errObj?.statusCode || errObj?.status || 500;
    res.status(statusCode).json({
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : errMessage,
      ...(process.env.NODE_ENV !== 'production' && { stack: errObj?.stack }),
    });
  }
);

export { app };

let server: Server | null = null;

async function start() {
  try {
    await connectDB();
    server = app.listen(config.port, () => {
      logger.info(`Server listening on http://localhost:${config.port}`);
      logger.info(`Environment: ${env}`);
      logger.info(`CORS Origin: ${config.corsOrigin}`);
    });
  } catch (e) {
    logger.error('Startup error', { error: e });
    process.exit(1);
  }
}

async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  if (server) {
    server.close(() => logger.info('HTTP server closed'));
  }
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (err) {
    logger.error('Error closing MongoDB', { error: err });
  }
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();
