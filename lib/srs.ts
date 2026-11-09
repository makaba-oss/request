// Интервальное повторение как в Anki (упрощённый SM-2). Оценки: 1 Снова, 2 Трудно, 3 Хорошо, 4 Легко.
export type SrsCard = { reps: number; ivl: number; ef: number; lapses: number; due: Date | null };
const DAY = 864e5;
const startOfDayMsk = (now: number) => { const msk = now + 3 * 3600e3; return msk - (msk % DAY) - 3 * 3600e3; };

export function srsNext(c: SrsCard, g: number, now = Date.now()): SrsCard {
  let { ivl, ef, reps, lapses } = c; let due: number;
  if (g === 1) { if (reps > 0) lapses++; reps = 0; ivl = 0; ef = Math.max(1.3, ef - 0.2); due = now + 10 * 60e3; }
  else {
    if (g === 2) { ivl = reps === 0 ? 1 : Math.max(ivl + 1, Math.round(ivl * 1.2)); ef = Math.max(1.3, ef - 0.15); }
    else if (g === 4) { ivl = reps === 0 ? 4 : Math.max(ivl + 2, Math.round(ivl * ef * 1.3)); ef += 0.15; }
    else { ivl = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(ivl + 1, Math.round(ivl * ef)); }
    reps++; due = startOfDayMsk(now) + ivl * DAY + 4 * 3600e3;
  }
  return { ivl, ef: Math.round(ef * 100) / 100, reps, lapses, due: new Date(due) };
}
export function ivlLabel(d: number) {
  if (d < 1) return '<10 мин';
  if (d < 30) { const m10 = d % 10, m100 = d % 100; return d + ' ' + (m10 === 1 && m100 !== 11 ? 'день' : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? 'дня' : 'дней'); }
  return d < 365 ? Math.round(d / 30) + ' мес' : (d / 365).toFixed(1).replace('.', ',') + ' г';
}
export const NEW_PER_SESSION = 20;
