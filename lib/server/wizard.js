import 'server-only';
import PROMPTS from './prompts.json';
import { claudeJson } from './claude.js';
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
  compliance_notes: strs,
});
const ASSETS_SCHEMA = obj({
  ideas: { type: 'array', items: obj({ visual_type: { type: 'string', enum: ['photo', 'object', 'illustration'] }, shape: { type: 'string', enum: ['square', 'tall', 'wide'] }, idea: str, prompt: str }) },
});

const methodText = (method) => PROMPTS[`method:${method === '100m' ? '100m' : 'presold'}`];

function system(method, task) {
  return [
    'You help a marketer build one Meta (Facebook and Instagram) static ad creative step by step for one brand. You only use facts from the brand kit: never invent numbers, reviews, results, client names or guarantees. Respect every banned phrase and compliance note.',
    methodText(method),
    task,
  ].join('\n\n');
}

const directionText = (direction) => (String(direction || '').trim() ? `\n\nDIRECTION FOR THIS ROUND FROM THE USER (follow it closely)\n"${String(direction).trim()}"` : '');

function kitText(brand) {
  return `BRAND KIT (the only facts you may use):\n${JSON.stringify(brandKit(brand), null, 2)}`;
}

export async function suggestAngles({ brand, method, stage, avoid = [], direction = '' }) {
  const task = `# Task: angles
Suggest 5 distinct, professional ad angles for this brand, the kind a senior direct-response strategist would put in front of a client: each one specific, grounded in the brand kit and clearly different from the others. An angle is who the ad speaks to, the specific situation or object, and the insight that will make them stop. Spread them across different people, pains, desires and awareness stages${stage && stage !== 'auto' ? ` (all at awareness stage "${stage}")` : ''}. title: 3 to 8 words. audience: the one person in a few words. insight: one sentence in the reader's own language. why: one short sentence on why it should work for this brand.`;
  const content = `${kitText(brand)}${directionText(direction)}\n\n${avoid.length ? `Already shown, suggest different ones: ${avoid.join('; ')}\n\n` : ''}Give the 5 angles now.`;
  const out = await claudeJson({ system: system(method, task), content, schema: ANGLES_SCHEMA, effort: 'medium', maxTokens: 12000 });
  return (out.angles || []).slice(0, 6);
}

export async function suggestHooks({ brand, method, angle, prompt, stage, avoid = [], direction = '' }) {
  const task = `# Task: hooks
Write 15 different hooks for one ad. A hook is the first line the reader sees on the creative: the biggest text, the reason they stop scrolling. Mix styles: pain question, oddly specific situation, contrarian claim, before/after, "you" statement, number or time detail (only real numbers from the kit, or concrete times and situations), curiosity gap, identity line, offer-led (only with a real offer from the kit). Each hook at most about 12 words. Never write "This is for you". style: 1 to 3 words naming the hook type.`;
  const ctx = angle
    ? `ANGLE CHOSEN\n- ${angle.title}\n- Audience: ${angle.audience}\n- Insight: ${angle.insight}\n- Awareness stage: ${angle.stage}`
    : `DIRECTION FROM THE USER\n"${prompt}"${stage && stage !== 'auto' ? `\n- Awareness stage: ${stage}` : ''}`;
  const content = `${kitText(brand)}\n\n${ctx}${directionText(direction)}\n\n${avoid.length ? `Already shown, write different ones: ${avoid.map((h) => `"${h}"`).join('; ')}\n\n` : ''}Write the 15 hooks now.`;
  const out = await claudeJson({ system: system(method, task), content, schema: HOOKS_SCHEMA, effort: 'medium', maxTokens: 12000 });
  return (out.hooks || []).slice(0, 20);
}

export async function suggestContent({ brand, method, angle, prompt, hook, format, direction = '' }) {
  const vertical = format === '9:16';
  const task = `# Task: the words on the creative and the Meta ad copy
Write everything that goes ON the creative around the chosen hook, plus the Meta ad fields.
- headline: the hook as it should appear on the card (keep the person's wording; only tighten if it is over 12 words).
- support: one or two short sentences, at most about ${vertical ? 18 : 25} words, that carry the hook to the offer or mechanism.
- bullets: ${vertical ? '2 or 3' : '3 or 4'} short benefit or proof points, each at most about 6 words, no ending punctuation. Empty array if the idea is stronger without them.
- extra: an optional short line such as the hard offer, a verified stat or a risk reversal from the kit, or an empty string.
- cta: the button text, at most about 4 words. Use the brand's default CTA unless the stage calls for something softer.
${PROMPTS.copy.split('# Output')[0].trim()}
- compliance_notes: anything the business must confirm before running (an unverified price, a guarantee), else an empty array.`;
  const ctx = angle
    ? `ANGLE\n- ${angle.title}\n- Audience: ${angle.audience}\n- Insight: ${angle.insight}\n- Awareness stage: ${angle.stage}`
    : `DIRECTION FROM THE USER\n"${prompt}"`;
  const content = `${kitText(brand)}\n\n${ctx}\n\nHOOK CHOSEN\n"${hook}"\n\nFormat: ${format}${directionText(direction)}\n\nWrite it now.`;
  const out = await claudeJson({ system: system(method, task), content, schema: CONTENT_SCHEMA, effort: 'medium', maxTokens: 16000 });
  out.bullets = (out.bullets || []).filter(Boolean).slice(0, 5);
  return out;
}

export async function suggestAssets({ brand, method, angle, prompt, hook, copy, format, visual, avoid = [], direction = '' }) {
  const withPhoto = visual === 'both';
  const task = `# Task: visual asset ideas
Suggest 4 different visual assets for this creative. Each is one clear subject an image model will make, such as a glossy 3D calendar with one day circled, a phone showing a missed call, a price tag, a clipboard, or a realistic scene. ${withPhoto ? 'A brand photo will sit in the background behind a dark overlay, so each asset must work as a foreground object on top of it: prefer 3D objects and icons with a clean or transparent-looking plain background, not full scenes.' : 'The asset is the main visual of the creative.'}
- visual_type: "photo" (realistic scene), "object" (glossy 3D icon or object) or "illustration".
- shape: how it will sit in the layout ("square", "tall" or "wide").
- idea: a short label a person can choose from, at most about 8 words, such as "Phone showing 3 missed calls".
- prompt: the brief for the image model, in the brand colours by hex, with no text, letters, numbers, logos or signage in the image.`;
  const ctx = angle
    ? `ANGLE\n- ${angle.title}\n- Audience: ${angle.audience}\n- Insight: ${angle.insight}`
    : `DIRECTION FROM THE USER\n"${prompt}"`;
  const words = copy ? `\n\nCOPY ON THE CREATIVE\n${JSON.stringify(copy)}` : '';
  const content = `${kitText(brand)}\n\n${ctx}\n\nHOOK\n"${hook}"${words}\n\nFormat: ${format}${directionText(direction)}\n\n${avoid.length ? `Already shown, suggest different ones: ${avoid.join('; ')}\n\n` : ''}Give the 4 ideas now.`;
  const out = await claudeJson({ system: system(method, task), content, schema: ASSETS_SCHEMA, effort: 'medium', maxTokens: 8000 });
  return (out.ideas || []).slice(0, 6);
}
