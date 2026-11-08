import 'server-only';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql, newId } from './db';
import { sendMail, codeEmail } from './mail';

export const SESSION_COOKIE = 'rq_session';
const SESSION_DAYS = 60;
const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;

export type User = { id: string; email: string; role: 'owner' | 'student'; workspaceId: string | null };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET не задан или короче 32 символов');
  return s;
}
const hmac = (v: string) => createHmac('sha256', secret()).update(v).digest('hex');

export function normalizeEmail(raw: string) {
  const e = String(raw || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 200 ? e : null;
}

export const isOwnerEmail = (email: string) =>
  (process.env.OWNER_EMAIL || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).includes(email);

/** Создаёт одноразовый код и отправляет его письмом. Не чаще раза в минуту на адрес. */
export async function requestCode(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const [recent] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM login_codes WHERE email = ${email} AND created_at > now() - interval '60 seconds'`;
  if (recent.n > 0) return { ok: false, error: 'Код уже отправлен. Новый можно запросить через минуту.' };
  const [hour] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM login_codes WHERE email = ${email} AND created_at > now() - interval '1 hour'`;
  if (hour.n >= 8) return { ok: false, error: 'Слишком много попыток. Попробуйте через час.' };

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await sql`INSERT INTO login_codes (id, email, code_hash, expires_at)
            VALUES (${newId()}, ${email}, ${hmac(email + ':' + code)}, now() + ${CODE_MINUTES + ' minutes'}::interval)`;
  const m = codeEmail(code);
  await sendMail(email, m.subject, m.text, m.html);
  return { ok: true };
}

/** Проверяет код; при успехе создаёт пользователя (если нужно) и сессию. */
export async function verifyCode(email: string, code: string): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const clean = String(code || '').replace(/\D/g, '');
  const [row] = await sql<{ id: string; codeHash: string; attempts: number; expired: boolean }[]>`
    SELECT id, code_hash, attempts, expires_at < now() AS expired FROM login_codes
    WHERE email = ${email} AND used_at IS NULL ORDER BY created_at DESC LIMIT 1`;
  if (!row || row.expired) return { ok: false, error: 'Код устарел. Запросите новый.' };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: 'Слишком много неверных попыток. Запросите новый код.' };

  const a = Buffer.from(row.codeHash, 'hex'), b = Buffer.from(hmac(email + ':' + clean), 'hex');
  if (clean.length !== 6 || a.length !== b.length || !timingSafeEqual(a, b)) {
    await sql`UPDATE login_codes SET attempts = attempts + 1 WHERE id = ${row.id}`;
    return { ok: false, error: 'Неверный код. Проверьте письмо и попробуйте ещё раз.' };
  }
  await sql`UPDATE login_codes SET used_at = now() WHERE id = ${row.id}`;

  const owner = isOwnerEmail(email);
  let [user] = await sql<User[]>`SELECT id, email, role, workspace_id FROM users WHERE email = ${email}`;
  if (!user) {
    [user] = await sql<User[]>`INSERT INTO users (id, email, role) VALUES (${newId()}, ${email}, ${owner ? 'owner' : 'student'})
                               RETURNING id, email, role, workspace_id`;
  } else if (owner && user.role !== 'owner') {
    [user] = await sql<User[]>`UPDATE users SET role = 'owner' WHERE id = ${user.id} RETURNING id, email, role, workspace_id`;
  }
  if (user.role === 'owner' && !user.workspaceId) {
    const wsId = await defaultWorkspaceId(true);
    [user] = await sql<User[]>`UPDATE users SET workspace_id = ${wsId} WHERE id = ${user.id} RETURNING id, email, role, workspace_id`;
  }
  await sql`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;

  const token = randomBytes(32).toString('base64url');
  await sql`INSERT INTO sessions (id, token_hash, user_id, expires_at)
            VALUES (${newId()}, ${hmac(token)}, ${user.id}, now() + ${SESSION_DAYS + ' days'}::interval)`;
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 86400,
    secure: (process.env.APP_URL || '').startsWith('https://'),
  });
  return { ok: true, user };
}

/** Кабинет репетитора. Пока он один — берём первый, а владелец создаёт его при первом входе. */
export async function defaultWorkspaceId(create = false): Promise<string | null> {
  const [ws] = await sql<{ id: string }[]>`SELECT id FROM workspaces ORDER BY created_at LIMIT 1`;
  if (ws) return ws.id;
  if (!create) return null;
  const [n] = await sql<{ id: string }[]>`INSERT INTO workspaces (id) VALUES (${newId()}) RETURNING id`;
  return n.id;
}

export async function currentUser(): Promise<User | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [u] = await sql<User[]>`
    SELECT u.id, u.email, u.role, u.workspace_id FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hmac(token)} AND s.expires_at > now()`;
  return u ?? null;
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect('/login');
  return u;
}

export async function requireOwner(): Promise<User & { workspaceId: string }> {
  const u = await requireUser();
  if (u.role !== 'owner' || !u.workspaceId) redirect('/app');
  return u as User & { workspaceId: string };
}

export async function logout() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await sql`DELETE FROM sessions WHERE token_hash = ${hmac(token)}`;
  cookies().delete(SESSION_COOKIE);
}
