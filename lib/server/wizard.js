import 'server-only';
import PROMPTS from './prompts.json';
import { claudeJson } from './claude.js';
import { db, check, publicUrl } from './supabase.js';
import { aiImagesEnabled, makeImage } from './openai.js';
import { brandKit } from './generate.js';

// The step-by-step builder: angles -> hooks -> creative copy -> asset ideas.
// Each step is one quick Claude call; the person picks or edits before the next.

const STAGE_ENUM = ['unaware', 'problem', 'solution', 'product', 'most'];
const str = { type: 'string' };
const strs = { type: 'array', items: str };
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

const ANGLES_SCHEMA = obj({
  angles: { type: 'array', items: obj({ title: str, audience: str, insight: str, stage: { type: 'string', enum: STAGE_ENUM }, why: str }) },
});
const HOOKS_SCHEMA = obj({
  hooks: { type: 'array', items: obj({ text: str, style: str }) },
});
const CONTENT_SCHEMA = obj({
  headline: str,
  support: str,
  bullets: strs,
  extra: str,
  cta: str,
  ad_copy: obj({
    primary_text: str, headline: str, description: str,
    cta_button: { type: 'string', enum: ['BOOK_NOW', 'LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'CONTACT_US', 'SHOP_NOW', 'SUBSCRIBE', 'GET_OFFER', 'APPLY_NOW'] },
  }),
  image_ideas: { type: 'array', items: obj({ visual_type: { type: 'string', enum: ['photo', 'object', 'illustration'] }, shape: { type: 'string', enum: ['square', 'tall', 'wide'] }, idea: str, prompt: str }) },
  compliance_notes: strs,
});

const methodText = (method) => PROMPTS[`method:${method === '100m' ? '100m' : 'presold'}`];

function system(method, task) {
  return [
    'You help a marketer build one Meta (Facebook and Instagram) static ad creative step by step for one brand. You only use facts from the brand kit: never invent numbers, reviews, results, client names or guarantees. Respect every banned phrase and compliance note.',
    methodText(method),
    task,
  ].join('\n\n');
}

function kitText(brand) {
  return `BRAND KIT (the only facts you may use):\n${JSON.stringify(brandKit(brand), null, 2)}`;
}

export async function suggestAngles({ brand, method, stage, avoid = [] }) {
  const task = `# Task: angles
Suggest 8 distinct ad angles for this brand. An angle is who the ad speaks to, the specific situation or object, and the insight that will make them stop. Spread them across different people, pains, desires and awareness stages${stage && stage !== 'auto' ? ` (all at awareness stage "${stage}")` : ''}. title: 3 to 8 words. audience: the one person in a few words. insight: one sentence in the reader's own language. why: one short sentence on why it should work for this brand.`;
  const content = `${kitText(brand)}\n\n${avoid.length ? `Already shown, suggest different ones: ${avoid.join('; ')}\n\n` : ''}Give the 8 angles now.`;
  const out = await claudeJson({ system: system(method, task), content, schema: ANGLES_SCHEMA, effort: 'medium', maxTokens: 12000 });
  return (out.angles || []).slice(0, 10);
}

export async function suggestHooks({ brand, method, angle, prompt, stage, avoid = [] }) {
  const task = `# Task: hooks
Write 15 different hooks for one ad. A hook is the first line the reader sees on the creative: the biggest text, the reason they stop scrolling. Mix styles: pain question, oddly specific situation, contrarian claim, before/after, "you" statement, number or time detail (only real numbers from the kit, or concrete times and situations), curiosity gap, identity line, offer-led (only with a real offer from the kit). Each hook at most about 12 words. Never write "This is for you". style: 1 to 3 words naming the hook type.`;
  const ctx = angle
    ? `ANGLE CHOSEN\n- ${angle.title}\n- Audience: ${angle.audience}\n- Insight: ${angle.insight}\n- Awareness stage: ${angle.stage}`
    : `DIRECTION FROM THE USER\n"${prompt}"${stage && stage !== 'auto' ? `\n- Awareness stage: ${stage}` : ''}`;
  const content = `${kitText(brand)}\n\n${ctx}\n\n${avoid.length ? `Already shown, write different ones: ${avoid.map((h) => `"${h}"`).join('; ')}\n\n` : ''}Write the 15 hooks now.`;
  const out = await claudeJson({ system: system(method, task), content, schema: HOOKS_SCHEMA, effort: 'medium', maxTokens: 12000 });
  return (out.hooks || []).slice(0, 20);
}

export async function suggestContent({ brand, method, angle, prompt, hook, format }) {
  const vertical = format === '9:16';
  const task = `# Task: the words on the creative, the Meta ad copy and image ideas
Write everything that goes ON the creative around the chosen hook, plus the Meta ad fields and three image ideas.
- headline: the hook as it should appear on the card (keep the person's wording; only tighten if it is over 12 words).
- support: one or two short sentences, at most about ${vertical ? 18 : 25} words, that carry the hook to the offer or mechanism.
- bullets: ${vertical ? '2 or 3' : '3 or 4'} short benefit or proof points, each at most about 6 words, no ending punctuation. Empty array if the idea is stronger without them.
- extra: an optional short line such as the hard offer, a verified stat or a risk reversal from the kit, or an empty string.
- cta: the button text, at most about 4 words. Use the brand's default CTA unless the stage calls for something softer.
${PROMPTS.copy.split('# Output')[0].trim()}
- image_ideas: three different visual assets for this creative. visual_type "photo" (realistic scene), "object" (a glossy 3D icon or object such as a calendar with one day circled, a phone, a price tag) or "illustration". shape is how it will sit in the layout. idea: a short label a person can choose from. prompt: the brief for the image model, in the brand colours by hex, with no text, letters, numbers, logos or signage in the image.
- compliance_notes: anything the business must confirm before running (an unverified price, a guarantee), else an empty array.`;
  const ctx = angle
    ? `ANGLE\n- ${angle.title}\n- Audience: ${angle.audience}\n- Insight: ${angle.insight}\n- Awareness stage: ${angle.stage}`
    : `DIRECTION FROM THE USER\n"${prompt}"`;
  const content = `${kitText(brand)}\n\n${ctx}\n\nHOOK CHOSEN\n"${hook}"\n\nFormat: ${format}\n\nWrite it now.`;
  const out = await claudeJson({ system: system(method, task), content, schema: CONTENT_SCHEMA, effort: 'medium', maxTokens: 16000 });
  out.bullets = (out.bullets || []).filter(Boolean).slice(0, 5);
  out.image_ideas = (out.image_ideas || []).slice(0, 4);
  return out;
}

const SIZE = { square: '1024x1024', tall: '1024x1536', wide: '1536x1024' };

/** Makes an AI image now so the person can see it before the creative is designed. */
export async function previewImage({ prompt, shape }) {
  if (!aiImagesEnabled()) throw new Error('AI images are off: add OPENAI_API_KEY on the server');
  if (!String(prompt || '').trim()) throw new Error('Write an image idea first');
  const png = await makeImage({ prompt: String(prompt).slice(0, 3000), size: SIZE[shape] || SIZE.square });
  const path = `ai-images/draft-${crypto.randomUUID()}.png`;
  check(await db().storage.from('creatives').upload(path, png, { contentType: 'image/png', upsert: true }));
  return publicUrl('creatives', path);
}
