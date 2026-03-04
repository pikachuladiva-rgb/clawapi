import { pool } from '../client.js';

export const orgsQ = {
  create: (name: string, apiKeyHash: string, apiKeyPrefix: string) =>
    pool.query(
      'INSERT INTO organizations (name, api_key_hash, api_key_prefix) VALUES ($1, $2, $3) RETURNING *',
      [name, apiKeyHash, apiKeyPrefix]
    ).then(r => r.rows[0]),

  findByKeyHash: (hash: string) =>
    pool.query('SELECT * FROM organizations WHERE api_key_hash = $1', [hash]).then(r => r.rows[0]),

  findByPrefix: (prefix: string) =>
    pool.query('SELECT * FROM organizations WHERE api_key_prefix = $1', [prefix]).then(r => r.rows[0]),

  list: () =>
    pool.query('SELECT id, name, api_key_prefix, created_at FROM organizations ORDER BY created_at DESC').then(r => r.rows),
};
