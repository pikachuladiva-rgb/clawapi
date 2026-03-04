import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

const clients = new Map<string, Anthropic>();

export function getClient(baseUrl?: string | null, apiKey?: string | null): Anthropic {
  const key = apiKey || config.ANTHROPIC_API_KEY;
  const url = baseUrl || undefined;
  const cacheKey = `${url || 'default'}:${key.slice(0, 8)}`;

  if (!clients.has(cacheKey)) {
    clients.set(cacheKey, new Anthropic({
      apiKey: key,
      baseURL: url,
      defaultHeaders: { 'User-Agent': 'anthropic-sdk-typescript/0.27.0' },
    }));
  }
  return clients.get(cacheKey)!;
}
