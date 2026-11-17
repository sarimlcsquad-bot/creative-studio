import 'server-only';
import { createClient } from '@supabase/supabase-js';

let client;
export function db() {
  if (!client) {
    // Also accept the names Vercel's Supabase integration creates.
    const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const key = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
    const missing = [!url && 'SUPABASE_URL', !key && 'SUPABASE_SERVICE_KEY'].filter(Boolean);
    if (missing.length) throw new Error(`${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not set on the server (check the name, the Production environment, then redeploy)`);
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

export function publicUrl(bucket, path) {
  return db().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export function check({ data, error }) {
  if (error) throw new Error(error.message || 'Database error');
  return data;
}
