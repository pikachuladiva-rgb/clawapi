import { pool } from '../client.js';

export const projectsQ = {
  create: (orgId: string, data: { name: string; base_url?: string; api_key?: string; model?: string; system_prompt?: string; tools_config?: string[]; rate_limit_config?: object; max_context_tokens?: number; context_strategy?: string; workspace_path?: string; active_skills?: string[]; use_agent_sdk?: boolean; default_stream?: boolean }) =>
    pool.query(
      `INSERT INTO projects (org_id, name, base_url, api_key, model, system_prompt, tools_config, rate_limit_config, max_context_tokens, context_strategy, workspace_path, active_skills, use_agent_sdk, default_stream)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [orgId, data.name, data.base_url ?? null, data.api_key ?? null, data.model ?? 'claude-sonnet-4-6', data.system_prompt ?? '', JSON.stringify(data.tools_config ?? []), JSON.stringify(data.rate_limit_config ?? { rpm: 60, tpm: 100000 }), data.max_context_tokens ?? 180000, data.context_strategy ?? 'sliding_window', data.workspace_path ?? null, JSON.stringify(data.active_skills ?? []), data.use_agent_sdk ?? true, data.default_stream ?? true]
    ).then(r => r.rows[0]),

  list: (orgId: string) =>
    pool.query('SELECT * FROM projects WHERE org_id = $1 AND is_active = true ORDER BY created_at DESC', [orgId]).then(r => r.rows),

  get: (orgId: string, id: string) =>
    pool.query('SELECT * FROM projects WHERE id = $1 AND org_id = $2', [id, orgId]).then(r => r.rows[0]),

  update: (orgId: string, id: string, data: Record<string, unknown>) => {
    const fields = Object.keys(data);
    const sets = fields.map((f, i) => `${f} = $${i + 3}`);
    const vals = fields.map(f => f.endsWith('_config') ? JSON.stringify(data[f]) : data[f]);
    return pool.query(
      `UPDATE projects SET ${sets.join(', ')} WHERE id = $1 AND org_id = $2 RETURNING *`,
      [id, orgId, ...vals]
    ).then(r => r.rows[0]);
  },

  softDelete: (orgId: string, id: string) =>
    pool.query('UPDATE projects SET is_active = false WHERE id = $1 AND org_id = $2 RETURNING *', [id, orgId]).then(r => r.rows[0]),
};
