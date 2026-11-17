import { handler, ok } from '@/lib/server/http';
import { claudeJson } from '@/lib/server/claude';

export const maxDuration = 120;

const list = { type: 'array', items: { type: 'string' } };
const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['name', 'industry', 'description', 'service_area', 'target_audience', 'services', 'offer', 'differentiators', 'proof_points', 'guarantees', 'tone_of_voice', 'default_cta', 'website_summary'],
  properties: {
    name: { type: 'string' }, industry: { type: 'string' }, description: { type: 'string' },
    service_area: { type: 'string' }, target_audience: { type: 'string' }, services: list, offer: { type: 'string' },
    differentiators: list, proof_points: list, guarantees: list,
    tone_of_voice: { type: 'string' }, default_cta: { type: 'string' }, website_summary: { type: 'string' },
  },
};

export const POST = handler(async (req) => {
  const { url } = await req.json();
  if (!/^https?:\/\//i.test(String(url || ''))) throw new Error('Enter a full website address starting with https://');
  let html = '';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CreativeStudio/1.0)' }, signal: AbortSignal.timeout(20000) });
    html = await res.text();
  } catch { throw new Error('Could not open that website'); }
  const pick = (re) => (html.match(re) || [])[1] || '';
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i).trim();
  const metaDesc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim().slice(0, 40000);
  if (text.length < 80) throw new Error('Could not read text from that website (it may block bots or need JavaScript). Fill the fields by hand.');
  const suggestions = await claudeJson({
    effort: 'medium',
    maxTokens: 8000,
    schema: SCHEMA,
    system: 'You read a business website and fill in a brand kit for an ad creative tool. Use only what the page states. Leave a field empty ("" or []) when the page does not say it. proof_points and guarantees must be quoted or closely paraphrased from the page, never invented. website_summary: 120 to 200 words covering what they sell, to whom, where, how they work, prices and offers, and their voice.',
    content: `Website: ${url}\nTitle: ${title}\nMeta description: ${metaDesc}\n\nPage text:\n${text}`,
  });
  return ok({ suggestions });
});
