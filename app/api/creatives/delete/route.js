import { db, check } from '@/lib/server/supabase';
import { handler, ok, isUuid } from '@/lib/server/http';

export const POST = handler(async (req) => {
  const { id } = await req.json();
  if (!isUuid(id)) throw new Error('Missing creative id');
  check(await db().from('creatives').delete().eq('id', id));
  return ok({ ok: true });
});
