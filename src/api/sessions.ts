import { Hono } from 'hono';
import { sessionsQ } from '../db/queries/sessions.js';
import { messagesQ } from '../db/queries/messages.js';
import { projectsQ } from '../db/queries/projects.js';
import type { AppEnv } from '../types.js';

export const sessionRoutes = new Hono<AppEnv>();

sessionRoutes.post('/:pid/sessions', async (c) => {
  const auth = c.get('auth');
  const project = await projectsQ.get(auth.orgId, c.req.param('pid'));
  if (!project) return c.json({ error: 'Project not found' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const session = await sessionsQ.create(project.id, body);
  return c.json(session, 201);
});

sessionRoutes.get('/:pid/sessions', async (c) => {
  const auth = c.get('auth');
  const project = await projectsQ.get(auth.orgId, c.req.param('pid'));
  if (!project) return c.json({ error: 'Project not found' }, 404);
  return c.json(await sessionsQ.list(project.id));
});

sessionRoutes.get('/:pid/sessions/:sid', async (c) => {
  const auth = c.get('auth');
  const project = await projectsQ.get(auth.orgId, c.req.param('pid'));
  if (!project) return c.json({ error: 'Project not found' }, 404);
  const session = await sessionsQ.get(project.id, c.req.param('sid'));
  if (!session) return c.json({ error: 'Session not found' }, 404);
  const messages = await messagesQ.listBySession(session.id);
  return c.json({ ...session, messages });
});

sessionRoutes.delete('/:pid/sessions/:sid', async (c) => {
  const auth = c.get('auth');
  const project = await projectsQ.get(auth.orgId, c.req.param('pid'));
  if (!project) return c.json({ error: 'Project not found' }, 404);
  const session = await sessionsQ.delete(project.id, c.req.param('sid'));
  if (!session) return c.json({ error: 'Session not found' }, 404);
  return c.json({ deleted: true });
});
