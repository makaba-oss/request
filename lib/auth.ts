import 'server-only';
import { createHmac, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql, newId } from './db';
import { checkPassword, normalizeLogin } from './password.mjs';

export const SESSION_COOKIE = 'rq_session';
const SESSION_DAYS = 60;
const MAX_FAILS = 8;
const LOCK_MINUTES = 15;

/** `email` хранит логин: почту или короткое имя, которое выдал преподаватель. */
export type User = { id: string; email: string; role: 'owner' | 'student'; workspaceId: string | null; label?: string };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET не задан или короче 32 символов');
  return s;
}
const hmac = (v: string) => createHmac('sha256', secret()).update(v).digest('hex');
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Проверяет логин и пароль; после 8 ошибок подряд блокирует вход на 15 минут. */
export async function passwordLogin(rawLogin: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const login = normalizeLogin(rawLogin);
  const wrong = { ok: false as const, error: 'Неверный логин или пароль.' };
  if (!login || !password) return wrong;
  const [u] = await sql<{ id: string; passwordHash: string | null; failedLogins: number; locked: boolean }[]>`
    SELECT id, password_hash, failed_logins, coalesce(locked_until > now(), false) AS locked FROM users WHERE email = ${login}`;
  if (u?.locked) return { ok: false, error: `Слишком много неверных попыток. Попробуйте через ${LOCK_MINUTES} минут.` };
  if (!u || !checkPassword(password, u.passwordHash)) {
    if (u) {
      await sql`UPDATE users SET
        locked_until = CASE WHEN failed_logins + 1 >= ${MAX_FAILS} THEN now() + ${LOCK_MINUTES + ' minutes'}::interval ELSE locked_until END,
        failed_logins = CASE WHEN failed_logins + 1 >= ${MAX_FAILS} THEN 0 ELSE failed_logins + 1 END
        WHERE id = ${u.id}`;
    }
    await pause(400);
    return wrong;
  }
  await sql`UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = ${u.id}`;
  await createSession(u.id);
  return { ok: true };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  await sql`INSERT INTO sessions (id, token_hash, user_id, expires_at)
            VALUES (${newId()}, ${hmac(token)}, ${userId}, now() + ${SESSION_DAYS + ' days'}::interval)`;
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 86400,
    secure: (process.env.APP_URL || '').startsWith('https://'),
  });
}

/** Кабинет преподавателя. Пока он один — берём первый. */
export async function defaultWorkspaceId(): Promise<string | null> {
  const [ws] = await sql<{ id: string }[]>`SELECT id FROM workspaces ORDER BY created_at LIMIT 1`;
  return ws?.id ?? null;
}

export async function currentUser(): Promise<User | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [u] = await sql<User[]>`
    SELECT u.id, u.email, u.role, u.workspace_id, u.label FROM sessions s JOIN users u ON u.id = s.user_id
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

/** Удаляет все сессии пользователя, кроме текущей (после смены пароля). */
export async function dropOtherSessions(userId: string) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  await sql`DELETE FROM sessions WHERE user_id = ${userId} AND token_hash <> ${token ? hmac(token) : ''}`;
}
