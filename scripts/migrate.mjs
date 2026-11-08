// Применяет новые SQL-миграции из db/migrations по порядку. Запускается при старте контейнера.
import postgres from 'postgres';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL не задан'); process.exit(1); }
const sql = postgres(url, { max: 1, onnotice: () => {} });
const dir = path.join(process.cwd(), 'db', 'migrations');

try {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const done = new Set((await sql`SELECT name FROM schema_migrations`).map(r => r.name));
  const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const body = await readFile(path.join(dir, f), 'utf8');
    await sql.begin(async tx => { await tx.unsafe(body); await tx`INSERT INTO schema_migrations (name) VALUES (${f})`; });
    console.log('Миграция применена:', f);
  }
  console.log('База данных в актуальном состоянии');
} catch (e) {
  console.error('Ошибка миграции:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
