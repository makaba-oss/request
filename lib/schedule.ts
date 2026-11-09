import 'server-only';
import { sql } from './db';
import { todayMsk, nowHmMsk, ymd } from './dates';
import type { Workspace } from './workspace';

export type LessonStatus = 'plan' | 'done' | 'noshow' | 'cancel';
export type Lesson = { id: string; studentId: string; day: Date; time: string; dur: number; topic: string; status: LessonStatus; callUrl: string };
export type LessonRow = Lesson & { lastName: string; firstName: string; format: 'one' | 'sub' };
export type Slot = { id: string; day: Date; time: string; dur: number; lessonId: string | null };
export type SlotRequest = {
  id: string; studentId: string; slotId: string; kind: 'book' | 'move'; lessonId: string | null; status: string; createdAt: Date;
  day: Date; time: string; dur: number; lastName?: string; firstName?: string; fromDay?: Date | null; fromTime?: string | null;
};

export const LESSON_STATUS: Record<LessonStatus, [string, string]> = {
  plan: ['Запланирован', 'c-ai'], done: ['Проведён', 'c-good'], noshow: ['Пропуск (списан)', 'c-bad'], cancel: ['Отменён', 'c-mute'],
};

export async function lessonsInRange(workspaceId: string, from: string, to: string) {
  return sql<LessonRow[]>`
    SELECT l.*, s.last_name, s.first_name, s.format FROM lessons l JOIN students s ON s.id = l.student_id
    WHERE l.workspace_id = ${workspaceId} AND l.day BETWEEN ${from} AND ${to} ORDER BY l.day, l.time`;
}
export async function slotsInRange(workspaceId: string, from: string, to: string) {
  return sql<Slot[]>`SELECT id, day, time, dur, lesson_id FROM slots WHERE workspace_id = ${workspaceId} AND day BETWEEN ${from} AND ${to} ORDER BY day, time`;
}
export async function studentLessons(studentId: string) {
  return sql<Lesson[]>`SELECT * FROM lessons WHERE student_id = ${studentId} ORDER BY day DESC, time DESC LIMIT 200`;
}
export const upcoming = (ls: Lesson[]) => {
  const t = todayMsk(), hm = nowHmMsk();
  return ls.filter(l => l.status === 'plan' && (ymd(l.day) > t || (ymd(l.day) === t && l.time >= hm)))
    .sort((a, b) => (ymd(a.day) + a.time).localeCompare(ymd(b.day) + b.time));
};

/** Свободные окна в будущем: не заняты уроком и никто другой их уже не попросил. */
export async function freeSlots(workspaceId: string, studentId: string) {
  return sql<Slot[]>`
    SELECT sl.id, sl.day, sl.time, sl.dur, sl.lesson_id FROM slots sl
    WHERE sl.workspace_id = ${workspaceId} AND sl.lesson_id IS NULL
      AND (sl.day > ${todayMsk()} OR (sl.day = ${todayMsk()} AND sl.time > ${nowHmMsk()}))
      AND NOT EXISTS (SELECT 1 FROM slot_requests r WHERE r.slot_id = sl.id AND r.status = 'pending')
    ORDER BY sl.day, sl.time LIMIT 120`;
}

export async function pendingRequests(workspaceId: string) {
  return sql<SlotRequest[]>`
    SELECT r.*, sl.day, sl.time, sl.dur, s.last_name, s.first_name, l.day AS from_day, l.time AS from_time
    FROM slot_requests r JOIN slots sl ON sl.id = r.slot_id JOIN students s ON s.id = r.student_id
    LEFT JOIN lessons l ON l.id = r.lesson_id
    WHERE r.workspace_id = ${workspaceId} AND r.status = 'pending' ORDER BY sl.day, sl.time`;
}
export async function myRequests(studentId: string) {
  return sql<SlotRequest[]>`
    SELECT r.*, sl.day, sl.time, sl.dur, l.day AS from_day, l.time AS from_time
    FROM slot_requests r JOIN slots sl ON sl.id = r.slot_id LEFT JOIN lessons l ON l.id = r.lesson_id
    WHERE r.student_id = ${studentId} AND (r.status = 'pending' OR (r.status = 'no' AND r.decided_at > now() - interval '7 days'))
    ORDER BY r.created_at DESC`;
}

export type Balance = { paid: number; used: number; left: number };
export async function balanceOf(studentId: string): Promise<Balance> {
  const [r] = await sql<{ paid: number; used: number }[]>`
    SELECT (SELECT coalesce(sum(lessons), 0)::int FROM payments WHERE student_id = ${studentId}) AS paid,
           (SELECT count(*)::int FROM lessons WHERE student_id = ${studentId} AND status IN ('done', 'noshow')) AS used`;
  return { paid: r.paid, used: r.used, left: r.paid - r.used };
}
export async function balances(workspaceId: string) {
  const rows = await sql<{ studentId: string; paid: number; used: number }[]>`
    SELECT s.id AS student_id,
      (SELECT coalesce(sum(lessons), 0)::int FROM payments p WHERE p.student_id = s.id) AS paid,
      (SELECT count(*)::int FROM lessons l WHERE l.student_id = s.id AND l.status IN ('done', 'noshow')) AS used
    FROM students s WHERE s.workspace_id = ${workspaceId}`;
  return Object.fromEntries(rows.map(r => [r.studentId, { paid: r.paid, used: r.used, left: r.paid - r.used }])) as Record<string, Balance>;
}

/** Куда подключаться на урок: своя ссылка урока → настройка ученика → общая ссылка. */
export type CallInfo = { kind: 'link'; url: string; label: string } | { kind: 'discord'; url: string; note: string } | null;
export function callInfo(ws: Pick<Workspace, 'callUrl'> | null, st: { callMode: string; callUrl: string; callNote: string }, lesson?: { callUrl: string }): CallInfo {
  if (lesson?.callUrl) return { kind: 'link', url: lesson.callUrl, label: callLabel(lesson.callUrl) };
  if (st.callMode === 'none') return null;
  if (st.callMode === 'discord') return { kind: 'discord', url: st.callUrl, note: st.callNote };
  const url = st.callMode === 'link' ? st.callUrl : ws?.callUrl || '';
  return url ? { kind: 'link', url, label: callLabel(url) } : null;
}
function callLabel(u: string) {
  let h = ''; try { h = new URL(u).hostname; } catch { /* оставляем пусто */ }
  if (/zoom/.test(h)) return 'Zoom';
  if (/meet\.google/.test(h)) return 'Google Meet';
  if (/(^|\.)t\.me$|telegram/.test(h)) return 'Telegram';
  if (/discord/.test(h)) return 'Discord';
  if (/telemost|yandex/.test(h)) return 'Телемост';
  return 'звонок';
}
