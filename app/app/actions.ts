'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql, newId } from '@/lib/db';
import { requireOwner, requireUser, defaultWorkspaceId, dropOtherSessions } from '@/lib/auth';
import { clip, safeUrl, getWorkspace, goalsOf, LEVELS, START_LEVELS } from '@/lib/workspace';
import { hashPassword, checkPassword, generatePassword, normalizeLogin } from '@/lib/password.mjs';

export type FormState = { ok?: boolean; error?: string; message?: string } | null;

const int = (v: FormDataEntryValue | null, min = 0, max = 10_000_000) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

/* ---------- ученик ---------- */

export async function registerStudent(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== 'student') return { error: 'Анкету заполняют только ученики.' };
  const wsId = await defaultWorkspaceId();
  if (!wsId) return { error: 'Преподаватель ещё не настроил кабинет. Попробуйте позже.' };
  const ws = await getWorkspace(wsId);
  const lastName = clip(fd.get('lastName'), 60), firstName = clip(fd.get('firstName'), 60);
  if (!lastName || !firstName) return { error: 'Заполните фамилию и имя.' };
  const allowed = new Set(goalsOf(ws));
  const goals = fd.getAll('goal').map(g => String(g)).filter(g => allowed.has(g)).slice(0, 20);
  if (!goals.length) return { error: 'Выберите хотя бы одну цель.' };
  if (fd.get('consent') !== '1') return { error: 'Подтвердите согласие на обработку персональных данных.' };
  const startLevel = START_LEVELS.includes(String(fd.get('startLevel'))) ? String(fd.get('startLevel')) : '';
  const format = fd.get('format') === 'sub' ? 'sub' : 'one';
  const level = startLevel === 'Примерно N5' ? 'N5' : startLevel === 'Примерно N4' ? 'N4' : startLevel === 'N3 и выше' ? 'N3' : 'С нуля';
  // Доступ выдал сам преподаватель, поэтому кабинет открывается сразу, без заявки.
  await sql`
    INSERT INTO students (id, user_id, workspace_id, status, accepted_at, level, last_name, first_name, middle_name, contact, goals, start_level, format, about)
    VALUES (${newId()}, ${user.id}, ${wsId}, 'active', now(), ${level}, ${lastName}, ${firstName}, ${clip(fd.get('middleName'), 60)}, ${clip(fd.get('contact'), 120)},
            ${goals}, ${startLevel}, ${format}, ${clip(fd.get('about'), 1000)})
    ON CONFLICT (user_id) DO NOTHING`;
  revalidatePath('/app');
  return { ok: true };
}

/* ---------- доступы и пароли ---------- */

export async function createAccount(_: FormState, fd: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const login = normalizeLogin(fd.get('login'));
  if (!login) return { error: 'Логин: латинские буквы, цифры и . _ - @, от 3 символов. Например: anna или anna.smirnova' };
  const label = clip(fd.get('label'), 80);
  const password = generatePassword();
  const res = await sql`
    INSERT INTO users (id, email, role, workspace_id, password_hash, label)
    VALUES (${newId()}, ${login}, 'student', ${owner.workspaceId}, ${hashPassword(password)}, ${label})
    ON CONFLICT (email) DO NOTHING`;
  if (!res.count) return { error: `Логин «${login}» уже занят. Выберите другой.` };
  revalidatePath('/app');
  return { ok: true, message: `Доступ создан${label ? ' для ' + label : ''}. Отправьте ученику:\n\nСайт: ${siteUrl()}\nЛогин: ${login}\nПароль: ${password}\n\nПароль показывается один раз. Если потеряется — выдадите новый.` };
}

export async function resetPassword(_: FormState, fd: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const id = String(fd.get('userId'));
  const password = generatePassword();
  const [u] = await sql<{ email: string }[]>`
    UPDATE users SET password_hash = ${hashPassword(password)}, failed_logins = 0, locked_until = NULL
    WHERE id = ${id} AND role = 'student' AND workspace_id = ${owner.workspaceId} RETURNING email`;
  if (!u) return { error: 'Ученик не найден.' };
  await sql`DELETE FROM sessions WHERE user_id = ${id}`;
  return { ok: true, message: `Новый пароль. Отправьте ученику:\n\nСайт: ${siteUrl()}\nЛогин: ${u.email}\nПароль: ${password}\n\nСтарый пароль больше не работает.` };
}

export async function deleteAccount(fd: FormData) {
  const owner = await requireOwner();
  await sql`DELETE FROM users WHERE id = ${String(fd.get('userId'))} AND role = 'student' AND workspace_id = ${owner.workspaceId}
            AND NOT EXISTS (SELECT 1 FROM students s WHERE s.user_id = users.id)`;
  revalidatePath('/app');
}

export async function changeMyPassword(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = String(fd.get('current') || ''), next = String(fd.get('next') || ''), again = String(fd.get('again') || '');
  const [u] = await sql<{ passwordHash: string | null }[]>`SELECT password_hash FROM users WHERE id = ${user.id}`;
  if (!checkPassword(current, u?.passwordHash)) return { error: 'Текущий пароль неверный.' };
  if (next.length < 8) return { error: 'Новый пароль — не короче 8 символов.' };
  if (next.length > 200) return { error: 'Слишком длинный пароль.' };
  if (next !== again) return { error: 'Пароли не совпадают.' };
  await sql`UPDATE users SET password_hash = ${hashPassword(next)} WHERE id = ${user.id}`;
  await dropOtherSessions(user.id);
  return { ok: true, message: 'Пароль изменён. На других устройствах нужно будет войти заново.' };
}

function siteUrl() {
  return (process.env.APP_URL || '').replace(/\/$/, '') || 'адрес сайта';
}

/* ---------- репетитор ---------- */

export async function acceptStudent(fd: FormData) {
  const owner = await requireOwner();
  const id = String(fd.get('id'));
  await sql`
    UPDATE students SET status = 'active', accepted_at = now(),
      level = CASE start_level WHEN 'Примерно N5' THEN 'N5' WHEN 'Примерно N4' THEN 'N4' WHEN 'N3 и выше' THEN 'N3' ELSE 'С нуля' END
    WHERE id = ${id} AND workspace_id = ${owner.workspaceId}`;
  revalidatePath('/app');
}

export async function rejectStudent(fd: FormData) {
  const owner = await requireOwner();
  await sql`DELETE FROM students WHERE id = ${String(fd.get('id'))} AND workspace_id = ${owner.workspaceId} AND status = 'pending'`;
  revalidatePath('/app');
}

export async function setArchived(fd: FormData) {
  const owner = await requireOwner();
  const archived = fd.get('archived') === '1';
  await sql`UPDATE students SET status = ${archived ? 'archived' : 'active'} WHERE id = ${String(fd.get('id'))} AND workspace_id = ${owner.workspaceId} AND status <> 'pending'`;
  revalidatePath('/app');
  if (archived) redirect('/app');
}

export async function saveStudent(_: FormState, fd: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const id = String(fd.get('id'));
  const ws = await getWorkspace(owner.workspaceId);
  const known = new Set(goalsOf(ws));
  const goals = fd.getAll('goal').map(String).filter(g => known.has(g) || g.length <= 60).slice(0, 20);
  const callMode = ['default', 'link', 'discord', 'none'].includes(String(fd.get('callMode'))) ? String(fd.get('callMode')) : 'default';
  const level = LEVELS.includes(String(fd.get('level'))) ? String(fd.get('level')) : '';
  const res = await sql`
    UPDATE students SET
      last_name = ${clip(fd.get('lastName'), 60)}, first_name = ${clip(fd.get('firstName'), 60)}, middle_name = ${clip(fd.get('middleName'), 60)},
      contact = ${clip(fd.get('contact'), 120)}, goals = ${goals},
      format = ${fd.get('format') === 'sub' ? 'sub' : 'one'}, level = ${level}, book = ${clip(fd.get('book'), 120)},
      message = ${clip(fd.get('message'), 1000)},
      price = ${int(fd.get('price'))}, price_lessons = ${int(fd.get('priceLessons'), 1, 100)}, price_note = ${clip(fd.get('priceNote'), 200)},
      call_mode = ${callMode}, call_url = ${safeUrl(fd.get('callUrl'))}, call_note = ${clip(fd.get('callNote'), 200)},
      private_note = ${clip(fd.get('privateNote'), 4000)}
    WHERE id = ${id} AND workspace_id = ${owner.workspaceId}`;
  if (!res.count) return { error: 'Ученик не найден.' };
  revalidatePath('/app');
  return { ok: true, message: 'Сохранено' };
}

/** Определяет тип картинки по первым байтам, чтобы не доверять расширению файла. */
function imageType(b: Buffer): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

/** Отзывы: блоки через пустую строку; первая строка блока — имя, дальше — текст. */
function parseReviews(raw: string) {
  return raw.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean).slice(0, 12).map(b => {
    const [first, ...rest] = b.split('\n');
    return rest.length ? { name: first.trim().slice(0, 80), text: rest.join('\n').trim().slice(0, 1000) } : { name: '', text: first.trim().slice(0, 1000) };
  });
}

export async function saveAbout(_: FormState, fd: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const points = String(fd.get('aboutPoints') || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 8).map(s => s.slice(0, 80));
  const reviews = parseReviews(String(fd.get('reviews') || ''));
  await sql`
    UPDATE workspaces SET about_title = ${clip(fd.get('aboutTitle'), 120)}, about_text = ${clip(fd.get('aboutText'), 3000)},
      about_points = ${points}, reviews = ${sql.json(reviews)}
    WHERE id = ${owner.workspaceId}`;
  const file = fd.get('photo');
  if (fd.get('removePhoto') === '1') {
    await sql`UPDATE workspaces SET photo = NULL, photo_type = '', photo_at = now() WHERE id = ${owner.workspaceId}`;
  } else if (file && typeof file === 'object' && 'arrayBuffer' in file && file.size > 0) {
    if (file.size > 3 * 1024 * 1024) return { error: 'Фото больше 3 МБ. Уменьшите его и загрузите снова.' };
    const buf = Buffer.from(await file.arrayBuffer());
    const type = imageType(buf);
    if (!type) return { error: 'Подходят только фото JPG, PNG или WebP.' };
    await sql`UPDATE workspaces SET photo = ${buf}, photo_type = ${type}, photo_at = now() WHERE id = ${owner.workspaceId}`;
  }
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Сохранено — блок уже на главной' };
}

export async function saveSettings(_: FormState, fd: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const goals = String(fd.get('goals') || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 20).map(s => s.slice(0, 60));
  const lessonMin = [30, 45, 60, 90].includes(int(fd.get('lessonMin'))) ? int(fd.get('lessonMin')) : 60;
  await sql`
    UPDATE workspaces SET school = ${clip(fd.get('school'), 80)}, teacher = ${clip(fd.get('teacher'), 80)},
      contact = ${clip(fd.get('contact'), 120)}, requisites = ${clip(fd.get('requisites'), 2000)},
      call_url = ${safeUrl(fd.get('callUrl'))}, goals = ${goals}, lesson_min = ${lessonMin}
    WHERE id = ${owner.workspaceId}`;
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Настройки сохранены' };
}
