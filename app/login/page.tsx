import { redirect } from 'next/navigation';
import { Header } from '@/components/Brand';
import { currentUser } from '@/lib/auth';
import { getWorkspace } from '@/lib/workspace';
import LoginForm from './LoginForm';

export const metadata = { title: 'Вход' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await currentUser()) redirect('/app');
  const ws = await getWorkspace();
  return (
    <>
      <Header href="/" />
      <main className="panel stack" style={{ margin: '24px auto 0', maxWidth: 420 }}>
        <h2 style={{ fontSize: '1.4rem' }}>Вход в кабинет</h2>
        <LoginForm contact={ws?.contact || ''} />
      </main>
    </>
  );
}
