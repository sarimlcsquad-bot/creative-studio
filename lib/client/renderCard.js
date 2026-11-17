'use client';
// Draws a creative "performance card" on a <canvas> from the spec Claude returns.
// Port of the house builder (scripts/build_performance_cards.py): dark ground,
// uppercase headline with an accent payoff line, sub-line, checklist or service
// grid, pill CTA, logo bottom-left, photo on the right or bottom faded into the
// ground. Text is drawn here, never by the image model, so it is spelled exactly.

export const FORMATS = {
  '1:1': { w: 1080, h: 1080, top: 92, safeBottom: 0 },
  '4:5': { w: 1080, h: 1350, top: 110, safeBottom: 0 },
  '9:16': { w: 1080, h: 1920, top: 290, safeBottom: 380 }, // Reels/Stories safe zone
};

const M = 64; // page margin

export const FONT_CHOICES = [
  'Montserrat', 'Inter', 'Poppins', 'Archivo', 'Oswald', 'Anton', 'Bebas Neue',
  'Roboto', 'Open Sans', 'Lato', 'Nunito Sans', 'Raleway', 'Work Sans', 'DM Sans',
  'Barlow', 'Barlow Condensed', 'Playfair Display', 'Merriweather',
];

const DEFAULT_COLORS = { deep: '#0B0B0C', light: '#F7F7F2', accent: '#7C5CFF' };

const imageCache = new Map();
export function loadImage(url) {
  if (!url) return Promise.resolve(null);
  if (imageCache.has(url)) return imageCache.get(url);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
  imageCache.set(url, p);
  return p;
}

const loadedFonts = new Set();
export async function ensureFonts(fonts) {
  const families = [fonts?.heading || 'Montserrat', fonts?.body || 'Nunito Sans'];
  for (const fam of families) {
    if (!loadedFonts.has(fam)) {
      const id = 'gf-' + fam.replace(/\s+/g, '-');
      if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam)}:wght@400;600;700;800;900&display=swap`;
        document.head.appendChild(link);
        await new Promise((r) => { link.onload = r; link.onerror = r; setTimeout(r, 3000); });
      }
      loadedFonts.add(fam);
    }
    try {
      await Promise.all([
        document.fonts.load(`800 40px "${fam}"`),
        document.fonts.load(`700 40px "${fam}"`),
        document.fonts.load(`600 40px "${fam}"`),
      ]);
    } catch { /* fall back to system font */ }
  }
}

function hexToRgb(hex) {
  const h = (hex || '#000').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function wrap(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width <= maxW || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// cover-fit crop with a focus point, like fill_crop() in the Python builder
function drawCover(ctx, img, x, y, w, h, fx = 0.5, fy = 0.45) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  const sx = Math.min(Math.max(img.width * fx - sw / 2, 0), img.width - sw);
  const sy = Math.min(Math.max(img.height * fy - sh / 2, 0), img.height - sh);
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawPhoto(ctx, img, layout, W, H, ground, spec) {
  const fx = spec.photo_focus_x ?? 0.5;
  const fy = spec.photo_focus_y ?? 0.4;
  if (layout === 'right') {
    const x0 = Math.round(W * 0.46);
    drawCover(ctx, img, x0, 0, W - x0, H, fx, fy);
    const fw = (W - x0) * 0.42;
    const g = ctx.createLinearGradient(x0, 0, x0 + fw, 0);
    const [r, gg, b] = hexToRgb(ground);
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      g.addColorStop(t, `rgba(${r},${gg},${b},${1 - t ** 0.8})`);
    }
    ctx.fillStyle = g;
    ctx.fillRect(x0 - 1, 0, fw + 2, H);
  } else if (layout === 'bottom') {
    const y0 = Math.round(H * 0.52);
    drawCover(ctx, img, 0, y0, W, H - y0, fx, fy);
  }
}

// Measures (dry run) or draws the block stack. Returns the y after the last block.
function layoutBlocks(ctx, blocks, opts, draw) {
  const { x0, width, W, pal, ink, fonts, scale } = opts;
  const head = fonts.heading;
  const body = fonts.body;
  let y = opts.top;
  for (const b of blocks || []) {
    const type = b.type;
    if (type === 'headline') {
      const size = Math.round((b.size || opts.headlineSize) * scale);
      ctx.font = `800 ${size}px "${head}", Arial, sans-serif`;
      const lh = Math.round(size * 1.06);
      for (const raw of b.lines || []) {
        if (!raw) continue;
        const accent = raw.startsWith('accent:');
        const txt = (accent ? raw.slice(7) : raw).toUpperCase();
        for (const ln of wrap(ctx, txt, width)) {
          if (draw) {
            if (accent && opts.accentStyle === 'highlight') {
              const tw = ctx.measureText(ln).width;
              ctx.fillStyle = pal.accent;
              ctx.fillRect(x0 - 12, y + size * 0.04, tw + 28, size * 1.04);
              ctx.fillStyle = pal.deep;
            } else {
              ctx.fillStyle = accent ? pal.accent : ink;
            }
            ctx.fillText(ln, x0, y);
          }
          y += lh + (accent && opts.accentStyle === 'highlight' ? 8 : 0);
        }
      }
      y += 10;
    } else if (type === 'sub') {
      const size = Math.round((b.size || 27) * scale);
      ctx.font = `600 ${size}px "${body}", Arial, sans-serif`;
      for (const ln of wrap(ctx, b.text, width)) {
        if (draw) { ctx.fillStyle = ink; ctx.fillText(ln, x0, y); }
        y += Math.round(size * 1.42);
      }
      y += 12;
    } else if (type === 'checklist') {
      const size = Math.round((b.size || 30) * scale);
      const r = Math.round(size * 0.62);
      ctx.font = `700 ${size}px "${body}", Arial, sans-serif`;
      for (const it of b.items || []) {
        if (!it) continue;
        const cy = y + r;
        if (draw) {
          ctx.fillStyle = pal.accent;
          ctx.beginPath(); ctx.arc(x0 + r, cy, r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = pal.deep;
          ctx.lineWidth = Math.max(3, r / 5);
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(x0 + r * 0.52, cy);
          ctx.lineTo(x0 + r * 0.88, cy + r * 0.38);
          ctx.lineTo(x0 + r * 1.48, cy - r * 0.46);
          ctx.stroke();
          ctx.fillStyle = ink;
          ctx.textBaseline = 'middle';
          ctx.fillText(it, x0 + 2 * r + 22, cy);
          ctx.textBaseline = 'top';
        }
        y += 2 * r + Math.round(17 * scale);
      }
      y += 8;
    } else if (type === 'grid') {
      const items = (b.items || []).filter(Boolean);
      const cols = 3;
      const gap = 13;
      const cellH = Math.round(128 * scale);
      const totalW = W - 2 * M;
      const cw = Math.floor((totalW - gap * (cols - 1)) / cols);
      const fsize = Math.round(21 * Math.max(scale, 0.85));
      ctx.font = `800 ${fsize}px "${body}", Arial, sans-serif`;
      items.forEach((label, i) => {
        const cx = M + (i % cols) * (cw + gap);
        const cy = y + Math.floor(i / cols) * (cellH + gap);
        if (draw) {
          ctx.fillStyle = pal.light;
          roundRect(ctx, cx, cy, cw, cellH, 14); ctx.fill();
          ctx.fillStyle = pal.accent;
          roundRect(ctx, cx, cy, cw, 6, 3); ctx.fill();
          const lines = wrap(ctx, label.toUpperCase(), cw - 26).slice(0, 3);
          let ty = cy + cellH / 2 - (lines.length * 26) / 2 + 3;
          ctx.fillStyle = pal.deep;
          ctx.textAlign = 'center';
          for (const ln of lines) { ctx.fillText(ln, cx + cw / 2, ty); ty += 26; }
          ctx.textAlign = 'left';
        }
      });
      const rows = Math.ceil(items.length / cols);
      y += rows * (cellH + gap) + 6;
    } else if (type === 'cta') {
      let size = Math.round(31 * Math.max(scale, 0.85));
      const label = String(b.label || '').toUpperCase();
      const maxW = W - x0 - M;
      ctx.font = `800 ${size}px "${body}", Arial, sans-serif`;
      while (ctx.measureText(label).width + 84 > maxW && size > 16) {
        size -= 1;
        ctx.font = `800 ${size}px "${body}", Arial, sans-serif`;
      }
      const tw = ctx.measureText(label).width;
      const w = Math.min(tw + 84, maxW);
      const h = Math.round(size * 2.25);
      if (draw) {
        ctx.fillStyle = pal.accent;
        roundRect(ctx, x0, y, w, h, h / 2); ctx.fill();
        ctx.fillStyle = pal.ctaInk;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, x0 + w / 2, y + h / 2 + 1);
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      }
      y += h + 16;
    } else if (type === 'space') {
      y += Math.round((b.px || 10) * scale);
    }
  }
  return y;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Render a creative onto `canvas`.
 * @param {HTMLCanvasElement} canvas
 * @param {object} creative  row from the creatives table (spec, format, photo_url)
 * @param {object} brand     row from the brands table (colors, fonts, logo_url, name)
 */
export async function renderCard(canvas, creative, brand) {
  const fmt = FORMATS[creative.format] || FORMATS['1:1'];
  const W = fmt.w, H = fmt.h;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const spec = creative.spec || {};
  const colors = { ...DEFAULT_COLORS, ...(brand?.colors || {}) };
  const fonts = { heading: brand?.fonts?.heading || 'Montserrat', body: brand?.fonts?.body || 'Nunito Sans' };
  await ensureFonts(fonts);

  const lightGround = spec.ground === 'light';
  const ground = lightGround ? colors.light : colors.deep;
  const ink = lightGround ? colors.deep : colors.light;
  // A mid-tone accent that fails contrast as text on the ground becomes a highlighter bar.
  const accentStyle = contrast(colors.accent, ground) < 2.6 ? 'highlight' : 'plain';
  const ctaInk = contrast(colors.deep, colors.accent) >= contrast(colors.light, colors.accent) ? colors.deep : colors.light;
  const pal = { ...colors, ctaInk };

  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'top';

  const photo = spec.photo_layout && spec.photo_layout !== 'none' ? await loadImage(creative.photo_url) : null;
  let layout = photo ? spec.photo_layout : 'none';

  // Fit: shrink the whole stack until it ends above the limit. A "bottom" photo
  // that would squeeze the text too small moves to the right instead.
  const fit = (lay) => {
    const width = lay === 'right' ? Math.round(W * 0.5) : Math.round(W * 0.86);
    const bottomLimit = lay === 'bottom' ? H * 0.52 - 20 : H - 150 - fmt.safeBottom;
    const base = { x0: M, width, W, pal, ink, fonts, accentStyle, top: spec.top || fmt.top, headlineSize: spec.headline_size || 70 };
    let scale = 1;
    while (scale > 0.55 && layoutBlocks(ctx, spec.blocks, { ...base, scale }, false) > bottomLimit) scale -= 0.05;
    return { base, scale };
  };
  let { base, scale } = fit(layout);
  if (layout === 'bottom' && scale < 0.8) { layout = 'right'; ({ base, scale } = fit(layout)); }
  if (photo) drawPhoto(ctx, photo, layout, W, H, ground, spec);
  const end = layoutBlocks(ctx, spec.blocks, { ...base, scale }, true);

  // Logo / wordmark bottom-left
  const wmY = Math.min(Math.max(end + 14, H - 128 - fmt.safeBottom), H - 70 - fmt.safeBottom);
  const logo = await loadImage(brand?.logo_url);
  const overPhoto = layout === 'bottom';
  if (logo) {
    const lh = 72;
    const lw = Math.round((logo.width * lh) / logo.height);
    const y = Math.min(wmY, H - lh - 28 - fmt.safeBottom);
    if (brand?.logo_mono) {
      const off = document.createElement('canvas');
      off.width = lw; off.height = lh;
      const o = off.getContext('2d');
      o.drawImage(logo, 0, 0, lw, lh);
      o.globalCompositeOperation = 'source-in';
      o.fillStyle = overPhoto || !lightGround ? colors.light : colors.deep;
      o.fillRect(0, 0, lw, lh);
      ctx.drawImage(off, M, y);
    } else {
      ctx.drawImage(logo, M, y, lw, lh);
    }
  } else if (brand?.name) {
    const y = Math.min(wmY, H - 70 - fmt.safeBottom);
    ctx.fillStyle = pal.accent;
    [26, 36, 26].forEach((hgt, i) => {
      const x = M + i * 11;
      ctx.beginPath(); ctx.moveTo(x, y + 36); ctx.lineTo(x + 6, y + 36 - hgt); ctx.lineTo(x + 12, y + 36); ctx.fill();
    });
    ctx.font = `800 30px "${fonts.heading}", Arial, sans-serif`;
    ctx.fillStyle = overPhoto || !lightGround ? colors.light : colors.deep;
    ctx.fillText(brand.name.toUpperCase(), M + 46, y + 6);
  }
  return canvas;
}

export async function renderToBlob(creative, brand) {
  const c = document.createElement('canvas');
  await renderCard(c, creative, brand);
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}
