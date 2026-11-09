'use server';
import { revalidatePath } from 'next/cache';
import { sql, newId } from '@/lib/db';
import { requireOwner, requireUser } from '@/lib/auth';
import { studentByUser } from '@/lib/students';
import { clip, safeUrl } from '@/lib/workspace';
import { addDays, isDate, isTime, isPast, todayMsk, ymd } from '@/lib/dates';
import type { FormState } from './actions';

const DURS = [30, 45, 60, 90, 120];
const dur = (v: FormDataEntryValue | null) => (DURS.includes(Number(v)) ? Number(v) : 60);
const int = (v: FormDataEntryValue | null, min = 0, max = 1_000_000) => {
  const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const refresh = () => revalidatePath('/app', 'layout');

async function ownStudent(workspaceId: string, studentId: string) {
  const [s] = await sql<{ id: string }[]>`SELECT id FROM students WHERE id = ${studentId} AND workspace_id = ${workspaceId} AND status = 'active'`;
  return s?.id ?? null;
}

/* ===================== преподаватель: уроки ===================== */

export async function addLessons(_: FormState, fd: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const studentId = await ownStudent(owner.workspaceId, String(fd.get('studentId')));
  if (!studentId) return { error: 'Выберите ученика.' };
  const day = String(fd.get('day')), time = String(fd.get('time'));
  if (!isDate(day) || !isTime(time)) return { error: 'Укажите дату и время.' };
  const repeat = int(fd.get('repeat'), 1, 26), d = dur(fd.get('dur')), topic = clip(fd.get('topic'), 200);
  for (let i = 0; i < repeat; i++) {
    await sql`INSERT INTO lessons (id, workspace_id, student_id, day, time, dur, topic) VALUES (${newId()}, ${owner.workspaceId}, ${studentId}, ${addDays(day, 7 * i)}, ${time}, ${d}, ${topic})`;
  }
  refresh();
  return { ok: true, message: repeat > 1 ? `Добавлено уроков: ${repeat}` : 'Урок добавлен' };
}

export async function updateLesson(_: FormState, fd: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const id = String(fd.get('id')), day = String(fd.get('day')), time = String(fd.get('time'));
  const status = ['plan', 'done', 'noshow', 'cancel'].includes(String(fd.get('status'))) ? String(fd.get('status')) : 'plan';
  if (!isDate(day) || !isTime(time)) return { error: 'Укажите дату и время.' };
  const r = await sql`UPDATE lessons SET day = ${day}, time = ${time}, dur = ${dur(fd.get('dur'))}, status = ${status},
    topic = ${clip(fd.get('topic'), 200)}, call_url = ${safeUrl(fd.get('callUrl'))}
    WHERE id = ${id} AND workspace_id = ${owner.workspaceId}`;
  if (!r.count) return { error: 'Урок не найден.' };
  await sql`UPDATE slots SET lesson_id = NULL WHERE lesson_id = ${id} AND (day <> ${day} OR time <> ${time} OR ${status} = 'cancel')`;
  refresh();
  return { ok: true, message: 'Сохранено' };
}

export async function setLessonStatus(fd: FormData) {
  const owner = await requireOwner();
  const status = String(fd.get('status'));
  if (!['plan', 'done', 'noshow', 'cancel'].includes(status)) return;
  const id = String(fd.get('id'));
  await sql`UPDATE lessons SET status = ${status} WHERE id = ${id} AND workspace_id = ${owner.workspaceId}`;
  if (status === 'cancel') await sql`UPDATE slots SET lesson_id = NULL WHERE lesson_id = ${id} AND workspace_id = ${owner.workspaceId}`;
  refresh();
}

export async function deleteLesson(fd: FormData) {
  const owner = await requireOwner();
  await sql`DELETE FROM lessons WHERE id = ${String(fd.get('id'))} AND workspace_id = ${owner.workspaceId}`;
  refresh();
}

/* ===================== преподаватель: свободные окна ===================== */

export async function addSlots(_: FormState, fd: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const day = String(fd.get('day'));
  if (!isDate(day)) return { error: 'Укажите дату.' };
  const times = String(fd.get('times') || '').split(/[,;\s]+/).map(t => t.trim()).filter(Boolean)
    .map(t => (/^\d:\d\d$/.test(t) ? '0' + t : t));
  if (!times.length || times.some(t => !isTime(t))) return { error: 'Время через запятую в формате 10:00, 15:30.' };
  const repeat = int(fd.get('repeat'), 1, 26), d = dur(fd.get('dur'));
  let n = 0;
  for (let i = 0; i < repeat; i++) for (const t of times) {
    const r = await sql`INSERT INTO slots (id, workspace_id, day, time, dur) VALUES (${newId()}, ${owner.workspaceId}, ${addDays(day, 7 * i)}, ${t}, ${d})
                        ON CONFLICT (workspace_id, day, time) DO NOTHING`;
    n += r.count;
  }
  refresh();
  return { ok: true, message: n ? `Открыто окон: ${n}` : 'Такие окна уже есть' };
}

export async function deleteSlot(fd: FormData) {
  const owner = await requireOwner();
  await sql`DELETE FROM slots WHERE id = ${String(fd.get('id'))} AND workspace_id = ${owner.workspaceId} AND lesson_id IS NULL`;
  refresh();
}

/** Подтвердить или отклонить запись/перенос. */
export async function decideRequest(fd: FormData) {
  const owner = await requireOwner();
  const id = String(fd.get('id')), ok = fd.get('decision') === 'ok';
  await sql.begin(async tx => {
    const [r] = await tx<{ id: string; studentId: string; slotId: string; kind: string; lessonId: string | null }[]>`
      SELECT id, student_id, slot_id, kind, lesson_id FROM slot_requests
      WHERE id = ${id} AND workspace_id = ${owner.workspaceId} AND status = 'pending' FOR UPDATE`;
    if (!r) return;
    if (!ok) { await tx`UPDATE slot_requests SET status = 'no', decided_at = now() WHERE id = ${id}`; return; }
    const [slot] = await tx<{ day: Date; time: string; dur: number; lessonId: string | null }[]>`
      SELECT day, time, dur, lesson_id FROM slots WHERE id = ${r.slotId} FOR UPDATE`;
    if (!slot || slot.lessonId) { await tx`UPDATE slot_requests SET status = 'no', decided_at = now() WHERE id = ${id}`; return; }
    let lessonId = r.lessonId;
    if (r.kind === 'move' && lessonId) {
      await tx`UPDATE slots SET lesson_id = NULL WHERE lesson_id = ${lessonId}`;
      await tx`UPDATE lessons SET day = ${ymd(slot.day)}, time = ${slot.time}, dur = ${slot.dur}, status = 'plan' WHERE id = ${lessonId}`;
    } else {
      lessonId = newId();
      await tx`INSERT INTO lessons (id, workspace_id, student_id, day, time, dur) VALUES (${lessonId}, ${owner.workspaceId}, ${r.studentId}, ${ymd(slot.day)}, ${slot.time}, ${slot.dur})`;
    }
    await tx`UPDATE slots SET lesson_id = ${lessonId} WHERE id = ${r.slotId}`;
    await tx`UPDATE slot_requests SET status = 'ok', decided_at = now() WHERE id = ${id}`;
    await tx`UPDATE slot_requests SET status = 'no', decided_at = now() WHERE slot_id = ${r.slotId} AND status = 'pending'`;
  });
  refresh();
}

/* ===================== преподаватель: оплаты ===================== */

export async function addPayment(_: FormState, fd: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const studentId = await ownStudent(owner.workspaceId, String(fd.get('studentId')));
  if (!studentId) return { error: 'Ученик не найден.' };
  const day = isDate(String(fd.get('day'))) ? String(fd.get('day')) : todayMsk();
  const lessons = int(fd.get('lessons'), 0, 200);
  if (!lessons) return { error: 'Сколько занятий зачесть?' };
  await sql`INSERT INTO payments (id, workspace_id, student_id, day, lessons, amount, note)
            VALUES (${newId()}, ${owner.workspaceId}, ${studentId}, ${day}, ${lessons}, ${int(fd.get('amount'))}, ${clip(fd.get('note'), 200)})`;
  refresh();
  return { ok: true, message: 'Оплата записана' };
}

export async function deletePayment(fd: FormData) {
  const owner = await requireOwner();
  await sql`DELETE FROM payments WHERE id = ${String(fd.get('id'))} AND workspace_id = ${owner.workspaceId}`;
  refresh();
}

export async function decidePayNotice(fd: FormData) {
  const owner = await requireOwner();
  const id = String(fd.get('id')), ok = fd.get('decision') === 'ok';
  await sql.begin(async tx => {
    const [n] = await tx<{ studentId: string; amount: number }[]>`
      UPDATE pay_notices SET status = ${ok ? 'ok' : 'no'} WHERE id = ${id} AND workspace_id = ${owner.workspaceId} AND status = 'pending'
      RETURNING student_id, amount`;
    if (n && ok) {
      await tx`INSERT INTO payments (id, workspace_id, student_id, day, lessons, amount, note)
               VALUES (${newId()}, ${owner.workspaceId}, ${n.studentId}, ${todayMsk()}, ${int(fd.get('lessons'), 0, 200)}, ${n.amount}, 'по сообщению ученика')`;
    }
  });
  refresh();
}

/* ===================== ученик ===================== */

async function me() {
  const user = await requireUser();
  const s = user.role === 'student' ? await studentByUser(user.id) : null;
  if (!s || s.status !== 'active') throw new Error('Кабинет ученика недоступен');
  return s;
}

export async function requestSlot(_: FormState, fd: FormData): Promise<FormState> {
  const s = await me();
  const slotId = String(fd.get('slotId')), lessonId = fd.get('lessonId') ? String(fd.get('lessonId')) : null;
  const [slot] = await sql<{ day: Date; time: string; lessonId: string | null }[]>`
    SELECT day, time, lesson_id FROM slots WHERE id = ${slotId} AND workspace_id = ${s.workspaceId}`;
  if (!slot || slot.lessonId || isPast(slot.day, slot.time)) return { error: 'Это время уже занято. Выберите другое.' };
  const [taken] = await sql`SELECT 1 FROM slot_requests WHERE slot_id = ${slotId} AND status = 'pending' AND student_id <> ${s.id}`;
  if (taken) return { error: 'Это время уже занято. Выберите другое.' };
  if (lessonId) {
    const [l] = await sql<{ day: Date; time: string }[]>`SELECT day, time FROM lessons WHERE id = ${lessonId} AND student_id = ${s.id} AND status = 'plan'`;
    if (!l || isPast(l.day, l.time)) return { error: 'Этот урок уже нельзя перенести.' };
    await sql`UPDATE slot_requests SET status = 'cancel' WHERE lesson_id = ${lessonId} AND status = 'pending'`;
  }
  await sql`INSERT INTO slot_requests (id, workspace_id, student_id, slot_id, kind, lesson_id)
            VALUES (${newId()}, ${s.workspaceId}, ${s.id}, ${slotId}, ${lessonId ? 'move' : 'book'}, ${lessonId})
            ON CONFLICT DO NOTHING`;
  refresh();
  return { ok: true, message: lessonId ? 'Запрос на перенос отправлен. Ждём подтверждения преподавателя.' : 'Вы записались. Ждём подтверждения преподавателя.' };
}

export async function cancelRequest(fd: FormData) {
  const s = await me();
  await sql`UPDATE slot_requests SET status = 'cancel' WHERE id = ${String(fd.get('id'))} AND student_id = ${s.id} AND status = 'pending'`;
  refresh();
}

export async function sendPayNotice(_: FormState, fd: FormData): Promise<FormState> {
  const s = await me();
  const amount = int(fd.get('amount'));
  if (!amount) return { error: 'Укажите сумму перевода.' };
  const [recent] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM pay_notices WHERE student_id = ${s.id} AND status = 'pending'`;
  if (recent.n >= 5) return { error: 'Преподаватель ещё не проверил прошлые сообщения. Подождите немного.' };
  await sql`INSERT INTO pay_notices (id, workspace_id, student_id, amount, comment) VALUES (${newId()}, ${s.workspaceId}, ${s.id}, ${amount}, ${clip(fd.get('comment'), 300)})`;
  refresh();
  return { ok: true, message: 'Преподаватель увидит сообщение и зачтёт занятия.' };
}
