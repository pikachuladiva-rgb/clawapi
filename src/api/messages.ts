import { Hono } from 'hono';
import { projectsQ } from '../db/queries/projects.js';
import { sessionsQ } from '../db/queries/sessions.js';
import { messagesQ } from '../db/queries/messages.js';
import { streamMessage, sendMessage } from '../claude/streaming.js';
import { sendMessageWithSDK } from '../claude/sdk-handler.js';
import { sendMessageWithAgentSDK, streamMessageWithAgentSDK } from '../claude/agent-sdk-handler.js';
import { checkRateLimit } from '../billing/limiter.js';
import type { AppEnv } from '../types.js';

export const messageRoutes = new Hono<AppEnv>();

messageRoutes.get('/:pid/sessions/:sid/messages', async (c) => {
  const auth = c.get('auth');
  const project = await projectsQ.get(auth.orgId, c.req.param('pid'));
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const session = await sessionsQ.get(project.id, c.req.param('sid'));
  if (!session) return c.json({ error: 'Session not found' }, 404);

  const messages = await messagesQ.listBySession(session.id);
  return c.json(messages);
});

messageRoutes.post('/:pid/sessions/:sid/messages', async (c) => {
  const auth = c.get('auth');
  const project = await projectsQ.get(auth.orgId, c.req.param('pid'));
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const session = await sessionsQ.get(project.id, c.req.param('sid'));
  if (!session) return c.json({ error: 'Session not found' }, 404);

  const body = await c.req.json();
  if (!body.content) return c.json({ error: 'content required' }, 400);

  // Rate limit check
  const rl = await checkRateLimit(project.id, project.rate_limit_config || {});
  if (!rl.allowed) return c.json({ error: rl.error }, 429);

  // Resolve settings: per-request overrides > project defaults
  const useAgentSdk = body.agent_sdk ?? project.use_agent_sdk ?? true;
  const useStream = body.stream ?? project.default_stream ?? true;

  // --- Agent SDK path ---
  if (useAgentSdk) {
    if (!useStream) {
      try {
        return c.json(await sendMessageWithAgentSDK(project, session.id, body.content));
      } catch (e: any) {
        return c.json({ error: e?.message || 'Agent SDK error' }, 500);
      }
    }
    return streamMessageWithAgentSDK(c, project, session.id, body.content);
  }

  // --- Legacy Messages API path ---
  if (!useStream) {
    try {
      return c.json(await sendMessageWithSDK(project, session.id, body.content));
    } catch (e: any) {
      return c.json({ error: e?.message || 'Error' }, 500);
    }
  }

  return streamMessage(c, project, session.id, body.content);
});
