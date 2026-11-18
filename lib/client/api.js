'use client';
// Calls the app's own server routes (app/api/*). Keys never reach the browser.

async function call(path, { method = 'GET', query, body, form } = {}) {
  const url = new URL('/api/' + path, window.location.origin);
  if (query) Object.entries(query).forEach(([k, v]) => v != null && v !== '' && url.searchParams.set(k, v));
  const headers = {};
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(url, { method, headers, body: payload, cache: 'no-store' });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Please log in'); }
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text.slice(0, 200) }; }
  if (!res.ok || data?.error) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

// Shrink big photos before upload: long side at most 2048px, JPEG. Keeps
// uploads fast and under hosting body limits. PNG logos stay PNG.
async function shrink(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.5 * 1024 * 1024) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const keepPng = file.type === 'image/png' && file.size < 4 * 1024 * 1024;
  const blob = await new Promise((r) => c.toBlob(r, keepPng ? 'image/png' : 'image/jpeg', 0.9));
  return new File([blob], file.name.replace(/\.[^.]+$/, keepPng ? '.png' : '.jpg'), { type: blob.type });
}

export const api = {
  listBrands: () => call('brands').then((d) => d.brands || []),
  saveBrand: (brand) => call('brands', { method: 'POST', body: brand }).then((d) => d.brand),
  deleteBrand: (id) => call('brands/delete', { method: 'POST', body: { id } }),
  analyzeWebsite: (url) => call('analyze-website', { method: 'POST', body: { url } }).then((d) => d.suggestions || {}),
  upload: async (file, folder) => {
    const small = await shrink(file);
    const form = new FormData();
    form.append('file', small, small.name || 'upload.png');
    form.append('folder', folder || 'misc');
    return call('upload', { method: 'POST', form }).then((d) => d.url);
  },
  listCreatives: (q = {}) => call('creatives', { query: q }).then((d) => d.creatives || []),
  updateCreative: (patch) => call('creatives/update', { method: 'POST', body: patch }).then((d) => d.creative),
  deleteCreative: (id) => call('creatives/delete', { method: 'POST', body: { id } }),
  favoriteCreative: (id, favorite) => call('creatives/favorite', { method: 'POST', body: { id, favorite } }).then((r) => r.creative),
  wizard: (body) => call('wizard', { method: 'POST', body }),
  config: () => call('config').catch(() => ({ ai_images: false })),
  generate: (req) => call('generate', { method: 'POST', body: req }).then((d) => d.creatives || []),
  logout: () => call('logout', { method: 'POST' }),
};
