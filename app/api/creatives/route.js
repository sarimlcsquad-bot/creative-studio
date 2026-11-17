import { db, check } from '@/lib/server/supabase';
import { handler, ok, isUuid } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
const STALE_MS = 15 * 60 * 1000;

export const GET = handler(async (req) => {
  const q = new URL(req.url).searchParams;
  let query = db().from('creatives').select('*').order('created_at', { ascending: false }).limit(300);
  if (isUuid(q.get('brand_id'))) query = query.eq('brand_id', q.get('brand_id'));
  if (['agency', 'owner'].includes(q.get('source'))) query = query.eq('source', q.get('source'));
  if (['ready', 'generating', 'failed'].includes(q.get('status'))) query = query.eq('status', q.get('status'));
  const rows = check(await query) || [];
  // A run cut off part-way (server restart, timeout) would otherwise show "generating" forever.
  const creatives = rows.map((r) => (r.status === 'generating' && Date.now() - Date.parse(r.created_at) > STALE_MS
    ? { ...r, status: 'failed', error: r.error || 'Timed out. Try generating again.' } : r));
  return ok({ creatives });
});
