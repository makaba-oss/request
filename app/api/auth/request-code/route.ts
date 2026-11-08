import { NextResponse } from 'next/server';
import { normalizeEmail, requestCode } from '@/lib/auth';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email) return NextResponse.json({ ok: false, error: 'Проверьте адрес почты.' }, { status: 400 });
  try {
    const r = await requestCode(email);
    return NextResponse.json(r, { status: r.ok ? 200 : 429 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: 'Не удалось отправить письмо. Попробуйте позже.' }, { status: 500 });
  }
}
