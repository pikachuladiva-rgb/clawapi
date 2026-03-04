import Redis from 'ioredis';
import { config } from '../config.js';

const redis = new Redis(config.REDIS_URL);

export async function checkRateLimit(projectId: string, limits: { rpm?: number; tpm?: number }): Promise<{ allowed: boolean; error?: string }> {
  const now = Date.now();
  const windowMs = 60_000;
  const key = `rl:${projectId}:rpm`;

  // RPM check
  if (limits.rpm) {
    await redis.zremrangebyscore(key, 0, now - windowMs);
    const count = await redis.zcard(key);
    if (count >= limits.rpm) return { allowed: false, error: 'Rate limit exceeded (RPM)' };
    await redis.zadd(key, now, `${now}:${Math.random()}`);
    await redis.expire(key, 120);
  }

  return { allowed: true };
}

export async function trackTokens(projectId: string, tokens: number) {
  const now = Date.now();
  const key = `rl:${projectId}:tpm`;
  await redis.zadd(key, now, `${now}:${tokens}`);
  await redis.expire(key, 120);
}
