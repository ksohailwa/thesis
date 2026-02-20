import mongoose from 'mongoose';
import { config } from './config';
import logger from './utils/logger';

export async function connectDB(retries = 5, delay = 5000) {
  let attempt = 0;

  while (attempt < retries) {
    try {
      if (!config.mongoUri) {
        logger.warn('No MONGO_URI set; skipping DB connection');
        return;
      }

      await mongoose.connect(config.mongoUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      logger.info(`Database connected (${config.mongoUri.replace(/\/\/.*@/, '//*****@')})`);

      mongoose.connection.on('error', (err) => {
        logger.error(`Database error: ${err}`);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
      });

      return;
    } catch (e) {
      attempt++;
      logger.error(`Database connection attempt ${attempt}/${retries} failed — ${attempt < retries ? `retrying in ${delay / 1000}s` : 'giving up'}`);

      if (attempt >= retries) {
        logger.error('MongoDB connection failed after all retries; continuing without DB');
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
