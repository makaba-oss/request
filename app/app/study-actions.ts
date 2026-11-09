'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { sql, newId } from '@/lib/db';
import { requireOwner, requireUser } from '@/lib/auth';
import { studentByUser } from '@/lib/students';
import { clip, safeUrl } from '@/lib/workspace';
import { isDate } from '@/lib/dates';
import { srsNext, type SrsCard } from '@/lib/srs';
import { READY_DECKS } from '@/lib/ready-decks';
import { KANA_SET } from '@/lib/kana';
import { uploadDir, GRADES } from '@/lib/files';
import type { FormState } from './actions';

const refresh = () => revalidatePath('/app', 'layout');

async function me() {
  const user = await requireUser();
  const s = user.role === 'student' ? await studentByUser(user.id) : null;
  if (!s || s.status !== 'active') throw new Error('Кабинет ученика недоступен');
  return s;
}

/* ===================== задания ===================== */

export async function assignHomework(_: FormState, fd: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const ids = fd.getAll('studentId').map(String);
  const students = ids.length ? await sql<{ id: string }[]>`SELECT id FROM students WHERE workspace_id = ${owner.workspaceId} AND status = 'active' AND id IN ${sql(ids)}` : [];
  if (!students.length) return { error: 'Выберите ученика.' };
  const title = clip(fd.get('title'), 200);
  if (!title) return { error: 'Напишите, что задано.' };
  const due = isDate(String(fd.get('due'))) ? String(fd.get('due')) : null;
  const task = clip(fd.get('task'), 5000), link = safeUrl(fd.get('link'));
  for (const s of students) {
    await sql`INSERT INTO homework (id, workspace_id, student_id, title, task, link, due) VALUES (${newId()}, ${owner.workspaceId}, ${s.id}, ${title}, ${task}, ${link}, ${due})`;
  }
  refresh();
  return { ok: true, message: students.length > 1 ? `Задано ученикам: ${students.length}` : 'Задание отправлено ученику' };
}

export async function deleteHomework(fd: FormData) {
  const owner = await requireOwner();
  await sql`DELETE FROM homework WHERE id = ${String(fd.get('id'))} AND workspace_id = ${owner.workspaceId}`;
  refresh();
}

export async function reviewHomework(_: FormState, fd: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const grade = GRADES.includes(String(fd.get('grade'))) ? String(fd.get('grade')) : null;
  const review = clip(fd.get('review'), 5000);
  if (!grade && !review) return { error: 'Поставьте оценку или напишите комментарий.' };
  const r = await sql`UPDATE homework SET grade = ${grade}, review = ${review}, reviewed_at = now() WHERE id = ${String(fd.get('id'))} AND workspace_id = ${owner.workspaceId}`;
  if (!r.count) return { error: 'Задание не найдено.' };
  refresh();
  return { ok: true, message: 'Проверено' };
}

export async function submitHomework(_: FormState, fd: FormData): Promise<FormState> {
  const s = await me();
  const answer = clip(fd.get('answer'), 10000), link = safeUrl(fd.get('answerLink'));
  if (!answer && !link) return { error: 'Напишите ответ или добавьте ссылку.' };
  if (fd.get('answerLink') && !link) return { error: 'Ссылка должна начинаться с https://' };
  const r = await sql`UPDATE homework SET answer = ${answer}, answer_link = ${link}, answered_at = now(),
      grade = CASE WHEN grade = 'На доработку' THEN NULL ELSE grade END,
      reviewed_at = CASE WHEN grade = 'На доработку' THEN NULL ELSE reviewed_at END
    WHERE id = ${String(fd.get('id'))} AND student_id = ${s.id} AND (reviewed_at IS NULL OR grade = 'На доработку')`;
  if (!r.count) return { error: 'Это задание уже проверено.' };
  refresh();
  return { ok: true, message: 'Ответ отправлен преподавателю' };
}

/* ===================== библиотека ===================== */

export async function deleteLibraryFile(fd: FormData) {
  const owner = await requireOwner();
  const [f] = await sql<{ filename: string }[]>`DELETE FROM library_files WHERE id = ${String(fd.get('id'))} AND workspace_id = ${owner.workspaceId} RETURNING filename`;
  if (f) await unlink(path.join(uploadDir(), path.basename(f.filename))).catch(() => {});
  refresh();
}

export async function updateLibraryFile(fd: FormData) {
  const owner = await requireOwner();
  const title = clip(fd.get('title'), 200);
  if (!title) return;
  await sql`UPDATE library_files SET title = ${title}, category = ${clip(fd.get('category'), 60) || 'Прочее'} WHERE id = ${String(fd.get('id'))} AND workspace_id = ${owner.workspaceId}`;
  refresh();
}

/* ===================== карточки ===================== */

/** Строки «лицо ; оборот» (или через | или Tab) → карточки. */
function parseLines(text: string) {
  return text.split('\n').map(l => l.split(/\s*[;|\t]\s*/)).filter(p => p[0]?.trim() && p[1]?.trim())
    .slice(0, 1000).map(p => ({ f: p[0].trim().slice(0, 300), b: p.slice(1).join('; ').trim().slice(0, 500) }));
}
async function insertCards(deckId: string, cards: { f: string; b: string }[]) {
  const [m] = await sql<{ n: number }[]>`SELECT coalesce(max(pos), -1)::int AS n FROM cards WHERE deck_id = ${deckId}`;
  const rows = cards.map((c, i) => ({ id: newId(), deckId, front: c.f, back: c.b, pos: m.n + 1 + i }));
  for (let i = 0; i < rows.length; i += 200) await sql`INSERT INTO cards ${sql(rows.slice(i, i + 200))}`;
}
async function myDeck(studentId: string, deckId: string) {
  const [d] = await sql<{ id: string }[]>`SELECT id FROM decks WHERE id = ${deckId} AND student_id = ${studentId}`;
  return d?.id ?? null;
}

export async function createDeck(_: FormState, fd: FormData): Promise<FormState> {
  const s = await me();
  const title = clip(fd.get('title'), 100);
  if (!title) return { error: 'Назовите колоду.' };
  const [n] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM decks WHERE student_id = ${s.id}`;
  if (n.n >= 100) return { error: 'Слишком много колод. Удалите ненужные.' };
  const id = newId();
  await sql`INSERT INTO decks (id, student_id, title) VALUES (${id}, ${s.id}, ${title})`;
  const cards = parseLines(String(fd.get('lines') || ''));
  if (cards.length) await insertCards(id, cards);
  refresh();
  return { ok: true, message: cards.length ? `Колода создана, карточек: ${cards.length}` : 'Колода создана. Добавьте в неё карточки.' };
}

export async function addReadyDeck(fd: FormData) {
  const s = await me();
  const r = READY_DECKS.find(d => d.id === String(fd.get('readyId')));
  if (!r) return;
  const [has] = await sql`SELECT 1 FROM decks WHERE student_id = ${s.id} AND ready_id = ${r.id}`;
  if (has) return;
  const id = newId();
  await sql`INSERT INTO decks (id, student_id, title, ready_id) VALUES (${id}, ${s.id}, ${r.title}, ${r.id})`;
  await insertCards(id, r.cards);
  refresh();
}

export async function addCards(_: FormState, fd: FormData): Promise<FormState> {
  const s = await me();
  const deckId = await myDeck(s.id, String(fd.get('deckId')));
  if (!deckId) return { error: 'Колода не найдена.' };
  const front = clip(fd.get('front'), 300), back = clip(fd.get('back'), 500);
  const cards = front && back ? [{ f: front, b: back }] : parseLines(String(fd.get('lines') || ''));
  if (!cards.length) return { error: 'Заполните обе стороны карточки.' };
  const [n] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM cards WHERE deck_id = ${deckId}`;
  if (n.n + cards.length > 3000) return { error: 'В колоде не больше 3000 карточек.' };
  await insertCards(deckId, cards);
  refresh();
  return { ok: true, message: cards.length > 1 ? `Добавлено карточек: ${cards.length}` : 'Карточка добавлена' };
}

export async function updateCard(fd: FormData) {
  const s = await me();
  const front = clip(fd.get('front'), 300), back = clip(fd.get('back'), 500);
  if (!front || !back) return;
  await sql`UPDATE cards c SET front = ${front}, back = ${back} FROM decks d WHERE c.id = ${String(fd.get('id'))} AND d.id = c.deck_id AND d.student_id = ${s.id}`;
  refresh();
}

export async function deleteCard(fd: FormData) {
  const s = await me();
  await sql`DELETE FROM cards c USING decks d WHERE c.id = ${String(fd.get('id'))} AND d.id = c.deck_id AND d.student_id = ${s.id}`;
  refresh();
}

export async function resetCard(fd: FormData) {
  const s = await me();
  await sql`UPDATE cards c SET reps = 0, ivl = 0, ef = 2.5, lapses = 0, due = NULL FROM decks d WHERE c.id = ${String(fd.get('id'))} AND d.id = c.deck_id AND d.student_id = ${s.id}`;
  refresh();
}

export async function renameDeck(fd: FormData) {
  const s = await me();
  const title = clip(fd.get('title'), 100);
  if (title) await sql`UPDATE decks SET title = ${title} WHERE id = ${String(fd.get('id'))} AND student_id = ${s.id}`;
  refresh();
}

export async function deleteDeck(fd: FormData) {
  const s = await me();
  await sql`DELETE FROM decks WHERE id = ${String(fd.get('id'))} AND student_id = ${s.id}`;
  refresh();
  redirect('/app/cards');
}

/** Оценка карточки во время повторения. Вызывается из браузера. */
export async function gradeCard(cardId: string, g: number): Promise<{ ok: boolean }> {
  const s = await me();
  if (![1, 2, 3, 4].includes(g)) return { ok: false };
  const [c] = await sql<(SrsCard & { id: string })[]>`
    SELECT c.id, c.reps, c.ivl, c.ef, c.lapses, c.due FROM cards c JOIN decks d ON d.id = c.deck_id WHERE c.id = ${cardId} AND d.student_id = ${s.id}`;
  if (!c) return { ok: false };
  const n = srsNext(c, g);
  await sql`UPDATE cards SET reps = ${n.reps}, ivl = ${n.ivl}, ef = ${n.ef}, lapses = ${n.lapses}, due = ${n.due} WHERE id = ${cardId}`;
  return { ok: true };
}

/* ===================== кана ===================== */

export async function saveKana(d: { right: number; wrong: number; best: number; weak: Record<string, number> }): Promise<{ ok: boolean }> {
  const s = await me();
  const n = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  const right = n(d.right, 5000), wrong = n(d.wrong, 5000), best = n(d.best, 10000);
  const weak: Record<string, number> = {};
  for (const [c, k] of Object.entries(d.weak || {})) if (KANA_SET.has(c)) weak[c] = n(k, 5000);
  await sql.begin(async tx => {
    const [cur] = await tx<{ weak: Record<string, number> }[]>`SELECT weak FROM kana_progress WHERE student_id = ${s.id} FOR UPDATE`;
    const merged = { ...(cur?.weak || {}) };
    for (const [c, k] of Object.entries(weak)) merged[c] = (merged[c] || 0) + k;
    await tx`INSERT INTO kana_progress (student_id, right_count, wrong_count, best_streak, weak, updated_at)
      VALUES (${s.id}, ${right}, ${wrong}, ${best}, ${tx.json(merged)}, now())
      ON CONFLICT (student_id) DO UPDATE SET right_count = kana_progress.right_count + ${right}, wrong_count = kana_progress.wrong_count + ${wrong},
        best_streak = greatest(kana_progress.best_streak, ${best}), weak = ${tx.json(merged)}, updated_at = now()`;
  });
  return { ok: true };
}

export async function resetKanaWeak() {
  const s = await me();
  await sql`UPDATE kana_progress SET weak = '{}' WHERE student_id = ${s.id}`;
  refresh();
}
