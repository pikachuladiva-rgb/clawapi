import { Hono } from 'hono';
import { getOrgUsage, getProjectUsage } from '../billing/tracker.js';
import type { AppEnv } from '../types.js';

export const usageRoutes = new Hono<AppEnv>();

usageRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  return c.json(await getOrgUsage(auth.orgId));
});

usageRoutes.get('/projects/:pid', async (c) => {
  const auth = c.get('auth');
  return c.json(await getProjectUsage(auth.orgId, c.req.param('pid')));
});
