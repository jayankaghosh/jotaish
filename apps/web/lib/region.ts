import type { ChartStyle } from '@/components/charts';
import type { Lang } from './i18n';

const KEY = 'jotaish_region';

// A sensible first guess from the language, until the person picks one.
const BY_LANGUAGE: Record<Lang, ChartStyle> = { en: 'north', hi: 'north', ml: 'south', kn: 'south', bn: 'east' };

export function preferredRegion(lang: Lang): ChartStyle {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'north' || saved === 'south' || saved === 'east') return saved;
  } catch {}
  return BY_LANGUAGE[lang];
}

export function rememberRegion(region: ChartStyle) {
  try {
    localStorage.setItem(KEY, region);
  } catch {}
}
