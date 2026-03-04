import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const url = process.env.DATABASE_URL || 'postgresql://clawapi:clawapi@localhost:5433/clawapi';
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await client.query(sql);
  console.log('Migration complete');
  await client.end();
}

migrate().catch(e => { console.error(e); process.exit(1); });
