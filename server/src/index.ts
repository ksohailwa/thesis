import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config.js';
import { connectDB } from './db.js';

import authRouter from './routes/auth.js';
import storiesRouter from './routes/stories.js';
import experimentsRouter from './routes/experiments.js';
import simpleRouter from './routes/simple.js';
import studentRouter from './routes/student.js';
import studentExtraRouter from './routes/studentExtra.js';
import analyticsRouter from './routes/analytics.js';
import demoRouter from './routes/demo.js';
import demoLoginRouter from './routes/demoLogin.js';

const app = express();
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/stories', storiesRouter);
app.use('/api/experiments', experimentsRouter);
app.use('/api/simple', simpleRouter);
app.use('/api/student', studentRouter);
app.use('/api/student', studentExtraRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api', demoRouter);
app.use('/api', demoLoginRouter);

// Static audio hosting
app.use('/static', express.static(path.join(process.cwd(), 'static')));
app.use('/static/audio', express.static(path.join(process.cwd(), 'static', 'audio')));

async function start() {
  try {
    await connectDB();
    app.listen(config.port, () => console.log(`Server listening on http://localhost:${config.port}`));
  } catch (e) {
    console.error('Startup error', e);
    process.exit(1);
  }
}

start();
