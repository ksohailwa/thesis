import OpenAI from 'openai';
import { config } from '../config';

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI | null {
  if (!config.openaiApiKey) return null;
  if (!client) {
    const timeoutMs = parseInt(process.env.OPENAI_TIMEOUT_MS || '60000', 10);
    client = new OpenAI({ apiKey: config.openaiApiKey, timeout: timeoutMs, maxRetries: 2 });
  }
  return client;
}
