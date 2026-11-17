import { db, check } from '@/lib/server/supabase';
import { handler, ok, isUuid } from '@/lib/server/http';
import { sanitizeCss, sanitizeHtml } from '@/lib/server/sanitize';

export const POST = handler(async (req) => {
  const b = await req.json();
  if (!isUuid(b.id)) throw new Error('Missing creative id');
  const patch = {};
  for (const k of ['spec', 'ad_copy', 'concept', 'rendered_url']) if (b[k] !== undefined) patch[k] = b[k];
  if (patch.spec?.mode === 'html') patch.spec = { ...patch.spec, html: sanitizeHtml(patch.spec.html), css: sanitizeCss(patch.spec.css) };
  const rows = check(await db().from('creatives').update(patch).eq('id', b.id).select('*'));
  if (!rows?.length) throw new Error('Creative not found');
  return ok({ creative: rows[0] });
});
