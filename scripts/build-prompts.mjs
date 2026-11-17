// Bundles the method and design prompts in prompts/*.md into lib/server/prompts.json.
// Runs before `npm run dev` and `npm run build`; edit the .md files, not the JSON.
import { readFileSync, writeFileSync } from 'node:fs';

const read = (n) => readFileSync(new URL(`../prompts/${n}`, import.meta.url), 'utf8').trim();
const intro = read('00-intro.md');
const design = read('design-rules.md');
const out = {
  presold: [intro, read('method-presold.md'), design].join('\n\n'),
  '100m': [intro, read('method-100m-offers.md'), design].join('\n\n'),
};
writeFileSync(new URL('../lib/server/prompts.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('prompts bundled');
