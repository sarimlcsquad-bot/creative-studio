import 'server-only';
import PROMPTS from './prompts.json';
import { claudeJson } from './claude.js';
import { db, check, publicUrl } from './supabase.js';
import { aiImagesEnabled, makeImage } from './openai.js';
import { sanitizeCss, sanitizeHtml } from './sanitize.js';

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
  required: ['concept', 'card', 'photo_prompt', 'visual_type', 'brand_image_index', 'ad_copy', 'compliance_notes'],
  properties: {
    concept: {
      type: 'object', additionalProperties: false,
      required: ['method', 'stage', 'psychographic_layer', 'tier', 'angle', 'specific_object', 'ladder_rungs',
        'mechanism_position', 'value_term', 'stack_items', 'enhancers_used', 'magic_name', 'rationale'],
      properties: {
        method: { type: 'string', enum: ['presold', '100m'] },
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
    compliance_notes: strings,
  },
};

// Free design: Claude writes the layout itself as HTML + CSS (see prompts/design-free.md).
const { card: _classicCard, ...SHARED_PROPS } = CREATIVE_SCHEMA.properties;
export const FREE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['concept', 'design', 'photo_prompt', 'visual_type', 'brand_image_index', 'ad_copy', 'compliance_notes'],
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

const STAGES = ['auto', 'unaware', 'problem', 'solution', 'product', 'most'];
const ROTATION = ['problem', 'solution', 'product', 'most'];

/** Validates a generate request from the browser. Throws with a readable message. */
export function parseRequest(b = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(b.brand_id || ''))) throw new Error('Pick a brand');
  const mode = b.mode === 'prompt' ? 'prompt' : 'random';
  if (mode === 'prompt' && !String(b.prompt || '').trim()) throw new Error('Write a prompt, or switch to Random');
  return {
    brand_id: b.brand_id,
    mode,
    prompt: String(b.prompt || '').slice(0, 4000),
    count: Math.min(Math.max(parseInt(b.count, 10) || 1, 1), 4),
    format: ['1:1', '4:5', '9:16'].includes(b.format) ? b.format : '1:1',
    photo_source: ['ai', 'brand', 'none'].includes(b.photo_source) ? b.photo_source : 'brand',
    image_style: ['auto', 'photo', 'object', 'illustration'].includes(b.image_style) ? b.image_style : 'auto',
    design: b.design === 'classic' ? 'classic' : 'free',
    stage: STAGES.includes(b.stage) ? b.stage : 'auto',
    method: ['presold', '100m', 'mix'].includes(b.method) ? b.method : 'presold',
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
  // Free designs always carry a visual asset when one is available.
  if (req.design !== 'classic' && photo_source === 'none') photo_source = ai ? 'ai' : (hasImages ? 'brand' : 'none');
  const offset = Math.floor(Math.random() * ROTATION.length);
  const mOffset = Math.floor(Math.random() * 2);
  return Array.from({ length: req.count }, (_, i) => ({
    index: i,
    stage: req.stage !== 'auto' ? req.stage : (req.count > 1 ? ROTATION[(offset + i) % ROTATION.length] : 'auto'),
    method: req.method !== 'mix' ? req.method : (req.count > 1 ? ['presold', '100m'][(mOffset + i) % 2] : (Math.random() < 0.5 ? 'presold' : '100m')),
    photo_source,
  }));
}

function recentHeadlines(rows) {
  return rows.map((r) => {
    const h = (r.spec?.blocks || []).find((b) => b.type === 'headline');
    return h ? h.lines.map((l) => l.replace(/^accent:/, '')).join(' ') : r.ad_copy?.headline;
  }).filter(Boolean);
}

function recentLayouts(rows) {
  return [...new Set(rows.map((r) => r.spec?.layout_name).filter(Boolean))].slice(0, 8);
}

function buildContent({ brand, req, job, images, headlines, layouts = [] }) {
  const free = req.design !== 'classic';
  const kit = {
    name: brand.name, website: brand.website, industry: brand.industry, description: brand.description,
    service_area: brand.service_area, ideal_customer: brand.target_audience, services: brand.services,
    main_offer: brand.offer, differentiators: brand.differentiators, verified_proof_points: brand.proof_points,
    guarantees: brand.guarantees, default_cta: brand.default_cta, tone_of_voice: brand.tone_of_voice,
    banned_phrases: brand.banned_phrases, compliance_notes: brand.compliance_notes,
    colors: brand.colors, fonts: brand.fonts, has_logo: Boolean(brand.logo_url), website_summary: brand.website_summary,
  };
  const lines = [
    'BRAND KIT (the only facts you may use):',
    JSON.stringify(kit, null, 2),
    '',
    'REQUEST',
    `- Method: ${job.method === '100m' ? '$100M Offers (value equation, named stack)' : 'Pre-Sold (awareness stage, psychographic stack)'}`,
    `- Mode: ${req.mode === 'prompt' ? 'follow the direction below' : 'random: choose the strongest angle for this brand yourself'}`,
  ];
  if (req.mode === 'prompt') lines.push(`- Direction from the user: "${req.prompt}"`);
  lines.push(`- Awareness stage: ${job.stage}`);
  if (free) {
    const size = { '1:1': '1080 x 1080', '4:5': '1080 x 1350', '9:16': '1080 x 1920' }[req.format];
    lines.push(`- Design: free. Design your own layout as HTML + CSS for a ${size} px canvas (format ${req.format}${req.format === '9:16' ? ', vertical Stories/Reels: respect the safe zone' : ''}). It must have a hook, the visual asset and the logo.`);
  } else {
    lines.push(`- Design: classic performance card. Format: ${req.format}${req.format === '9:16' ? ' (vertical Stories/Reels: keep the text short, headline 2 lines, checklist at most 3 items)' : ''}`);
  }
  if (job.photo_source === 'brand') {
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
  if (req.count > 1) lines.push(`- This is creative ${job.index + 1} of ${req.count} in one batch. Make it clearly different from the others: a different person, specific object and headline${job.photo_source === 'brand' && images.length > 1 ? ', and a different photo if one fits' : ''}.`);
  if (free && req.count > 1) lines.push('- Use a different layout from the other creatives in this batch.');
  if (free && layouts.length) lines.push(`- Layouts already used for this brand (pick something different): ${layouts.map((l) => `"${l}"`).join('; ')}`);
  if (headlines.length) lines.push(`- Headlines already used for this brand (do not repeat them): ${headlines.map((h) => `"${h}"`).join('; ')}`);
  lines.push('', 'Write the creative now.');

  const content = [];
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

/** Writes one creative with Claude and saves it. Marks the row failed on any error. */
export async function runJob({ creativeId, brand, req, job, headlines, layouts }) {
  const free = req.design !== 'classic';
  const images = job.photo_source === 'brand'
    ? (brand.brand_images || []).filter((im) => /^https?:\/\//.test(im.url || '')).slice(0, 8)
    : [];
  try {
    const out = await claudeJson({
      system: PROMPTS[`${job.method}:${free ? 'free' : 'classic'}`] || PROMPTS['presold:free'],
      content: buildContent({ brand, req, job, images, headlines, layouts }),
      schema: free ? FREE_SCHEMA : CREATIVE_SCHEMA,
      maxTokens: free ? 32000 : 16000,
    });
    if (free) return await saveFree({ creativeId, job, images, out });
    const card = cleanCard(out.card);
    let photo_url = null;
    let image_error = null;
    if (job.photo_source === 'ai' && out.photo_prompt) {
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
      concept: { ...out.concept, visual_type: out.visual_type, compliance_notes: out.compliance_notes || [], ...(image_error ? { image_error } : {}) },
      ad_copy: out.ad_copy, photo_prompt: out.photo_prompt || null, photo_url,
    }).eq('id', creativeId));
  } catch (e) {
    console.error('creative', creativeId, e);
    const msg = e?.error?.error?.message || e?.message || String(e);
    await db().from('creatives').update({ status: 'failed', error: String(msg).slice(0, 500) }).eq('id', creativeId);
  }
}

const IMAGE_SIZE = { square: '1024x1024', tall: '1024x1536', wide: '1536x1024' };

async function generateImage(creativeId, prompt, size) {
  const png = await makeImage({ prompt, size });
  const path = `ai-images/${creativeId}.png`;
  check(await db().storage.from('creatives').upload(path, png, { contentType: 'image/png', upsert: true }));
  return publicUrl('creatives', path);
}

/** Saves a free-design creative: cleaned HTML/CSS plus its image. */
async function saveFree({ creativeId, job, images, out }) {
  const d = out.design || {};
  const spec = {
    mode: 'html',
    layout_name: String(d.layout_name || '').slice(0, 60),
    hook: String(d.hook || '').slice(0, 200),
    image_shape: d.image_shape || 'none',
    html: sanitizeHtml(d.html),
    css: sanitizeCss(d.css),
  };
  if (!spec.html.trim()) throw new Error('Claude returned an empty design');
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
  if (job.photo_source === 'ai') {
    if (!out.photo_prompt) out.photo_prompt = `${out.concept?.specific_object || 'the ad idea'}, as a clean 3D object render in the brand colours, plain background`;
    try {
      photo_url = await generateImage(creativeId, out.photo_prompt, IMAGE_SIZE[spec.image_shape] || '1024x1024');
    } catch (err) {
      console.error('image', creativeId, err);
      image_error = String(err?.message || err).slice(0, 300);
    }
  } else if (job.photo_source === 'brand' && images.length) {
    photo_url = (images[out.brand_image_index] || images[0]).url;
  }
  check(await db().from('creatives').update({
    status: 'ready', error: null, spec,
    concept: { ...out.concept, visual_type: out.visual_type, layout_name: spec.layout_name, hook: spec.hook, compliance_notes: out.compliance_notes || [], ...(image_error ? { image_error } : {}) },
    ad_copy: out.ad_copy, photo_prompt: out.photo_prompt || null, photo_url,
  }).eq('id', creativeId));
}

export async function recentFor(brandId) {
  const rows = check(await db().from('creatives').select('concept,ad_copy,spec')
    .eq('brand_id', brandId).eq('status', 'ready').order('created_at', { ascending: false }).limit(12)) || [];
  return { headlines: recentHeadlines(rows), layouts: recentLayouts(rows) };
}
