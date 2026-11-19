import { after } from 'next/server';
import { db, check } from '@/lib/server/supabase';
import { handler, ok } from '@/lib/server/http';
import { parseRequest, planJobs, recentFor, runJob } from '@/lib/server/generate';
import { suggestAngles } from '@/lib/server/wizard';

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
    format: j.format, photo_source: j.photo_source, stage: req.stage, method: j.method, status: 'generating',
  }))).select('*'));
  const { headlines, layouts, backgrounds } = await recentFor(brand.id);
  // Answer the browser now; write the creatives in the background, in parallel.
  after(async () => {
    // A batch made without the builder gets one distinct angle per creative first, so they don't repeat each other.
    if (!req.brief && req.count > 1) {
      try {
        const { angles } = await suggestAngles({
          brand, source: req.source, method: req.method === '100m' ? '100m' : 'presold', stage: req.stage, avoid: headlines,
          direction: `Give exactly ${req.count} angles, each built on a different concrete moment.${req.prompt.trim() ? ` Follow this direction: "${req.prompt.trim()}"` : ''}`,
        });
        jobs.forEach((j) => { j.angle = angles[j.index % Math.max(angles.length, 1)] || null; });
      } catch (e) { console.error('batch angles', e); }
    }
    await Promise.all(rows.map((row, i) => runJob({ creativeId: row.id, brand, req, job: jobs[i], headlines, layouts, backgrounds })));
  });
  return ok({ creatives: rows });
});
