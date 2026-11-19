import 'server-only';
import { sanitizeHtml } from './sanitize.js';
import { contrast } from './deviceCheck.js';

// The house layout for the device card. Claude picks the words, the visual, the screen content
// and the background colour; this file places them on a fixed grid with set type sizes and
// spacing. Everything sits in normal document flow (columns and rows), so no two elements can
// overlap however long the words are.

const SIZES = {
  '4:5': { w: 1080, h: 1350, top: 64, mainTop: 184, mainBottom: 176, footBottom: 64 },
  '9:16': { w: 1080, h: 1920, top: 280, mainTop: 396, mainBottom: 770, footBottom: 676 }, // Stories/Reels safe zone
  '1:1': { w: 1080, h: 1080, top: 56, mainTop: 160, mainBottom: 150, footBottom: 52 },
};
const M = 72; // side margin

const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ''));
const lumOf = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

/** Headline lines with the accent words wrapped in <span class="acc">. */
function headlineHtml(lines, accents) {
  const words = (accents || []).map((a) => String(a).trim()).filter(Boolean).sort((a, b) => b.length - a.length);
  const re = words.length ? new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi') : null;
  return lines.map((l) => {
    const text = esc(l);
    return `<span class="hl">${re ? text.replace(re, '<span class="acc">$1</span>') : text}</span>`;
  }).join('');
}

/** Font size that keeps the longest headline line inside the width (heavy display fonts run about 0.66 em per character). */
function fitHeadline(lines, width, max, min) {
  const longest = Math.max(...lines.map((l) => l.length), 8);
  return Math.round(Math.max(min, Math.min(max, width / (longest * 0.66))));
}

const WEAK_END = /^(the|a|an|to|of|and|or|for|your|my|our|in|on|at|with|by|is|are|who|that)$/i;

/** Re-breaks a headline whose lines are lopsided (one word alone, one line far longer than the rest). Keeps good breaks as they are. */
export function balanceHeadline(lines, accents = []) {
  const clean = lines.map((l) => String(l).trim()).filter(Boolean);
  const words = clean.join(' ').split(/\s+/).filter(Boolean);
  if (words.length < 4) return clean;
  const lens = clean.map((l) => l.length);
  const lopsided = clean.length < 2 || Math.max(...lens) > 22 || clean.some((l) => !/\s/.test(l) && Math.max(...lens) > l.length * 2) || Math.max(...lens) > Math.min(...lens) * 2.6;
  if (!lopsided) return clean;
  const accentIdx = new Set();
  const lw = words.map((w) => w.toLowerCase().replace(/[^a-z0-9']/g, ''));
  (accents || []).forEach((a) => {
    const aw = String(a).toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z0-9']/g, '')).filter(Boolean);
    for (let i = 0; i + aw.length <= lw.length; i++) if (aw.every((w, k) => lw[i + k] === w)) for (let k = 0; k < aw.length - 1; k++) accentIdx.add(i + k);
  });
  let best = null;
  const walk = (start, left, acc) => {
    if (left === 1) {
      const parts = [...acc, words.slice(start)];
      if (!parts[parts.length - 1].length) return;
      const ls = parts.map((p) => p.join(' ').length);
      let score = Math.max(...ls) * 3 + (Math.max(...ls) - Math.min(...ls)) + parts.length * 12 + (Math.max(...ls) > 22 ? 40 : 0);
      let at = 0;
      parts.forEach((p, i) => {
        at += p.length;
        if (p.length === 1) score += 14;
        if (i < parts.length - 1 && WEAK_END.test(p[p.length - 1])) score += 10;
        if (i < parts.length - 1 && accentIdx.has(at - 1)) score += 60;
      });
      if (!best || score < best.score) best = { score, parts };
      return;
    }
    for (let e = start + 1; e <= words.length - left + 1; e++) walk(e, left - 1, [...acc, words.slice(start, e)]);
  };
  for (let n = 2; n <= Math.min(4, words.length); n++) walk(0, n, []);
  return best ? best.parts.map((p) => p.join(' ')) : clean;
}

const SHIELD = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" fill="var(--accent)"/><path d="M8.2 12.2l2.6 2.6 5-5.2" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const BAD = /\b(missed|lost|no answer|unanswered|declined|overdue|failed|late|cancel+ed|waiting|stuck|again)\b/i;
const GOOD = /\b(booked|done|complete[d]?|paid|confirmed|sent|replied|built|returned|signed|active|live|delivered|approved|won|scheduled|answered|added|ready|fixed|qa'?d)\b|✓/i;

/** One line on the device screen, shown as a small card with a status mark. */
function screenRow(text, i) {
  const t = String(text || '').trim();
  const cut = t.indexOf(':');
  const label = cut > 0 && cut < 34 ? t.slice(0, cut) : '';
  const rest = label ? t.slice(cut + 1).trim() : t;
  const mark = GOOD.test(t)
    ? '<span class="mk ok"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8.4l2.6 2.6L12 5.4" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
    : BAD.test(t) ? '<span class="mk bad"></span>' : '<span class="mk acc-dot"></span>';
  return `<div class="row${i === 0 ? ' first' : ''}">${mark}<div class="rt">${label ? `<strong>${esc(label)}</strong><span>${esc(rest)}</span>` : `<strong>${esc(rest)}</strong>`}</div></div>`;
}

function screenHtml(screen, max) {
  const rows = (screen?.elements || []).filter((e) => String(e || '').trim()).slice(0, max);
  return `<div class="app">${esc(screen?.app_title || 'Today')}</div><div class="rows">${rows.map(screenRow).join('')}</div>`;
}

function visualHtml({ kind, device, screen, photo, objectSvg }) {
  if (kind === 'object') {
    if (photo) return '<div class="device obj"><img class="objimg" src="{{PHOTO}}"></div>';
    const svg = sanitizeHtml(objectSvg || '').trim();
    if (svg.startsWith('<svg')) return `<div class="device obj drawn">${svg}</div>`;
    device = device || 'phone'; // nothing to show for the object: fall back to a phone screen
  }
  if (device === 'laptop') return `<div class="device laptop"><div class="lid"><div class="scr">${screenHtml(screen, 4)}</div></div><div class="base"></div></div>`;
  if (device === 'tablet') return `<div class="device tablet"><div class="scr">${screenHtml(screen, 5)}</div></div>`;
  return `<div class="device phone"><div class="scr"><div class="notch"></div>${screenHtml(screen, 5)}</div></div>`;
}

/**
 * Builds the device card's HTML and CSS from Claude's choices.
 * d: Claude's design fields; furniture: the exact texts (deviceFurniture); kind: 'device' | 'object';
 * photo: true when an AI image is generated for an object visual.
 */
export function buildDeviceCard({ d, brand, furniture, format, kind = 'device', photo = false, body = '' }) {
  const S = SIZES[format] || SIZES['4:5'];
  const W = S.w - M * 2;
  const bg = isHex(d.background_hex) ? d.background_hex : (isHex(brand.colors?.deep) ? brand.colors.deep : '#111418');
  const light = lumOf(bg) > 0.6;
  const ink = light ? '#15151A' : '#FFFFFF';
  const soft = light ? 'rgba(21,21,26,.74)' : 'rgba(255,255,255,.80)';
  const faint = light ? 'rgba(21,21,26,.56)' : 'rgba(255,255,255,.60)';
  const accent = isHex(brand.colors?.accent) ? brand.colors.accent : '#0F766E';
  const label = contrast(accent, '#FFFFFF') < 2.6 ? '#111111' : '#FFFFFF';

  let lines = (d.headline_lines || []).map((l) => String(l).trim()).filter(Boolean).slice(0, 4);
  if (!lines.length) lines = [String(d.hook || '').trim() || 'Your headline'];
  lines = balanceHeadline(lines, d.accent_words);
  const tall = format === '9:16';
  // 9:16 stacks: all text sits inside the Reels safe zone, the visual fills the space under it.
  const below = tall || d.device_side === 'below' || (kind !== 'object' && d.device === 'laptop');
  const left = !below && d.device_side === 'left';
  const mainBottom = tall ? 300 : S.mainBottom;
  const footBottom = tall ? 210 : S.footBottom;
  const hSize = fitHeadline(lines, W, tall ? 112 : format === '1:1' ? 92 : 104, 56);
  const text = String(body || d.subhead || '').trim();
  const bodySize = text.split(/\s+/).length > 22 ? 30 : 34;
  const visualW = below ? '100%' : kind === 'object' ? '46%' : '40%';

  const html = [
    `<div class="top"><img class="logo" src="{{LOGO}}">${furniture.bonus_pill ? `<span class="bonus">${esc(furniture.bonus_pill)}</span>` : ''}</div>`,
    '<div class="main">',
    `<h1 class="headline">${headlineHtml(lines, d.accent_words)}</h1>`,
    `<div class="row-area${below ? ' below' : ''}${left ? ' left' : ''}">`,
    '<div class="col">',
    text ? `<p class="body">${esc(text)}</p>` : '',
    furniture.proof_line ? `<div class="proof">${SHIELD}<span>${esc(furniture.proof_line)}</span></div>` : '',
    `<div class="cta-wrap"><span class="cta">${esc(furniture.cta || 'Learn more')}</span>${furniture.cta_note ? `<span class="cta-note">${esc(furniture.cta_note)}</span>` : ''}</div>`,
    '</div>',
    `<div class="vis">${visualHtml({ kind, device: d.device, screen: d.screen, photo, objectSvg: d.object_svg })}</div>`,
    '</div>',
    '</div>',
    `<div class="foot"><strong>${esc(brand.name)}</strong><span>${esc([furniture.website, furniture.email].filter(Boolean).join('  ·  '))}</span></div>`,
  ].join('');

  const css = `
.canvas{background:${bg};color:${ink}}
.canvas .top{position:absolute;left:${M}px;right:${M}px;top:${S.top}px;height:84px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.canvas .logo{height:68px;width:auto;max-width:380px;object-fit:contain;object-position:left center}
.canvas .bonus{flex:none;font:700 25px/1 var(--font-body);padding:15px 26px;border-radius:999px;background:var(--accent);color:${label};white-space:nowrap}
.canvas .main{position:absolute;left:${M}px;right:${M}px;top:${S.mainTop}px;bottom:${mainBottom}px;display:flex;flex-direction:column}
.canvas .headline{flex:none;margin:0;font:900 ${hSize}px/1.03 var(--font-heading);letter-spacing:-0.025em;color:${ink}}
.canvas .headline .hl{display:block;white-space:nowrap}
.canvas .row-area{flex:1;min-height:0;display:flex;gap:44px;align-items:center;margin-top:${tall ? 44 : 36}px}
.canvas .row-area.left{flex-direction:row-reverse}
.canvas .row-area.below{flex-direction:column;align-items:stretch;gap:32px}
.canvas .col{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:flex-start}
.canvas .row-area.below .col{flex:none}
.canvas .body{margin:0;font:500 ${bodySize}px/1.38 var(--font-body);color:${soft};max-width:${below ? 900 : 560}px}
.canvas .proof{display:flex;align-items:center;gap:12px;margin-top:34px;font:600 25px/1.3 var(--font-body);color:${ink}}
.canvas .proof .ico{flex:none;width:30px;height:30px}
.canvas .cta-wrap{display:flex;flex-direction:${below ? 'row' : 'column'};align-items:${below ? 'center' : 'flex-start'};gap:${below ? 24 : 14}px;margin-top:30px}
.canvas .cta{display:inline-block;padding:26px 40px;border-radius:16px;font:800 31px/1.1 var(--font-body);letter-spacing:-0.005em;box-shadow:0 14px 30px rgba(0,0,0,.18)}
.canvas .cta-note{font:500 22px/1.3 var(--font-body);color:${faint}}
.canvas .vis{flex:0 0 ${visualW};height:100%;min-height:0;display:flex;align-items:center;justify-content:center}
.canvas .row-area.below .vis{flex:1 1 0;width:100%}
.canvas .foot{position:absolute;left:${M}px;right:${M}px;bottom:${footBottom}px;display:flex;flex-direction:column;gap:6px}
.canvas .foot strong{font:800 27px/1.1 var(--font-heading);color:${ink}}
.canvas .foot span{font:500 21px/1.2 var(--font-body);color:${faint}}

.canvas .device{position:relative}
.canvas .phone{height:100%;max-height:${tall ? 800 : 760}px;aspect-ratio:9/18.6;max-width:100%;border-radius:58px;background:#111114;padding:13px;box-shadow:0 0 0 2px #2A2A2E inset,0 40px 80px rgba(0,0,0,.34)}
.canvas .tablet{height:100%;max-height:760px;aspect-ratio:3/4;max-width:100%;border-radius:40px;background:#111114;padding:18px;box-shadow:0 40px 80px rgba(0,0,0,.30)}
.canvas .laptop{height:100%;max-height:520px;aspect-ratio:16/10.6;max-width:100%;display:flex;flex-direction:column;align-items:center;margin:0 auto}
.canvas .laptop .lid{flex:1;min-height:0;width:88%;border-radius:22px 22px 6px 6px;background:#111114;padding:14px 14px 18px;box-shadow:0 30px 70px rgba(0,0,0,.30)}
.canvas .laptop .base{flex:none;width:100%;height:22px;border-radius:0 0 22px 22px;background:#2A2A2E}
.canvas .scr{position:relative;height:100%;border-radius:46px;background:#F6F6F4;overflow:hidden;padding:64px 20px 20px;display:flex;flex-direction:column;gap:16px}
.canvas .tablet .scr{border-radius:24px;padding:34px 26px}
.canvas .laptop .scr{border-radius:10px;padding:26px 28px}
.canvas .notch{position:absolute;top:18px;left:50%;width:120px;height:32px;margin-left:-60px;border-radius:20px;background:#111114}
.canvas .app{font:800 30px/1.1 var(--font-heading);color:#15151A;padding:0 6px}
.canvas .rows{display:flex;flex-direction:column;gap:12px}
.canvas .laptop .rows{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.canvas .row{display:flex;gap:12px;align-items:flex-start;background:#FFFFFF;border-radius:18px;padding:15px 16px;box-shadow:0 2px 8px rgba(0,0,0,.07)}
.canvas .row.first{box-shadow:0 0 0 3px var(--accent) inset,0 2px 8px rgba(0,0,0,.07)}
.canvas .rt{display:flex;flex-direction:column;gap:3px;min-width:0}
.canvas .rt strong{font:700 21px/1.25 var(--font-body);color:#15151A}
.canvas .rt span{font:500 20px/1.3 var(--font-body);color:#6B6F76}
.canvas .mk{flex:none;width:24px;height:24px;margin-top:1px;border-radius:50%;display:block}
.canvas .mk svg{width:24px;height:24px;display:block}
.canvas .mk.ok{background:#2BA36B}
.canvas .mk.bad{width:14px;height:14px;margin:6px 5px;background:#E5484D}
.canvas .mk.acc-dot{width:14px;height:14px;margin:6px 5px;background:var(--accent)}

.canvas .obj{height:100%;width:100%;display:flex;align-items:center;justify-content:center}
.canvas .objimg{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;filter:drop-shadow(0 28px 36px rgba(0,0,0,.30))}
.canvas .drawn svg{width:100%;height:100%;max-height:640px}
`;
  return { html, css };
}
