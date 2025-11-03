import OpenAI from 'openai';
import { config } from '../config';

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI | null {
  if (!config.openaiApiKey) return null;
  if (!client) client = new OpenAI({ apiKey: config.openaiApiKey });
  return client;
}

