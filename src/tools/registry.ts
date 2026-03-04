import type Anthropic from '@anthropic-ai/sdk';

type ToolDef = Anthropic.Messages.Tool;

/**
 * Built-in tools for the legacy Messages API path (agent_sdk: false).
 * When using the Agent SDK (default), tools like WebSearch are handled natively.
 *
 * web_search_20250305 is an Anthropic server-side tool — it does NOT need input_schema.
 * Note: Some third-party proxies may not support server-side tools.
 */
const builtinTools: Record<string, ToolDef> = {
  web_search: { type: 'web_search_20250305', name: 'web_search' } as unknown as ToolDef,
};

export function resolveTools(toolsConfig: string[]): ToolDef[] {
  return toolsConfig
    .map(name => builtinTools[name])
    .filter(Boolean);
}
