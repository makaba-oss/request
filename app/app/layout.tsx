import Link from 'next/link';
import { Header, LogoutButton } from '@/components/Brand';
import { NavTabs } from '@/components/forms';
import { requireUser } from '@/lib/auth';
import { getWorkspace } from '@/lib/workspace';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const ws = await getWorkspace(user.workspaceId);
  const sub = [ws?.school, ws?.teacher].filter(Boolean).join(' · ') || (user.role === 'owner' ? 'Кабинет преподавателя' : 'Кабинет ученика');
  let pending = 0, attn = 0, studentActive = false;
  if (user.role === 'owner' && user.workspaceId) {
    const [r] = await sql<{ n: number; a: number }[]>`SELECT
      (SELECT count(*)::int FROM students WHERE workspace_id = ${user.workspaceId} AND status = 'pending') AS n,
      (SELECT count(*)::int FROM slot_requests WHERE workspace_id = ${user.workspaceId} AND status = 'pending')
      + (SELECT count(*)::int FROM pay_notices WHERE workspace_id = ${user.workspaceId} AND status = 'pending') AS a`;
    pending = r.n; attn = r.a;
  } else {
    const [r] = await sql`SELECT 1 FROM students WHERE user_id = ${user.id} AND status = 'active'`;
    studentActive = !!r;
  }
  return (
    <>
      <Header sub={sub} right={<div className="row" style={{ gap: 4 }}><span className="small muted cred">{user.email}</span><Link href="/app/account" className="btn ghost sm">Пароль</Link><LogoutButton /></div>} />
      {user.role === 'owner' ? (
        <NavTabs items={[{ href: '/app', label: 'Ученики', count: pending }, { href: '/app/calendar', label: 'Календарь', count: attn }, { href: '/app/settings', label: 'Настройки и реквизиты' }]} />
      ) : studentActive ? (
        <NavTabs items={[{ href: '/app', label: 'Главная' }, { href: '/app/lessons', label: 'Занятия' }, { href: '/app/pay', label: 'Оплата' }]} />
      ) : null}
      <main>{children}</main>
    </>
  );
}
