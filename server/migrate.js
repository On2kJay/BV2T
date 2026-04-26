import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, 'migrations');

async function main() {
  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  if (!files.length) {
    console.log('No migrations found.');
    return;
  }

  // Simple runner: execute each SQL file in order every time.
  // Migrations are written to be idempotent (IF NOT EXISTS).
  for (const f of files) {
    const full = path.join(migrationsDir, f);
    const sql = await fs.readFile(full, 'utf8');
    console.log(`Running ${f}...`);
    await pool.query(sql);
  }

  console.log('Migrations complete.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

