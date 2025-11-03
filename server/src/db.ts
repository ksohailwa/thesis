import mongoose from 'mongoose';
import { config } from './config';

export async function connectDB() {
  try {
    if (!config.mongoUri) { console.warn('No MONGO_URI set; skipping DB connection'); return; }
    await mongoose.connect(config.mongoUri);
    console.log('Mongo connected');
  } catch (e) {
    console.warn('Mongo connection failed; continuing without DB');
  }
}
