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

// Helper to generate TTS for a single sentence of text.
export async function generateSentenceTTS(opts: {
  client: OpenAI;
  text: string;
  model?: string;
  voice?: string;
}) {
  const { client, text, model, voice } = opts;
  const resp = await client.audio.speech.create({
    model: model || process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
    voice: voice || process.env.OPENAI_TTS_VOICE || 'nova',
    input: text,
  } as any);
  const buf = Buffer.from(await resp.arrayBuffer());
  return buf;
}
