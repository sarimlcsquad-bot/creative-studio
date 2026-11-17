// One shared app password. A successful login sets an httpOnly cookie holding
// an HMAC of the password, which middleware.js checks on every request.
export const COOKIE = 'cs_session';

export async function sessionToken(password) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('creative-studio-session-v1'));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
