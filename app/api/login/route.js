import { NextResponse } from 'next/server';
import { COOKIE, sessionToken } from '@/lib/server/auth';

export async function POST(req) {
  const { password } = await req.json().catch(() => ({}));
  const expected = (process.env.APP_PASSWORD || '').trim();
  if (!expected) return NextResponse.json({ error: 'APP_PASSWORD is not set on the server' }, { status: 500 });
  if (!password || String(password).trim() !== expected) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await sessionToken(expected), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' && !process.env.INSECURE_COOKIES,
    path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
