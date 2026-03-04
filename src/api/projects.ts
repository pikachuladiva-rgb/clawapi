import { Hono } from 'hono';
import { projectsQ } from '../db/queries/projects.js';
import type { AppEnv } from '../types.js';

export const projectRoutes = new Hono<AppEnv>();

import fs from 'fs';
import path from 'path';

projectRoutes.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json();
  if (!body.name) return c.json({ error: 'name required' }, 400);

  // Generate a workspace path and create it
  const safeName = body.name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  const workspacePath = path.join(process.cwd(), 'data', 'workspaces', auth.orgId, safeName);

  if (!fs.existsSync(workspacePath)) {
    fs.mkdirSync(workspacePath, { recursive: true });
    fs.mkdirSync(path.join(workspacePath, '.claude'), { recursive: true });
    fs.writeFileSync(
      path.join(workspacePath, '.claude', 'CLAUDE.md'),
      `# Project: ${body.name}\n\nThis is the workspace for project ${body.name}.`
    );
  }

  body.workspace_path = workspacePath;
  body.active_skills = body.active_skills || [];

  const project = await projectsQ.create(auth.orgId, body);
  return c.json(project, 201);
});

projectRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  return c.json(await projectsQ.list(auth.orgId));
});

projectRoutes.get('/:pid', async (c) => {
  const auth = c.get('auth');
  const project = await projectsQ.get(auth.orgId, c.req.param('pid'));
  if (!project) return c.json({ error: 'Not found' }, 404);
  return c.json(project);
});

projectRoutes.patch('/:pid', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json();
  const project = await projectsQ.update(auth.orgId, c.req.param('pid'), body);
  if (!project) return c.json({ error: 'Not found' }, 404);
  return c.json(project);
});

projectRoutes.delete('/:pid', async (c) => {
  const auth = c.get('auth');
  const project = await projectsQ.softDelete(auth.orgId, c.req.param('pid'));
  if (!project) return c.json({ error: 'Not found' }, 404);
  return c.json({ deleted: true });
});
