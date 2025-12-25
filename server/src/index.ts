import mongoose from 'mongoose';
import { Server } from 'http';
import { app } from './app';
import { config } from './config';
import { connectDB } from './db';
import logger from './utils/logger';

const env = process.env.NODE_ENV || 'development';
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
