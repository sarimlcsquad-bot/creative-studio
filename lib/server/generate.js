import 'server-only';
import PROMPTS from './prompts.json';
import { claudeJson } from './claude.js';
import { db, check, publicUrl } from './supabase.js';
import { aiImagesEnabled, makeImage, OBJECT_IMAGE_QUALITY } from './openai.js';
import { cutOut } from './cutout.js';
import { buildPanelCard } from '../panelTemplate.js';
import { PANEL_OBJECT, PANEL_GUIDE, THEME_ENUM, parsePanel } from './panelSpec.js';
import { sanitizeCss, sanitizeHtml } from './sanitize.js';
import { checkDevice, deviceCss, deviceFurniture, groundFor } from './deviceCheck.js';
import { buildDeviceCard } from './deviceTemplate.js';

// What Claude must return for one creative. The card is drawn by the browser
// (lib/client/renderCard.js), so every word here ships exactly as written.
const BLOCK = {
  type: 'object', additionalProperties: false,
  required: ['type', 'lines', 'text', 'items', 'label', 'px'],
  properties: {
    type: { type: 'string', enum: ['headline', 'sub', 'checklist', 'grid', 'cta', 'space'] },
    lines: { type: 'array', items: { type: 'string' } },
    text: { type: 'string' },
    items: { type: 'array', items: { type: 'string' } },
    label: { type: 'string' },
    px: { type: 'integer' },
  },
};
const strings = { type: 'array', items: { type: 'string' } };
export const CREATIVE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['concept', 'card', 'photo_prompt', 'visual_type', 'brand_image_index', 'ad_copy', 'claims_used', 'flags', 'compliance_notes'],
  properties: {
    concept: {
      type: 'object', additionalProperties: false,
      required: ['method', 'stage', 'psychographic_layer', 'tier', 'angle', 'specific_object', 'ladder_rungs',
        'mechanism_position', 'value_term', 'stack_items', 'enhancers_used', 'magic_name', 'rationale'],
      properties: {
        method: { type: 'string', enum: ['presold', '100m', 'both'] },
        stage: { type: 'string', enum: ['unaware', 'problem', 'solution', 'product', 'most'] },
        psychographic_layer: { type: 'string', enum: ['value', 'desire', 'fear', 'identity', 'n/a'] },
        tier: { type: 'string', enum: ['bottom', 'mid', 'top'] },
        angle: { type: 'string' },
        specific_object: { type: 'string' },
        ladder_rungs: strings,
        mechanism_position: { type: 'string', enum: ['headline', 'sub', 'device'] },
        value_term: { type: 'string', enum: ['dream_outcome', 'likelihood', 'time_delay', 'effort', 'n/a'] },
        stack_items: strings,
        enhancers_used: strings,
        magic_name: { type: 'string' },
        rationale: { type: 'string' },
      },
    },
    card: {
      type: 'object', additionalProperties: false,
      required: ['ground', 'photo_layout', 'photo_focus_x', 'photo_focus_y', 'blocks'],
      properties: {
        ground: { type: 'string', enum: ['deep', 'light'] },
        photo_layout: { type: 'string', enum: ['right', 'bottom', 'none'] },
        photo_focus_x: { type: 'number' },
        photo_focus_y: { type: 'number' },
        blocks: { type: 'array', items: BLOCK },
      },
    },
    photo_prompt: { type: 'string' },
    visual_type: { type: 'string', enum: ['photo', 'object', 'illustration', 'n/a'] },
    brand_image_index: { type: 'integer' },
    ad_copy: {
      type: 'object', additionalProperties: false,
      required: ['primary_text', 'headline', 'description', 'cta_button'],
      properties: {
        primary_text: { type: 'string' },
        headline: { type: 'string' },
        description: { type: 'string' },
        cta_button: { type: 'string', enum: ['BOOK_NOW', 'LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'CONTACT_US', 'SHOP_NOW', 'SUBSCRIBE', 'GET_OFFER', 'APPLY_NOW'] },
      },
    },
    claims_used: strings,
    flags: strings,
    compliance_notes: strings,
  },
};

// Free design: Claude writes the layout itself as HTML + CSS (see prompts/design-free.md).
const { card: _classicCard, ...SHARED_PROPS } = CREATIVE_SCHEMA.properties;
export const FREE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['concept', 'design', 'photo_prompt', 'visual_type', 'brand_image_index', 'ad_copy', 'claims_used', 'flags', 'compliance_notes'],
  properties: {
    ...SHARED_PROPS,
    design: {
      type: 'object', additionalProperties: false,
      required: ['layout_name', 'hook', 'image_shape', 'html', 'css'],
      properties: {
        layout_name: { type: 'string' },
        hook: { type: 'string' },
        image_shape: { type: 'string', enum: ['square', 'tall', 'wide', 'none'] },
        html: { type: 'string' },
        css: { type: 'string' },
      },
    },
  },
};

// Device card: Claude draws one device whose screen shows the fix, on a flat background (prompts/design-device.md).
const DESIGN_FREE = FREE_SCHEMA.properties.design;
export const DEVICE_SCHEMA = {
  ...FREE_SCHEMA,
  properties: {
    ...FREE_SCHEMA.properties,
    design: {
      ...DESIGN_FREE,
      required: [...DESIGN_FREE.required, 'headline_lines', 'accent_words', 'subhead', 'device', 'device_side', 'background_hex', 'screen', 'story_9x16_note'],
      properties: {
        ...DESIGN_FREE.properties,
        headline_lines: strings,
        accent_words: strings,
        subhead: { type: 'string' },
        device: { type: 'string', enum: ['phone', 'tablet', 'laptop'] },
        device_side: { type: 'string', enum: ['right', 'left', 'below'] },
        background_hex: { type: 'string' },
        screen: {
          type: 'object', additionalProperties: false, required: ['app_title', 'elements'],
          properties: { app_title: { type: 'string' }, elements: strings },
        },
        story_9x16_note: { type: 'string' },
        object_svg: { type: 'string' },
      },
    },
  },
};

// Headline + diagram card (the house reference style): Claude fills the words, a theme and one diagram panel; panelTemplate.js draws it.
export const PANEL_CARD_SCHEMA = {
  ...FREE_SCHEMA,
  properties: {
    ...FREE_SCHEMA.properties,
    design: {
      ...DESIGN_FREE,
      required: [...DESIGN_FREE.required, 'headline_lines', 'accent_words', 'subhead', 'theme', 'panel'],
      properties: { ...DESIGN_FREE.properties, headline_lines: strings, accent_words: strings, subhead: { type: 'string' }, theme: THEME_ENUM, panel: PANEL_OBJECT },
    },
  },
};

const STAGES = ['auto', 'unaware', 'problem', 'solution', 'product', 'most'];
const ROTATION = ['problem', 'solution', 'product', 'most'];

const clip = (v, n) => String(v || '').slice(0, n);

const HEX = /^#[0-9a-f]{6}$/i;
/** The device and screen chosen for a device card. */
function parseScreen(s) {
  if (!s || typeof s !== 'object') return null;
  return {
    kind: s.kind === 'object' ? 'object' : 'device',
    device: ['phone', 'tablet', 'laptop'].includes(s.device) ? s.device : 'phone',
    object: clip(s.object, 120),
    image_prompt: clip(s.image_prompt, 2000),
    device_side: ['right', 'left', 'below'].includes(s.device_side) ? s.device_side : 'right',
    background_hex: HEX.test(String(s.background_hex || '')) ? s.background_hex : '',
    app_title: clip(s.app_title, 80),
    elements: (Array.isArray(s.elements) ? s.elements : []).map((t) => clip(t, 160)).filter((t) => t.trim()).slice(0, 8),
    idea: clip(s.idea, 160),
  };
}

/** The choices made in the step-by-step builder: the copy is used word for word. */
function parseBrief(x) {
  if (!x || typeof x !== 'object' || !clip(x.hook, 300).trim()) return null;
  const c = x.content || {};
  const a = x.ad_copy || {};
  const url = clip(x.photo_url, 1000);
  const base = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
  return {
    angle: x.angle ? { title: clip(x.angle.title, 200), audience: clip(x.angle.audience, 300), insight: clip(x.angle.insight, 600), stage: clip(x.angle.stage, 20) } : null,
    hook: clip(x.hook, 300),
    design_notes: clip(x.design_notes, 1000),
    content: {
      headline: clip(c.headline || x.hook, 300), support: clip(c.support, 600),
      bullets: (Array.isArray(c.bullets) ? c.bullets : []).map((t) => clip(t, 120)).filter((t) => t.trim()).slice(0, 5),
      extra: clip(c.extra, 200), cta: clip(c.cta, 60),
      accent_words: (Array.isArray(c.accent_words) ? c.accent_words : []).map((t) => clip(t, 60)).filter((t) => t.trim()).slice(0, 4),
      proof_line: clip(c.proof_line, 200), bonus_pill: clip(c.bonus_pill, 80), cta_note: clip(c.cta_note, 120),
    },
    claims_used: (Array.isArray(x.claims_used) ? x.claims_used : []).map((t) => clip(t, 300)).slice(0, 10),
    flags: (Array.isArray(x.flags) ? x.flags : []).map((t) => clip(t, 300)).slice(0, 10),
    screen: parseScreen(x.screen),
    panel: (() => { const pn = parsePanel(x.panel); if (pn && pn.bg_url && !(base && pn.bg_url.startsWith(`${base}/storage/v1/object/public/`))) pn.bg_url = ''; return pn; })(),
    ad_copy: { primary_text: clip(a.primary_text, 3000), headline: clip(a.headline, 120), description: clip(a.description, 120), cta_button: clip(a.cta_button, 20) || 'LEARN_MORE' },
    compliance_notes: (Array.isArray(x.compliance_notes) ? x.compliance_notes : []).map((t) => clip(t, 300)).slice(0, 10),
    // Only images from this app's own storage.
    photo_url: base && url.startsWith(`${base}/storage/v1/object/public/`) ? url : '',
    // both: brand photo in the background + a new AI image; ai: AI image only; photo: brand photo only.
    visual: ['both', 'ai', 'photo', 'none'].includes(x.visual) ? x.visual : (x.photo_url ? 'photo' : 'none'),
    image_prompt: clip(x.image_prompt, 3000),
    visual_type: ['photo', 'object', 'illustration'].includes(x.visual_type) ? x.visual_type : 'object',
    image_shape: ['square', 'tall', 'wide'].includes(x.image_shape) ? x.image_shape : 'square',
  };
}

/** Validates a generate request from the browser. Throws with a readable message. */
export function parseRequest(b = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(b.brand_id || ''))) throw new Error('Pick a brand');
  const mode = b.mode === 'prompt' ? 'prompt' : 'random';
  if (mode === 'prompt' && !String(b.prompt || '').trim()) throw new Error('Write a prompt, or switch to Random');
  return {
    brand_id: b.brand_id,
    mode,
    prompt: String(b.prompt || '').slice(0, 4000),
    count: Math.min(Math.max(parseInt(b.count, 10) || 1, 1), 10),
    // "both" makes each version twice: once in 4:5 for feeds and once in 9:16 for Stories and Reels.
    format: ['1:1', '4:5', '9:16', 'both'].includes(b.format) ? b.format : '4:5',
    photo_source: ['ai', 'brand', 'none'].includes(b.photo_source) ? b.photo_source : 'brand',
    image_style: ['auto', 'photo', 'object', 'illustration'].includes(b.image_style) ? b.image_style : 'auto',
    design: ['classic', 'free', 'device'].includes(b.design) ? b.design : 'panel',
    brief: parseBrief(b.brief),
    stage: STAGES.includes(b.stage) ? b.stage : 'auto',
    method: ['presold', '100m', 'mix', 'both'].includes(b.method) ? b.method : 'presold',
    source: b.source === 'agency' ? 'agency' : 'owner',
    created_by: String(b.created_by || '').slice(0, 120),
  };
}

/** Plans the batch: one stage and method per creative, spread so a batch isn't four copies. */
export function planJobs(req, brand) {
  const hasImages = (brand.brand_images || []).some((im) => /^https?:\/\//.test(im.url || ''));
  const ai = aiImagesEnabled();
  let photo_source = req.photo_source;
  if (photo_source === 'ai' && !ai) photo_source = hasImages ? 'brand' : 'none';
  if (photo_source === 'brand' && !hasImages) photo_source = ai ? 'ai' : 'none';
  let visual = 'none';
  if (req.brief) {
    const br = req.brief;
    visual = br.visual;
    if ((visual === 'both' || visual === 'ai') && (!ai || !br.image_prompt.trim())) visual = br.photo_url ? 'photo' : 'none';
    if (visual === 'both' && !br.photo_url) visual = 'ai';
    if (visual === 'photo' && !br.photo_url) visual = 'none';
    photo_source = visual === 'photo' ? 'brand' : visual === 'none' ? 'none' : 'ai';
  }
  // Free designs always carry a visual asset when one is available.
  if (req.design === 'free' && photo_source === 'none' && !req.brief) photo_source = ai ? 'ai' : (hasImages ? 'brand' : 'none');
  // The headline + diagram card is drawn in code: no photo, no AI image.
  if (req.design === 'panel') { photo_source = 'none'; visual = 'none'; }
  // The device card is drawn entirely by Claude: no photo, no AI image.
  if (req.design === 'device') {
    photo_source = 'none'; visual = 'none';
    const sc = req.brief?.screen;
    // An object visual (a fridge, a calendar, a toolbox…) is made as an AI image when images are on; otherwise Claude draws it.
    if (sc?.kind === 'object') { visual = 'object'; if (ai && sc.image_prompt.trim()) photo_source = 'ai'; }
  }
  const offset = Math.floor(Math.random() * ROTATION.length);
  const mOffset = Math.floor(Math.random() * 2);
  const tOffset = Math.floor(Math.random() * 2);
  const formats = req.format === 'both' ? ['4:5', '9:16'] : [req.format];
  const versions = Array.from({ length: req.count }, (_, i) => ({
    index: i,
    // Mix dark and light grounds across a batch.
    ground: ['dark', 'light'][(tOffset + i) % 2],
    stage: STAGES.includes(req.brief?.angle?.stage) && req.brief.angle.stage !== 'auto' ? req.brief.angle.stage : req.stage !== 'auto' ? req.stage : (req.count > 1 ? ROTATION[(offset + i) % ROTATION.length] : 'auto'),
    method: req.method !== 'mix' ? req.method : (req.count > 1 ? ['presold', '100m'][(mOffset + i) % 2] : (Math.random() < 0.5 ? 'presold' : '100m')),
    photo_source,
    visual,
  }));
  return versions.flatMap((v) => formats.map((format) => ({ ...v, format, pair: formats.length > 1 })));
}

function recentHeadlines(rows) {
  return rows.map((r) => {
    const h = (r.spec?.blocks || []).find((b) => b.type === 'headline');
    return h ? h.lines.map((l) => l.replace(/^accent:/, '')).join(' ') : r.ad_copy?.headline;
  }).filter(Boolean);
}

function recentBackgrounds(rows) {
  return [...new Set(rows.map((r) => r.concept?.theme || r.concept?.background_hex).filter(Boolean))].slice(0, 8);
}

function recentLayouts(rows) {
  return [...new Set(rows.map((r) => r.spec?.layout_name).filter(Boolean))].slice(0, 8);
}

const AUDIENCE_NAME = { owner: 'business owners', agency: 'agency owners' };

/** The audience block for this ad, without empty fields. */
function audienceBlock(brand, source) {
  const a = brand.audiences?.[source];
  if (!a || typeof a !== 'object') return null;
  const out = Object.fromEntries(Object.entries(a).filter(([, v]) => (Array.isArray(v) ? v.length : String(v || '').trim())));
  return Object.keys(out).length ? out : null;
}

/** The brand facts Claude may use, with the audience block for business owners or agency owners. */
export function brandKit(brand, source) {
  const audience = source ? { reader: AUDIENCE_NAME[source] || AUDIENCE_NAME.owner, ...(audienceBlock(brand, source) || {}) } : undefined;
  return {
    name: brand.name, website: brand.website, email: brand.email || '', ...(audience ? { audience } : {}), industry: brand.industry, description: brand.description,
    service_area: brand.service_area, ideal_customer: brand.target_audience, services: brand.services,
    main_offer: brand.offer, differentiators: brand.differentiators, verified_proof_points: brand.proof_points,
    guarantees: brand.guarantees, default_cta: brand.default_cta, tone_of_voice: brand.tone_of_voice,
    banned_phrases: brand.banned_phrases, compliance_notes: brand.compliance_notes,
    colors: brand.colors, fonts: brand.fonts, has_logo: Boolean(brand.logo_url), website_summary: brand.website_summary,
  };
}

function buildContent({ brand, req, job, images, headlines, layouts = [], backgrounds = [] }) {
  const free = req.design !== 'classic';
  const panel = req.design === 'panel';
  const device = req.design === 'device' || panel;
  const kit = brandKit(brand, req.source);
  const format = job.format || req.format;
  const lines = [
    'BRAND KIT (the only facts you may use):',
    JSON.stringify(kit, null, 2),
    '',
    'REQUEST',
    `- Method: ${{ '100m': '$100M Offers (value equation, named stack)', both: 'both skills: Pre-Sold for the aim (stage, person, moment) and $100M Offers for the offer framing' }[job.method] || 'Pre-Sold (awareness stage, psychographic stack)'}`,
    `- Mode: ${req.mode === 'prompt' ? 'follow the direction below' : 'random: choose the strongest angle for this brand yourself'}`,
  ];
  if (req.mode === 'prompt' && req.prompt) lines.push(`- Direction from the user: "${req.prompt}"`);
  const br = req.brief;
  if (br) {
    lines.push('- The person already chose the angle, hook and copy in the builder. Design the creative around them and put this copy on it WORD FOR WORD (you may only change letter case and line breaks). Do not add other claims. Fill concept to describe this ad, and return ad_copy exactly as given.');
    if (br.angle) lines.push(`- Angle: ${br.angle.title} (audience: ${br.angle.audience}; insight: ${br.angle.insight}; stage: ${br.angle.stage})`);
    lines.push(`- HOOK (the biggest text): "${br.content.headline}"`);
    if (device) {
      if (br.content.support) lines.push(`- Body line under the headline (word for word, as subhead): "${br.content.support}"`);
      else lines.push('- Body line: write one short sentence (at most about 18 words) under the headline that carries the hook to the fix.');
      lines.push('- The bullets and extra line are NOT on a device card: they live in the caption.');
    } else {
      if (br.content.support) lines.push(`- Support line: "${br.content.support}"`);
      if (br.content.bullets.length) lines.push(`- Bullets: ${br.content.bullets.map((t) => `"${t}"`).join('; ')}`);
      if (br.content.extra) lines.push(`- Extra line (offer, stat or risk reversal): "${br.content.extra}"`);
      if (br.content.cta) lines.push(`- CTA button: "${br.content.cta}"`);
      if (br.content.proof_line) lines.push(`- Proof line: "${br.content.proof_line}"`);
      if (br.content.bonus_pill) lines.push(`- Bonus pill: "${br.content.bonus_pill}"`);
      if (br.content.cta_note) lines.push(`- Note under the CTA: "${br.content.cta_note}"`);
    }
    if (br.content.accent_words.length) lines.push(`- Accent words in the headline: ${br.content.accent_words.map((t) => `"${t}"`).join('; ')}`);
    if (br.claims_used.length) lines.push(`- claims_used to return: ${JSON.stringify(br.claims_used)}`);
    if (br.flags.length) lines.push(`- flags to return (keep them): ${JSON.stringify(br.flags)}`);
    lines.push(`- ad_copy to return: ${JSON.stringify(br.ad_copy)}`);
    if (req.mode === 'random' && req.prompt.trim()) lines.push(`- Extra direction from the user: "${req.prompt.trim()}"`);
    if (br.design_notes.trim()) lines.push(`- Design direction from the user for this creative (follow it closely; it never changes the copy above, which stays word for word, and the hook stays the biggest text): "${br.design_notes.trim()}"`);
  }
  lines.push(`- Awareness stage: ${job.stage}`);
  const size = { '1:1': '1080 x 1080', '4:5': '1080 x 1350', '9:16': '1080 x 1920' }[format];
  if (panel) {
    lines.push(`- Design: headline + diagram card, format ${format}. The app draws it; you fill the design fields (html and css empty).`);
    const fu = deviceFurniture(brand, req);
    lines.push('- Card furniture the app adds, word for word (for your information; never repeat it in your fields):');
    lines.push(`  - Button: "${fu.cta}"; note under it: ${fu.cta_note ? `"${fu.cta_note}"` : '(none)'}; offer pill: ${fu.bonus_pill ? `"${fu.bonus_pill}"` : '(none)'}; trust line: ${fu.proof_line ? `"${fu.proof_line}"` : '(none)'}`);
    if (br?.panel) {
      const { idea, theme, ...given } = br.panel;
      lines.push(`- Diagram chosen by the person (return it exactly as panel): ${JSON.stringify(given)}`);
      if (theme) lines.push(`- Theme chosen by the person: ${theme}`);
    }
    if (job.pair) lines.push(`- This card is made in both 4:5 and 9:16; this one is the ${format} version. Keep the same headline, line, diagram and theme as its twin would.`);
    if (backgrounds.length) lines.push(`- Themes already used for this brand (pick a different one): ${backgrounds.join(', ')}`);
    if (layouts.length) lines.push(`- Diagram types used recently for this brand (prefer another when it fits as well): ${layouts.join(', ')}`);
  } else if (device) {
    lines.push(`- Design: device card, format ${format}. The app lays it out on its grid; you fill the design fields (html and css empty).`);
    const fu = deviceFurniture(brand, req);
    lines.push('- Card furniture, word for word (leave out any that is empty; never invent one):');
    lines.push(`  - CTA button: "${fu.cta}"`);
    lines.push(`  - Note under the button: ${fu.cta_note ? `"${fu.cta_note}"` : '(none)'}`);
    lines.push(`  - Proof line with shield: ${fu.proof_line ? `"${fu.proof_line}"` : '(none)'}`);
    lines.push(`  - Offer pill top-right: ${fu.bonus_pill ? `"${fu.bonus_pill}"` : '(none)'}`);
    lines.push(`  - Footer: "${brand.name}", "${fu.website}"${fu.email ? `, "${fu.email}"` : ''}`);
    const sc = br?.screen;
    const ground = groundFor(brand, job.ground);
    if (!sc?.background_hex) lines.push(`- Ground: ${ground}. Choose background_hex as a flat ${ground} colour in the brand's family on which the accent ${brand.colors?.accent || ''} stands out clearly.`);
    if (sc?.kind === 'object') {
      const where = sc.device_side === 'below' ? 'under the headline' : `on the ${sc.device_side} of the headline`;
      lines.push(`- Visual chosen by the person: NOT a device. The hero visual is ${sc.object || sc.idea}, placed ${where} in the device's slot of the layout grid.${sc.background_hex ? ` Use background_hex ${sc.background_hex}.` : ''}`);
      lines.push(job.photo_source === 'ai'
        ? '- That object is generated as an image with a see-through background and placed by the app. Keep screen empty and object_svg empty.'
        : `- No image is generated: draw the object in object_svg (see the rules). Keep screen empty. Idea: "${sc.idea}". ${sc.image_prompt ? `Details: ${sc.image_prompt}` : ''}`);
    } else if (sc) {
      lines.push(`- Device chosen by the person: ${sc.device}, placed ${sc.device_side === 'below' ? 'under the headline' : `on the ${sc.device_side} of the headline`}.${sc.background_hex ? ` Use background_hex ${sc.background_hex}.` : ''}`);
      if (sc.app_title || sc.elements.length) lines.push(`- Screen chosen by the person (the app shows it as given): app title "${sc.app_title}"; elements: ${sc.elements.map((t) => `"${t}"`).join('; ')}`);
    }
    if (job.pair) lines.push(`- This card is made in both 4:5 and 9:16; this one is the ${format} version. Keep the same headline, body, visual, screen and background_hex as its twin would.`);
    if (backgrounds.length) lines.push(`- Background colours already used for this brand (pick a different one): ${backgrounds.join(', ')}`);
  } else if (free) {
    lines.push(`- Design: free. Design your own layout as HTML + CSS for a ${size} px canvas (format ${format}${format === '9:16' ? ', vertical Stories/Reels: respect the safe zone' : ''}). It must have a hook, the visual asset and the logo.`);
  } else {
    lines.push(`- Design: classic performance card. Format: ${format}${format === '9:16' ? ' (vertical Stories/Reels: keep the text short, headline 2 lines, checklist at most 3 items)' : ''}`);
  }
  if (device) {
    // No image in a device card; the device itself is the visual.
  } else if (br && job.visual === 'both') {
    lines.push(`- Main image: a new AI ${br.visual_type} will be generated from this brief: "${br.image_prompt}". ${free ? 'Use it in your design as {{PHOTO}} (the foreground visual)' : 'Choose photo_layout "right" or "bottom" for it'}, set brand_image_index -1, visual_type "${br.visual_type}", ${free ? `image_shape "${br.image_shape}" unless your layout needs another shape, ` : ''}and copy that brief into photo_prompt.`);
    lines.push(free
      ? '- Background: the brand photo attached above as Brand image 0 goes behind everything as a full-bleed background. Use it as {{BG}} (an <img src="{{BG}}"> covering the whole canvas with object-fit: cover, or background-image: url({{BG}})) under an overlay of the brand colours strong enough that every word reads clearly. The AI image {{PHOTO}} sits on top of it as the main visual.'
      : '- Background: the brand photo attached above as Brand image 0 is drawn faintly behind the whole card by the renderer; you do not need to place it.');
  } else if (br && job.visual === 'ai') {
    lines.push(`- Image: a new AI ${br.visual_type} will be generated from this brief: "${br.image_prompt}". ${free ? 'Use it in your design as {{PHOTO}}' : 'Choose photo_layout "right" or "bottom" for it'}, set brand_image_index -1, visual_type "${br.visual_type}", ${free ? `image_shape "${br.image_shape}" unless your layout needs another shape, ` : ''}and copy that brief into photo_prompt.`);
  } else if (br && job.visual === 'photo') {
    lines.push(free
      ? `- Image: already chosen and attached above as Brand image 0 (a brand photo). Use it as {{PHOTO}}, set brand_image_index 0, visual_type "photo", and describe it briefly in photo_prompt.`
      : '- Image: already chosen and attached above as Brand image 0. Set brand_image_index 0, choose photo_layout "right" or "bottom" to suit it, set photo_focus_x / photo_focus_y, and describe it briefly in photo_prompt.');
  } else if (br && job.visual === 'none') {
    lines.push(free
      ? '- Photo source: none. No image: design with type, colour and shapes only, and build the visual asset from a large CSS or inline-SVG illustration. image_shape "none", brand_image_index -1, visual_type "n/a", empty photo_prompt.'
      : '- Photo source: none. Use photo_layout "none", brand_image_index -1, visual_type "n/a" and an empty photo_prompt.');
  } else if (job.photo_source === 'brand') {
    lines.push(free
      ? `- Photo source: brand. The brand's own photos are attached above, index 0 to ${images.length - 1}. Choose the one that best fits this ad with brand_image_index, design around it with {{PHOTO}}, and put a short description of it in photo_prompt.`
      : `- Photo source: brand. The brand's own photos are attached above, index 0 to ${images.length - 1}. Choose the one that best fits this ad with brand_image_index, choose photo_layout "right" or "bottom" to suit it, and set photo_focus_x / photo_focus_y on the subject. Put a short description of the chosen photo in photo_prompt.`);
  } else if (job.photo_source === 'ai') {
    const style = {
      auto: 'choose the visual type that best carries this ad',
      photo: 'visual_type "photo"',
      object: 'visual_type "object" (a 3D icon or object render, such as a calendar, phone, clipboard or price tag)',
      illustration: 'visual_type "illustration"',
    }[req.image_style || 'auto'];
    lines.push(free
      ? `- Photo source: ai. A new image will be generated from your photo_prompt by an image model at your image_shape. Image style: ${style}. Use it in your design as {{PHOTO}}, set brand_image_index -1, and write photo_prompt following the AI image rules.`
      : `- Photo source: ai. A new image will be generated from your photo_prompt by an image model. Image style: ${style}. Choose photo_layout "right" or "bottom", brand_image_index -1, and write photo_prompt following the AI image rules.`);
  } else {
    lines.push(free
      ? '- Photo source: none. No image: design with type, colour and shapes only. image_shape "none", brand_image_index -1, visual_type "n/a", empty photo_prompt.'
      : '- Photo source: none. Use photo_layout "none", brand_image_index -1, visual_type "n/a" and an empty photo_prompt.');
  }
  if (!br && job.angle) {
    lines.push(`- Angle for this creative (assigned so no two in the batch repeat; build the ad on it): ${job.angle.title}. Reader: ${job.angle.audience}. Moment and insight: ${job.angle.insight}`);
  }
  if (req.count > 1) lines.push(`- This is creative ${job.index + 1} of ${req.count} in one batch. Make it clearly different from the others: a different ${device ? 'moment, screen, background colour' : 'person, specific object'} and headline${job.photo_source === 'brand' && images.length > 1 ? ', and a different photo if one fits' : ''}.${br ? ' The copy above stays word for word; vary the layout and design only.' : ''}`);
  if (free && req.count > 1) lines.push('- Use a different layout from the other creatives in this batch.');
  if (free && layouts.length) lines.push(`- Layouts already used for this brand (pick something different): ${layouts.map((l) => `"${l}"`).join('; ')}`);
  if (headlines.length) lines.push(`- Headlines already used for this brand (do not repeat them): ${headlines.map((h) => `"${h}"`).join('; ')}`);
  lines.push('', 'Write the creative now.');

  const content = [];
  // Let Claude see the logo, so it places it on a ground where every part of it shows.
  if (/^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(brand.logo_url || '')) {
    content.push({ type: 'text', text: 'Brand logo (often a PNG with a transparent background; see-through parts show whatever is behind them). This is not a Brand image and has no index. Place it where every part of it is clearly visible: on a ground of strongly contrasting tone, or on a small solid plate in a brand colour if the ground behind it is busy or similar in tone to any part of the logo.' });
    content.push({ type: 'image', source: { type: 'url', url: brand.logo_url } });
  }
  images.forEach((im, i) => {
    content.push({ type: 'text', text: `Brand image ${i}: ${im.label || ''}` });
    content.push({ type: 'image', source: { type: 'url', url: im.url } });
  });
  content.push({ type: 'text', text: lines.join('\n') });
  return content;
}

function cleanCard(card) {
  card.blocks = (card.blocks || []).map((b) => {
    const c = { type: b.type };
    if (b.type === 'headline') c.lines = (b.lines || []).filter(Boolean).slice(0, 4);
    if (b.type === 'sub') c.text = b.text;
    if (b.type === 'checklist') c.items = (b.items || []).filter(Boolean).slice(0, 5);
    if (b.type === 'grid') c.items = (b.items || []).filter(Boolean).slice(0, 9);
    if (b.type === 'cta') c.label = b.label;
    if (b.type === 'space') c.px = Math.min(Math.max(b.px || 10, 4), 24);
    return c;
  });
  card.photo_focus_x = Math.min(Math.max(Number(card.photo_focus_x) || 0.5, 0), 1);
  card.photo_focus_y = Math.min(Math.max(Number(card.photo_focus_y) || 0.35, 0), 1);
  return card;
}

/**
 * Checks a device card against the house rules (lib/server/deviceCheck.js). If it breaks any,
 * Claude gets one more pass with the list of problems; the better of the two is kept.
 */
/** Puts Claude's choices into the house layout (lib/server/deviceTemplate.js). */
function layoutDevice(out, { brand, req, job, furniture }) {
  const d = out.design || (out.design = {});
  const sc = req.brief?.screen;
  const kind = sc?.kind === 'object' ? 'object' : 'device';
  if (sc) {
    // What the person picked in the builder wins over Claude's own pick.
    if (kind === 'device') {
      if (sc.device) d.device = sc.device;
      if ((sc.elements || []).length) d.screen = { app_title: sc.app_title || d.screen?.app_title || '', elements: sc.elements };
    }
    if (sc.device_side) d.device_side = sc.device_side;
    if (HEX.test(String(sc.background_hex || ''))) d.background_hex = sc.background_hex;
  }
  const body = String(req.brief?.content?.support || '').trim();
  if (body) d.subhead = body;
  const { html, css } = buildDeviceCard({ d, brand, furniture, format: job.format || req.format, kind, photo: job.photo_source === 'ai', body: d.subhead });
  d.html = html; d.css = css;
  d.layout_name = `device ${kind === 'object' ? 'object' : d.device || 'phone'} ${d.device_side || 'right'}`;
  return out;
}

async function reviseDevice({ out, brand, req, job, images, headlines, layouts, backgrounds }) {
  const furniture = deviceFurniture(brand, req);
  const ctx = { brand, furniture, chosenBg: req.brief?.screen?.background_hex || '', allowPhoto: job.photo_source === 'ai' };
  out = layoutDevice(out, { brand, req, job, furniture });
  const issues = checkDevice(out, ctx);
  if (!issues.length) return { out, issues };
  try {
    const content = buildContent({ brand, req, job, images, headlines, layouts, backgrounds });
    content.push({ type: 'text', text: `YOUR PREVIOUS DESIGN FOR THIS REQUEST\n${JSON.stringify({ ...out.design, html: '', css: '' })}\n\nIt broke these rules:\n${issues.map((i) => `- ${i}`).join('\n')}\n\nReturn the whole creative again with every one of these fixed. Keep what was right.` });
    const again = layoutDevice(await claudeJson({ system: PROMPTS[`${job.method}:device`], content, schema: DEVICE_SCHEMA, maxTokens: 16000 }), { brand, req, job, furniture });
    const left = checkDevice(again, ctx);
    return left.length <= issues.length ? { out: again, issues: left } : { out, issues };
  } catch (e) {
    console.error('device revise', e);
    return { out, issues };
  }
}

const RATING = /\b\d(\.\d)?\s*\/\s*5\b|★|⭐|\b\d(\.\d)?\s*stars?\b|\bverified reviews?\b|\b5-star\b|\bfive[- ]star\b/i;

/** Removes any sentence that carries a rating or review score. */
export function scrubRatings(text) {
  const t = String(text || '');
  if (!RATING.test(t)) return t;
  return t.split('\n').map((line) => {
    if (!RATING.test(line)) return line;
    const kept = line.split(/(?<=[.!?])\s+/).filter((part) => !RATING.test(part)).join(' ');
    return kept;
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Writes one creative with Claude and saves it. Marks the row failed on any error. */
/** Draws the headline + diagram card from Claude's fields (and the person's choices from the builder). */
function layoutPanel(out, { brand, req, job }) {
  const d = out.design || (out.design = {});
  const br = req.brief;
  if (br?.panel) {
    const { idea, theme, ...given } = br.panel;
    d.panel = given;
    if (theme) d.theme = theme;
  }
  d.panel = parsePanel(d.panel) || { type: 'checklist', heading: '', rows: [], left_label: '', right_label: '', center: '', result: '', result_detail: '', footnote: '' };
  if (br?.content?.support) d.subhead = br.content.support;
  // The person's headline goes on the card word for word: Claude only chooses the line breaks.
  const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9$%']+/g, ' ').trim();
  if (br?.content?.headline && norm((d.headline_lines || []).join(' ')) !== norm(br.content.headline)) d.headline_lines = [br.content.headline];
  const furniture = deviceFurniture(brand, req);
  const built = buildPanelCard({ d, brand, furniture, format: job.format || req.format });
  d.headline_lines = built.lines;
  d.html = built.html;
  d.css = built.css;
  d.layout_name = `panel ${d.panel.type}`;
  d.image_shape = 'none';
  return out;
}

export async function runJob({ creativeId, brand, req, job, headlines, layouts, backgrounds }) {
  const free = req.design !== 'classic';
  const panel = req.design === 'panel';
  const device = req.design === 'device';
  const fixed = job.visual === 'photo' ? req.brief.photo_url : '';
  const bgPhoto = job.visual === 'both' ? req.brief.photo_url : '';
  // A background photo uploaded for a headline + diagram card goes straight under the template.
  const bg = bgPhoto || (panel ? req.brief?.panel?.bg_url || '' : '');
  const images = fixed ? [{ url: fixed, label: 'chosen image' }] : bgPhoto ? [{ url: bgPhoto, label: 'background photo' }] : job.photo_source === 'brand'
    ? (brand.brand_images || []).filter((im) => /^https?:\/\//.test(im.url || '')).slice(0, 8)
    : [];
  try {
    let out = await claudeJson({
      system: (PROMPTS[`${job.method}:${req.design}`] || PROMPTS['presold:device']).replace('{{PANEL_GUIDE}}', PANEL_GUIDE),
      content: buildContent({ brand, req, job, images, headlines, layouts, backgrounds }),
      schema: panel ? PANEL_CARD_SCHEMA : device ? DEVICE_SCHEMA : free ? FREE_SCHEMA : CREATIVE_SCHEMA,
      maxTokens: panel ? 16000 : free ? 32000 : 16000,
    });
    if (panel) {
      layoutPanel(out, { brand, req, job });
      out.photo_prompt = ''; out.visual_type = 'n/a';
      const d = out.design;
      out.concept = { ...out.concept, theme: d.theme || '', panel: d.panel, accent_words: d.accent_words || [] };
    }
    let designIssues = [];
    if (device) ({ out, issues: designIssues } = await reviseDevice({ out, brand, req, job, images, headlines, layouts, backgrounds }));
    if (req.brief) {
      out.ad_copy = { ...out.ad_copy, ...Object.fromEntries(Object.entries(req.brief.ad_copy).filter(([, v]) => v)) };
      out.compliance_notes = [...new Set([...(req.brief.compliance_notes || []), ...(out.compliance_notes || [])])];
      out.flags = [...new Set([...(req.brief.flags || []), ...(out.flags || [])])];
      if (req.brief.claims_used.length) out.claims_used = [...new Set([...req.brief.claims_used, ...(out.claims_used || [])])];
      if (job.visual === 'both' || job.visual === 'ai') { out.photo_prompt = req.brief.image_prompt; out.visual_type = req.brief.visual_type; }
      out.concept = { ...out.concept, ...(req.brief.angle ? { angle: req.brief.angle.title } : {}) };
    }
    if (!req.brief && job.angle?.title) out.concept = { ...out.concept, angle: job.angle.title };
    if (device) {
      const sc = req.brief?.screen;
      if (job.photo_source === 'ai' && sc) {
        const bgHex = /^#[0-9a-f]{6}$/i.test(out.design?.background_hex || '') ? out.design.background_hex : (sc.background_hex || brand.colors?.deep || '#111111');
        out.photo_prompt = objectPrompt(sc.image_prompt, bgHex, brand);
        out.visual_type = 'object';
        if (out.design) out.design.image_shape = sc.device_side === 'below' ? 'wide' : 'tall';
      } else { out.photo_prompt = ''; out.visual_type = 'n/a'; }
      out.concept = { ...out.concept, design_check: designIssues, ...(sc?.kind === 'object' ? { visual_object: sc.object || sc.idea } : {}) };
    }
    // Ratings and review scores never ship, in the caption either.
    const scrubbed = scrubRatings(out.ad_copy?.primary_text);
    if (scrubbed !== (out.ad_copy?.primary_text || '')) {
      out.ad_copy.primary_text = scrubbed;
      out.flags = [...(out.flags || []), 'A rating or review score was removed from the caption. Add one back only if the business can prove it.'];
    }
    if (free) return await saveFree({ creativeId, job, images, out, fixed, bg, hook: req.brief?.hook, extraCss: device ? deviceCss(brand) : '' });
    const card = cleanCard(out.card);
    // Every card carries body text: add the support line under the headline if Claude left it out.
    if (!card.blocks.some((b) => b.type === 'sub' && String(b.text || '').trim())) {
      const body = String(req.brief?.content?.support || out.ad_copy?.description || '').trim();
      const at = card.blocks.findIndex((b) => b.type === 'headline');
      if (body) card.blocks.splice(at + 1, 0, { type: 'sub', text: body });
    }
    if (bg) card.bg_url = bg;
    let photo_url = null;
    let image_error = null;
    if (fixed) {
      photo_url = fixed;
      if (card.photo_layout === 'none') card.photo_layout = 'right';
    } else if (job.photo_source === 'ai' && out.photo_prompt) {
      if (card.photo_layout === 'none') card.photo_layout = 'right';
      try {
        const png = await makeImage({ prompt: out.photo_prompt, size: card.photo_layout === 'bottom' ? '1536x1024' : '1024x1536' });
        const path = `ai-images/${creativeId}.png`;
        check(await db().storage.from('creatives').upload(path, png, { contentType: 'image/png', upsert: true }));
        photo_url = publicUrl('creatives', path);
        card.photo_focus_x = 0.5; card.photo_focus_y = 0.45;
      } catch (err) {
        // Keep the creative as a text card rather than losing Claude's work.
        console.error('image', creativeId, err);
        image_error = String(err?.message || err).slice(0, 300);
        card.photo_layout = 'none';
      }
    } else if (job.photo_source === 'brand' && images.length) {
      photo_url = (images[out.brand_image_index] || images[0]).url;
      if (card.photo_layout === 'none') card.photo_layout = 'right';
    } else {
      card.photo_layout = 'none';
    }
    check(await db().from('creatives').update({
      status: 'ready', error: null, spec: card,
      concept: { ...out.concept, visual_type: out.visual_type, compliance_notes: out.compliance_notes || [], claims_used: out.claims_used || [], flags: out.flags || [], ...(image_error ? { image_error } : {}) },
      ad_copy: out.ad_copy, photo_prompt: out.photo_prompt || null, photo_url,
    }).eq('id', creativeId));
  } catch (e) {
    console.error('creative', creativeId, e);
    const msg = e?.error?.error?.message || e?.message || String(e);
    await db().from('creatives').update({ status: 'failed', error: String(msg).slice(0, 500) }).eq('id', creativeId);
  }
}

const IMAGE_SIZE = { square: '1024x1024', tall: '1024x1536', wide: '1536x1024' };

/**
 * The image brief for a cut-out object. It never mentions transparency in words: image models
 * that can't make a see-through background then paint a fake grey checkerboard. It asks for a
 * plain card-coloured background instead, which the API makes see-through when it can and
 * cutOut() removes when it can't.
 */
export function objectPrompt(brief, bgHex, brand) {
  const accent = /^#[0-9a-f]{6}$/i.test(brand.colors?.accent || '') ? brand.colors.accent : '';
  return [
    // Older briefs may describe a background; the app decides that, and saying "transparent" gets a painted checkerboard.
    `${String(brief || '').split(/(?<=[.!?])\s+/).filter((t) => !/transparen|checker|background|backdrop|isolated on/i.test(t)).join(' ').trim().replace(/[.\s]+$/, '') || 'One object that stands for the ad idea'}.`,
    'Style: a premium, high-end 3D product render, like a hero image in a modern software ad. Crisp, detailed and sharp, smooth matte and soft-gloss materials, subtle bevels, soft studio key light from the upper left with a gentle rim light, realistic soft shading.',
    accent ? `Use ${accent} as the main accent colour on the object, with white and neutral greys.` : 'Use the brand colours on the object, with white and neutral greys.',
    'Composition: one single object, centred, seen at a slight three-quarter angle, whole and uncropped, filling about 70% of the frame, with clear empty space on every side.',
    `Background: one completely plain, flat, solid ${bgHex} colour filling the entire frame, edge to edge. No floor, no surface, no cast shadow on the ground, no gradient, no vignette, no glow, no pattern, nothing else in the frame. The object must contrast clearly with that background colour.`,
  ].join(' ');
}

async function generateImage(creativeId, prompt, size, transparent = false) {
  let png = await makeImage({ prompt, size, transparent, quality: transparent ? OBJECT_IMAGE_QUALITY : undefined });
  // Objects: cut away whatever background came back and trim to the object, so it sits on the card's colour.
  if (transparent) {
    try { png = (await cutOut(png)).png; } catch (e) { console.error('cutout', creativeId, e); }
  }
  const path = `ai-images/${creativeId}.png`;
  check(await db().storage.from('creatives').upload(path, png, { contentType: 'image/png', upsert: true }));
  return publicUrl('creatives', path);
}

/** What a device card shows, kept with the creative so people can see what was chosen. */
function deviceFacts(d) {
  if (!d.device) return {};
  return {
    device: d.device, device_side: d.device_side,
    background_hex: HEX.test(String(d.background_hex || '')) ? d.background_hex : '',
    screen: { app_title: String(d.screen?.app_title || '').slice(0, 80), elements: (d.screen?.elements || []).map((t) => String(t).slice(0, 160)).slice(0, 8) },
    accent_words: (d.accent_words || []).map((t) => String(t).slice(0, 60)).slice(0, 4),
    story_9x16_note: String(d.story_9x16_note || '').slice(0, 300),
  };
}

/** Saves a free-design creative: cleaned HTML/CSS plus its image. */
async function saveFree({ creativeId, job, images, out, fixed, bg, hook, extraCss = '' }) {
  const d = out.design || {};
  const spec = {
    mode: 'html',
    layout_name: String(d.layout_name || '').slice(0, 60),
    hook: String(hook || d.hook || '').slice(0, 300),
    image_shape: d.image_shape || 'none',
    html: sanitizeHtml(d.html),
    css: sanitizeCss(d.css) + (extraCss ? `\n${extraCss}` : ''),
  };
  if (!spec.html.trim()) throw new Error('Claude returned an empty design');
  if (bg) {
    spec.bg_url = bg;
    // The chosen background photo always shows, behind the design's own content.
    if (!/\{\{BG\}\}/.test(spec.html + spec.css)) {
      spec.html = `<img class="cs-auto-bg" src="{{BG}}">${spec.html}`;
      spec.css += '\n.canvas .cs-auto-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.32;z-index:-1}';
    }
  } else {
    spec.html = spec.html.replace(/<img[^>]*\{\{BG\}\}[^>]*>/g, '');
  }
  // Guarantee the logo and the visual asset are on the card even if the layout left them out.
  if (!/\{\{LOGO\}\}/.test(spec.html + spec.css)) {
    spec.html += '<img class="cs-auto-logo" src="{{LOGO}}">';
    spec.css += '\n.canvas .cs-auto-logo{position:absolute;left:56px;bottom:56px;height:72px;width:auto;z-index:50}';
  }
  if (job.photo_source !== 'none' && !/\{\{PHOTO\}\}/.test(spec.html + spec.css)) {
    spec.html += '<img class="cs-auto-photo" src="{{PHOTO}}">';
    spec.css += '\n.canvas .cs-auto-photo{position:absolute;right:56px;bottom:56px;width:300px;height:300px;object-fit:cover;border-radius:28px;box-shadow:0 20px 50px rgba(0,0,0,.35);z-index:40}';
    if (spec.image_shape === 'none') spec.image_shape = 'square';
  }
  let photo_url = null;
  let image_error = null;
  if (fixed) {
    photo_url = fixed;
  } else if (job.photo_source === 'ai') {
    if (!out.photo_prompt) out.photo_prompt = spec.layout_name.startsWith('device object')
      ? objectPrompt(out.concept?.specific_object || 'the ad idea as one object', (/^#[0-9a-f]{6}$/i.test(out.design?.background_hex || '') ? out.design.background_hex : brand.colors?.deep || '#111111'), brand)
      : `${out.concept?.specific_object || 'the ad idea'}, as a clean 3D object render in the brand colours, plain background`;
    try {
      // Objects on a device card come with a see-through background so they sit on the card's colour, not in a box.
      const isObject = spec.layout_name.startsWith('device object');
      photo_url = await generateImage(creativeId, out.photo_prompt, isObject ? '1024x1024' : (IMAGE_SIZE[spec.image_shape] || '1024x1024'), isObject);
    } catch (err) {
      console.error('image', creativeId, err);
      image_error = String(err?.message || err).slice(0, 300);
    }
  } else if (job.photo_source === 'brand' && images.length) {
    photo_url = (images[out.brand_image_index] || images[0]).url;
  }
  check(await db().from('creatives').update({
    status: 'ready', error: null, spec,
    concept: {
      ...out.concept, visual_type: out.visual_type, layout_name: spec.layout_name, hook: spec.hook,
      compliance_notes: out.compliance_notes || [], claims_used: out.claims_used || [], flags: out.flags || [],
      ...deviceFacts(d),
      ...(image_error ? { image_error } : {}),
    },
    ad_copy: out.ad_copy, photo_prompt: out.photo_prompt || null, photo_url,
  }).eq('id', creativeId));
}

export async function recentFor(brandId) {
  const rows = check(await db().from('creatives').select('concept,ad_copy,spec')
    .eq('brand_id', brandId).eq('status', 'ready').order('created_at', { ascending: false }).limit(12)) || [];
  return { headlines: [...new Set(recentHeadlines(rows))], layouts: recentLayouts(rows), backgrounds: recentBackgrounds(rows) };
}
