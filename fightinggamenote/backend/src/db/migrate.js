// Minimal migration runner: applies migrations/*.sql in filename order,
// tracks applied ones in a _migrations table. Good enough for a solo
// project in Phase 1 — replace with node-pg-migrate or similar if the
// team/complexity grows.

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', '..', 'migrations');

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const applied = new Set(
    (await pool.query('SELECT filename FROM _migrations')).rows.map(
      (r) => r.filename
    )
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip  ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`apply ${file}`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [
        file,
      ]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`failed ${file}:`, err.message);
      process.exit(1);
    } finally {
      client.release();
    }
  }

  console.log('done');
  await pool.end();
}

run();
