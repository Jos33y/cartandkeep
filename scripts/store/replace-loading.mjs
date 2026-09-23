// scripts/replace-loading.mjs
// Swaps the bare "Loading" paragraph on portal pages for the page skeleton.
//   node scripts/replace-loading.mjs            show what would change
//   node scripts/replace-loading.mjs --write    change it

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const write = process.argv.includes('--write');
const IMPORT = "import { PageSkeleton } from '@components/ui/portal/Skeleton';";

// Whole pages only. Inside a component a full page skeleton is the wrong shape,
// so those are listed for a person to look at instead.
const PAGES = 'src/pages/portal';
const ELSEWHERE = ['src/components/ui/portal', 'src/components/layout/portal'];

const LOADING = /<p\s+className=\{styles\.status\}[^>]*>\s*Loading(?:\.\.\.|…)?\s*<\/p>/g;

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.jsx') ? [p] : [];
});

let changed = 0;

for (const file of walk(PAGES)) {
  const src = readFileSync(file, 'utf8');
  const hits = src.match(LOADING);
  if (!hits) continue;

  let out = src.replace(LOADING, '<PageSkeleton />');
  if (!out.includes('PageSkeleton }') && !out.includes(IMPORT)) {
    const imports = [...out.matchAll(/^import .*;$/gm)];
    const last = imports.at(-1);
    out = last
      ? out.slice(0, last.index + last[0].length) + `\n${IMPORT}` + out.slice(last.index + last[0].length)
      : `${IMPORT}\n${out}`;
  }

  changed += 1;
  console.log(`${write ? 'fixed' : 'would fix'}  ${file}  (${hits.length})`);
  if (write) writeFileSync(file, out);
}

for (const dir of ELSEWHERE) {
  for (const file of walk(dir)) {
    const n = (readFileSync(file, 'utf8').match(LOADING) ?? []).length;
    if (n) console.log(`look at     ${file}  (${n}, inside a component, left alone)`);
  }
}

console.log(changed ? `\n${changed} page${changed === 1 ? '' : 's'}${write ? ' changed' : ' to change. Run again with --write.'}` : 'No bare Loading left on any page.');
