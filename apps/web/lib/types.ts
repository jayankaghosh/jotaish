export type ReadingType = 'BIRTH_CHART' | 'HOROSCOPE' | 'TAROT' | 'NUMEROLOGY' | 'PALM' | 'DREAM' | 'COMPATIBILITY';

export interface BirthProfile {
  id: string;
  name: string;
  relation: string;
  gender?: string | null;
  birthDate: string;
  birthTime?: string | null;
  birthPlace: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  disabled: boolean;
  createdAt: string;
  lastSeenAt?: string | null;
  profiles: BirthProfile[];
  readingCount: number;
  conversationCount: number;
}

export interface Reading {
  id: string;
  type: ReadingType;
  title: string;
  input: any;
  data: any;
  interpretation: string;
  model?: string | null;
  createdAt: string;
  conversationId?: string | null;
  profile?: BirthProfile | null;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  imageDataUrl?: string | null;
  toolName?: string | null;
  toolCalls?: any;
  model?: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string | null;
  messages?: Message[];
}

export interface Place {
  name: string;
  label: string;
  latitude: number;
  longitude: number;
  timezone: string;
}
