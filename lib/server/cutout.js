import 'server-only';
import sharp from 'sharp';

// Object images go on a flat card colour, so they need a clean see-through background.
// The image model is asked for one, but when it can't (or paints a fake checkerboard or a
// glow instead), this cuts the background away itself: it flood-fills from the edges over
// the background colours, softens the edge, and trims the empty space so the object fills its slot.

const dist = (d, i, c) => Math.abs(d[i] - c[0]) + Math.abs(d[i + 1] - c[1]) + Math.abs(d[i + 2] - c[2]);

/** The few colours the border is made of (one for a flat background, two for a checkerboard). */
function borderColours(d, w, h) {
  const bins = new Map();
  const add = (x, y) => {
    const i = (y * w + x) * 4;
    const k = `${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`;
    const b = bins.get(k) || { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2];
    bins.set(k, b);
  };
  for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
  for (let y = 0; y < h; y++) { add(0, y); add(w - 1, y); }
  const total = 2 * (w + h);
  const top = [...bins.values()].sort((a, b) => b.n - a.n);
  const out = [];
  let covered = 0;
  for (const b of top) {
    if (out.length >= 4 || covered / total > 0.9) break;
    if (b.n / total < 0.03) break;
    out.push([b.r / b.n, b.g / b.n, b.b / b.n]);
    covered += b.n;
  }
  return { colours: out, covered: covered / total };
}

/**
 * Returns a PNG whose background is see-through and trimmed to the object.
 * Leaves the image as it is when it can't find a clean background (a full scene).
 */
export async function cutOut(input) {
  const img = sharp(input).ensureAlpha();
  const { data: d, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const n = w * h;

  let clear = 0;
  for (let p = 0; p < n; p++) if (d[p * 4 + 3] < 16) clear++;
  const alpha = new Uint8Array(n);
  for (let p = 0; p < n; p++) alpha[p] = d[p * 4 + 3];

  // Already see-through (the model managed it): only trim.
  if (clear / n < 0.05) {
    const { colours, covered } = borderColours(d, w, h);
    if (!colours.length || covered < 0.6) return { png: await sharp(input).png().toBuffer(), cut: false };
    // Flood from the edges over pixels close to a border colour, or a gentle step from a background
    // neighbour (soft glows and vignettes), never across a hard edge. Looser settings first; when they
    // eat the object too (a white object on a white background), stricter ones.
    const flood = (nearT, stepT) => {
      const bg = new Uint8Array(n);
      const stack = [];
      const near = (i) => colours.some((c) => dist(d, i, c) < nearT);
      const seed = (p) => { if (!bg[p] && near(p * 4)) { bg[p] = 1; stack.push(p); } };
      for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
      while (stack.length) {
        const p = stack.pop();
        const x = p % w, y = (p / w) | 0;
        const i = p * 4;
        const from = [d[i], d[i + 1], d[i + 2]];
        const visit = (q) => {
          if (bg[q]) return;
          const j = q * 4;
          if (near(j) || (stepT && dist(d, j, from) < stepT && colours.some((c) => dist(d, j, c) < 140))) { bg[q] = 1; stack.push(q); }
        };
        if (x > 0) visit(p - 1);
        if (x < w - 1) visit(p + 1);
        if (y > 0) visit(p - w);
        if (y < h - 1) visit(p + w);
      }
      let removed = 0;
      for (let p = 0; p < n; p++) if (bg[p]) removed++;
      return { bg, share: removed / n };
    };
    let bg = null;
    for (const [nearT, stepT] of [[54, 12], [26, 6], [12, 0]]) {
      const r = flood(nearT, stepT);
      if (process.env.CUT_DEBUG) console.log({ nearT, share: r.share });
      // Nothing sensible to cut (a scene) at the loosest setting: leave the image alone.
      if (r.share < 0.08) break;
      if (r.share <= 0.9) { bg = r.bg; break; }
    }
    if (!bg) return { png: await sharp(input).png().toBuffer(), cut: false };
    // Soft 1-2 px edge instead of a jagged one.
    const mask = Buffer.alloc(n);
    for (let p = 0; p < n; p++) mask[p] = bg[p] ? 0 : 255;
    const soft = await sharp(mask, { raw: { width: w, height: h, channels: 1 } }).blur(0.8).extractChannel(0).raw().toBuffer();
    for (let p = 0; p < n; p++) alpha[p] = Math.min(alpha[p], soft[p]);
  }

  // Trim to the object with a little room around it.
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (alpha[y * w + x] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  for (let p = 0; p < n; p++) d[p * 4 + 3] = alpha[p];
  let out = sharp(d, { raw: { width: w, height: h, channels: 4 } });
  if (x1 > x0 && y1 > y0) {
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
    const left = Math.max(0, x0 - pad), top = Math.max(0, y0 - pad);
    out = out.extract({ left, top, width: Math.min(w, x1 + pad + 1) - left, height: Math.min(h, y1 + pad + 1) - top });
  }
  return { png: await out.png({ compressionLevel: 9 }).toBuffer(), cut: true };
}
