import { db, check } from '@/lib/server/supabase';
import { handler, ok, isUuid } from '@/lib/server/http';
import { sanitizeCss, sanitizeHtml } from '@/lib/server/sanitize';

export const POST = handler(async (req) => {
  const b = await req.json();
  if (!isUuid(b.id)) throw new Error('Missing creative id');
  const patch = {};
  for (const k of ['spec', 'ad_copy', 'concept', 'rendered_url']) if (b[k] !== undefined) patch[k] = b[k];
  // A background photo may only come from this app's own storage.
  const base = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
  if (patch.spec?.bg_url && !(base && String(patch.spec.bg_url).startsWith(`${base}/storage/v1/object/public/`))) delete patch.spec.bg_url;
  if (patch.spec?.mode === 'html') patch.spec = { ...patch.spec, html: sanitizeHtml(patch.spec.html), css: sanitizeCss(patch.spec.css) };
  const rows = check(await db().from('creatives').update(patch).eq('id', b.id).select('*'));
  if (!rows?.length) throw new Error('Creative not found');
  return ok({ creative: rows[0] });
});
