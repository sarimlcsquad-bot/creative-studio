import { db, check } from '@/lib/server/supabase';
import { handler, ok, isUuid } from '@/lib/server/http';
import { previewImage, suggestAngles, suggestContent, suggestHooks } from '@/lib/server/wizard';

// One endpoint for the builder's suggestion steps. body.step picks the step.
export const maxDuration = 300;

const clip = (v, n = 2000) => String(v || '').slice(0, n);
const cleanAngle = (a) => (a && typeof a === 'object' ? { title: clip(a.title, 200), audience: clip(a.audience, 300), insight: clip(a.insight, 600), stage: clip(a.stage, 20) || 'auto' } : null);

export const POST = handler(async (request) => {
  const b = await request.json();
  if (b.step === 'image') return ok({ url: await previewImage({ prompt: clip(b.prompt, 3000), shape: b.shape }) });

  if (!isUuid(b.brand_id)) throw new Error('Pick a brand');
  const brand = check(await db().from('brands').select('*').eq('id', b.brand_id))?.[0];
  if (!brand) throw new Error('Brand not found');
  const method = b.method === '100m' ? '100m' : 'presold';
  const avoid = Array.isArray(b.avoid) ? b.avoid.map((x) => clip(x, 200)).slice(0, 40) : [];
  const angle = cleanAngle(b.angle);
  const prompt = clip(b.prompt, 4000);

  if (b.step === 'angles') return ok({ angles: await suggestAngles({ brand, method, stage: b.stage, avoid }) });
  if (b.step === 'hooks') {
    if (!angle && !prompt.trim()) throw new Error('Pick an angle or write a prompt first');
    return ok({ hooks: await suggestHooks({ brand, method, angle, prompt, stage: b.stage, avoid }) });
  }
  if (b.step === 'content') {
    if (!clip(b.hook).trim()) throw new Error('Pick a hook first');
    return ok({ content: await suggestContent({ brand, method, angle, prompt, hook: clip(b.hook, 300), format: b.format }) });
  }
  throw new Error('Unknown step');
});
