// Выдаёт новый пароль преподавателю (владельцу сайта).
// На сервере: cd /opt/request && docker compose exec app node scripts/set-password.mjs
// Логин по умолчанию — OWNER_EMAIL из .env; можно указать другой: ... set-password.mjs мой-логин
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { hashPassword, generatePassword, normalizeLogin } from '../lib/password.mjs';

const login = normalizeLogin(process.argv[2] || (process.env.OWNER_EMAIL || '').split(',')[0]);
if (!login) { console.error('Укажите логин: латиница, цифры и . _ - @, от 3 символов. Например: node scripts/set-password.mjs makar'); process.exit(1); }
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  let [ws] = await sql`SELECT id FROM workspaces ORDER BY created_at LIMIT 1`;
  if (!ws) [ws] = await sql`INSERT INTO workspaces (id) VALUES (${randomUUID()}) RETURNING id`;
  const password = generatePassword();
  const hash = hashPassword(password);
  const [u] = await sql`
    INSERT INTO users (id, email, role, workspace_id, password_hash) VALUES (${randomUUID()}, ${login}, 'owner', ${ws.id}, ${hash})
    ON CONFLICT (email) DO UPDATE SET role = 'owner', workspace_id = COALESCE(users.workspace_id, ${ws.id}),
      password_hash = ${hash}, failed_logins = 0, locked_until = NULL
    RETURNING id`;
  await sql`DELETE FROM sessions WHERE user_id = ${u.id}`;
  console.log(`\nВход преподавателя:\n  Логин:  ${login}\n  Пароль: ${password}\n\nСохраните пароль. Сменить его можно в кабинете: «Пароль» вверху страницы.\n`);
} catch (e) {
  console.error('Не получилось:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
