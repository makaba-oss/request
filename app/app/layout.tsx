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
  let pending = 0;
  if (user.role === 'owner' && user.workspaceId) {
    const [r] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM students WHERE workspace_id = ${user.workspaceId} AND status = 'pending'`;
    pending = r.n;
  }
  return (
    <>
      <Header sub={sub} right={<div className="row" style={{ gap: 4 }}><span className="small muted cred">{user.email}</span><Link href="/app/account" className="btn ghost sm">Пароль</Link><LogoutButton /></div>} />
      {user.role === 'owner' ? (
        <NavTabs items={[{ href: '/app', label: 'Ученики', count: pending }, { href: '/app/settings', label: 'Настройки и реквизиты' }]} />
      ) : null}
      <main>{children}</main>
    </>
  );
}
