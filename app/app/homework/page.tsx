import { requireUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { studentByUser, listStudents } from '@/lib/students';
import { fio } from '@/lib/workspace';
import { hwStatus, type Homework } from '@/lib/files';
import { todayMsk } from '@/lib/dates';
import { HwCard, OwnerHomeworkView, type HwRow } from '@/components/Homework';

export const metadata = { title: 'Задания' };

export default async function HomeworkPage() {
  const user = await requireUser();
  if (user.role === 'owner') return <OwnerHomework workspaceId={user.workspaceId!} />;
  const me = await studentByUser(user.id);
  if (!me || me.status !== 'active') return <div className="empty"><strong>Кабинет недоступен</strong></div>;
  const list = await sql<Homework[]>`SELECT * FROM homework WHERE student_id = ${me.id} ORDER BY (reviewed_at IS NOT NULL AND coalesce(grade, '') <> 'На доработку'), coalesce(due, '2999-01-01'), created_at DESC`;
  const today = todayMsk();
  const open = list.filter(h => ['new', 'late', 'redo'].includes(hwStatus(h, today)));
  const rest = list.filter(h => !open.includes(h));
  return (
    <div className="stack">
      {!list.length ? <div className="empty"><strong>Заданий пока нет</strong>Когда преподаватель задаст что-то, оно появится здесь.</div> : null}
      {list.length && !open.length ? <div className="alert ok">Все задания сданы. Молодец!</div> : null}
      {open.map(h => <HwCard key={h.id} h={h} today={today} student />)}
      {rest.length ? <><h2 style={{ marginTop: 8 }}>Сданные</h2>{rest.map(h => <HwCard key={h.id} h={h} today={today} student />)}</> : null}
    </div>
  );
}

async function OwnerHomework({ workspaceId }: { workspaceId: string }) {
  const [students, list] = await Promise.all([
    listStudents(workspaceId),
    sql<HwRow[]>`SELECT h.*, s.last_name, s.first_name FROM homework h JOIN students s ON s.id = h.student_id
      WHERE h.workspace_id = ${workspaceId} AND s.status = 'active' ORDER BY h.created_at DESC LIMIT 300`,
  ]);
  const active = students.filter(s => s.status === 'active');
  const today = todayMsk();
  const toCheck = list.filter(h => hwStatus(h, today) === 'sent');
  const waiting = list.filter(h => ['new', 'late', 'redo'].includes(hwStatus(h, today)));
  const done = list.filter(h => hwStatus(h, today) === 'checked').slice(0, 30);
  return <OwnerHomeworkView active={active.map(s => ({ id: s.id, name: fio(s) }))} toCheck={toCheck} waiting={waiting} done={done} today={today} />;
}

