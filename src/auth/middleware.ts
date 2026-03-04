import { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import { hashApiKey, getKeyPrefix } from './keys.js';
import { orgsQ } from '../db/queries/orgs.js';
import { config } from '../config.js';

export type AuthContext = { orgId: string; projectId?: string; userId?: string; authType: 'apikey' | 'jwt' };

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) return c.json({ error: 'Missing authorization' }, 401);

  const token = header.slice(7);

  if (token.startsWith('claw_')) {
    const hash = hashApiKey(token);
    const org = await orgsQ.findByKeyHash(hash);
    if (!org) return c.json({ error: 'Invalid API key' }, 401);
    c.set('auth', { orgId: org.id, authType: 'apikey' } as AuthContext);
  } else {
    try {
      const payload = jwt.verify(token, config.JWT_SECRET) as { orgId: string; projectId: string; userId?: string };
      c.set('auth', { orgId: payload.orgId, projectId: payload.projectId, userId: payload.userId, authType: 'jwt' } as AuthContext);
    } catch {
      return c.json({ error: 'Invalid token' }, 401);
    }
  }

  await next();
}

export function signJwt(orgId: string, projectId: string, userId?: string): string {
  return jwt.sign({ orgId, projectId, userId }, config.JWT_SECRET, { expiresIn: '24h' });
}
