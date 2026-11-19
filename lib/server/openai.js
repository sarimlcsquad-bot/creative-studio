import 'server-only';

// OpenAI image generation, used only when a creative asks for an AI image.
// Without OPENAI_API_KEY the option is hidden in the app and the server
// falls back to a brand photo or a text card.
export const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gpt-image-2';
export const IMAGE_QUALITY = process.env.IMAGE_QUALITY || 'medium';

export function aiImagesEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

// Appended to every prompt: cards draw their own text, so the image must have none.
const GUARD = ' Absolutely no text, letters, numbers, words, logos, watermarks, signage or UI anywhere in the image.';

/** Returns a PNG/JPEG Buffer for the prompt. size: '1024x1536' (tall) or '1536x1024' (wide). */
export async function makeImage({ prompt, size, transparent = false }) {
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const call = (extra) => fetch(`${base}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: IMAGE_MODEL, prompt: prompt + GUARD, size, quality: IMAGE_QUALITY, n: 1, ...extra }),
    signal: AbortSignal.timeout(180_000),
  });
  // A see-through background when asked (objects on a card); models that do not support it get a plain request.
  let res = await call(transparent ? { background: 'transparent', output_format: 'png' } : {});
  if (!res.ok && transparent && res.status === 400) res = await call({});
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI image: ${body?.error?.message || `HTTP ${res.status}`}`);
  const item = (body.data || [])[0] || {};
  if (item.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item.url) {
    const img = await fetch(item.url);
    if (!img.ok) throw new Error('OpenAI image: could not download the result');
    return Buffer.from(await img.arrayBuffer());
  }
  throw new Error('OpenAI image: no image in the response');
}
