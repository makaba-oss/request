import { NextResponse } from 'next/server';
import { logout } from '@/lib/auth';

export async function POST(req: Request) {
  await logout();
  return NextResponse.redirect(new URL('/', req.url), { status: 303 });
}
