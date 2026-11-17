import { Hand, Heart, Hash, Moon, Sparkles, Sun, Layers } from 'lucide-react';
import type { ReadingType } from './types';

export interface Service {
  slug: string;
  type: ReadingType;
  title: string;
  short: string;
  description: string;
  icon: typeof Sun;
  needsBirth: boolean;
  time: string;
  askPrompt: string;
}

export const SERVICES: Service[] = [
  {
    slug: 'kundli',
    type: 'BIRTH_CHART',
    title: 'Kundli (Birth chart)',
    short: 'Your complete Vedic birth chart',
    description: 'We calculate where every planet was at the moment you were born, then explain your ascendant, Moon sign, nakshatra, yogas, doshas and the dasha period you are in now.',
    icon: Sun,
    needsBirth: true,
    time: 'About a minute',
    askPrompt: 'Can you prepare my Kundli and explain it?',
  },
  {
    slug: 'horoscope',
    type: 'HOROSCOPE',
    title: 'Horoscope',
    short: 'Today, this week or this month',
    description: 'A personal forecast based on where the planets are right now and your Moon sign (Vedic) or Sun sign (Western).',
    icon: Sparkles,
    needsBirth: false,
    time: 'About 20 seconds',
    askPrompt: 'What does today look like for me?',
  },
  {
    slug: 'matching',
    type: 'COMPATIBILITY',
    title: 'Compatibility',
    short: 'Kundli matching for two people',
    description: 'Compare two birth charts for love or marriage: Moon signs, nakshatras, Venus and Mars, the 7th house and Manglik status.',
    icon: Heart,
    needsBirth: true,
    time: 'About a minute',
    askPrompt: 'I want to check compatibility with my partner.',
  },
  {
    slug: 'tarot',
    type: 'TAROT',
    title: 'Tarot reading',
    short: 'Draw cards for a question',
    description: 'Focus on a question, choose a spread and we shuffle a full 78-card deck for you. Each card is explained in its position.',
    icon: Layers,
    needsBirth: false,
    time: 'About 30 seconds',
    askPrompt: 'Can you do a tarot reading for me?',
  },
  {
    slug: 'numerology',
    type: 'NUMEROLOGY',
    title: 'Numerology',
    short: 'Your name and birth numbers',
    description: 'Life Path, Expression and Soul Urge numbers, plus the Indian Mulank and Bhagyank with their ruling planets and lucky numbers.',
    icon: Hash,
    needsBirth: false,
    time: 'About 30 seconds',
    askPrompt: 'What do my numbers say about me?',
  },
  {
    slug: 'palm',
    type: 'PALM',
    title: 'Palm reading',
    short: 'Upload a photo of your palm',
    description: 'Take a clear photo of your open palm and we read the heart, head, life and fate lines, the mounts and the shape of your hand.',
    icon: Hand,
    needsBirth: false,
    time: 'About 30 seconds',
    askPrompt: 'Can you read my palm?',
  },
  {
    slug: 'dream',
    type: 'DREAM',
    title: 'Dream interpretation',
    short: 'What was your dream telling you?',
    description: 'Describe a dream and we explain its symbols through Swapna Shastra and modern psychology, and what it may reflect in your life.',
    icon: Moon,
    needsBirth: false,
    time: 'About 30 seconds',
    askPrompt: 'I had a dream I want to understand.',
  },
];

export const serviceBySlug = (slug: string) => SERVICES.find((s) => s.slug === slug);
export const serviceByType = (type: ReadingType) => SERVICES.find((s) => s.type === type)!;

export const ZODIAC = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];
