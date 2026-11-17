import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const LANGS = ['en', 'hi', 'ml', 'kn', 'bn'] as const;
export type Lang = (typeof LANGS)[number];

// Names used when asking the language model to write in a language.
export const LANGUAGE_NAMES: Record<Lang, string> = {
  en: 'English',
  hi: 'Hindi (Devanagari script)',
  ml: 'Malayalam (Malayalam script)',
  kn: 'Kannada (Kannada script)',
  bn: 'Bengali (Bengali script)',
};

export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);
export const toLang = (v: unknown): Lang => (isLang(v) ? v : 'en');

// Translations are keyed by the English text itself, so code stays readable
// and anything not yet translated simply shows in English.
const dir = path.dirname(fileURLToPath(import.meta.url));
const dictionaries: Partial<Record<Lang, Record<string, string>>> = {};
for (const lang of LANGS) {
  const file = path.join(dir, `${lang}.json`);
  if (lang !== 'en' && existsSync(file)) dictionaries[lang] = JSON.parse(readFileSync(file, 'utf8'));
}

// The language of the request being handled, so errors raised deep inside a
// service come out in the right language without passing it everywhere.
const store = new AsyncLocalStorage<Lang>();

export function withLang<T>(lang: Lang, fn: () => T): T {
  return store.run(lang, fn);
}

export function currentLang(): Lang {
  return store.getStore() ?? 'en';
}

type Vars = Record<string, string | number>;

export function tr(text: string, vars?: Vars, lang: Lang = currentLang()): string {
  const template = (lang !== 'en' && dictionaries[lang]?.[text]) || text;
  return vars ? template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : template;
}
