import { messagesQ } from '../db/queries/messages.js';

type DbMessage = { role: string; content: string | null; tool_use: object | null; tool_result: object | null };

export async function buildContext(sessionId: string, maxTokens: number): Promise<Array<{ role: string; content: unknown }>> {
  const rows: DbMessage[] = await messagesQ.listBySession(sessionId);
  const msgs: Array<{ role: string; content: unknown }> = [];
  let budget = maxTokens;

  // Walk backwards, include messages until budget exhausted
  for (let i = rows.length - 1; i >= 0 && budget > 0; i--) {
    const row = rows[i];
    // Only include text content for conversation history
    if (!row.content) continue;
    const estimate = Math.ceil(row.content.length / 4);
    if (estimate > budget && msgs.length > 0) break;
    budget -= estimate;
    msgs.unshift({ role: row.role, content: row.content });
  }

  return msgs;
}
