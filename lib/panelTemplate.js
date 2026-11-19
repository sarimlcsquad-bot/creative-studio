// The "headline + diagram" card (the house reference style).
// Claude picks the words, a theme and one diagram panel and fills its content; this file draws
// all of it the same way every time: logo and offer pill on top, a centred 3-line headline whose
// last line is in the theme's accent colour, one short line under it, the diagram, an orange pill
// button with an arrow, a note, and a footer with the logo, website, email and a trust line.
// It has no server-only imports so the builder can show the same card as a live preview.

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ''));
const clip = (v, n) => { const s = String(v ?? '').trim(); return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s; };

export const PANEL_TYPES = {
  timeline: 'Day or week rows, the last one crossed out (Monday: build delivered / Friday night: you, editing)',
  checklist: 'A card with a title and 3 to 5 ticked items (what is included, what gets checked)',
  steps: 'A heading and 3 or 4 numbered steps, each with a short title and detail',
  compare_table: 'Two columns in one card: what they have now (left) and what you do about it (right, ticked)',
  compare_cards: 'Two cards side by side: today, with crossed items, and with you, with ticked items',
  flow: '2 or 3 inputs that join into one orange hub, which leads to one finished result',
  calendar: 'Two week grids: the messy one with gaps and crosses, and the full one with every slot ticked',
  path: 'A 3-step chain shown twice: broken today, connected after you build it',
  tiles: 'A heading and 4 numbered tiles in a 2 by 2 grid',
  columns: 'A card with a heading and 3 columns, each with an icon, a short title and a detail',
  clock: 'A clock at a time of day beside 3 reminder bubbles, with one line under it',
  seesaw: 'A see-saw: a stack of 3 things on one side outweighs one small thing on the other',
  funnel: 'Two cards: a leaky funnel today and a funnel that moves people through 3 stages with you',
  device: 'A phone, tablet or laptop showing one simple app screen: a list with status pills, a calendar, notifications, a two-column board or a team roster',
};
export const DEVICES = ['phone', 'tablet', 'laptop'];
export const SCREENS = {
  list: 'A titled list: each row a name and a status pill; a missing item shows as a dashed row; start a name with ~ to cross it out',
  calendar: 'A month view with one day circled, then the day and 1 or 2 items under it',
  notifications: 'A lock screen with a date, a big time and 2 or 3 message cards',
  board: 'Two columns: one highlighted card on the left, a queue of cards on the right',
  roster: 'A team list with an avatar per role and a tick, and an optional crossed-out alternative on the side',
};
export const LAYOUTS = ['stack', 'split_right', 'split_left'];

// Bold ground per ad. ink = headline colour, acc = last headline line, pill = offer pill.
export const THEMES = {
  indigo: { bg: 'linear-gradient(165deg,#2A1C8C 0%,#3B25B8 55%,#5B2CA8 100%)', ink: '#FFFFFF', acc: '#FF7A45', pill: '#FF6A3D', pillInk: '#FFFFFF', pillAcc: '#FFE38A', decor: 'dots', dark: true },
  teal: { bg: 'linear-gradient(165deg,#13897A 0%,#0C5D53 60%,#0A3F38 100%)', ink: '#FFFFFF', acc: '#FFC93A', pill: '#FFC93A', pillInk: '#1B1530', decor: 'circle', dark: true },
  sun: { bg: 'linear-gradient(160deg,#FFC72C 0%,#FFC72C 38%,#FFF4D6 38.2%,#FFF8E6 100%)', ink: '#1B1530', acc: '#E8542E', pill: '#1B1530', pillInk: '#FFFFFF', decor: 'none', dark: false },
  lavender: { bg: 'linear-gradient(170deg,#C3B1FF 0%,#DCD0FF 50%,#F1ECFF 100%)', ink: '#2A1660', acc: '#C0168A', pill: '#1F1A4A', pillInk: '#FFFFFF', decor: 'rings', dark: false },
  violet: { bg: 'linear-gradient(165deg,#6D28D9 0%,#5B21B6 55%,#3B1585 100%)', ink: '#FFFFFF', acc: '#FFC93A', pill: '#FFC93A', pillInk: '#1B1530', decor: 'circle', dark: true },
  charcoal: { bg: 'linear-gradient(165deg,#2A2C3A 0%,#17181F 60%,#0D0E12 100%)', ink: '#FFFFFF', acc: '#B5F23D', pill: '#B5F23D', pillInk: '#14160A', decor: 'frame', dark: true },
  sky: { bg: 'linear-gradient(170deg,#7CC8FF 0%,#B9E1FF 45%,#EEF8FF 100%)', ink: '#10223F', acc: '#D61F3D', pill: '#10223F', pillInk: '#FFFFFF', decor: 'circle', dark: false },
  pink: { bg: 'linear-gradient(170deg,#FF93BA 0%,#FFC2D8 50%,#FFE9F1 100%)', ink: '#3A0F2B', acc: '#6D28D9', pill: '#2A1036', pillInk: '#FFFFFF', decor: 'none', dark: false },
  wine: { bg: 'linear-gradient(165deg,#951A41 0%,#6E1233 55%,#4A0B24 100%)', ink: '#FFFFFF', acc: '#FF9C6E', pill: '#FFB08A', pillInk: '#3A0C1E', decor: 'circle', dark: true },
  ocean: { bg: 'linear-gradient(165deg,#1E6FE0 0%,#1450B4 55%,#0C347A 100%)', ink: '#FFFFFF', acc: '#C8F53A', pill: '#C8F53A', pillInk: '#10210A', decor: 'none', dark: true },
  mint: { bg: 'linear-gradient(170deg,#6FE3BE 0%,#B5F2DC 50%,#EBFFF7 100%)', ink: '#0B2A24', acc: '#E5502E', pill: '#0B2A24', pillInk: '#FFFFFF', decor: 'none', dark: false },
  lime: { bg: 'linear-gradient(170deg,#D4F23A 0%,#E8FA8E 50%,#F7FFD9 100%)', ink: '#1A1F05', acc: '#E5502E', pill: '#1A1F05', pillInk: '#FFFFFF', decor: 'none', dark: false },
  emerald: { bg: 'linear-gradient(165deg,#13684A 0%,#0C4A33 55%,#072E1F 100%)', ink: '#FFFFFF', acc: '#FF8A5B', pill: '#FFA37D', pillInk: '#2A0F05', decor: 'confetti', dark: true },
  cyan: { bg: 'linear-gradient(170deg,#45D3E2 0%,#9BE9F1 45%,#EAFBFD 100%)', ink: '#082B33', acc: '#C9461C', pill: '#082B33', pillInk: '#FFFFFF', decor: 'circle', dark: false },
  plum: { bg: 'linear-gradient(165deg,#7A1F7E 0%,#561461 55%,#330B3E 100%)', ink: '#FFFFFF', acc: '#FF7DB8', pill: '#FFB3D4', pillInk: '#330B3E', decor: 'none', dark: true },
  royal: { bg: 'linear-gradient(165deg,#2747E0 0%,#1A34B4 55%,#122480 100%)', ink: '#FFFFFF', acc: '#FFC93A', pill: '#FFC93A', pillInk: '#1B1530', decor: 'circle', dark: true },
  // Solid grounds: one flat colour, the accent words in the brand's button colour.
  navy: { bg: '#1E2333', ink: '#FFFFFF', acc: 'var(--cta)', pill: '#FFFFFF', pillInk: '#15151A', decor: 'none', dark: true, solid: true },
  espresso: { bg: '#2A1F1A', ink: '#FFFFFF', acc: 'var(--cta)', pill: '#F4EBDD', pillInk: '#2A1F1A', decor: 'none', dark: true, solid: true },
  aubergine: { bg: '#3A2238', ink: '#FFFFFF', acc: 'var(--cta)', pill: '#FFFFFF', pillInk: '#15151A', decor: 'none', dark: true, solid: true },
  forest: { bg: '#1F4A3A', ink: '#FFFFFF', acc: 'var(--cta)', pill: '#FFFFFF', pillInk: '#15151A', decor: 'none', dark: true, solid: true },
  midnight: { bg: '#2B2457', ink: '#FFFFFF', acc: 'var(--cta)', pill: '#FFFFFF', pillInk: '#15151A', decor: 'none', dark: true, solid: true },
  harbor: { bg: '#163655', ink: '#FFFFFF', acc: 'var(--cta)', pill: '#FFFFFF', pillInk: '#15151A', decor: 'none', dark: true, solid: true },
  cream: { bg: '#FBF3E6', ink: '#15151A', acc: 'var(--cta)', pill: '#15151A', pillInk: '#FFFFFF', decor: 'none', dark: false, solid: true },
  frost: { bg: '#EAF4F1', ink: '#15151A', acc: 'var(--cta)', pill: '#15151A', pillInk: '#FFFFFF', decor: 'none', dark: false, solid: true },
};
export const THEME_NAMES = Object.keys(THEMES);

const SIZES = {
  '4:5': { w: 1080, h: 1350, pt: 52, pb: 40, panelH: 470 },
  '9:16': { w: 1080, h: 1920, pt: 250, pb: 330, panelH: 540 },
  '1:1': { w: 1080, h: 1080, pt: 44, pb: 32, panelH: 330 },
};

const WEAK_END = /^(the|a|an|to|of|and|or|for|your|my|our|in|on|at|with|by|is|are|who|that|still|not)$/i;

/**
 * Breaks a headline into balanced lines: as few as fit maxChars per line (2 to maxLines), keeping
 * the accent phrase on the last line when it can. Good breaks from Claude are kept as they are.
 */
export function threeLines(lines, accents = [], { maxChars = 18, maxLines = 3, minLines = 2 } = {}) {
  const given = (Array.isArray(lines) ? lines : [lines]).map((l) => String(l || '').trim()).filter(Boolean);
  const words = given.join(' ').split(/\s+/).filter(Boolean);
  if (words.length <= 2) return [words.join(' ')];
  if (given.length >= minLines && given.length <= maxLines && given.every((l) => l.length <= maxChars) && !given.some((l) => !/\s/.test(l) && l.length < 7)) return given;
  const acc = (accents || []).map((a) => String(a).toLowerCase().replace(/[^a-z0-9' ]/g, '').trim()).filter(Boolean);
  let best = null;
  const walk = (start, left, acc0) => {
    if (left === 1) {
      const parts = [...acc0, words.slice(start)];
      const ls = parts.map((p) => p.join(' ').length);
      let score = Math.max(...ls) * 3 + (Math.max(...ls) - Math.min(...ls)) + parts.length * 6 + Math.max(0, Math.max(...ls) - maxChars) * 20;
      parts.forEach((p, i) => { if (i < parts.length - 1 && WEAK_END.test(p[p.length - 1])) score += 12; if (p.length === 1 && ls[i] < 8) score += 10; });
      const last = parts[parts.length - 1].join(' ').toLowerCase().replace(/[^a-z0-9' ]/g, '');
      if (acc.length && !acc.some((x) => last.includes(x) || x.includes(last))) score += 8;
      if (!best || score < best.score) best = { score, parts };
      return;
    }
    for (let e = start + 1; e <= words.length - left + 1; e++) walk(e, left - 1, [...acc0, words.slice(start, e)]);
  };
  for (let n = Math.min(minLines, words.length); n <= Math.min(maxLines, words.length); n++) walk(0, n, []);
  return best.parts.map((p) => p.join(' '));
}

const CHECK = (fill = 'var(--cta)', tick = '#FFFFFF') => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="${fill}"/><path d="M7 12.4l3.2 3.2L17 8.8" fill="none" stroke="${tick}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CROSS = (stroke = '#9AA0AE') => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="${stroke}" stroke-width="2.6" stroke-linecap="round"/></svg>`;
const ARROW = '<svg class="arr" viewBox="0 0 32 20" aria-hidden="true"><path d="M2 10h26M20 3l8 7-8 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SHIELD = '<svg class="shield" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.4l8.2 3v6.2c0 5.1-3.5 8.8-8.2 10.1-4.7-1.3-8.2-5-8.2-10.1V5.4z" fill="none" stroke="var(--cta)" stroke-width="2"/><path d="M8.3 12.2l2.6 2.6 4.9-5.1" fill="none" stroke="var(--cta)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const GIFT = '<svg class="gift" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h18v4H3zM5 13h14v8H5zM12 9v12M12 9c-1.5-3.5-5.5-4-5.5-1.5S10 9 12 9zm0 0c1.5-3.5 5.5-4 5.5-1.5S14 9 12 9z" fill="currentColor"/></svg>';
const BOLT = '<svg class="bolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2L5 13.5h6L9.5 22 19 9.5h-6.2z" fill="var(--cta)"/></svg>';
const ICONS = [
  '<path d="M13.5 2L5 13.5h6L9.5 22 19 9.5h-6.2z" fill="var(--cta)"/>',
  '<circle cx="12" cy="12" r="9" fill="var(--cta)"/><path d="M7.6 12.3l3 3 5.8-6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  '<path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" fill="var(--cta)"/>',
];

const rowsOf = (p, max, n = 60) => (p.rows || []).map((r) => ({ a: clip(r?.a, n), b: clip(r?.b, n) })).filter((r) => r.a || r.b).slice(0, max);

/** One diagram panel as HTML. Every type has fixed sizes so it always fits its slot. */
function panelHtml(p, t) {
  const type = PANEL_TYPES[p.type] ? p.type : 'checklist';
  const rows = rowsOf(p, 6);
  const heading = clip(p.heading, 48);
  const L = clip(p.left_label, 28), R = clip(p.right_label, 28);
  switch (type) {
    case 'timeline': {
      const rs = rows.slice(0, 3);
      return `<div class="pn tl">${rs.map((r, i) => `<div class="tl-row${i === rs.length - 1 ? ' bad' : ''}"><span class="tl-k">${esc(clip(r.a, 16))}</span><span class="tl-v">${esc(clip(r.b, 30))}</span></div>`).join('')}${p.footnote ? `<div class="tl-foot">${esc(clip(p.footnote, 30))}</div>` : ''}</div>`;
    }
    case 'checklist':
      return `<div class="pn card ck">${heading ? `<div class="ck-h">${esc(heading)}</div>` : ''}${rows.slice(0, 5).map((r) => `<div class="ck-row">${CHECK()}<span>${esc(clip(r.a || r.b, 40))}</span></div>`).join('')}</div>`;
    case 'steps':
      return `<div class="pn st">${heading ? `<div class="st-h">${esc(heading)}</div>` : ''}${rows.slice(0, 4).map((r, i) => `<div class="st-row"><span class="num">${i + 1}</span><span class="st-t"><strong>${esc(clip(r.a, 34))}</strong>${r.b ? `<small>${esc(clip(r.b, 46))}</small>` : ''}</span></div>`).join('')}</div>`;
    case 'compare_table':
      return `<div class="pn card ct"><div class="ct-head"><span>${esc(L || 'Today')}</span><span class="acc">${esc(R || 'What we do')}</span></div>${rows.slice(0, 4).map((r) => `<div class="ct-row"><span class="ct-a">${esc(clip(r.a, 40))}</span><span class="ct-b">${CHECK()}<strong>${esc(clip(r.b, 34))}</strong></span></div>`).join('')}</div>`;
    case 'compare_cards':
      return `<div class="pn cc"><div class="cc-card cc-l"><div class="cc-h">${esc(L || 'Today')}</div>${rows.filter((r) => r.a).slice(0, 4).map((r) => `<div class="cc-row">${CROSS('#9AA0AE')}<span>${esc(clip(r.a, 36))}</span></div>`).join('')}</div><div class="cc-card cc-r"><div class="cc-h">${esc(R || 'With us')}</div>${rows.filter((r) => r.b).slice(0, 4).map((r) => `<div class="cc-row">${CHECK('#FFFFFF', 'var(--cta)')}<span>${esc(clip(r.b, 36))}</span></div>`).join('')}</div></div>`;
    case 'flow': {
      const ins = rows.filter((r) => r.a).slice(0, 3);
      const ys = ins.length === 2 ? [120, 260] : ins.length === 1 ? [190] : [80, 190, 300];
      const lines = ys.map((y) => `<path d="M318 ${y} L452 190" />`).join('');
      return `<div class="pn fl"><svg class="fl-lines" viewBox="0 0 936 380" aria-hidden="true">${lines}<path d="M618 190 L668 190" /><path d="M656 178 L670 190 L656 202" /></svg>${ins.map((r, i) => `<div class="fl-in" style="top:${ys[i] - 34}px">${esc(clip(r.a, 22))}</div>`).join('')}<div class="fl-hub"><span>${esc(clip(p.center || 'Built for you', 26))}</span></div><div class="fl-out">${CHECK()}<strong>${esc(clip(p.result || 'Done', 30))}</strong>${p.result_detail ? `<small>${esc(clip(p.result_detail, 52))}</small>` : ''}</div></div>`;
    }
    case 'calendar': {
      const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
      const messy = 'cx.xc,.x..c,x..xc'.replace(/,/g, '').split('');
      const head = `<div class="cal-days">${days.map((d) => `<span>${d}</span>`).join('')}</div>`;
      const cellL = messy.map((m) => `<span class="cal-c">${m === 'c' ? CHECK('var(--cta)') : m === 'x' ? CROSS('#E5484D') : ''}</span>`).join('');
      const cellR = messy.map(() => `<span class="cal-c on">${CHECK('#FFFFFF', 'var(--cta)')}</span>`).join('');
      return `<div class="pn cal"><div class="cal-card cal-l"><div class="cal-h">${esc(L || 'Today')}</div>${head}<div class="cal-grid">${cellL}</div><div class="cal-f">${esc(clip(p.result || 'Slots stay empty', 34))}</div></div><div class="cal-card cal-r"><div class="cal-h">${esc(R || 'With us')}</div>${head}<div class="cal-grid">${cellR}</div><div class="cal-f">${esc(clip(p.result_detail || 'Every slot booked', 40))}</div></div></div>`;
    }
    case 'path': {
      const nodes = rows.filter((r) => r.a).slice(0, 3).map((r) => clip(r.a, 14));
      while (nodes.length < 3) nodes.push(['Your ad', 'Landing page', 'Follow-up'][nodes.length]);
      const chain = (on) => `<div class="pa-chain${on ? ' on' : ''}"><span class="pa-n">${esc(nodes[0])}</span><span class="pa-l"></span>${on ? '' : BOLT}<span class="pa-n${on ? '' : ' ghost'}">${esc(nodes[1])}</span><span class="pa-l${on ? '' : ' ghost'}"></span><span class="pa-n${on ? '' : ' ghost'}">${esc(nodes[2])}</span></div>`;
      return `<div class="pn card pa"><div class="pa-h">${esc(L || 'Today')}</div>${chain(false)}<div class="pa-note bad">${CROSS('#E5484D')}${esc(clip(p.result || 'it breaks here', 40))}</div><div class="pa-sep"></div><div class="pa-h acc">${esc(R || 'After we build it')}</div>${chain(true)}<div class="pa-note">${CHECK()}${esc(clip(p.result_detail || 'connected end to end', 44))}</div></div>`;
    }
    case 'tiles':
      return `<div class="pn ti">${heading ? `<div class="ti-h">${esc(heading)}</div>` : ''}<div class="ti-grid">${rows.slice(0, 4).map((r, i) => `<div class="ti-c"><span class="num">${i + 1}</span><span>${esc(clip([r.a, r.b].filter(Boolean).join(': '), 40))}</span></div>`).join('')}</div></div>`;
    case 'columns':
      return `<div class="pn card co">${heading ? `<div class="co-h">${esc(heading)}</div>` : ''}<div class="co-grid">${rows.slice(0, 3).map((r, i) => `<div class="co-c"><span class="co-i"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[i % 3]}</svg></span><strong>${esc(clip(r.a, 22))}</strong><small>${esc(clip(r.b, 40))}</small></div>`).join('')}</div></div>`;
    case 'clock': {
      const m = String(p.center || '9:00').match(/(\d{1,2})(?::(\d{2}))?/);
      const hh = m ? (+m[1] % 12) : 9, mm = m && m[2] ? +m[2] : 0;
      const ha = (hh + mm / 60) * 30, ma = mm * 6;
      const ticks = Array.from({ length: 12 }, (_, i) => `<line x1="100" y1="16" x2="100" y2="${i % 3 ? 26 : 32}" transform="rotate(${i * 30} 100 100)"/>`).join('');
      return `<div class="pn ck2"><div class="ck2-h">${esc(heading || 'Tonight, 9:00 pm')}</div><div class="ck2-body"><svg class="ck2-clock" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="92" fill="#FBF7F2" stroke="#1B1530" stroke-width="7"/><g stroke="#1B1530" stroke-width="4" stroke-linecap="round">${ticks}</g><line x1="100" y1="100" x2="100" y2="52" stroke="#1B1530" stroke-width="9" stroke-linecap="round" transform="rotate(${ha} 100 100)"/><line x1="100" y1="100" x2="100" y2="30" stroke="#1B1530" stroke-width="6" stroke-linecap="round" transform="rotate(${ma} 100 100)"/><circle cx="100" cy="100" r="8" fill="var(--cta)"/></svg><div class="ck2-b">${rows.slice(0, 3).map((r) => `<span>${esc(clip(r.a || r.b, 26))}</span>`).join('')}</div></div>${p.footnote ? `<div class="ck2-f">${esc(clip(p.footnote, 56))}</div>` : ''}</div>`;
    }
    case 'seesaw': {
      const items = rows.filter((r) => r.a).slice(0, 3);
      return `<div class="pn card ss"><div class="ss-labels"><span class="acc">${esc(L || 'The heavy side')}</span><span>${esc(R || 'The light side')}</span></div><svg class="ss-svg" viewBox="0 0 936 130" aria-hidden="true"><line x1="130" y1="96" x2="806" y2="26" stroke="#1B2A4A" stroke-width="8" stroke-linecap="round"/><polygon points="468,62 440,128 496,128" fill="#1B2A4A"/><circle cx="130" cy="96" r="9" fill="#E5484D"/><circle cx="806" cy="26" r="9" fill="#E5484D"/></svg><div class="ss-boxes"><div class="ss-left">${items.map((r) => `<span>${esc(clip(r.a, 26))}</span>`).join('')}</div><div class="ss-right"><span>${esc(clip(p.center || 'One small thing', 26))}</span></div></div>${p.footnote ? `<div class="ss-f">${esc(clip(p.footnote, 56))}</div>` : ''}</div>`;
    }
    case 'funnel': {
      const stages = rows.filter((r) => r.a).slice(0, 3).map((r) => clip(r.a, 12));
      while (stages.length < 3) stages.push(['Sent', 'Followed up', 'Booked'][stages.length]);
      const leak = '<circle cx="70" cy="40" r="7"/><circle cx="110" cy="62" r="6"/><circle cx="150" cy="34" r="7"/><circle cx="96" cy="96" r="6"/><circle cx="190" cy="70" r="6"/><circle cx="40" cy="120" r="5"/><circle cx="250" cy="110" r="6"/>';
      return `<div class="pn fu"><div class="fu-card fu-l"><div class="fu-h">${esc(L || 'Today')}</div><svg class="fu-svg" viewBox="0 0 300 170" aria-hidden="true"><path d="M60 20h180l-60 80v60h-60v-60z" fill="#EEF0F4" stroke="#C9CED8" stroke-width="4"/><g fill="#C7432A">${leak}</g></svg><div class="fu-f">${esc(clip(p.result || 'People slip through', 40))}</div></div><div class="fu-card fu-r"><div class="fu-h">${esc(R || 'With us')}</div><svg class="fu-svg" viewBox="0 0 300 170" aria-hidden="true"><path d="M70 20h160l-50 70v70h-60v-70z" fill="rgba(255,255,255,.95)"/><g fill="var(--cta)"><circle cx="120" cy="45" r="7"/><circle cx="150" cy="60" r="7"/><circle cx="180" cy="45" r="7"/><circle cx="150" cy="110" r="7"/><circle cx="150" cy="140" r="7"/></g></svg><div class="fu-stages">${stages.map((s) => `<span>${esc(s)}</span>`).join('')}</div><div class="fu-f">${esc(clip(p.result_detail || 'Runs until they reply', 40))}</div></div></div>`;
    }
    case 'device':
      return `<div class="pn dvwrap">${deviceHtml(p)}</div>`;
    default:
      return '';
  }
}

const GOOD_S = /^✓|\b(covered|assigned|done|ready|booked|built|live|sent|signed|paid|connected|delivered|mapped|deployed|active|approved|handled|yes)\b|✓/i;
const BAD_S = /\b(missing|not yet|no [a-z]+|blocked|discarded|overdue|late|stuck|lost|none|waiting)\b|^x\s/i;
const PILL_S = /^(new|open|live|today|now|next)$/i;

function screenHtml(p) {
  const rows = rowsOf(p, 6, 46);
  const title = clip(p.heading, 28);
  const toggle = '<i class="tg"></i>';
  switch (SCREENS[p.screen] ? p.screen : 'list') {
    case 'calendar': {
      const day = Math.min(31, Math.max(1, parseInt(String(p.center).replace(/\D/g, ''), 10) || 26));
      const head = '<div class="cl-w">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x) => `<span>${x}</span>`).join('') + '</div>';
      const cells = Array.from({ length: 30 }, (_, i) => i + 1).map((n) => `<span class="${n === day ? 'on' : ''}${n < day && n >= day - 3 ? ' rg' : ''}">${n}</span>`).join('');
      const [r1, r2] = rows;
      return `<div class="sc-cal"><div class="sc-title">${esc(title || 'November 2026')}</div>${head}<div class="cl-g">${cells}</div><div class="cl-sep"></div>${p.result ? `<div class="cl-day">${esc(clip(p.result, 22))}</div>` : ''}${r1 ? `<div class="cl-ev">${esc(clip(r1.a, 24))}</div>` : ''}${r2 ? `<div class="cl-btn">${esc(clip(r2.a, 24))}</div>` : ''}</div>`;
    }
    case 'notifications':
      return `<div class="sc-lock"><div class="lk-d">${esc(clip(p.heading || 'Monday, November 23', 26))}</div><div class="lk-t">${esc(clip(p.center || '9:41', 6))}</div>${rows.slice(0, 3).map((r) => `<div class="lk-n"><i class="lk-i"></i><span><b>${esc(clip(r.a, 22))}</b>${r.b ? `<small>${esc(clip(r.b, 40))}</small>` : ''}</span></div>`).join('')}</div>`;
    case 'board': {
      const [r1] = rows;
      const sk = Array.from({ length: 5 }, () => '<div class="bd-sk"><i></i><span></span></div>').join('');
      return `<div class="sc-board"><div class="bd-col"><div class="bd-h">${esc(clip(p.left_label || 'New deals', 16))}</div>${r1 ? `<div class="bd-card"><b>${esc(clip(r1.a, 20))}</b>${r1.b ? `<span><i></i>${esc(clip(r1.b, 22))}</span>` : ''}</div>` : ''}</div><svg class="bd-arr" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h12M10 5l5 5-5 5" fill="none" stroke="var(--cta)" stroke-width="2.4" stroke-linecap="round"/></svg><div class="bd-col q"><div class="bd-h">${esc(clip(p.right_label || 'Build queue', 16))}</div>${sk}</div></div>`;
    }
    case 'roster': {
      const side = p.right_label ? `<div class="rs-side"><div class="rs-sh">${esc(clip(p.right_label, 22))}</div>${p.center ? `<div class="rs-x">${esc(clip(p.center, 22))}</div>` : ''}<i></i><i></i><i></i>${p.result ? `<div class="rs-d">${CROSS('#5D6170')}${esc(clip(p.result, 16))}</div>` : ''}</div>` : '';
      const ppl = rows.slice(0, 5).map((r) => {
        const off = BAD_S.test(r.b) || /^x\s/i.test(r.b);
        return `<div class="rs-row${off ? ' off' : ''}"><i class="av"></i><span><b>${esc(clip(r.a, 20))}</b>${r.b ? `<small>${off ? '' : '✓ '}${esc(clip(r.b.replace(/^x\s/i, ''), 22))}</small>` : ''}</span></div>`;
      }).join('');
      return `<div class="sc-ros"><div class="sc-title">${esc(title || 'Your team')}${toggle}</div><div class="rs-body"><div class="rs-list">${ppl}</div>${side}</div></div>`;
    }
    default: {
      const items = rows.slice(0, 5).map((r) => {
        const strike = r.a.startsWith('~');
        const a = r.a.replace(/^~\s*/, '');
        if (BAD_S.test(r.b) && !strike && !/^✓/.test(r.b)) return `<div class="ls-row miss"><i class="dot"></i><b>${esc(clip(a, 20))}</b><span class="ls-m">${esc(clip(r.b, 22))}</span></div>`;
        const pill = !r.b ? '' : GOOD_S.test(r.b) ? `<span class="pl ok">✓ ${esc(clip(r.b.replace(/^✓\s*/, ''), 18))}</span>` : PILL_S.test(r.b) ? `<span class="pl new">${esc(clip(r.b, 10))}</span>` : `<span class="pl">${esc(clip(r.b, 18))}</span>`;
        return `<div class="ls-row${strike ? ' strike' : ''}"><i class="sq"></i><b>${esc(clip(a, 22))}</b>${pill}</div>`;
      }).join('');
      return `<div class="sc-list"><div class="sc-title">${esc(title || 'Today')}${toggle}</div>${items}</div>`;
    }
  }
}

/** A device frame around one simple app screen. */
function deviceHtml(p) {
  const dev = DEVICES.includes(p.device) ? p.device : 'phone';
  const scr = screenHtml(p);
  const lock = p.screen === 'notifications';
  if (dev === 'laptop') return `<div class="dv laptop"><div class="lid"><div class="scr">${scr}</div></div><div class="base"></div></div>`;
  const bar = dev === 'phone' ? `<div class="sbar${lock ? ' lt' : ''}"><span>9:41</span><i class="isl"></i><span class="sig">●●●</span></div>` : '';
  return `<div class="dv ${dev}${lock ? ' lock' : ''}"><div class="scr">${bar}${scr}</div></div>`;
}

function decorHtml(kind) {
  if (kind === 'circle') return '<div class="dc dc-circle"></div><div class="dc dc-circle2"></div>';
  if (kind === 'rings') return '<div class="dc dc-rings"></div>';
  if (kind === 'dots') return '<div class="dc dc-dots"></div><div class="dc dc-glow"></div>';
  if (kind === 'frame') return '<div class="dc dc-frame"></div>';
  if (kind === 'confetti') return '<div class="dc dc-conf"></div>';
  return '';
}

/** The headline lines with the accent words coloured; with no accent words found, the last line is the accent. */
function headlineHtml(lines, accents) {
  const norm = (w) => w.toLowerCase().replace(/[^a-z0-9$%']/g, '');
  const words = lines.map((l) => l.split(/\s+/));
  const flat = words.flat().map(norm);
  const on = new Set();
  (accents || []).map((a) => String(a).split(/\s+/).map(norm).filter(Boolean)).filter((a) => a.length).forEach((a) => {
    for (let i = 0; i + a.length <= flat.length; i++) if (a.every((w, k) => flat[i + k] === w)) for (let k = 0; k < a.length; k++) on.add(i + k);
  });
  if (!on.size && lines.length > 1) words[words.length - 1].forEach((_, k) => on.add(flat.length - words[words.length - 1].length + k));
  let n = 0;
  return words.map((ws) => `<span class="hl">${ws.map((w) => { const x = on.has(n++); return x ? `<span class="acc">${esc(w)}</span>` : esc(w); }).join(' ').replace(/<\/span> <span class="acc">/g, ' ')}</span>`).join('');
}

/**
 * Builds the card. d: { headline_lines, accent_words, subhead, theme, panel }.
 * furniture: { cta, cta_note, proof_line, bonus_pill, website, email }.
 */
export function buildPanelCard({ d, brand, furniture, format = '4:5' }) {
  const S = SIZES[format] || SIZES['4:5'];
  const t = THEMES[d.theme] || THEMES.indigo;
  const cta = isHex(brand?.colors?.accent) ? brand.colors.accent : '#F2662F';
  const panel = d.panel || {};
  const dev = panel.type === 'device' ? (DEVICES.includes(panel.device) ? panel.device : 'phone') : '';
  // Phones and tablets can sit beside the text; laptops and the other diagrams sit under it.
  const layout = dev && dev !== 'laptop' && ['split_right', 'split_left'].includes(panel.layout) ? panel.layout : 'stack';
  const split = layout !== 'stack';
  const condensed = panel.font === 'condensed';
  const lines = threeLines(d.headline_lines?.length ? d.headline_lines : [d.hook || 'Your headline'], d.accent_words, split ? { maxChars: condensed ? 17 : 13, maxLines: 4 } : dev ? { maxChars: condensed ? 26 : 18, maxLines: 3 } : { maxChars: condensed ? 24 : 18, maxLines: 3, minLines: 3 });
  const longest = Math.max(...lines.map((l) => l.length), 10);
  const visW = dev === 'tablet' ? 420 : 360;
  const W = split ? S.w - 120 - 44 - visW : S.w - 120;
  const factor = condensed ? 0.46 : 0.64;
  const hMax = split ? (condensed ? 108 : 86) : format === '9:16' ? (condensed ? 132 : 116) : (condensed ? 120 : 108);
  const hSize = Math.round(Math.max(54, Math.min(hMax, W / (longest * factor))));
  const pill = String(furniture.bonus_pill || '').trim();
  const pillHtml = pill ? `<span class="offer">${GIFT}<span>${esc(pill.toUpperCase()).replace(/(\$\d[\d,.]*)/g, '<b>$1</b>')}</span></span>` : '';
  const sub = String(d.subhead || '').trim();
  const head = `<h1 class="hd">${headlineHtml(lines, d.accent_words)}</h1>`;
  const subHtml = sub ? `<p class="sub">${esc(clip(sub, 120))}</p>` : '';
  const ctaHtml = `<div class="cta-wrap"><span class="cta">${esc(String(furniture.cta || 'Learn more').toUpperCase())}${ARROW}</span>${furniture.cta_note ? `<span class="note">${esc(furniture.cta_note)}</span>` : ''}</div>`;
  const foot = `<div class="foot"><div class="foot-l"><img class="logo-s" src="{{LOGO}}"><span><b>${esc(furniture.website || '')}</b>${furniture.email ? `<i>${esc(furniture.email)}</i>` : ''}</span></div>${furniture.proof_line ? `<div class="foot-r">${SHIELD}<span>${esc(furniture.proof_line)}</span></div>` : ''}</div>`;
  const body = split
    ? `<div class="sp${layout === 'split_left' ? ' rev' : ''}"><div class="sp-text">${head}${subHtml}${ctaHtml}</div><div class="sp-vis">${panelHtml(panel)}</div></div>`
    : `${head}${subHtml}<div class="slot">${panelHtml(panel)}</div>${ctaHtml}`;
  const html = [
    decorHtml(t.decor),
    `<div class="pc ${split ? 'split' : 'stack'}${condensed ? ' cond' : ''}"><div class="pc-top"><img class="logo" src="{{LOGO}}">${pillHtml}</div>`,
    body,
    `${foot}</div>`,
  ].join('');

  const soft = t.dark ? 'rgba(255,255,255,.86)' : 'rgba(20,20,40,.78)';
  const faint = t.dark ? 'rgba(255,255,255,.72)' : 'rgba(20,20,40,.62)';
  const css = `
.canvas{--cta:${cta};--acc:${t.acc};--ink:${t.ink};background:${t.bg};color:${t.ink};font-family:var(--font-body)}
.canvas .dc{position:absolute;pointer-events:none;z-index:0}
.canvas .dc-circle{width:760px;height:760px;border-radius:50%;right:-300px;top:-260px;background:rgba(255,255,255,${t.dark ? '.07' : '.35'})}
.canvas .dc-circle2{width:520px;height:520px;border-radius:50%;left:-260px;bottom:-200px;background:rgba(255,255,255,${t.dark ? '.05' : '.28'})}
.canvas .dc-rings{width:1100px;height:1100px;border-radius:50%;right:-520px;top:280px;border:2px solid rgba(80,40,160,.12);box-shadow:0 0 0 120px rgba(255,255,255,.12),0 0 0 240px rgba(255,255,255,.08)}
.canvas .dc-dots{inset:0;background-image:radial-gradient(rgba(255,255,255,.16) 1.6px,transparent 1.8px);background-size:34px 34px}
.canvas .dc-glow{width:900px;height:700px;left:-200px;top:300px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,110,70,.28),transparent)}
.canvas .dc-frame{inset:18px;border:2px solid rgba(255,255,255,.14);border-radius:28px}
.canvas .dc-conf{inset:0;background-image:radial-gradient(${t.acc} 5px,transparent 6px),radial-gradient(rgba(255,255,255,.35) 3px,transparent 4px);background-size:190px 230px,140px 160px;background-position:30px 600px,90px 520px;opacity:.55}
.canvas .pc{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;align-items:center;padding:${S.pt}px 60px ${S.pb}px}
.canvas .pc-top{width:100%;display:flex;align-items:center;justify-content:space-between;gap:20px;height:64px;flex:none}
.canvas .logo{height:58px;width:auto;max-width:260px;object-fit:contain;object-position:left center}
.canvas .offer{display:inline-flex;align-items:center;gap:10px;padding:13px 22px;border-radius:999px;background:${t.pill};color:${t.pillInk};font:700 19px/1 var(--font-body);letter-spacing:.01em;white-space:nowrap;max-width:720px;overflow:hidden}
.canvas .offer b{color:${t.pillAcc || (t.pillInk === '#FFFFFF' ? '#FF8A5B' : '#C2371B')};font-weight:800}
.canvas .offer .gift{width:20px;height:20px;flex:none}
.canvas .hd{margin:${format === '9:16' ? 40 : 22}px 0 0;text-align:center;font:900 ${hSize}px/1.02 var(--font-heading);letter-spacing:-0.02em;color:${t.ink};flex:none}
.canvas .hd .hl{display:block;white-space:nowrap}
.canvas .hd .acc{color:${t.acc}}
.canvas .sub{margin:16px 0 0;max-width:940px;text-align:center;font:500 25px/1.32 var(--font-body);color:${soft};flex:none}
.canvas .slot{flex:1 1 auto;min-height:0;width:100%;display:flex;align-items:center;justify-content:center;margin:24px 0 18px}
.canvas .pn{width:100%;max-height:${S.panelH}px;position:relative;color:#1B1530}
.canvas .card{background:#FFFFFF;border-radius:28px;box-shadow:0 24px 60px rgba(10,10,40,.22);padding:30px 36px}
.canvas .ic{width:30px;height:30px;flex:none}
.canvas .num{flex:none;width:44px;height:44px;border-radius:50%;background:var(--cta);color:#fff;font:800 22px/44px var(--font-heading);text-align:center}
.canvas .acc{color:var(--cta)}
.canvas .tl{display:flex;flex-direction:column;gap:16px}
.canvas .tl-row{display:flex;align-items:center;gap:28px;background:#fff;border-radius:18px;padding:24px 30px;box-shadow:0 14px 30px rgba(10,10,40,.16)}
.canvas .tl-k{flex:none;width:200px;font:600 24px/1 var(--font-body);color:#5D6170;letter-spacing:.04em;text-transform:uppercase}
.canvas .tl-v{font:800 34px/1.1 var(--font-heading);color:#1B1530}
.canvas .tl-row.bad{box-shadow:0 0 0 4px #E5484D inset,0 14px 30px rgba(10,10,40,.16)}
.canvas .tl-row.bad .tl-k{color:#E5484D}
.canvas .tl-row.bad .tl-v{text-decoration:line-through;text-decoration-color:#E5484D;text-decoration-thickness:4px}
.canvas .tl-foot{margin-top:10px;font:800 36px/1.1 var(--font-heading);color:var(--acc)}
.canvas .ck{display:flex;flex-direction:column;gap:20px;padding:36px 44px}
.canvas .ck-h{text-align:center;font:800 36px/1.15 var(--font-heading);margin-bottom:4px}
.canvas .ck-row{display:flex;align-items:center;gap:18px;font:600 29px/1.2 var(--font-body)}
.canvas .st{display:flex;flex-direction:column;gap:20px;color:${t.ink}}
.canvas .st-h{font:800 38px/1.15 var(--font-heading);color:${t.ink};margin-bottom:6px}
.canvas .st-row{display:flex;gap:20px;align-items:flex-start}
.canvas .st-t{display:flex;flex-direction:column;gap:4px}
.canvas .st-t strong{font:700 30px/1.15 var(--font-body);color:${t.ink}}
.canvas .st-t small{font:500 23px/1.25 var(--font-body);color:${faint}}
.canvas .ct-head{display:grid;grid-template-columns:1fr 1fr;gap:30px;font:600 20px/1 var(--font-body);letter-spacing:.06em;text-transform:uppercase;color:#5D6170;padding-bottom:16px;border-bottom:2px solid #ECEDF2}
.canvas .ct-row{display:grid;grid-template-columns:1fr 1fr;gap:30px;padding:20px 0;border-bottom:2px solid #F1F2F5;align-items:center}
.canvas .ct-row:last-child{border-bottom:0;padding-bottom:4px}
.canvas .ct-a{font:500 25px/1.3 var(--font-body);color:#4A4E5C}
.canvas .ct-b{display:flex;gap:14px;align-items:center;font:700 25px/1.25 var(--font-body)}
.canvas .ct-b .ic{width:28px;height:28px}
.canvas .cc{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.canvas .cc-card{border-radius:26px;padding:30px 30px;display:flex;flex-direction:column;gap:20px;box-shadow:0 20px 50px rgba(10,10,40,.25)}
.canvas .cc-l{background:#1E2130;color:#FFFFFF}
.canvas .cc-r{background:var(--cta);color:#FFFFFF}
.canvas .cc-h{font:700 21px/1 var(--font-body);letter-spacing:.06em;text-transform:uppercase;opacity:.85}
.canvas .cc-row{display:flex;gap:14px;align-items:flex-start;font:600 26px/1.25 var(--font-body)}
.canvas .cc-row .ic{width:28px;height:28px;margin-top:1px}
.canvas .fl{height:380px}
.canvas .fl-lines{position:absolute;inset:0;width:100%;height:100%}
.canvas .fl-lines path{fill:none;stroke:var(--cta);stroke-width:5;stroke-linecap:round;stroke-linejoin:round}
.canvas .fl-in{position:absolute;left:0;width:318px;height:68px;border-radius:16px;background:${t.dark ? 'rgba(8,12,24,.55)' : '#1E2130'};color:#fff;font:600 25px/68px var(--font-body);text-align:center;white-space:nowrap;overflow:hidden;padding:0 14px}
.canvas .fl-hub{position:absolute;left:450px;top:107px;width:166px;height:166px;border-radius:50%;background:var(--cta);display:flex;align-items:center;justify-content:center;text-align:center;padding:18px;box-shadow:0 18px 40px rgba(0,0,0,.25)}
.canvas .fl-hub span{font:800 23px/1.15 var(--font-heading);color:#fff}
.canvas .fl-out{position:absolute;left:676px;top:40px;width:260px;height:300px;border-radius:22px;background:#fff;border:4px solid var(--cta);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:20px}
.canvas .fl-out .ic{width:40px;height:40px}
.canvas .fl-out strong{font:800 29px/1.15 var(--font-heading)}
.canvas .fl-out small{font:500 21px/1.3 var(--font-body);color:#4A4E5C}
.canvas .cal{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.canvas .cal-card{border-radius:24px;padding:24px 24px 22px;box-shadow:0 20px 50px rgba(10,10,40,.22)}
.canvas .cal-l{background:#fff}
.canvas .cal-r{background:var(--cta);color:#fff}
.canvas .cal-h{font:700 20px/1 var(--font-body);letter-spacing:.06em;text-transform:uppercase;color:#5D6170;margin-bottom:16px}
.canvas .cal-r .cal-h{color:#fff}
.canvas .cal-days{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;font:600 15px/1 var(--font-body);color:#5D6170;text-align:center;margin-bottom:10px}
.canvas .cal-r .cal-days{color:rgba(255,255,255,.9)}
.canvas .cal-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.canvas .cal-c{aspect-ratio:1;border-radius:10px;background:#F1F2F5;display:flex;align-items:center;justify-content:center}
.canvas .cal-c.on{background:rgba(255,255,255,.22)}
.canvas .cal-c .ic{width:30px;height:30px}
.canvas .cal-f{margin-top:16px;font:700 21px/1.25 var(--font-body)}
.canvas .pa{padding:28px 36px}
.canvas .pa-h{font:700 20px/1 var(--font-body);letter-spacing:.06em;text-transform:uppercase;color:#5D6170;margin-bottom:16px}
.canvas .pa-h.acc{color:var(--cta)}
.canvas .pa-chain{display:flex;align-items:center}
.canvas .pa-n{flex:none;width:200px;height:62px;border-radius:14px;background:#EDE8E2;color:#1B1530;font:600 23px/62px var(--font-body);text-align:center;white-space:nowrap;overflow:hidden;padding:0 8px}
.canvas .pa-n.ghost{background:transparent;border:2px dashed #CDD0D8;color:#B4B8C2;line-height:58px}
.canvas .pa-l{flex:1;height:5px;background:#D9DCE3}
.canvas .pa-l.ghost{background:repeating-linear-gradient(90deg,#D9DCE3 0 10px,transparent 10px 18px)}
.canvas .pa-chain .bolt{width:40px;height:40px;flex:none;margin:0 -6px}
.canvas .pa-chain.on .pa-n{background:var(--cta);color:#fff}
.canvas .pa-chain.on .pa-l{background:var(--cta)}
.canvas .pa-note{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:12px;font:600 21px/1 var(--font-body);color:#1B1530}
.canvas .pa-note.bad{color:#E5484D}
.canvas .pa-note .ic{width:24px;height:24px}
.canvas .pa-sep{height:2px;background:#ECEDF2;margin:22px 0}
.canvas .ti-h{font:800 40px/1.15 var(--font-heading);color:${t.ink};margin-bottom:22px}
.canvas .ti-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.canvas .ti-c{display:flex;gap:18px;align-items:center;background:#fff;border-radius:22px;padding:26px 24px;font:600 26px/1.25 var(--font-body);min-height:120px;box-shadow:0 16px 36px rgba(10,10,40,.18)}
.canvas .co-h{font:600 21px/1 var(--font-body);letter-spacing:.06em;text-transform:uppercase;color:#4A4E5C;margin-bottom:26px}
.canvas .co-grid{display:grid;grid-template-columns:1fr 1fr 1fr}
.canvas .co-c{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:0 16px;border-left:2px solid #ECEDF2}
.canvas .co-c:first-child{border-left:0}
.canvas .co-i{width:64px;height:64px;border-radius:16px;background:color-mix(in srgb,var(--cta) 14%,#fff);display:flex;align-items:center;justify-content:center;margin-bottom:6px}
.canvas .co-i svg{width:34px;height:34px}
.canvas .co-c strong{font:800 27px/1.15 var(--font-heading)}
.canvas .co-c small{font:500 22px/1.3 var(--font-body);color:#4A4E5C}
.canvas .ck2{background:#1E2130;border-radius:28px;padding:30px 36px;color:#fff;box-shadow:0 24px 60px rgba(10,10,40,.3)}
.canvas .ck2-h{font:600 21px/1 var(--font-body);letter-spacing:.06em;text-transform:uppercase;opacity:.85;margin-bottom:18px}
.canvas .ck2-body{display:flex;align-items:center;gap:40px}
.canvas .ck2-clock{width:220px;height:220px;flex:none}
.canvas .ck2-b{flex:1;display:flex;flex-direction:column;gap:16px}
.canvas .ck2-b span{display:block;background:${t.dark ? t.acc : 'var(--cta)'};color:${t.dark && !/^#F|^#C|^#B/i.test(t.acc) ? '#fff' : '#1B1530'};border-radius:14px;padding:16px 22px;font:700 25px/1.2 var(--font-body);text-align:center}
.canvas .ck2-f{margin-top:22px;font:700 25px/1.3 var(--font-body)}
.canvas .ss{padding:26px 36px 28px}
.canvas .ss-labels{display:flex;justify-content:space-between;font:600 20px/1 var(--font-body);letter-spacing:.06em;text-transform:uppercase;color:#5D6170}
.canvas .ss-svg{width:100%;height:auto;display:block;margin-top:6px}
.canvas .ss-boxes{display:flex;justify-content:space-between;align-items:flex-start;margin-top:-30px;padding:0 10px}
.canvas .ss-left{width:330px;display:flex;flex-direction:column;gap:10px;padding:14px;border:3px solid var(--cta);border-radius:16px;background:#FFF5F0;margin-top:40px}
.canvas .ss-left span{background:var(--cta);color:#fff;border-radius:10px;padding:11px 12px;font:700 20px/1.1 var(--font-body);text-align:center}
.canvas .ss-right{width:310px;padding:14px;border:3px solid #D9DCE3;border-radius:16px;background:#F5F6F8;margin-top:-34px}
.canvas .ss-right span{display:block;background:#A2A8B6;color:#fff;border-radius:10px;padding:11px 12px;font:700 20px/1.1 var(--font-body);text-align:center}
.canvas .ss-f{margin-top:22px;text-align:center;font:700 25px/1.3 var(--font-body)}
.canvas .fu{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.canvas .fu-card{border-radius:24px;padding:24px 26px;box-shadow:0 20px 50px rgba(10,10,40,.22);display:flex;flex-direction:column;gap:12px}
.canvas .fu-l{background:#fff}
.canvas .fu-r{background:var(--cta);color:#fff}
.canvas .fu-h{font:700 20px/1 var(--font-body);letter-spacing:.06em;text-transform:uppercase;color:#5D6170}
.canvas .fu-r .fu-h{color:#fff}
.canvas .fu-svg{width:100%;height:170px}
.canvas .fu-stages{display:flex;gap:8px}
.canvas .fu-stages span{flex:1;background:#fff;color:#1B1530;border-radius:10px;padding:10px 4px;font:700 17px/1.1 var(--font-body);text-align:center}
.canvas .fu-f{font:700 22px/1.25 var(--font-body)}
.canvas .cta-wrap{flex:none;display:flex;flex-direction:column;align-items:center;gap:14px}
.canvas .cta{display:inline-flex;align-items:center;gap:18px;background:var(--cta);color:#fff;border-radius:999px;padding:24px 46px;font:800 32px/1 var(--font-heading);letter-spacing:.02em;box-shadow:0 16px 34px rgba(0,0,0,.25)}
.canvas .cta .arr{width:34px;height:22px}
.canvas .note{font:500 19px/1.2 var(--font-body);color:${faint};text-align:center}
.canvas .foot{flex:none;width:100%;display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-top:26px}
.canvas .foot-l{display:flex;flex-direction:column;gap:6px}
.canvas .logo-s{height:44px;width:auto;max-width:180px;object-fit:contain;object-position:left center}
.canvas .foot-l span{display:flex;flex-direction:column;gap:2px}
.canvas .foot-l b{font:700 18px/1.2 var(--font-body);color:${t.ink}}
.canvas .foot-l i{font:500 16px/1.2 var(--font-body);font-style:normal;color:${faint}}
.canvas .foot-r{display:flex;align-items:center;gap:14px;font:500 27px/1.2 var(--font-body);color:${t.ink}}
.canvas .foot-r .shield{width:38px;height:38px;flex:none}
.canvas .cond .hd{font-family:"Barlow Condensed",var(--font-heading);font-weight:700;letter-spacing:-0.005em;line-height:.98}
.canvas .hd .acc{color:${t.acc}}
.canvas .split .sp{flex:1 1 auto;min-height:0;width:100%;display:flex;align-items:center;gap:44px;margin:24px 0 10px}
.canvas .split .sp.rev{flex-direction:row-reverse}
.canvas .split .sp-text{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:flex-start}
.canvas .split .hd{text-align:left;margin:0}
.canvas .split .sub{text-align:left;margin-top:22px;max-width:540px}
.canvas .split .cta-wrap{align-items:flex-start;margin-top:46px}
.canvas .split .note{text-align:left}
.canvas .split .cta{font-size:27px;padding:22px 34px;gap:14px;white-space:nowrap}
.canvas .cta{white-space:nowrap}
.canvas .split .sp-vis{flex:none;width:${visW}px}
.canvas .dvwrap{display:flex;justify-content:center;align-items:center;max-height:none}
.canvas .stack .dvwrap{height:${format === '9:16' ? 780 : format === '1:1' ? 380 : 520}px}
.canvas .dv{position:relative;color:#15151A;font-family:var(--font-body)}
.canvas .dv .scr{height:100%;background:#FFFFFF;overflow:hidden;padding:16px 22px 20px}
.canvas .dv.phone,.canvas .dv.tablet{border:11px solid #17171C;border-radius:58px;background:#17171C;box-shadow:${t.dark ? '0 0 0 3px rgba(255,255,255,.9),' : ''}0 30px 60px rgba(0,0,0,.28)}
.canvas .dv.phone{aspect-ratio:9/18.6}
.canvas .dv.tablet{aspect-ratio:3/4.1;border-radius:40px;border-width:13px}
.canvas .dv.phone .scr,.canvas .dv.tablet .scr{border-radius:46px}
.canvas .dv.tablet .scr{border-radius:28px;padding:22px 22px}
.canvas .stack .dv.phone,.canvas .stack .dv.tablet{height:100%}
.canvas .split .dv.phone,.canvas .split .dv.tablet{width:100%}
.canvas .dv.laptop{width:100%;max-width:${format === '9:16' ? 900 : 760}px;display:flex;flex-direction:column;align-items:center}
.canvas .dv.laptop .lid{width:88%;aspect-ratio:16/10.4;border:13px solid #17171C;border-bottom-width:18px;border-radius:24px 24px 6px 6px;background:#17171C;box-shadow:${t.dark ? '0 0 0 3px rgba(255,255,255,.9),' : ''}0 26px 50px rgba(0,0,0,.25)}
.canvas .dv.laptop .scr{border-radius:10px;padding:18px 24px}
.canvas .dv.laptop .base{width:100%;height:22px;border-radius:0 0 22px 22px;background:${t.dark ? '#D9DCE3' : '#2A2A30'}}
.canvas .sbar{display:flex;justify-content:space-between;align-items:center;font:700 20px/1 var(--font-body);padding:2px 6px 10px}
.canvas .sbar .isl{width:120px;height:32px;border-radius:18px;background:#17171C}
.canvas .sbar .sig{font-size:12px;letter-spacing:2px}
.canvas .sbar.lt{color:#fff}
.canvas .dv.lock .scr{background:linear-gradient(175deg,#3E2350,#6A3A63)}
.canvas .sc-title{display:flex;justify-content:space-between;align-items:center;gap:12px;font:800 29px/1.15 var(--font-heading);margin:8px 0 16px}
.canvas .tg{position:relative;flex:none;width:50px;height:26px;border-radius:13px;background:#2F4B7C}
.canvas .tg::after{content:"";position:absolute;right:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff}
.canvas .ls-row{display:flex;align-items:center;gap:12px;border:2px solid #E3E5EA;border-radius:12px;padding:13px 14px;margin-bottom:10px}
.canvas .ls-row b{flex:1;min-width:0;font:700 24px/1.15 var(--font-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.canvas .ls-row .sq{flex:none;width:18px;height:18px;border-radius:4px;background:#2F4B7C}
.canvas .pl{flex:none;font:600 18px/1 var(--font-body);padding:7px 12px;border-radius:999px;background:#EEF0F4;color:#4A4E5C;white-space:nowrap}
.canvas .pl.ok{background:transparent;color:#2459C8;font-weight:700;padding:0}
.canvas .pl.new{background:#fff;border:2px solid #2F4B7C;color:#2F4B7C}
.canvas .ls-row.miss{border:3px dashed var(--cta)}
.canvas .ls-row.miss .dot{flex:none;width:14px;height:14px;border-radius:50%;background:var(--cta)}
.canvas .ls-row.miss b{flex:none}
.canvas .ls-m{font:600 21px/1.15 var(--font-body);color:#15151A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.canvas .ls-m::before{content:"· "}
.canvas .ls-row.strike b{text-decoration:line-through;color:#8A8F9C;font-weight:500}
.canvas .cl-w,.canvas .cl-g{display:grid;grid-template-columns:repeat(7,1fr);text-align:center}
.canvas .cl-w{font:700 18px/1 var(--font-body);color:#5D6170;margin-bottom:6px}
.canvas .cl-g span{font:600 21px/42px var(--font-body);height:42px}
.canvas .cl-g .on{background:var(--cta);color:#fff;border-radius:50%;width:42px;justify-self:center}
.canvas .cl-g .rg{box-shadow:inset 0 -5px 0 #3B6AA8}
.canvas .cl-sep{height:2px;background:#E3E5EA;margin:14px 0 12px}
.canvas .cl-day{font:600 18px/1.2 var(--font-body);color:#5D6170}
.canvas .cl-ev{border-left:6px solid var(--cta);padding:6px 12px;font:800 23px/1.15 var(--font-body);margin:12px 0}
.canvas .cl-btn{background:#3B6AA8;color:#fff;border-radius:10px;padding:13px 14px;font:700 21px/1 var(--font-body)}
.canvas .sc-lock{color:#fff;text-align:center;padding-top:6px}
.canvas .lk-d{font:600 20px/1.2 var(--font-body)}
.canvas .lk-t{font:800 66px/1.05 var(--font-heading);margin:2px 0 18px}
.canvas .lk-n{display:flex;gap:12px;text-align:left;background:#fff;color:#15151A;border-radius:16px;padding:14px;margin-bottom:12px}
.canvas .lk-i{flex:none;width:30px;height:30px;border-radius:8px;background:var(--cta)}
.canvas .lk-n b{display:block;font:800 22px/1.15 var(--font-body)}
.canvas .lk-n small{display:block;font:500 18px/1.3 var(--font-body);color:#4A4E5C;margin-top:2px}
.canvas .sc-board{display:flex;gap:12px;align-items:flex-start;padding-top:6px}
.canvas .bd-col{flex:1;background:#F4F5F8;border-radius:10px;padding:12px}
.canvas .bd-h{font:700 20px/1.1 var(--font-body);margin-bottom:10px}
.canvas .bd-card{background:#fff;border:3px solid var(--cta);border-radius:10px;padding:10px 12px}
.canvas .bd-card b{display:block;font:800 21px/1.2 var(--font-body)}
.canvas .bd-card span{display:flex;align-items:center;gap:6px;font:600 18px/1.2 var(--font-body);margin-top:4px}
.canvas .bd-card span i{width:10px;height:10px;border-radius:50%;background:var(--cta)}
.canvas .bd-arr{flex:none;width:26px;margin-top:70px}
.canvas .bd-sk{display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #E3E5EA;border-radius:8px;padding:9px;margin-bottom:8px}
.canvas .bd-sk i{flex:none;width:10px;height:10px;border-radius:50%;background:#2F4B7C}
.canvas .bd-sk span{flex:1;height:8px;background:#D9DCE3;border-radius:4px}
.canvas .rs-body{display:flex;gap:16px}
.canvas .rs-list{flex:1;min-width:0}
.canvas .rs-row{display:flex;gap:12px;align-items:center;margin-bottom:14px}
.canvas .rs-row .av{flex:none;width:42px;height:42px;border-radius:50%;background:radial-gradient(circle at 50% 38%,#fff 0 8px,transparent 9px),radial-gradient(ellipse 15px 10px at 50% 92%,#fff 0 99%,transparent 100%),#2F4B7C}
.canvas .rs-row b{display:block;font:800 22px/1.15 var(--font-body)}
.canvas .rs-row small{display:block;font:600 18px/1.2 var(--font-body);color:var(--cta)}
.canvas .rs-row.off .av{background:transparent;border:3px solid #9AA0AE}
.canvas .rs-row.off small{color:#8A8F9C}
.canvas .rs-side{width:44%;border:2px dashed #B4B8C2;border-radius:12px;padding:12px}
.canvas .rs-sh{font:600 18px/1.2 var(--font-body);color:#5D6170}
.canvas .rs-x{text-decoration:line-through;font:700 20px/1.2 var(--font-body);color:#5D6170;margin:8px 0}
.canvas .rs-side>i{display:block;height:8px;background:#E3E5EA;border-radius:4px;margin:9px 0}
.canvas .rs-d{display:flex;gap:6px;align-items:center;font:600 17px/1 var(--font-body);color:#5D6170;margin-top:14px}
.canvas .rs-d .ic{width:18px;height:18px}
${format === '9:16' ? '.canvas .stack .slot .pn:not(.dvwrap){zoom:1.14;width:calc(100% / 1.14)}\n.canvas .sub{font-size:28px}' : ''}
`;
  return { html, css, lines };
}
