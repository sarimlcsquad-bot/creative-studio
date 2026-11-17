import { db, check, publicUrl } from '@/lib/server/supabase';
import { handler, ok } from '@/lib/server/http';

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

// multipart/form-data: file, folder. Images are resized in the browser before upload.
export const POST = handler(async (req) => {
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new Error('No file received');
  const type = file.type || 'application/octet-stream';
  if (!EXT[type]) throw new Error('Upload a PNG, JPG, WebP or GIF image');
  if (file.size > 8 * 1024 * 1024) throw new Error('Image is over 8 MB');
  const folder = String(form.get('folder') || 'misc').replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '') || 'misc';
  const bucket = folder.startsWith('renders') ? 'creatives' : 'brand-assets';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT[type]}`;
  check(await db().storage.from(bucket).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: type, upsert: true }));
  return ok({ url: publicUrl(bucket, path) });
});
