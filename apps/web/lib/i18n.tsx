'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import en from './locales/en';
import { gql } from './gql';
import { useAuth } from './auth';
import { setDateLocale } from './dates';

export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
] as const;

export type Lang = (typeof LANGUAGES)[number]['code'];
export type MessageKey = keyof typeof en;
export type Messages = Partial<Record<MessageKey, string>>;

export const LANG_KEY = 'jotaish_lang';
const isLang = (v: unknown): v is Lang => LANGUAGES.some((l) => l.code === v);

// Each language loads only when chosen, so visitors download one dictionary.
const LOADERS: Record<Lang, () => Promise<Messages>> = {
  en: async () => en,
  hi: () => import('./locales/hi').then((m) => m.default),
  ml: () => import('./locales/ml').then((m) => m.default),
  kn: () => import('./locales/kn').then((m) => m.default),
  bn: () => import('./locales/bn').then((m) => m.default),
};

// The language chosen on this device, if any.
function storedLang(): Lang | null {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

type Vars = Record<string, string | number>;

export function format(template: string, vars?: Vars) {
  return vars ? template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : template;
}

interface I18nState {
  lang: Lang;
  t: (key: MessageKey, vars?: Vars) => string;
  // Astrology terms coming from computed data, e.g. term('sign', 'Aries').
  term: (kind: 'sign' | 'rashi' | 'planet' | 'planetShort' | 'nakshatra' | 'dignity' | 'yoga' | 'tarot' | 'suit' | 'rank' | 'position' | 'relation' | 'feeling', value: string) => string;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nState | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lang, setLangState] = useState<Lang>('en');
  const [messages, setMessages] = useState<Messages>(en);

  useEffect(() => setLangState(storedLang() ?? 'en'), []);

  // A choice made on this device wins and is saved to the account (someone
  // may pick a language on the sign-in page). On a device with no choice yet,
  // the account's saved language is used.
  useEffect(() => {
    if (!user) return;
    const local = storedLang();
    if (!local) {
      if (isLang(user.language) && user.language !== 'en') {
        setLangState(user.language);
        try {
          localStorage.setItem(LANG_KEY, user.language);
        } catch {}
      }
    } else if (local !== user.language) {
      void gql(`mutation($l: String!) { updateMe(language: $l) { id } }`, { l: local }).catch(() => undefined);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    LOADERS[lang]().then((m) => !cancelled && setMessages(m));
    document.documentElement.lang = lang;
    setDateLocale(`${lang}-IN`);
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      try {
        localStorage.setItem(LANG_KEY, next);
      } catch {}
      if (user) void gql(`mutation($l: String!) { updateMe(language: $l) { id } }`, { l: next }).catch(() => undefined);
    },
    [user],
  );

  const t = useCallback((key: MessageKey, vars?: Vars) => format(messages[key] ?? en[key] ?? key, vars), [messages]);

  const term: I18nState['term'] = useCallback(
    (kind, value) => {
      const key = `${kind}.${value}` as MessageKey;
      return messages[key] ?? en[key] ?? value;
    },
    [messages],
  );

  return <I18nContext.Provider value={{ lang, t, term, setLang }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

export const useT = () => useI18n().t;

// New conversations are stored with this English title until they are named.
export const DEFAULT_CONVERSATION_TITLE = 'New consultation';
export function useConversationTitle() {
  const t = useT();
  return (title: string) => (title === DEFAULT_CONVERSATION_TITLE ? t('chat.newTitle') : title);
}
