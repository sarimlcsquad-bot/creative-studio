// Cleans the HTML and CSS Claude writes for a free-design creative. The browser
// also renders it with scripts disabled; this keeps stored designs clean too.

const ALLOWED_TAGS = new Set(['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'b', 'i', 'u', 's', 'br', 'ul', 'ol', 'li', 'img',
  'svg', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'g', 'defs', 'lineargradient', 'radialgradient', 'stop', 'small', 'sup', 'sub', 'del']);
const PLACEHOLDER = /^\{\{(LOGO|PHOTO|BG)\}\}$/;

export function sanitizeHtml(html) {
  let s = String(html || '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  // Drop dangerous elements together with their content.
  s = s.replace(/<(script|style|iframe|object|embed|noscript|template|textarea|select|form|title|head)\b[\s\S]*?<\/\1\s*>/gi, '');
  // Keep allowed tags, drop the rest (keeping their inner text).
  s = s.replace(/<\/?([a-zA-Z][\w-]*)\b([^>]*)>/g, (tag, name, attrs) => {
    const n = name.toLowerCase();
    if (!ALLOWED_TAGS.has(n)) return '';
    if (tag.startsWith('</')) return `</${name}>`;
    const clean = [];
    const re = /([^\s=/]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let m;
    while ((m = re.exec(attrs))) {
      const key = m[1];
      const k = key.toLowerCase();
      let v = m[3] ?? m[4] ?? m[5] ?? '';
      if (k.startsWith('on') || k === 'href' || k === 'xlink:href' || k === 'srcset' || k === 'action' || k === 'formaction') continue;
      if (k === 'src') { if (!(PLACEHOLDER.test(v.trim()) || /^data:image\//i.test(v.trim()))) continue; }
      if (k === 'style') v = sanitizeCss(v);
      if (/javascript:|vbscript:/i.test(v)) continue;
      clean.push(m[2] === undefined ? key : `${key}="${v.replace(/"/g, '&quot;')}"`);
    }
    const self = /\/\s*$/.test(attrs) ? ' /' : '';
    return `<${name}${clean.length ? ' ' + clean.join(' ') : ''}${self}>`;
  });
  return s.slice(0, 60000);
}

export function sanitizeCss(css) {
  let s = String(css || '');
  s = s.replace(/<\/?style[^>]*>/gi, '');
  s = s.replace(/@import[^;]*;?/gi, '').replace(/@font-face\s*\{[^}]*\}/gi, '');
  s = s.replace(/expression\s*\(/gi, '(').replace(/javascript:/gi, '').replace(/behavior\s*:/gi, '');
  // url() only for the two placeholders or inline data images.
  s = s.replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi, (all, q, u) => (PLACEHOLDER.test(u.trim()) || /^data:image\//i.test(u.trim()) ? `url("${u.trim()}")` : 'none'));
  return s.slice(0, 40000);
}
