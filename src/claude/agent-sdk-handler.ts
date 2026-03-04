/**
 * Agent SDK Handler for ClawAPI
 * Uses the Claude Agent SDK's query() function to get real tool execution
 * (web search, web fetch, etc.) instead of the raw Messages API.
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import { messagesQ } from '../db/queries/messages.js';
import { trackUsage } from '../billing/tracker.js';
import { logger } from '../logger.js';
import { readEnvFile } from './env.js';
import { buildSystemPrompt, buildIdentityPrefix } from './system-prompt.js';
import { buildContext } from './context.js';
import { streamSSE } from 'hono/streaming';
import type { Context } from 'hono';

type Project = {
    id: string; org_id: string; name: string; base_url: string | null; api_key: string | null;
    model: string; system_prompt: string; tools_config: string[];
    max_context_tokens: number; workspace_path?: string;
};

/**
 * Build the environment variables for the Agent SDK.
 */
function buildSdkEnv(project: Project): Record<string, string | undefined> {
    const env: Record<string, string | undefined> = { ...process.env };

    delete env.ANTHROPIC_BASE_URL;
    delete env.ANTHROPIC_AUTH_TOKEN;

    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE_ENTRYPOINT;
    delete env.CLAUDE_CODE_SSE_PORT;
    for (const key of Object.keys(env)) {
        if (key.startsWith('CLAUDE_CODE_') && key !== 'CLAUDE_CODE_OAUTH_TOKEN' && key !== 'CLAUDE_CODE_USE_MODEL') {
            delete env[key];
        }
    }

    const envFile = readEnvFile([
        'ANTHROPIC_API_KEY',
        'CLAUDE_CODE_OAUTH_TOKEN',
        'CLAUDE_CODE_USE_MODEL',
    ]);
    for (const [key, value] of Object.entries(envFile)) {
        env[key] = value;
    }

    return env;
}

/** Build common query options */
async function buildQueryOptions(project: Project, sessionId: string, userContent: string, sdkEnv: Record<string, string | undefined>) {
    const identityMessages = buildIdentityPrefix(project.name);
    const identityRules = identityMessages
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join('\n');

    const history = await buildContext(sessionId, project.max_context_tokens);
    await messagesQ.create(sessionId, { role: 'user', content: userContent });

    let fullPrompt = userContent;
    if (history.length > 0) {
        const historyText = history
            .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n\n');
        fullPrompt = `[Conversation history]\n${historyText}\n\n[Current message]\nUser: ${userContent}`;
    }

    return {
        prompt: fullPrompt,
        options: {
            cwd: project.workspace_path || process.cwd(),
            systemPrompt: { type: 'preset' as const, preset: 'claude_code' as const, append: identityRules },
            allowedTools: ['WebSearch', 'WebFetch', 'Read', 'Glob', 'Grep'],
            env: sdkEnv,
            model: (sdkEnv.CLAUDE_CODE_USE_MODEL as string) || project.model || undefined,
            permissionMode: 'bypassPermissions' as const,
            allowDangerouslySkipPermissions: true,
        },
    };
}

/**
 * Send a message using the Agent SDK (non-streaming, returns JSON).
 */
export async function sendMessageWithAgentSDK(
    project: Project,
    sessionId: string,
    userContent: string,
) {
    const startTime = Date.now();
    const sdkEnv = buildSdkEnv(project);

    logger.info({
        hasApiKey: !!sdkEnv.ANTHROPIC_API_KEY,
        hasOAuthToken: !!sdkEnv.CLAUDE_CODE_OAUTH_TOKEN,
        cwd: project.workspace_path || process.cwd(),
    }, 'Agent SDK env check');

    const queryOpts = await buildQueryOptions(project, sessionId, userContent, sdkEnv);

    let resultText = '';
    let sdkSessionId: string | undefined;
    let messageCount = 0;

    try {
        for await (const message of query(queryOpts)) {
            messageCount++;
            const msgType = message.type === 'system'
                ? `system/${(message as { subtype?: string }).subtype}`
                : message.type;
            logger.debug({ msgType, messageCount }, 'Agent SDK message');

            if (message.type === 'system' && message.subtype === 'init') {
                sdkSessionId = message.session_id;
                logger.info({ sdkSessionId }, 'Agent SDK session initialized');
            }

            if (message.type === 'result') {
                const text = 'result' in message ? (message as { result?: string }).result : null;
                if (text) resultText = text;
                logger.info(
                    { subtype: message.subtype, hasText: !!text, duration: Date.now() - startTime },
                    'Agent SDK result received',
                );
            }
        }
    } catch (err: any) {
        logger.error({ err: err?.message || err, stack: err?.stack }, 'Agent SDK query error');
        throw err;
    }

    await messagesQ.create(sessionId, {
        role: 'assistant',
        content: resultText || undefined,
        tokens_in: 0,
        tokens_out: 0,
    });

    trackUsage(project.org_id, project.id, sessionId, 0, 0, 0, project.model).catch(e =>
        logger.error(e),
    );

    const duration = Date.now() - startTime;
    logger.info({ duration, messageCount, resultLength: resultText.length }, 'Agent SDK complete');

    return {
        role: 'assistant',
        content: resultText,
        usage: { tokens_in: 0, tokens_out: 0 },
        stop_reason: 'end_turn',
        agent_sdk: true,
    };
}

/**
 * Stream a message using the Agent SDK via SSE.
 * Yields text chunks as they arrive from assistant messages.
 */
export function streamMessageWithAgentSDK(c: Context, project: Project, sessionId: string, userContent: string) {
    return streamSSE(c, async (stream) => {
        const startTime = Date.now();
        const sdkEnv = buildSdkEnv(project);

        logger.info({
            hasApiKey: !!sdkEnv.ANTHROPIC_API_KEY,
            cwd: project.workspace_path || process.cwd(),
        }, 'Agent SDK stream env check');

        const queryOpts = await buildQueryOptions(project, sessionId, userContent, sdkEnv);

        let resultText = '';
        let messageCount = 0;
        let headerSent = false;

        try {
            for await (const message of query(queryOpts)) {
                messageCount++;

                if (message.type === 'system' && message.subtype === 'init') {
                    logger.info({ sdkSessionId: message.session_id }, 'Agent SDK stream initialized');
                }

                // Stream assistant text messages as SSE
                if (message.type === 'assistant') {
                    const msg = message as any;
                    const text = msg.message?.content
                        ?.filter((b: any) => b.type === 'text')
                        ?.map((b: any) => b.text)
                        ?.join('') || '';

                    if (text) {
                        // Send the new text delta (text that wasn't sent yet)
                        const delta = text.slice(resultText.length);
                        if (delta) {
                            if (!headerSent) {
                                await stream.writeSSE({ event: 'message_start', data: JSON.stringify({ role: 'assistant' }) });
                                headerSent = true;
                            }
                            await stream.writeSSE({ event: 'content_delta', data: JSON.stringify({ type: 'text', text: delta }) });
                            resultText = text;
                        }
                    }
                }

                if (message.type === 'result') {
                    const text = 'result' in message ? (message as { result?: string }).result : null;
                    if (text) {
                        // Send any remaining text
                        const delta = text.slice(resultText.length);
                        if (delta) {
                            if (!headerSent) {
                                await stream.writeSSE({ event: 'message_start', data: JSON.stringify({ role: 'assistant' }) });
                                headerSent = true;
                            }
                            await stream.writeSSE({ event: 'content_delta', data: JSON.stringify({ type: 'text', text: delta }) });
                        }
                        resultText = text;
                    }
                }
            }

            // Send end event
            await stream.writeSSE({ event: 'message_end', data: JSON.stringify({ stop_reason: 'end_turn' }) });

        } catch (err: any) {
            logger.error({ err: err?.message || err }, 'Agent SDK stream error');
            await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: err?.message || 'Agent SDK error' }) });
        }

        // Save assistant response
        await messagesQ.create(sessionId, {
            role: 'assistant',
            content: resultText || undefined,
            tokens_in: 0,
            tokens_out: 0,
        });

        trackUsage(project.org_id, project.id, sessionId, 0, 0, 0, project.model).catch(e =>
            logger.error(e),
        );

        const duration = Date.now() - startTime;
        logger.info({ duration, messageCount, resultLength: resultText.length }, 'Agent SDK stream complete');
    });
}

