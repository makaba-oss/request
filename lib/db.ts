import postgres from 'postgres';
import { randomUUID } from 'node:crypto';

const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

export const sql =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL ?? '', {
    max: 10,
    idle_timeout: 30,
    onnotice: () => {},
    transform: postgres.camel,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.sql = sql;

export const newId = () => randomUUID();
