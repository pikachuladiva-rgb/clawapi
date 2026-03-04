import { createHash, randomBytes } from 'crypto';

export function generateApiKey(): string {
  return 'claw_' + randomBytes(36).toString('base64url');
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function getKeyPrefix(key: string): string {
  return key.slice(0, 12);
}
