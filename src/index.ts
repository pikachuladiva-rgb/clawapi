import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { logger as pinoLogger } from './logger.js';
import { config } from './config.js';
import { authMiddleware } from './auth/middleware.js';
import { adminRoutes } from './api/admin.js';
import { projectRoutes } from './api/projects.js';
import { sessionRoutes } from './api/sessions.js';
import { messageRoutes } from './api/messages.js';
import { usageRoutes } from './api/usage.js';
import { orgsQ } from './db/queries/orgs.js';
import { generateApiKey, hashApiKey, getKeyPrefix } from './auth/keys.js';
import type { AppEnv } from './types.js';

const app = new Hono();

// Serve static files from public/ directory (root is relative to cwd = /home/ubuntu/clawapi)
app.use('/*', serveStatic({ root: './public' }));

// Redirect /admin -> /admin.html
app.get('/admin', (c) => c.redirect('/admin.html'));

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Bootstrap: create first org without auth (only works when no orgs exist)
app.post('/v1/bootstrap', async (c) => {
  const existing = await orgsQ.list();
  if (existing.length > 0) return c.json({ error: 'Already bootstrapped' }, 403);
  const { name } = await c.req.json();
  if (!name) return c.json({ error: 'name required' }, 400);
  const rawKey = generateApiKey();
  const org = await orgsQ.create(name, hashApiKey(rawKey), getKeyPrefix(rawKey));
  return c.json({ ...org, api_key: rawKey }, 201);
});

// All routes require auth
const api = new Hono<AppEnv>();
api.use('*', authMiddleware);

api.route('/admin', adminRoutes);
api.route('/projects', projectRoutes);
api.route('/projects', sessionRoutes);
api.route('/projects', messageRoutes);
api.route('/usage', usageRoutes);

app.route('/v1', api);

serve({ fetch: app.fetch, port: config.PORT }, () => {
  pinoLogger.info(`ClawAPI running on port ${config.PORT}`);
});
