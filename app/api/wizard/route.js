import { db, check } from '@/lib/server/supabase';
import { aiImagesEnabled } from '@/lib/server/openai';
import { handler, ok, isUuid } from '@/lib/server/http';
import { suggestAngles, suggestAssets, suggestContent, suggestHooks, suggestPanels, suggestScreens } from '@/lib/server/wizard';

// One endpoint for the builder's suggestion steps. body.step picks the step.
export const maxDuration = 300;

const clip = (v, n = 2000) => String(v || '').slice(0, n);
const cleanAngle = (a) => (a && typeof a === 'object' ? { title: clip(a.title, 200), audience: clip(a.audience, 300), insight: clip(a.insight, 600), stage: clip(a.stage, 20) || 'auto' } : null);

export const POST = handler(async (request) => {
  const b = await request.json();
  if (!isUuid(b.brand_id)) throw new Error('Pick a brand');
  const brand = check(await db().from('brands').select('*').eq('id', b.brand_id))?.[0];
  if (!brand) throw new Error('Brand not found');
  const method = ['100m', 'both'].includes(b.method) ? b.method : 'presold';
  const avoid = Array.isArray(b.avoid) ? b.avoid.map((x) => clip(x, 200)).slice(0, 40) : [];
  const angle = cleanAngle(b.angle);
  const prompt = clip(b.prompt, 4000);
  const direction = clip(b.direction, 1500);
  const notes = clip(b.notes, 1500);
  const history = Array.isArray(b.history) ? b.history.map((x) => clip(x, 1000)).slice(-8) : [];
  const source = b.source === 'agency' ? 'agency' : 'owner';
  const chat = { direction, history, notes, source, device: b.design === 'device' || b.design === 'panel' || !b.design };
  const format = b.format === 'both' ? '4:5 and 9:16 (one of each)' : b.format;

  if (b.step === 'angles') return ok(await suggestAngles({ brand, method, stage: b.stage, avoid, howMany: Math.min(Math.max(parseInt(b.how_many, 10) || 5, 3), 12), ...chat }));
  if (b.step === 'hooks') {
    if (!angle && !prompt.trim()) throw new Error('Pick an angle or write a prompt first');
    return ok(await suggestHooks({ brand, method, angle, prompt, stage: b.stage, avoid, ...chat }));
  }
  if (b.step === 'content') {
    if (!clip(b.hook).trim()) throw new Error('Pick a hook first');
    const k = b.current && typeof b.current === 'object' ? b.current : null;
    const list = (v, n, max) => (Array.isArray(v) ? v : []).map((t) => clip(t, n)).slice(0, max);
    const cur = k ? {
      headline: clip(k.headline, 300), support: clip(k.support, 600), bullets: list(k.bullets, 120, 6), extra: clip(k.extra, 200), cta: clip(k.cta, 60),
      accent_words: list(k.accent_words, 60, 4), proof_line: clip(k.proof_line, 200), bonus_pill: clip(k.bonus_pill, 80), cta_note: clip(k.cta_note, 120),
    } : null;
    const content = await suggestContent({ brand, method, angle, prompt, hook: clip(b.hook, 300), format, current: cur, ...chat });
    return ok({ content, reply: content.reply || '' });
  }
  if (b.step === 'assets') {
    if (!clip(b.hook).trim()) throw new Error('Pick a hook first');
    const c = b.copy && typeof b.copy === 'object' ? { headline: clip(b.copy.headline, 300), support: clip(b.copy.support, 600), extra: clip(b.copy.extra, 200) } : null;
    return ok(await suggestAssets({ brand, method, angle, prompt, hook: clip(b.hook, 300), copy: c, format, visual: b.visual === 'both' ? 'both' : 'ai', avoid, ...chat }));
  }
  if (b.step === 'screens') {
    if (!clip(b.hook).trim()) throw new Error('Pick a hook first');
    const c = b.copy && typeof b.copy === 'object' ? { headline: clip(b.copy.headline, 300), support: clip(b.copy.support, 600) } : null;
    return ok(await suggestScreens({ brand, method, angle, prompt, hook: clip(b.hook, 300), copy: c, format, avoid, aiImages: aiImagesEnabled(), ...chat }));
  }
  if (b.step === 'panels') {
    if (!clip(b.hook).trim()) throw new Error('Pick a hook first');
    const c = b.copy && typeof b.copy === 'object' ? { headline: clip(b.copy.headline, 300), support: clip(b.copy.support, 600) } : null;
    return ok(await suggestPanels({ brand, method, angle, prompt, hook: clip(b.hook, 300), copy: c, format, avoid, ...chat }));
  }
  throw new Error('Unknown step');
});
