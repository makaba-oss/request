import 'server-only';
import { sql } from './db';

export type Workspace = {
  id: string; school: string; teacher: string; contact: string; requisites: string;
  callUrl: string; goals: string[]; lessonMin: number;
};

export const DEFAULT_GOALS = ['Сдать JLPT', 'Путешествия по Японии', 'Аниме, манга, игры', 'Разговорная речь', 'Работа и бизнес', 'Учёба в Японии', 'Переезд в Японию', 'Для себя, хобби'];
export const START_LEVELS = ['С нуля', 'Знаю кану', 'Примерно N5', 'Примерно N4', 'N3 и выше'];
export const LEVELS = ['С нуля', 'N5', 'N4', 'N3', 'N2', 'N1'];
export const FORMATS = {
  one: ['Разовые занятия', 'Сами выбираете свободное время в календаре и платите за каждое занятие'],
  sub: ['Абонемент', 'Постоянное расписание, которое составляет репетитор, оплата пакетом занятий'],
} as const;

export async function getWorkspace(id?: string | null): Promise<Workspace | null> {
  const rows = id
    ? await sql<Workspace[]>`SELECT * FROM workspaces WHERE id = ${id}`
    : await sql<Workspace[]>`SELECT * FROM workspaces ORDER BY created_at LIMIT 1`;
  return rows[0] ?? null;
}

export const goalsOf = (ws: Workspace | null) => (ws && ws.goals.length ? ws.goals : DEFAULT_GOALS);

export const fio = (s: { lastName: string; firstName: string; middleName: string }) =>
  [s.lastName, s.firstName, s.middleName].filter(Boolean).join(' ');

export function safeUrl(u: unknown) {
  const s = String(u ?? '').trim();
  return /^https?:\/\/[^\s]+$/i.test(s) && s.length < 500 ? s : '';
}

export const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
