import { Hono } from 'hono';
import { orgsQ } from '../db/queries/orgs.js';
import { generateApiKey, hashApiKey, getKeyPrefix } from '../auth/keys.js';
import type { AppEnv } from '../types.js';

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.post('/orgs', async (c) => {
  const { name } = await c.req.json();
  if (!name) return c.json({ error: 'name required' }, 400);

  const rawKey = generateApiKey();
  const org = await orgsQ.create(name, hashApiKey(rawKey), getKeyPrefix(rawKey));
  return c.json({ ...org, api_key: rawKey }, 201);
});

adminRoutes.get('/orgs', async (c) => {
  return c.json(await orgsQ.list());
});
