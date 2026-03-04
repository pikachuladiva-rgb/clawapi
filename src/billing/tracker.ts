import { pool } from '../db/client.js';

export async function trackUsage(orgId: string, projectId: string, sessionId: string, tokensIn: number, tokensOut: number, toolCalls: number, model: string) {
  await pool.query(
    'INSERT INTO usage_logs (org_id, project_id, session_id, tokens_in, tokens_out, tool_calls, model) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [orgId, projectId, sessionId, tokensIn, tokensOut, toolCalls, model]
  );
}

export async function getOrgUsage(orgId: string) {
  const r = await pool.query(
    'SELECT COALESCE(SUM(tokens_in),0) as tokens_in, COALESCE(SUM(tokens_out),0) as tokens_out, COALESCE(SUM(tool_calls),0) as tool_calls, COUNT(*) as requests FROM usage_logs WHERE org_id = $1',
    [orgId]
  );
  return r.rows[0];
}

export async function getProjectUsage(orgId: string, projectId: string) {
  const r = await pool.query(
    'SELECT COALESCE(SUM(tokens_in),0) as tokens_in, COALESCE(SUM(tokens_out),0) as tokens_out, COALESCE(SUM(tool_calls),0) as tool_calls, COUNT(*) as requests FROM usage_logs WHERE org_id = $1 AND project_id = $2',
    [orgId, projectId]
  );
  return r.rows[0];
}
