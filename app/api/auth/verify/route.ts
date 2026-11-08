import { NextResponse } from 'next/server';
import { normalizeEmail, verifyCode } from '@/lib/auth';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email) return NextResponse.json({ ok: false, error: 'Проверьте адрес почты.' }, { status: 400 });
  const r = await verifyCode(email, String(body.code || ''));
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json({ ok: true });
}
