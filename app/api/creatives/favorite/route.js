import { db, check } from '@/lib/server/supabase';
import { handler, ok, isUuid } from '@/lib/server/http';

// Marks a creative as a favorite (or not). Kept inside `concept`, so no database change is needed.
export const POST = handler(async (req) => {
  const { id, favorite } = await req.json();
  if (!isUuid(id)) throw new Error('Missing creative id');
  const row = check(await db().from('creatives').select('concept').eq('id', id))?.[0];
  if (!row) throw new Error('Creative not found');
  const concept = { ...(row.concept || {}), favorite: !!favorite };
  const rows = check(await db().from('creatives').update({ concept }).eq('id', id).select('*'));
  return ok({ creative: rows?.[0] });
});
