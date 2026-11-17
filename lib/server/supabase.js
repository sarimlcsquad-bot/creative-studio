import 'server-only';
import { createClient } from '@supabase/supabase-js';

let client;
export function db() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set on the server');
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
