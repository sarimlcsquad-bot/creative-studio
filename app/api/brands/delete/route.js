import { db, check } from '@/lib/server/supabase';
import { handler, ok, isUuid } from '@/lib/server/http';

export const POST = handler(async (req) => {
  const { id } = await req.json();
  if (!isUuid(id)) throw new Error('Missing brand id');
  check(await db().from('brands').delete().eq('id', id)); // creatives go with it (on delete cascade)
  return ok({ ok: true });
});
