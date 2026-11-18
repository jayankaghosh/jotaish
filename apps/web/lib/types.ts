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
  language?: string;
  emailVerified?: boolean;
  creditLimit?: number | null;
  unlimitedCredits?: boolean;
  usage?: Usage | null;
}

export interface Usage {
  used: number;
  limit: number | null;
  remaining: number | null;
  percentLeft: number | null;
  spentUsd: number;
  balance: number;
  period: 'day' | 'month' | 'total';
  resetsAt: string | null;
  source: 'default' | 'custom' | 'unlimited' | 'admin';
}

export interface Reading {
  id: string;
  type: ReadingType;
  title: string;
  input: any;
  data: any;
  interpretation: string;
  model?: string | null;
  generationMs?: number | null;
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

export interface CreditPack {
  rupees: number;
  credits: number;
}

export interface PaymentRequest {
  id: string;
  credits: number;
  rupees: number;
  screenshot?: string;
  status: 'pending' | 'approved' | 'rejected';
  creditsAdded?: number | null;
  note?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  user?: Pick<User, 'id' | 'name' | 'email'> | null;
}
