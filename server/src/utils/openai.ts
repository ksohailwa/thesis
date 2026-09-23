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

const TTS_ABBREVIATIONS: Record<string, string> = {
  'mr.': 'Mister',
  'mrs.': 'Missus',
  'ms.': 'Ms',
  'dr.': 'Doctor',
  'prof.': 'Professor',
  'sr.': 'Senior',
  'jr.': 'Junior',
  'etc.': 'et cetera',
  'e.g.': 'for example',
  'i.e.': 'that is',
};

export function normalizeTtsText(text: string): string {
  return text.replace(/\b(?:mr|mrs|ms|dr|prof|sr|jr|etc|e\.g|i\.e)\./gi, (match) =>
    TTS_ABBREVIATIONS[match.toLowerCase()] || match
  );
}

// Helper to generate TTS for a single sentence of text.
export async function generateSentenceTTS(opts: {
  client: OpenAI;
  text: string;
  model?: string;
  voice?: string;
}) {
  const { client, text, model, voice } = opts;
  const params: OpenAI.Audio.SpeechCreateParams = {
    model: model || process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
    voice: voice || process.env.OPENAI_TTS_VOICE || 'nova',
    input: normalizeTtsText(text),
  };
  const resp = await client.audio.speech.create(params);
  const buf = Buffer.from(await resp.arrayBuffer());
  return buf;
}
