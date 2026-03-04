import { pool } from '../client.js';

export const sessionsQ = {
  create: (projectId: string, data: { user_id?: string; title?: string; metadata?: object }) =>
    pool.query(
      'INSERT INTO sessions (project_id, user_id, title, metadata) VALUES ($1, $2, $3, $4) RETURNING *',
      [projectId, data.user_id ?? null, data.title ?? null, JSON.stringify(data.metadata ?? {})]
    ).then(r => r.rows[0]),

  list: (projectId: string) =>
    pool.query('SELECT * FROM sessions WHERE project_id = $1 ORDER BY created_at DESC', [projectId]).then(r => r.rows),

  get: (projectId: string, id: string) =>
    pool.query('SELECT * FROM sessions WHERE id = $1 AND project_id = $2', [id, projectId]).then(r => r.rows[0]),

  delete: async (projectId: string, id: string) => {
    await pool.query('DELETE FROM usage_logs WHERE session_id = $1', [id]);
    return pool.query('DELETE FROM sessions WHERE id = $1 AND project_id = $2 RETURNING *', [id, projectId]).then(r => r.rows[0]);
  },
};
