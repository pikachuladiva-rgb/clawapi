import { messagesQ } from '../db/queries/messages.js';
import { buildContext } from './context.js';
import { resolveTools } from '../tools/registry.js';
import { trackUsage } from '../billing/tracker.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { buildSystemPrompt, buildIdentityPrefix } from './system-prompt.js';

const ANTHROPIC_DEFAULT_BASE = 'https://api.anthropic.com';

type Project = {
  id: string; org_id: string; name: string; base_url: string | null; api_key: string | null;
  model: string; system_prompt: string; tools_config: string[];
  max_context_tokens: number; workspace_path?: string; active_skills?: string[];
};

/**
 * Call the Anthropic Messages API using raw fetch.
 * This avoids the SDK's default headers which some proxies intercept
 * to inject their own system prompts.
 */
async function callAnthropicAPI(baseUrl: string, apiKey: string, body: object): Promise<any> {
  const url = `${baseUrl}/v1/messages`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${text}`);
  }

  return resp.json();
}

export async function sendMessageWithSDK(project: Project, sessionId: string, userContent: string) {
  try {
    const apiKey = project.api_key || config.ANTHROPIC_API_KEY;
    const baseUrl = project.base_url || ANTHROPIC_DEFAULT_BASE;
    const tools = resolveTools(project.tools_config);
    const context = await buildContext(sessionId, project.max_context_tokens);
    context.push({ role: 'user', content: userContent });
    await messagesQ.create(sessionId, { role: 'user', content: userContent });

    // Prepend identity messages so proxy can't override persona
    const identityPrefix = buildIdentityPrefix(project.name);
    let messages = [...identityPrefix, ...context] as any[];
    let totalIn = 0, totalOut = 0, toolCalls = 0;
    const systemPrompt = buildSystemPrompt(project.system_prompt, project.name);

    while (true) {
      const body: any = {
        model: project.model,
        max_tokens: 8192,
        messages,
        system: systemPrompt,
      };
      if (tools.length > 0) body.tools = tools;

      logger.info({ model: project.model, messageCount: messages.length }, 'Sending request to Anthropic API');

      const msg = await callAnthropicAPI(baseUrl, apiKey, body);
      totalIn += msg.usage?.input_tokens || 0;
      totalOut += msg.usage?.output_tokens || 0;

      const text = msg.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('') || '';
      const toolBlocks = msg.content?.filter((b: any) => b.type === 'tool_use') || [];

      await messagesQ.create(sessionId, {
        role: 'assistant', content: text || undefined,
        tool_use: toolBlocks.length > 0 ? toolBlocks : undefined,
        tokens_in: totalIn, tokens_out: totalOut,
      });

      if (msg.stop_reason !== 'tool_use' || toolBlocks.length === 0) {
        trackUsage(project.org_id, project.id, sessionId, totalIn, totalOut, toolCalls, project.model).catch(e => logger.error(e));
        return { role: 'assistant', content: text, usage: { tokens_in: totalIn, tokens_out: totalOut }, stop_reason: msg.stop_reason || 'end_turn' };
      }

      toolCalls += toolBlocks.length;
      messages.push({ role: 'assistant', content: msg.content });
      const toolResults = toolBlocks.map((tu: any) => ({ type: 'tool_result' as const, tool_use_id: tu.id, content: 'Tool executed by server' }));
      messages.push({ role: 'user', content: toolResults });
      await messagesQ.create(sessionId, { role: 'user', tool_result: toolResults });
    }
  } catch (e: any) {
    logger.error({ err: e?.message || e, stack: e?.stack }, 'sendMessageWithSDK error');
    throw e;
  }
}
