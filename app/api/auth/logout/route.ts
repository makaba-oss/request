import { logout } from '@/lib/auth';

export async function POST() {
  await logout();
  // Относительный адрес: за прокси req.url содержит внутренний адрес контейнера.
  return new Response(null, { status: 303, headers: { Location: '/' } });
}
