import path from 'node:path';

/** Папка для PDF библиотеки (в контейнере — том uploads). */
export const uploadDir = () => path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
export const LIB_CATEGORIES = ['Грамматика', 'Лексика', 'Кандзи', 'Кана', 'JLPT', 'Тексты и чтение', 'Прочее'];
export const MAX_PDF = 30 * 1024 * 1024;
export const GRADES = ['5', '4', '3', '2', 'Зачёт', 'На доработку'];
export const HW_STATUS = {
  new: ['Задано', 'c-ai'], sent: ['Сдано · 提出', 'c-warn'], checked: ['Проверено · 済', 'c-good'], redo: ['На доработку', 'c-bad'], late: ['Срок прошёл', 'c-bad'],
} as const;
export type Homework = {
  id: string; studentId: string; title: string; task: string; link: string; due: Date | null; createdAt: Date;
  answer: string | null; answerLink: string; answeredAt: Date | null; grade: string | null; review: string; reviewedAt: Date | null;
};
export function hwStatus(h: Homework, today: string): keyof typeof HW_STATUS {
  if (h.reviewedAt) return h.grade === 'На доработку' ? 'redo' : 'checked';
  if (h.answeredAt) return 'sent';
  if (h.due) { const d = h.due instanceof Date ? h.due.toISOString().slice(0, 10) : String(h.due).slice(0, 10); if (d < today) return 'late'; }
  return 'new';
}
export const fmtSize = (b: number) => b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + ' КБ' : (b / 1024 / 1024).toFixed(1).replace('.', ',') + ' МБ';
