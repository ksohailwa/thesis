import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic | null {
  if (!config.anthropicApiKey) return null;
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

export const ANTHROPIC_MODEL = config.anthropicModel || 'claude-sonnet-4-20250514';
