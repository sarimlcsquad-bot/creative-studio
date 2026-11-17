import { NextResponse } from 'next/server';

export const ok = (data) => NextResponse.json(data);
export const fail = (message, status = 400) => NextResponse.json({ error: message }, { status });

export function handler(fn) {
  return async (req, ctx) => {
    try { return await fn(req, ctx); }
    catch (e) {
      console.error(e);
      return fail(e?.message || 'Something went wrong', e?.status || 400);
    }
  };
}

export const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(String(s || ''));
