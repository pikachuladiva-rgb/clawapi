import { streamSSE } from 'hono/streaming';
import type { Context } from 'hono';
import { getClient } from '../providers/anthropic.js';
import { resolveTools } from '../tools/registry.js';
import { buildContext } from './context.js';
import { messagesQ } from '../db/queries/messages.js';
import { trackUsage } from '../billing/tracker.js';
import { logger } from '../logger.js';
import { buildSystemPrompt, buildIdentityPrefix } from './system-prompt.js';

type Project = {
  id: string; org_id: string; name: string; base_url: string | null; api_key: string | null;
  model: string; system_prompt: string; tools_config: string[];
  max_context_tokens: number;
};

export async function sendMessage(project: Project, sessionId: string, userContent: string) {
  try {
    const client = getClient(project.base_url, project.api_key);
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
      const params: any = { model: project.model, max_tokens: 8192, messages };
      params.system = systemPrompt;
      if (tools.length > 0) params.tools = tools;

      const response = await client.messages.create(params);
      const msg = response as any;
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
    logger.error({ err: e?.message || e, status: e?.status, body: e?.error }, 'sendMessage error');
    throw e;
  }
}

export function streamMessage(c: Context, project: Project, sessionId: string, userContent: string) {
  return streamSSE(c, async (stream) => {
    const client = getClient(project.base_url, project.api_key);
    const tools = resolveTools(project.tools_config);
    const context = await buildContext(sessionId, project.max_context_tokens);
    context.push({ role: 'user', content: userContent });

    // Save user message
    await messagesQ.create(sessionId, { role: 'user', content: userContent });

    // Prepend identity messages so proxy can't override persona
    const identityPrefix = buildIdentityPrefix(project.name);
    let totalIn = 0, totalOut = 0, toolCalls = 0;
    let messages = [...identityPrefix, ...context] as any[];
    const systemPrompt = buildSystemPrompt(project.system_prompt, project.name);

    // Tool loop
    while (true) {
      const params: any = {
        model: project.model,
        max_tokens: 8192,
        messages,
        stream: true,
      };
      params.system = systemPrompt;
      if (tools.length > 0) params.tools = tools;

      let fullText = '';
      let toolUseBlocks: any[] = [];
      let stopReason = '';
      let currentToolUse: any = null;

      await stream.writeSSE({ event: 'message_start', data: JSON.stringify({ role: 'assistant' }) });

      const response = await client.messages.create(params);

      for await (const event of response as any) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            currentToolUse = { id: event.content_block.id, name: event.content_block.name, input: '' };
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            fullText += event.delta.text;
            await stream.writeSSE({ event: 'content_delta', data: JSON.stringify({ type: 'text', text: event.delta.text }) });
          } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
            currentToolUse.input += event.delta.partial_json;
          }
        } else if (event.type === 'content_block_stop') {
          if (currentToolUse) {
            try { currentToolUse.input = JSON.parse(currentToolUse.input); } catch { currentToolUse.input = {}; }
            toolUseBlocks.push(currentToolUse);
            await stream.writeSSE({ event: 'tool_use', data: JSON.stringify(currentToolUse) });
            currentToolUse = null;
          }
        } else if (event.type === 'message_delta') {
          stopReason = event.delta?.stop_reason || '';
          if (event.usage) {
            totalOut += event.usage.output_tokens || 0;
          }
        } else if (event.type === 'message_start' && event.message?.usage) {
          totalIn += event.message.usage.input_tokens || 0;
        }
      }

      // Save assistant message
      await messagesQ.create(sessionId, {
        role: 'assistant',
        content: fullText || undefined,
        tool_use: toolUseBlocks.length > 0 ? toolUseBlocks : undefined,
        tokens_in: totalIn,
        tokens_out: totalOut,
      });

      // If no tool use, we're done
      if (stopReason !== 'tool_use' || toolUseBlocks.length === 0) {
        await stream.writeSSE({ event: 'usage', data: JSON.stringify({ tokens_in: totalIn, tokens_out: totalOut }) });
        await stream.writeSSE({ event: 'message_end', data: JSON.stringify({ stop_reason: stopReason || 'end_turn' }) });

        trackUsage(project.org_id, project.id, sessionId, totalIn, totalOut, toolCalls, project.model).catch(e => logger.error(e));
        break;
      }

      // Build tool results for next iteration
      toolCalls += toolUseBlocks.length;
      const assistantContent: any[] = [];
      if (fullText) assistantContent.push({ type: 'text', text: fullText });
      for (const tu of toolUseBlocks) {
        assistantContent.push({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input });
      }
      messages.push({ role: 'assistant', content: assistantContent });

      // For server-side tools (web_search), Anthropic handles execution
      // We just need to continue the conversation
      const toolResults = toolUseBlocks.map(tu => ({
        type: 'tool_result' as const,
        tool_use_id: tu.id,
        content: 'Tool executed by server',
      }));

      for (const tr of toolResults) {
        await stream.writeSSE({ event: 'tool_result', data: JSON.stringify(tr) });
      }

      messages.push({ role: 'user', content: toolResults });

      // Save tool result message
      await messagesQ.create(sessionId, { role: 'user', tool_result: toolResults });

      // Reset for next iteration
      fullText = '';
      toolUseBlocks = [];
      currentToolUse = null;
    }
  });
}
