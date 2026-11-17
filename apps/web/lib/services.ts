import { Hand, Heart, Hash, Moon, Sparkles, Sun, Layers } from 'lucide-react';
import type { MessageKey } from './i18n';
import type { ReadingType } from './types';

export interface Service {
  slug: 'kundli' | 'horoscope' | 'matching' | 'tarot' | 'numerology' | 'palm' | 'dream';
  type: ReadingType;
  icon: typeof Sun;
  needsBirth: boolean;
}

export const SERVICES: Service[] = [
  { slug: 'kundli', type: 'BIRTH_CHART', icon: Sun, needsBirth: true },
  { slug: 'horoscope', type: 'HOROSCOPE', icon: Sparkles, needsBirth: false },
  { slug: 'matching', type: 'COMPATIBILITY', icon: Heart, needsBirth: true },
  { slug: 'tarot', type: 'TAROT', icon: Layers, needsBirth: false },
  { slug: 'numerology', type: 'NUMEROLOGY', icon: Hash, needsBirth: false },
  { slug: 'palm', type: 'PALM', icon: Hand, needsBirth: false },
  { slug: 'dream', type: 'DREAM', icon: Moon, needsBirth: false },
];

// Words for a service live in the dictionaries, e.g. service.kundli.title.
export const serviceKey = (s: Service, field: 'title' | 'short' | 'description' | 'time' | 'ask') => `service.${s.slug}.${field}` as MessageKey;

export const serviceBySlug = (slug: string) => SERVICES.find((s) => s.slug === slug);
export const serviceByType = (type: ReadingType) => SERVICES.find((s) => s.type === type)!;

export const ZODIAC = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];
