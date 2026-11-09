// Даты занятий хранятся и показываются по московскому времени.
const TZ = 'Europe/Moscow';
export const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
export const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const pad = (n: number) => String(n).padStart(2, '0');
const parts = (d = new Date()) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
};

export const todayMsk = () => parts().day;
export const nowHmMsk = () => parts().hm;

/** Дата из базы (Date или строка) → 'ГГГГ-ММ-ДД'. */
export function ymd(v: Date | string): string {
  if (typeof v === 'string') return v.slice(0, 10);
  return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
}
const toUtc = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const addDays = (s: string, n: number) => { const d = toUtc(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
export const mondayOf = (s: string) => { const d = toUtc(s); return addDays(s, -((d.getUTCDay() + 6) % 7)); };
export const weekday = (s: string) => toUtc(s).getUTCDay();
export const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(toUtc(s).getTime());
export const isTime = (s: unknown): s is string => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export function fmtDay(s: Date | string, withWd = true) {
  const v = ymd(s), d = toUtc(v);
  return (withWd ? WD[d.getUTCDay()] + ', ' : '') + d.getUTCDate() + ' ' + MON[d.getUTCMonth()];
}
export function fmtWhen(v: Date | string | null) {
  if (!v) return '';
  return new Date(v).toLocaleString('ru-RU', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export function timeEnd(t: string, dur: number) {
  const [h, m] = t.split(':').map(Number); const x = h * 60 + m + dur;
  return `${pad(Math.floor(x / 60) % 24)}:${pad(x % 60)}`;
}
/** Наступило ли уже время 'день + время' по Москве. */
export function isPast(day: Date | string, time: string) {
  const d = ymd(day), t = todayMsk();
  return d < t || (d === t && time <= nowHmMsk());
}
export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n), m10 = a % 10, m100 = a % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many;
}
export const rub = (n: number) => Number(n || 0).toLocaleString('ru-RU') + ' ₽';
