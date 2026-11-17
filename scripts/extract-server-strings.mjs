// Lists every English sentence the API can show customers, for translators.
// Writes apps/api/src/i18n/strings.json; translations live next to it in
// <lang>.json files keyed by the same English text.
//
// Run: node scripts/extract-server-strings.mjs
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = 'apps/api/src';
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.ts')) files.push(p);
  }
})(root);

// Reads a quoted string starting at src[i]; returns [value, endIndex].
function readString(src, i) {
  const quote = src[i];
  let out = '';
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') {
      const n = src[++j];
      out += n === 'n' ? '\n' : n;
    } else if (c === quote) {
      return [out, j + 1];
    } else if (quote === '`' && c === '$' && src[j + 1] === '{') {
      // A template with expressions is not a fixed sentence: skip to its end.
      for (; j < src.length; j++) {
        if (src[j] === '\\') j++;
        else if (src[j] === '`') return [null, j + 1];
      }
      return [null, src.length];
    } else out += c;
  }
  return [null, src.length];
}

// The first argument of a call starting just after "(": every string in it,
// except ones that are only compared against (period === 'today' ? ...).
function firstArgStrings(src, i) {
  const strings = [];
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      const before = src.slice(Math.max(0, i - 5), i);
      const [value, end] = readString(src, i);
      if (value !== null && !/[=!]==?\s*$/.test(before)) strings.push(value);
      i = end - 1;
    } else if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) break;
      depth--;
    } else if (c === ',' && depth === 0) break;
  }
  return strings;
}

const found = new Set();
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  // tr(), userError(), and the local t() wrappers used in emails and PDFs.
  for (const m of src.matchAll(/\b(tr|userError|t)\(/g)) {
    if (m[1] === 't' && !/const t = \(/.test(src)) continue;
    for (const s of firstArgStrings(src, m.index + m[0].length)) found.add(s);
  }
  // Lookup tables whose values are passed through tr() later.
  for (const table of ['TOOL_STATUS', 'READING_NOUN', 'TYPE_LABEL']) {
    const block = src.match(new RegExp(`const ${table}[^{]*\\{([\\s\\S]*?)\\n\\};`));
    if (!block) continue;
    for (const m of block[1].matchAll(/:\s*(?=['"])/g)) {
      const [value] = readString(block[1], m.index + m[0].length);
      if (value) found.add(value);
    }
  }
}
found.add('Working on it…');

const list = [...found].filter((s) => s.trim()).sort();
writeFileSync(path.join(root, 'i18n', 'strings.json'), JSON.stringify(list, null, 2) + '\n');
console.log(`${list.length} strings`);
