import { pool } from '../client.js';

export const messagesQ = {
  create: (sessionId: string, data: { role: string; content?: string; tool_use?: object; tool_result?: object; tokens_in?: number; tokens_out?: number }) =>
    pool.query(
      'INSERT INTO messages (session_id, role, content, tool_use, tool_result, tokens_in, tokens_out) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [sessionId, data.role, data.content ?? null, data.tool_use ? JSON.stringify(data.tool_use) : null, data.tool_result ? JSON.stringify(data.tool_result) : null, data.tokens_in ?? 0, data.tokens_out ?? 0]
    ).then(r => r.rows[0]),

  listBySession: (sessionId: string) =>
    pool.query('SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at ASC', [sessionId]).then(r => r.rows),
};
