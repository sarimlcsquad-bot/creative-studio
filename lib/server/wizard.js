import 'server-only';
import PROMPTS from './prompts.json';
import { claudeJson } from './claude.js';
import { brandKit, scrubRatings } from './generate.js';

// The step-by-step builder: angles -> hooks -> creative copy -> asset ideas.
// Each step is one quick Claude call; the person picks or edits before the next.

const STAGE_ENUM = ['unaware', 'problem', 'solution', 'product', 'most'];
const str = { type: 'string' };
const strs = { type: 'array', items: str };
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

const ANGLES_SCHEMA = obj({
  reply: str,
  action: { type: 'string', enum: ['replace', 'add'] },
  angles: { type: 'array', items: obj({ title: str, audience: str, insight: str, stage: { type: 'string', enum: STAGE_ENUM }, why: str }) },
});
const HOOKS_SCHEMA = obj({
  reply: str,
  action: { type: 'string', enum: ['replace', 'add'] },
  hooks: { type: 'array', items: obj({ text: str, style: str }) },
});
const CONTENT_SCHEMA = obj({
  reply: str,
  headline: str,
  support: str,
  bullets: strs,
  extra: str,
  cta: str,
  ad_copy: obj({
    primary_text: str, headline: str, description: str,
    cta_button: { type: 'string', enum: ['BOOK_NOW', 'LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'CONTACT_US', 'SHOP_NOW', 'SUBSCRIBE', 'GET_OFFER', 'APPLY_NOW'] },
  }),
  accent_words: strs,
  proof_line: str,
  bonus_pill: str,
  cta_note: str,
  claims_used: strs,
  flags: strs,
  compliance_notes: strs,
});
const ASSETS_SCHEMA = obj({
  reply: str,
  action: { type: 'string', enum: ['replace', 'add'] },
  ideas: { type: 'array', items: obj({ visual_type: { type: 'string', enum: ['photo', 'object', 'illustration'] }, shape: { type: 'string', enum: ['square', 'tall', 'wide'] }, idea: str, prompt: str }) },
});

const SCREENS_SCHEMA = obj({
  reply: str,
  action: { type: 'string', enum: ['replace', 'add'] },
  screens: { type: 'array', items: obj({
    idea: str,
    kind: { type: 'string', enum: ['device', 'object'] },
    object: str,
    image_prompt: str,
    device: { type: 'string', enum: ['phone', 'tablet', 'laptop'] },
    device_side: { type: 'string', enum: ['right', 'left', 'below'] },
    background_hex: str,
    app_title: str,
    elements: strs,
  }) },
});

const methodText = (method) => PROMPTS[`method:${['100m', 'both'].includes(method) ? method : 'presold'}`];

function system(method, task) {
  return [
    PROMPTS.core,
    'Right now you are helping a person build one creative step by step in a builder: each step is one suggestion task, below. The person picks or edits your suggestions before the next step. Return JSON only.',
    methodText(method),
    task,
  ].join('\n\n');
}

// The person talks to each step like a chat: their latest message is the main instruction.
function chatText({ direction = '', history = [], notes = '' }) {
  const parts = [];
  if (String(notes).trim()) parts.push(`BACKGROUND FROM THE USER (from setup, keep it in mind)\n"${String(notes).trim()}"`);
  const past = history.filter((h) => String(h).trim());
  if (past.length) parts.push(`EARLIER MESSAGES FROM THE USER IN THIS STEP (oldest first, for context)\n${past.map((h) => `- "${h}"`).join('\n')}`);
  if (String(direction).trim()) {
    parts.push(`THE USER'S MESSAGE NOW (this is your main instruction: do exactly what it asks, fully, even if it changes the topic, audience, tone, length or number of items. Only the brand-kit fact rules and banned phrases come before it.)\n"${String(direction).trim()}"`);
  }
  return parts.length ? `\n\n${parts.join('\n\n')}` : '';
}
const REPLY_RULE = 'reply: one or two short, friendly sentences to the user saying what you made and how it follows their message (if there is no message, just introduce the suggestions). Plain text, no lists.';
const ACTION_RULE = 'action: "add" only when the user asks for more or additional items to add to what they already have; otherwise "replace".';

function kitText(brand, source) {
  return `BRAND KIT (the only facts you may use):\n${JSON.stringify(brandKit(brand, source), null, 2)}`;
}

export async function suggestAngles({ brand, source, method, stage, howMany = 5, avoid = [], direction = '', history = [], notes = '' }) {
  const task = `# Task: angles
Suggest ${howMany} distinct, professional ad angles for this brand, the kind a senior direct-response strategist would put in front of a client: each one specific, grounded in the brand kit and clearly different from the others. An angle is who the ad speaks to, the one concrete moment they live through (the call that goes to voicemail at 7:40pm, the client asking for an update you have not sent), and the insight that will make them stop. With no message from the user, build each angle on a different concrete moment; when the user names themes or pains, give one angle per pain. Spread them across different people, pains, desires and awareness stages${stage && stage !== 'auto' ? ` (all at awareness stage "${stage}")` : ''}. title: 3 to 8 words. audience: the one person in a few words. insight: one sentence in the reader's own language. why: one short sentence on why it should work for this brand. If the user asks for a different number of angles, give that number.\n${REPLY_RULE}\n${ACTION_RULE}`;
  const content = `${kitText(brand, source)}${chatText({ direction, history, notes })}\n\n${avoid.length ? `Already shown to the user (do not repeat them): ${avoid.join('; ')}\n\n` : ''}Answer now.`;
  const out = await claudeJson({ system: system(method, task), content, schema: ANGLES_SCHEMA, effort: 'medium', maxTokens: 12000 });
  return { angles: (out.angles || []).slice(0, 12), reply: out.reply || '', action: out.action === 'add' ? 'add' : 'replace' };
}

export async function suggestHooks({ brand, source, device = false, method, angle, prompt, stage, avoid = [], direction = '', history = [], notes = '' }) {
  const task = `# Task: hooks${device ? '\nThe creative is a device card: the hook becomes a 2 or 3 line headline, so keep every hook to about 9 words or fewer, plain and clear.' : ''}
Write 15 different hooks for one ad. A hook is the first line the reader sees on the creative: the biggest text, the reason they stop scrolling. Mix styles: pain question, oddly specific situation, contrarian claim, before/after, "you" statement, number or time detail (only real numbers from the kit, or concrete times and situations), curiosity gap, identity line, offer-led (only with a real offer from the kit). Each hook at most about 12 words, in the audience's own words, one pain per hook, clear before clever. If the user's message contains finished hook lines, return those lines word for word as hooks (style "yours"), add a flag-style note in reply if one makes a claim the brand kit does not support, and only then add your own. If the user names themes or pains, write hooks for each one. style: 1 to 3 words naming the hook type. If the user asks for a different number of hooks, a single style, or a specific theme, do exactly that.\n${REPLY_RULE}\n${ACTION_RULE}`;
  const ctx = angle
    ? `ANGLE CHOSEN\n- ${angle.title}\n- Audience: ${angle.audience}\n- Insight: ${angle.insight}\n- Awareness stage: ${angle.stage}`
    : `DIRECTION FROM THE USER\n"${prompt}"${stage && stage !== 'auto' ? `\n- Awareness stage: ${stage}` : ''}`;
  const content = `${kitText(brand, source)}\n\n${ctx}${chatText({ direction, history, notes })}\n\n${avoid.length ? `Already shown to the user (do not repeat them): ${avoid.map((h) => `"${h}"`).join('; ')}\n\n` : ''}Answer now.`;
  const out = await claudeJson({ system: system(method, task), content, schema: HOOKS_SCHEMA, effort: 'medium', maxTokens: 12000 });
  return { hooks: (out.hooks || []).slice(0, 30), reply: out.reply || '', action: out.action === 'add' ? 'add' : 'replace' };
}

export async function suggestContent({ brand, source, device = false, method, angle, prompt, hook, format, direction = '', history = [], notes = '', current = null }) {
  const vertical = format === '9:16';
  const task = `# Task: the words on the creative and the Meta ad copy
Write everything that goes ON the creative around the chosen hook, plus the Meta ad fields.
- headline: the hook as it should appear on the card (keep the person's wording; only tighten if it is over ${device ? 9 : 12} words).${device ? ' On this device card the support line, bullets and extra line are NOT shown on the card; write them anyway as raw material for the caption, and put the benefits in the caption bullets.' : ''}
- support: one or two short sentences, at most about ${vertical ? 18 : 25} words, that carry the hook to the offer or mechanism.
- bullets: ${vertical ? '2 or 3' : '3 or 4'} short benefit or proof points, each at most about 6 words, no ending punctuation. Empty array if the idea is stronger without them.
- extra: an optional short line such as the hard offer, a verified stat or a risk reversal from the kit, or an empty string.
- cta: the button text: the brand's default CTA exactly as written in the kit (only if the kit has none, at most about 4 words of your own).
- accent_words: 1 to 3 payoff words from the headline, word for word, that get the accent colour.
- proof_line, bonus_pill, cta_note: from the brand kit's audience block exactly as written (or verified_proof_points / main_offer when there is no audience block); empty string when the kit has none.
- claims_used: each brand-kit claim the copy relies on, word for word.
- flags: what the business must confirm (a claim in the person's own words the kit does not support), else an empty array.
${PROMPTS.copy.split('# Output')[0].trim()}
- ${REPLY_RULE}
- If the user's message asks to change only part of the current copy, keep the rest as it is.
- compliance_notes: anything the business must confirm before running (an unverified price, a guarantee), else an empty array.`;
  const ctx = angle
    ? `ANGLE\n- ${angle.title}\n- Audience: ${angle.audience}\n- Insight: ${angle.insight}\n- Awareness stage: ${angle.stage}`
    : `DIRECTION FROM THE USER\n"${prompt}"`;
  const cur = current ? `\n\nCURRENT COPY (the user may have edited it; change it as their message asks)\n${JSON.stringify(current)}` : '';
  const content = `${kitText(brand, source)}\n\n${ctx}\n\nHOOK CHOSEN\n"${hook}"\n\nFormat: ${format}${cur}${chatText({ direction, history, notes })}\n\nAnswer now.`;
  const out = await claudeJson({ system: system(method, task), content, schema: CONTENT_SCHEMA, effort: 'medium', maxTokens: 16000 });
  out.bullets = (out.bullets || []).filter(Boolean).slice(0, 5);
  if (out.ad_copy) {
    const t = scrubRatings(out.ad_copy.primary_text);
    if (t !== out.ad_copy.primary_text) { out.ad_copy.primary_text = t; out.flags = [...(out.flags || []), 'A rating or review score was removed from the caption.']; }
  }
  return out;
}

export async function suggestAssets({ brand, source, method, angle, prompt, hook, copy, format, visual, avoid = [], direction = '', history = [], notes = '' }) {
  const withPhoto = visual === 'both';
  const task = `# Task: visual asset ideas
Suggest 4 different visual assets for this creative. Each is one clear subject an image model will make, such as a glossy 3D calendar with one day circled, a phone showing a missed call, a price tag, a clipboard, or a realistic scene. ${withPhoto ? 'A brand photo will sit in the background behind a dark overlay, so each asset must work as a foreground object on top of it: prefer 3D objects and icons with a clean or transparent-looking plain background, not full scenes.' : 'The asset is the main visual of the creative.'}
- visual_type: "photo" (realistic scene), "object" (glossy 3D icon or object) or "illustration".
- shape: how it will sit in the layout ("square", "tall" or "wide").
- idea: a short label a person can choose from, at most about 8 words, such as "Phone showing 3 missed calls".
- prompt: the brief for the image model, in the brand colours by hex, with no text, letters, numbers, logos or signage in the image.\nIf the user describes the image they want, make that image (and variations of it) rather than other ideas. If they ask for a different number, give that number.\n${REPLY_RULE}\n${ACTION_RULE}`;
  const ctx = angle
    ? `ANGLE\n- ${angle.title}\n- Audience: ${angle.audience}\n- Insight: ${angle.insight}`
    : `DIRECTION FROM THE USER\n"${prompt}"`;
  const words = copy ? `\n\nCOPY ON THE CREATIVE\n${JSON.stringify(copy)}` : '';
  const content = `${kitText(brand, source)}\n\n${ctx}\n\nHOOK\n"${hook}"${words}\n\nFormat: ${format}${chatText({ direction, history, notes })}\n\n${avoid.length ? `Already shown to the user (do not repeat them): ${avoid.join('; ')}\n\n` : ''}Answer now.`;
  const out = await claudeJson({ system: system(method, task), content, schema: ASSETS_SCHEMA, effort: 'medium', maxTokens: 8000 });
  return { ideas: (out.ideas || []).slice(0, 10), reply: out.reply || '', action: out.action === 'add' ? 'add' : 'replace' };
}

export async function suggestScreens({ brand, source, method, angle, prompt, hook, copy, format, aiImages = false, avoid = [], direction = '', history = [], notes = '' }) {
  const task = `# Task: hero visual ideas
The creative is a clean card: one hero visual on one flat background colour, beside or under a short headline. Suggest 4 different hero visuals that make the hook and angle instantly clear. A visual can be:
- kind "device": a phone, tablet or laptop whose screen shows the fix the headline promises. Use this when the fix really happens on a screen (an inbox, a booking, a dashboard).
- kind "object": any real object or thing that carries the idea, such as a fridge, a calendar with one day circled, a clipboard, a toolbox, an invoice, a stopwatch, a trophy, a van, a key. ${aiImages ? 'It is made as a clean product-style image.' : 'It is drawn as a clean, simple illustration.'}
With no message from the user, base the ideas on the hook and the angle, and mix kinds (at least one object) unless only screens make sense. When the user's message names a thing ("a fridge", "show a calendar"), every idea uses that thing, in variations. Never squeeze an object onto a screen (no "fridge display").
Fields:
- idea: a short label a person can choose from, at most about 8 words.
- kind: "device" or "object".
- object: for kind "object", the object in a few words (such as "stainless steel fridge with a sticky note"); empty for devices.
- image_prompt: for kind "object", a short brief for the image: the object, its look, materials and one telling detail, in the brand colours where it fits. No text, letters, numbers or logos. Empty for devices.
- device: for kind "device", "phone", "tablet" or "laptop"; for objects use "phone" (ignored).
- device_side: where it sits: "right" or "left" of the headline, or "below" it (laptops and wide objects).
- background_hex: one flat background colour as #RRGGBB in the brand's own colour family (a deep or very light tint of a brand colour, or a neutral), on which the brand accent stands out clearly.
- app_title and elements: for kind "device" only: the title bar of the app view and 3 to 5 short lines, one per thing on the screen, top to bottom, synced to the headline (its key words, problem and fix). Generic first names and 555 numbers only; no prices, counts, ratings or faces. Empty for objects.
If they ask for a different number, give that number.\n${REPLY_RULE}\n${ACTION_RULE}`;
  const ctx = angle
    ? `ANGLE\n- ${angle.title}\n- Audience: ${angle.audience}\n- Insight: ${angle.insight}`
    : `DIRECTION FROM THE USER\n"${prompt}"`;
  const words = copy ? `\n\nCOPY ON THE CREATIVE\n${JSON.stringify(copy)}` : '';
  const content = `${kitText(brand, source)}\n\n${ctx}\n\nHOOK\n"${hook}"${words}\n\nFormat: ${format}${chatText({ direction, history, notes })}\n\n${avoid.length ? `Already shown to the user (do not repeat them): ${avoid.join('; ')}\n\n` : ''}Answer now.`;
  const out = await claudeJson({ system: system(method, task), content, schema: SCREENS_SCHEMA, effort: 'medium', maxTokens: 8000 });
  const hex = /^#[0-9a-f]{6}$/i;
  const screens = (out.screens || []).slice(0, 10).map((x) => ({ ...x, background_hex: hex.test(x.background_hex || '') ? x.background_hex : '', elements: (x.elements || []).filter(Boolean).slice(0, 8) }));
  return { screens, reply: out.reply || '', action: out.action === 'add' ? 'add' : 'replace' };
}
