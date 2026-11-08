import { redirect } from 'next/navigation';
import { Header } from '@/components/Brand';
import { currentUser } from '@/lib/auth';
import LoginForm from './LoginForm';

export const metadata = { title: 'Вход' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await currentUser()) redirect('/app');
  return (
    <>
      <Header href="/" />
      <main className="panel stack narrow" style={{ margin: '24px auto 0', maxWidth: 440 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Вход в кабинет</h2>
          <p className="muted" style={{ marginTop: 6 }}>Ученики и преподаватель входят одинаково — по почте.</p>
        </div>
        <LoginForm />
      </main>
    </>
  );
}
