import { requireStudent } from '@/lib/me';
import { sql } from '@/lib/db';
import { KanaTrainer } from '@/components/KanaTrainer';

export const metadata = { title: 'Кана' };

export default async function KanaPage() {
  const me = await requireStudent();
  const [p] = await sql<{ rightCount: number; wrongCount: number; bestStreak: number; weak: Record<string, number> }[]>`
    SELECT right_count, wrong_count, best_streak, weak FROM kana_progress WHERE student_id = ${me.id}`;
  return <KanaTrainer saved={{ right: p?.rightCount ?? 0, wrong: p?.wrongCount ?? 0, best: p?.bestStreak ?? 0, weak: p?.weak ?? {} }} />;
}
