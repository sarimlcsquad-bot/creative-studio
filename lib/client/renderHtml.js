'use client';
// Renders a free-design creative (HTML + CSS written by Claude) into a <canvas>.
// The design is wrapped in an SVG <foreignObject> with fonts and images inlined
// as data URLs, drawn as an image, so the PNG matches what the browser lays out.
import { FORMATS } from './renderCard';
import { groundLum, logoPixels, needsPlate, plateColor } from './logoFix';

const DEFAULT_COLORS = { deep: '#0B0B0C', light: '#F7F7F2', accent: '#7C5CFF', primary: '#0B0B0C', secondary: '#F7F7F2' };

const dataCache = new Map();
function toDataUrl(url) {
  if (!url) return Promise.resolve('');
  if (!dataCache.has(url)) {
    dataCache.set(url, fetch(url, { mode: 'cors' })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => blob && new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(''); fr.readAsDataURL(blob); }))
      .catch(() => '') || '');
  }
  return dataCache.get(url);
}

const fontCssUrl = (fam) => `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam)}:wght@400;600;700;800;900&display=block`;

// Google Fonts CSS with the latin woff2 files inlined, so the SVG image can use them.
const fontCache = new Map();
function inlineFont(fam) {
  if (!fontCache.has(fam)) {
    fontCache.set(fam, (async () => {
      try {
        const css = await (await fetch(fontCssUrl(fam))).text();
        const blocks = css.split(/(?=\/\*)/).filter((b) => /\/\*\s*latin\s*\*\//.test(b));
        const out = await Promise.all((blocks.length ? blocks : [css]).map(async (b) => {
          const m = b.match(/url\((https:[^)]+)\)/);
          if (!m) return b;
          const data = await toDataUrl(m[1]);
          return data ? b.replace(m[1], data) : '';
        }));
        return out.join('\n');
      } catch { return ''; }
    })());
  }
  return fontCache.get(fam);
}

function fontsOf(brand) {
  return { heading: brand?.fonts?.heading || 'Montserrat', body: brand?.fonts?.body || 'Nunito Sans' };
}

/** Base CSS shared by the renderer and the editor. */
export function baseCss(creative, brand) {
  const fmt = FORMATS[creative.format] || FORMATS['1:1'];
  const c = { ...DEFAULT_COLORS, ...(brand?.colors || {}) };
  const f = fontsOf(brand);
  return `
.canvas { --deep:${c.deep}; --light:${c.light}; --accent:${c.accent}; --primary:${c.primary || c.deep}; --secondary:${c.secondary || c.light};
  --font-heading:"${f.heading}", Arial, sans-serif; --font-body:"${f.body}", Arial, sans-serif;
  position:relative; isolation:isolate; width:${fmt.w}px; height:${fmt.h}px; overflow:hidden; }
:where(.canvas) { background:var(--deep); color:var(--light);
  font-family:var(--font-body); font-size:32px; line-height:1.25; -webkit-font-smoothing:antialiased; }
/* Resets use :where() so they never outrank the design's own CSS. */
:where(.canvas) *, :where(.canvas) *::before, :where(.canvas) *::after { box-sizing:border-box; }
:where(.canvas) :where(h1, h2, h3, h4, h5, h6, p, ul, ol) { margin:0; padding:0; }
:where(.canvas) :where(ul, ol) { list-style:none; }
:where(.canvas) :where(img) { display:block; max-width:none; }
`;
}

/** Puts real (or data) URLs in place of {{LOGO}} / {{PHOTO}} / {{BG}}. */
export function fillPlaceholders(text, logo, photo, bg) {
  return String(text || '').replace(/\{\{LOGO\}\}/g, logo || '').replace(/\{\{PHOTO\}\}/g, photo || '').replace(/\{\{BG\}\}/g, bg || '');
}

function toXhtml(markup, logo) {
  const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${markup}</body></html>`, 'text/html');
  // Hide images whose source is missing (no logo, no photo) instead of showing a broken icon.
  doc.querySelectorAll('img').forEach((img) => { if (!img.getAttribute('src')) img.setAttribute('style', `${img.getAttribute('style') || ''};display:none`); });
  // Mark every copy of the logo so it can be checked for contrast.
  if (logo) {
    let i = 0;
    doc.querySelectorAll('img').forEach((img) => { if (img.getAttribute('src') === logo) img.setAttribute('data-cs-logo', String(i++)); });
  }
  const ser = new XMLSerializer();
  return Array.from(doc.body.childNodes).map((n) => ser.serializeToString(n)).join('');
}

const loadImg = (src) => new Promise((res) => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

async function drawSvg(canvas, fmt, inner) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt.w}" height="${fmt.h}"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${inner}</div></foreignObject></svg>`;
  const img = new Image();
  img.width = fmt.w; img.height = fmt.h;
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  try { await img.decode(); } catch { await new Promise((r) => { img.onload = r; img.onerror = r; }); }
  // Give inlined fonts a moment to apply inside the SVG before drawing.
  await new Promise((r) => setTimeout(r, 60));
  canvas.width = fmt.w; canvas.height = fmt.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, fmt.w, fmt.h);
  ctx.drawImage(img, 0, 0, fmt.w, fmt.h);
  return ctx;
}

/** Where each logo copy sits on the canvas, from a hidden layout of the same design. */
async function logoBoxes(css, body, fmt) {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:-30000px;top:0;width:${fmt.w}px;height:${fmt.h}px;pointer-events:none;contain:strict`;
  document.body.appendChild(host);
  try {
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${css}</style>${body}`;
    const imgs = Array.from(root.querySelectorAll('img'));
    await Promise.all(imgs.map((im) => (im.complete ? null : im.decode().catch(() => null))));
    const canvasEl = root.querySelector('.canvas');
    const base = canvasEl.getBoundingClientRect();
    return Array.from(root.querySelectorAll('[data-cs-logo]')).map((el) => {
      const r = el.getBoundingClientRect();
      return { i: el.getAttribute('data-cs-logo'), x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    }).filter((b) => b.w > 4 && b.h > 4);
  } catch { return []; }
  finally { host.remove(); }
}

export async function renderHtmlCard(canvas, creative, brand) {
  const fmt = FORMATS[creative.format] || FORMATS['1:1'];
  const spec = creative.spec || {};
  const f = fontsOf(brand);
  const [logo, photo, bg, fh, fb] = await Promise.all([
    toDataUrl(brand?.logo_url), toDataUrl(creative.photo_url), toDataUrl(spec.bg_url), inlineFont(f.heading), f.body === f.heading ? '' : inlineFont(f.body),
  ]);
  const css = `${fh}\n${fb}\n${baseCss(creative, brand)}\n${fillPlaceholders(spec.css, logo, photo, bg)}`;
  const body = toXhtml(`<div class="canvas">${fillPlaceholders(spec.html, logo, photo, bg)}</div>`, logo);
  // The SVG is XML, so the stylesheet text is escaped for it.
  const page = (extra) => `<style>${`${css}\n${extra}`.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</style>${body}`;

  // Logo check: draw the design without the logo, see what is behind each copy of it,
  // and put any copy that would partly disappear on a contrasting plate.
  let fix = '';
  const logoImg = logo ? await loadImg(logo) : null;
  const pixels = logoPixels(logoImg);
  if (pixels && body.includes('data-cs-logo')) {
    const boxes = await logoBoxes(css, body, fmt);
    if (boxes.length) {
      const probe = document.createElement('canvas');
      const pctx = await drawSvg(probe, fmt, page('.canvas [data-cs-logo]{visibility:hidden !important}'));
      const colors = { ...DEFAULT_COLORS, ...(brand?.colors || {}) };
      boxes.forEach((b) => {
        if (!needsPlate(pixels, groundLum(pctx, b.x, b.y, b.w, b.h))) return;
        // Drawn around the logo with background + box-shadow, so nothing else on the design moves.
        const pad = Math.round(Math.max(10, Math.min(24, b.h * 0.22)));
        const plate = plateColor(pixels, colors);
        fix += `.canvas [data-cs-logo="${b.i}"]{background-color:${plate} !important;box-shadow:0 0 0 ${pad}px ${plate} !important;border-radius:4px !important;opacity:1 !important;filter:none !important;mix-blend-mode:normal !important}\n`;
      });
    }
  }
  await drawSvg(canvas, fmt, page(fix));
  return canvas;
}

/** A full HTML document for the in-place text editor (iframe, scripts disabled). */
export function editorDoc(creative, brand) {
  const spec = creative.spec || {};
  const f = fontsOf(brand);
  const fam = [...new Set([f.heading, f.body])].map(fontCssUrl).map((u) => `<link rel="stylesheet" href="${u}">`).join('');
  const csp = "default-src 'none'; img-src https: data: blob:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}">${fam}
<style>html,body{margin:0;background:#fff} .canvas div:empty,.canvas span:empty,.canvas img,.canvas svg{pointer-events:none} .canvas [contenteditable],.canvas *{caret-color:#6246ea}${baseCss(creative, brand)}${fillPlaceholders(spec.css, brand?.logo_url, creative.photo_url, spec.bg_url)}</style></head>
<body><div class="canvas">${fillPlaceholders(spec.html, brand?.logo_url, creative.photo_url, spec.bg_url)}</div></body></html>`;
}

/** Turns edited markup back into the stored form (real URLs back to placeholders). */
export function toStoredHtml(markup, creative, brand) {
  let s = String(markup || '');
  if (brand?.logo_url) s = s.split(brand.logo_url).join('{{LOGO}}');
  if (creative.photo_url) s = s.split(creative.photo_url).join('{{PHOTO}}');
  if (creative.spec?.bg_url) s = s.split(creative.spec.bg_url).join('{{BG}}');
  return s;
}
