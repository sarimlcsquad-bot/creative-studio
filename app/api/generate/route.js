import { after } from 'next/server';
import { db, check } from '@/lib/server/supabase';
import { handler, ok } from '@/lib/server/http';
import { parseRequest, planJobs, recentFor, runJob } from '@/lib/server/generate';

// Claude can take a minute or two per creative; the work runs after the
// response, so the host must allow long functions (Vercel: up to 300s on Hobby).
export const maxDuration = 300;

export const POST = handler(async (request) => {
  const req = parseRequest(await request.json());
  const brands = check(await db().from('brands').select('*').eq('id', req.brand_id));
  const brand = brands?.[0];
  if (!brand) throw new Error('Brand not found');
  const jobs = planJobs(req, brand);
  const rows = check(await db().from('creatives').insert(jobs.map((j) => ({
    brand_id: brand.id, source: req.source, created_by: req.created_by, mode: req.mode, prompt: req.prompt,
    format: req.format, photo_source: j.photo_source, stage: req.stage, method: j.method, status: 'generating',
  }))).select('*'));
  const headlines = await recentFor(brand.id);
  // Answer the browser now; write the creatives in the background, in parallel.
  after(() => Promise.all(rows.map((row, i) => runJob({ creativeId: row.id, brand, req, job: jobs[i], headlines }))));
  return ok({ creatives: rows });
});
