// Bundles the method and design prompts in prompts/*.md into lib/server/prompts.json.
// Runs before `npm run dev` and `npm run build`; edit the .md files, not the JSON.
import { readFileSync, writeFileSync } from 'node:fs';

const read = (n) => readFileSync(new URL(`../prompts/${n}`, import.meta.url), 'utf8').trim();
const intro = read('00-intro.md');
const tail = read('copy-and-output.md');
const methods = { presold: read('method-presold.md'), '100m': read('method-100m-offers.md') };
const designs = { classic: read('design-classic.md'), free: read('design-free.md'), device: read('design-device.md') };
const out = {};
for (const [m, method] of Object.entries(methods)) {
  for (const [d, design] of Object.entries(designs)) out[`${m}:${d}`] = [intro, method, design, tail].join('\n\n');
}
for (const [m, method] of Object.entries(methods)) out[`method:${m}`] = method;
out.copy = tail;
out.core = intro;
writeFileSync(new URL('../lib/server/prompts.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('prompts bundled');
