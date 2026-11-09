import { NextResponse } from 'next/server';
import { passwordLogin } from '@/lib/auth';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const r = await passwordLogin(String(body.login ?? ''), String(body.password ?? ''));
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
