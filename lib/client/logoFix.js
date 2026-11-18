'use client';
// Keeps a logo readable wherever it lands. A logo with a transparent background can vanish
// partly or fully on a ground of similar tone (a white logo on a white card). We measure the
// logo's own pixels against what sits behind it and, when too much of it would disappear,
// put it on a small plate in the colour that shows the most of it.

const lum = (r, g, b) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const hexLum = (hex) => {
  const m = String(hex || '').replace('#', '').match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return lum((n >> 16) & 255, (n >> 8) & 255, n & 255);
};

// A part of the logo counts as visible when it stands out at least this much from the ground.
const VISIBLE = 1.7;
// Correct the logo when more than this share of it would be hard to see.
const MAX_HIDDEN = 0.12;

const cache = new Map();
/** Luminances of the logo's opaque pixels (sampled), or null if it can't be read. */
export function logoPixels(img) {
  if (!img || !img.width) return null;
  const key = img.src;
  if (cache.has(key)) return cache.get(key);
  let out = null;
  try {
    const s = Math.min(1, 96 / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const list = [];
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 140) list.push(lum(d[i], d[i + 1], d[i + 2]));
    out = list.length ? list : null;
  } catch { out = null; }
  cache.set(key, out);
  return out;
}

/** Share of the logo that would be hard to see on a ground of luminance `bg`. */
export function hiddenShare(pixels, bg) {
  if (!pixels?.length) return 0;
  let hidden = 0;
  for (const l of pixels) if (ratio(l, bg) < VISIBLE) hidden++;
  return hidden / pixels.length;
}

/** Average luminance of a rectangle of a canvas (what sits behind the logo). */
export function groundLum(ctx, x, y, w, h) {
  const X = Math.max(0, Math.round(x)), Y = Math.max(0, Math.round(y));
  const W = Math.max(1, Math.min(ctx.canvas.width - X, Math.round(w))), H = Math.max(1, Math.min(ctx.canvas.height - Y, Math.round(h)));
  try {
    const d = ctx.getImageData(X, Y, W, H).data;
    let sum = 0, n = 0;
    const step = Math.max(4, Math.floor(d.length / 4 / 4000) * 4);
    for (let i = 0; i < d.length; i += step) { sum += lum(d[i], d[i + 1], d[i + 2]); n++; }
    return n ? sum / n : null;
  } catch { return null; }
}

/** The plate colour that shows the most of the logo, preferring the brand's own colours. */
export function plateColor(pixels, colors = {}) {
  const options = [colors.deep, colors.light, colors.primary, colors.secondary, '#FFFFFF', '#111111']
    .filter((c, i, a) => hexLum(c) != null && a.indexOf(c) === i);
  let best = options[0] || '#FFFFFF', bestHidden = 2;
  options.forEach((c, i) => {
    // Brand colours win ties; white and near-black are the fallback.
    const h = hiddenShare(pixels, hexLum(c)) + (i >= options.length - 2 ? 0.02 : 0);
    if (h < bestHidden) { best = c; bestHidden = h; }
  });
  return best;
}

/** Whether a logo on a ground of luminance `bg` needs a plate. */
export function needsPlate(pixels, bg) {
  return bg != null && hiddenShare(pixels, bg) > MAX_HIDDEN;
}

/** A background for showing a logo in the app's own UI (brand previews). */
export function uiLogoBackground(img, colors = {}) {
  const px = logoPixels(img);
  if (!px) return null;
  return needsPlate(px, hexLum('#FFFFFF')) ? plateColor(px, colors) : null;
}
