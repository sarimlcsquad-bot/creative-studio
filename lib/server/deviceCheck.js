import 'server-only';
import { sanitizeHtml } from './sanitize.js';

// Rules for the device card that are checked in code after Claude designs it.
// A design that breaks them goes back to Claude once with the list of problems.

const clean = (v) => String(v || '').trim();

/** The fixed texts on a device card: from the builder when given, otherwise from the brand's audience block. */
export function deviceFurniture(brand, req) {
  const a = brand.audiences?.[req.source] || {};
  const c = req.brief?.content || {};
  return {
    cta: clean(c.cta) || clean(brand.default_cta),
    cta_note: clean(c.cta_note) || clean(a.cta_note),
    proof_line: clean(c.proof_line) || clean(a.proof_line),
    bonus_pill: clean(c.bonus_pill) || clean(a.bonus_pill),
    website: clean(brand.website).replace(/^https?:\/\//, '').replace(/\/$/, ''),
    email: clean(brand.email),
  };
}

const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
};
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ''));

/** Dark or light ground: forced when the brand accent would not read on the other one. */
export function groundFor(brand, wanted) {
  const accent = brand.colors?.accent;
  if (!isHex(accent)) return wanted;
  const onLight = contrast(accent, '#F6F4EF'), onDark = contrast(accent, '#111418');
  if (onLight < 2.4 && onDark >= 2.4) return 'dark';
  if (onDark < 2.4 && onLight >= 2.4) return 'light';
  return wanted;
}

function hue(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}
const expand = (h) => (h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h);

/** Colours in the design that are neither brand colours, neutrals, nor the small red/green status marks. */
function offBrandColours(css, html, brand, bg) {
  const brandHues = Object.values(brand.colors || {}).filter(isHex).map(hue);
  const found = [...new Set(`${css}\n${html}`.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) || [])].map((h) => expand(h).toLowerCase());
  return found.filter((h) => {
    if (bg && h === bg.toLowerCase()) return false;
    const c = hue(h);
    if (c.s < 0.22 || c.l < 0.12 || c.l > 0.93) return false; // neutral, near-black, near-white
    if (brandHues.some((b) => b.s >= 0.1 && Math.min(Math.abs(b.h - c.h), 360 - Math.abs(b.h - c.h)) < 22)) return false;
    if (c.h < 14 || c.h > 346 || (c.h > 95 && c.h < 160)) return false; // status red / green on the screen
    return true;
  });
}

const textOf = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').toLowerCase();
const has = (text, s) => !s || text.includes(s.toLowerCase().replace(/\s+/g, ' '));

/** Problems with a device card, as short sentences Claude can act on. Empty when it passes. */
export function checkDevice(out, { brand, furniture, chosenBg = '', allowPhoto = false }) {
  const d = out.design || {};
  const html = sanitizeHtml(d.html);
  const css = String(d.css || '');
  const text = textOf(html);
  const issues = [];
  const lines = (d.headline_lines || []).filter((l) => clean(l));
  const words = lines.join(' ').split(/\s+/).filter(Boolean).length;
  if (lines.length > 3) issues.push(`The headline has ${lines.length} lines. Use 2 or 3 short lines.`);
  if (words > 11) issues.push(`The headline has ${words} words. Keep it to about 9 words or fewer.`);
  if (clean(d.subhead)) issues.push('There is a subhead. Remove it: the card has no subhead or support sentence.');
  if (/<(ul|ol|li)\b/i.test(html)) issues.push('The card has a bullet list. Remove all lists; benefits go in the caption only.');
  if (/\b\d(\.\d)?\s*\/\s*5\b|★|⭐|\b\d(\.\d)?\s*stars?\b|verified reviews?|\brated\b|\breviews?\s+score/i.test(text)) {
    issues.push('The card shows a rating or review score. Remove it; use only the proof line given.');
  }
  for (const [cls, what] of [['headline', 'headline'], ['cta', 'CTA button'], ['device', 'device'], ['foot', 'footer']]) {
    if (!new RegExp(`class="[^"]*\\b${cls}\\b`).test(html)) issues.push(`Add class="${cls}" to the ${what}.`);
  }
  if (!has(text, furniture.cta)) issues.push(`The CTA button must say exactly "${furniture.cta}".`);
  if (furniture.proof_line && !has(text, furniture.proof_line)) issues.push(`The proof line must say exactly "${furniture.proof_line}" (with the shield icon).`);
  if (furniture.bonus_pill && !has(text, furniture.bonus_pill)) issues.push(`The offer pill top-right must say exactly "${furniture.bonus_pill}".`);
  if (furniture.cta_note && !has(text, furniture.cta_note)) issues.push(`The note under the button must say exactly "${furniture.cta_note}".`);
  if (furniture.website && !has(text, furniture.website)) issues.push(`The footer must show the website "${furniture.website}".`);
  if (furniture.email && !has(text, furniture.email)) issues.push(`The footer must show the email "${furniture.email}".`);
  if (/\{\{BG\}\}/.test(html + css) || (!allowPhoto && /\{\{PHOTO\}\}/.test(html + css))) issues.push('Remove {{PHOTO}} and {{BG}}: this card has no photo.');
  if (allowPhoto && !/\{\{PHOTO\}\}/.test(html + css)) issues.push('Use the generated visual: <img class="device" src="{{PHOTO}}"> in the device slot.');
  const bg = isHex(d.background_hex) ? d.background_hex : null;
  if (!bg) issues.push('background_hex must be one colour like #1A2B3C.');
  const accent = brand.colors?.accent;
  // A background the person picked in the builder is their call, so it is not second-guessed here.
  if (bg && !chosenBg && isHex(accent) && contrast(accent, bg) < 2.2) {
    issues.push(`The brand accent ${accent} does not stand out on the background ${bg}. Pick a ${lum(accent) > 0.35 ? 'darker' : 'lighter'} background.`);
  }
  if (bg && !chosenBg) {
    const b = hue(bg);
    const near = Object.values(brand.colors || {}).filter(isHex).map(hue).some((c) => c.s >= 0.1 && Math.min(Math.abs(c.h - b.h), 360 - Math.abs(c.h - b.h)) < 25);
    if (b.s > 0.25 && b.l > 0.08 && b.l < 0.95 && !near) issues.push(`The background ${bg} is not in the brand's colour family. Use a deep or very light tint of a brand colour, or a neutral.`);
  }
  const off = offBrandColours(css, html, brand, bg);
  if (off.length) issues.push(`These colours are not brand colours: ${off.slice(0, 6).join(', ')}. Use only the brand colours, neutrals and the background.`);
  return issues;
}

/** CSS appended to every device card so the brand accent is used the same way on all of them. */
export function deviceCss(brand) {
  const accent = isHex(brand.colors?.accent) ? brand.colors.accent : null;
  const label = accent && contrast(accent, '#FFFFFF') < 2.6 ? '#111111' : '#FFFFFF';
  return [
    '/* house rules */',
    '.canvas .headline .acc{color:var(--accent)!important;background:none!important;box-shadow:none!important;padding:0!important;border:0!important;text-decoration:none!important}',
    '.canvas .headline span:not(.acc){color:inherit!important;background:none!important;box-shadow:none!important}',
    `.canvas .cta{background:var(--accent)!important;color:${label}!important;background-image:none!important}`,
    `.canvas .cta *{color:${label}!important}`,
  ].join('\n');
}
