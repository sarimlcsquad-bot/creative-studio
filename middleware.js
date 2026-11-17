import { NextResponse } from 'next/server';
import { COOKIE, sessionToken } from '@/lib/server/auth';

// Everything except the login page and login API needs the session cookie.
export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname === '/login' || pathname === '/api/login') return NextResponse.next();
  const pw = (process.env.APP_PASSWORD || '').trim();
  const expected = pw ? await sessionToken(pw) : null;
  if (expected && req.cookies.get(COOKIE)?.value === expected) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Please log in again' }, { status: 401 });
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
