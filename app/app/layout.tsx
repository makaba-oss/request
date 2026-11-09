import Link from 'next/link';
import { Header, LogoutButton } from '@/components/Brand';
import { AppNav, type NavItem } from '@/components/AppNav';
import { requireUser } from '@/lib/auth';
import { getWorkspace } from '@/lib/workspace';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const ws = await getWorkspace(user.workspaceId);
  const sub = [ws?.school, ws?.teacher].filter(Boolean).join(' · ') || (user.role === 'owner' ? 'Кабинет преподавателя' : 'Кабинет ученика');
  let nav: NavItem[] | null = null;
  if (user.role === 'owner' && user.workspaceId) {
    const w = user.workspaceId;
    const [r] = await sql<{ n: number; a: number; h: number }[]>`SELECT
      (SELECT count(*)::int FROM students WHERE workspace_id = ${w} AND status = 'pending') AS n,
      (SELECT count(*)::int FROM slot_requests WHERE workspace_id = ${w} AND status = 'pending')
      + (SELECT count(*)::int FROM pay_notices WHERE workspace_id = ${w} AND status = 'pending') AS a,
      (SELECT count(*)::int FROM homework h JOIN students s ON s.id = h.student_id WHERE h.workspace_id = ${w} AND s.status = 'active' AND h.answered_at IS NOT NULL AND h.reviewed_at IS NULL) AS h`;
    nav = [
      { href: '/app', label: 'Ученики', icon: 'people', count: r.n },
      { href: '/app/calendar', label: 'Календарь', icon: 'calendar', count: r.a },
      { href: '/app/homework', label: 'Задания', icon: 'task', count: r.h },
      { href: '/app/library', label: 'Библиотека', short: 'Файлы', icon: 'book' },
      { href: '/app/settings', label: 'Настройки и реквизиты', short: 'Настройки', icon: 'gear' },
    ];
  } else {
    const [st] = await sql<{ id: string }[]>`SELECT id FROM students WHERE user_id = ${user.id} AND status = 'active'`;
    if (st) {
      const [r] = await sql<{ h: number; c: number }[]>`SELECT
        (SELECT count(*)::int FROM homework WHERE student_id = ${st.id} AND (answered_at IS NULL OR grade = 'На доработку')) AS h,
        (SELECT count(*)::int FROM cards c JOIN decks d ON d.id = c.deck_id WHERE d.student_id = ${st.id} AND c.due <= now()) AS c`;
      nav = [
        { href: '/app', label: 'Главная', icon: 'home' },
        { href: '/app/lessons', label: 'Занятия', short: 'Уроки', icon: 'calendar' },
        { href: '/app/homework', label: 'Задания', icon: 'task', count: r.h },
        { href: '/app/cards', label: 'Карточки', icon: 'cards', count: r.c },
        { href: '/app/kana', label: 'Кана', icon: 'kana' },
        { href: '/app/library', label: 'Библиотека', short: 'Файлы', icon: 'book' },
        { href: '/app/pay', label: 'Оплата', icon: 'pay' },
      ];
    }
  }
  return (
    <>
      <Header sub={sub} right={<div className="row" style={{ gap: 4 }}><span className="small muted cred">{user.email}</span><Link href="/app/account" className="btn ghost sm">Пароль</Link><LogoutButton /></div>} />
      {nav ? <AppNav items={nav} /> : null}
      <main>{children}</main>
    </>
  );
}
