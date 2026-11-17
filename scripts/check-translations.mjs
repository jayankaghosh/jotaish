// Checks every language against English: nothing missing, nothing extra, and
// every {placeholder} kept. Run: node scripts/check-translations.mjs [lang...]
import { existsSync, readFileSync } from 'node:fs';

const langs = process.argv.slice(2).length ? process.argv.slice(2) : ['hi', 'ml', 'kn', 'bn'];

// Pulls 'key': 'value' pairs out of a locale .ts file without running it.
function readLocale(file) {
  const src = readFileSync(file, 'utf8');
  const out = {};
  for (const m of src.matchAll(/^\s*(['"])((?:\\.|(?!\1).)+)\1\s*:\s*(['"`])((?:\\.|(?!\3)[\s\S])*)\3\s*,?\s*$/gm)) {
    out[m[2].replace(/\\'/g, "'")] = m[4].replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return out;
}

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const bold = (s) => (s.match(/\*\*/g) ?? []).length;

const en = { ...readLocale('apps/web/lib/locales/terms-en.ts'), ...readLocale('apps/web/lib/locales/en.ts') };
const serverEn = JSON.parse(readFileSync('apps/api/src/i18n/strings.json', 'utf8'));
let problems = 0;
const report = (lang, msg) => {
  problems++;
  console.log(`[${lang}] ${msg}`);
};

for (const lang of langs) {
  const webFile = `apps/web/lib/locales/${lang}.ts`;
  const apiFile = `apps/api/src/i18n/${lang}.json`;
  if (!existsSync(webFile)) report(lang, `missing ${webFile}`);
  else {
    const t = readLocale(webFile);
    for (const k of Object.keys(en)) {
      if (!(k in t)) report(lang, `website: missing "${k}"`);
      else {
        if (placeholders(en[k]) !== placeholders(t[k])) report(lang, `website: placeholders differ in "${k}": ${t[k]}`);
        if (!t[k].trim()) report(lang, `website: empty "${k}"`);
      }
    }
    for (const k of Object.keys(t)) if (!(k in en)) report(lang, `website: unknown key "${k}"`);
  }
  if (!existsSync(apiFile)) report(lang, `missing ${apiFile}`);
  else {
    let t;
    try {
      t = JSON.parse(readFileSync(apiFile, 'utf8'));
    } catch (e) {
      report(lang, `server: invalid JSON (${e.message})`);
      continue;
    }
    for (const s of serverEn) {
      if (!(s in t)) report(lang, `server: missing ${JSON.stringify(s)}`);
      else {
        if (placeholders(s) !== placeholders(t[s])) report(lang, `server: placeholders differ in ${JSON.stringify(s)}: ${t[s]}`);
        if (bold(s) !== bold(t[s])) report(lang, `server: **bold** markers differ in ${JSON.stringify(s)}`);
      }
    }
  }
}

console.log(problems ? `${problems} problem(s)` : `All good: ${langs.join(', ')}`);
process.exit(problems ? 1 : 0);
