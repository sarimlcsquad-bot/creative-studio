import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

let client;
function anthropic() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY must be set on the server');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, authToken: null, timeout: 10 * 60 * 1000 });
  }
  return client;
}

export const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
export const EFFORT = process.env.CLAUDE_EFFORT || 'high';

/**
 * One Claude call that must return JSON matching `schema` (structured outputs).
 * Server-side refusal fallbacks are on: if the safety filter declines, the API
 * retries the same request on a fallback model inside the same call.
 */
export async function claudeJson({ system, content, schema, effort = EFFORT, maxTokens = 16000 }) {
  const response = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort, format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content }],
  });
  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined this request: ' + (response.stop_details?.explanation || 'no reason given'));
  }
  if (response.stop_reason === 'max_tokens') throw new Error('Claude ran out of output space');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try { return JSON.parse(text); }
  catch { throw new Error('Claude returned something that is not JSON'); }
}
