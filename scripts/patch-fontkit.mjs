// fontkit (used by pdfkit) crashes on mark anchors that some Noto fonts leave
// empty, for example the Malayalam conjunct in "സ്ത്രീ". Treat a missing
// anchor as zero offset instead. Runs after every install; safe to repeat.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const MARKER = '// patched: missing anchor';
const FIND = 'getAnchor(anchor) {';
const REPLACE = `getAnchor(anchor) {\n        if (!anchor) return { x: 0, y: 0 }; ${MARKER}`;

for (const file of ['main.cjs', 'module.mjs']) {
  const target = path.join('node_modules', 'fontkit', 'dist', file);
  if (!existsSync(target)) continue;
  const source = readFileSync(target, 'utf8');
  if (source.includes(MARKER)) continue;
  if (!source.includes(FIND)) {
    console.warn(`patch-fontkit: ${target} has changed; patch not applied`);
    continue;
  }
  writeFileSync(target, source.replace(FIND, REPLACE));
  console.log(`patch-fontkit: patched ${target}`);
}
