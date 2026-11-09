import 'server-only';
import { redirect } from 'next/navigation';
import { requireUser } from './auth';
import { studentByUser } from './students';

/** Активный ученик для страниц кабинета; остальных отправляем на главную. */
export async function requireStudent() {
  const user = await requireUser();
  if (user.role !== 'student') redirect('/app');
  const me = await studentByUser(user.id);
  if (!me || me.status !== 'active') redirect('/app');
  return me;
}
