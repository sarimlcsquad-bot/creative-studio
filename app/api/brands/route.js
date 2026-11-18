import { db, check } from '@/lib/server/supabase';
import { handler, ok } from '@/lib/server/http';

const FIELDS = ['id', 'name', 'website', 'industry', 'description', 'service_area', 'target_audience', 'services',
  'offer', 'differentiators', 'proof_points', 'guarantees', 'default_cta', 'tone_of_voice', 'banned_phrases',
  'compliance_notes', 'colors', 'fonts', 'logo_url', 'logo_mono', 'brand_images', 'social', 'agency_name', 'website_summary', 'email', 'audiences'];

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const brands = check(await db().from('brands').select('*').order('name', { ascending: true }));
  return ok({ brands });
});

// Create (no id) or update (with id).
export const POST = handler(async (req) => {
  const b = await req.json();
  const row = {};
  for (const k of FIELDS) if (b[k] !== undefined) row[k] = b[k];
  for (const k of ['name', 'website', 'industry']) {
    if (!String(row[k] || '').trim()) throw new Error(`Missing required field: ${k}`);
  }
  let rows;
  try {
    rows = await save(row);
  } catch (e) {
    if (/email|audiences/.test(e.message) && /column/i.test(e.message)) {
      throw new Error('Your database needs a small update for the new brand fields: open Supabase, SQL Editor, and run supabase/schema.sql again (it is safe to re-run).');
    }
    throw e;
  }
  if (!rows?.length) throw new Error('Brand not found');
  return ok({ brand: rows[0] });
});

async function save(row) {
  let rows;
  if (row.id) {
    const { id, ...patch } = row;
    rows = check(await db().from('brands').update(patch).eq('id', id).select('*'));
  } else {
    delete row.id;
    rows = check(await db().from('brands').insert(row).select('*'));
  }
  return rows;
}
