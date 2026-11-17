import type { User } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { prisma } from '../lib/db';

// Allowances are measured in credits so heavier models and longer readings
// use more of them. One credit is a tenth of a cent of model cost.
export const CREDIT_USD = 0.001;

export type LimitPeriod = 'day' | 'month' | 'total';

export interface LimitSettings {
  // Credits per period. Null means unlimited.
  limit: number | null;
  period: LimitPeriod;
}

const SETTING = 'credit_allowance';
const DEFAULTS: LimitSettings = { limit: 200, period: 'day' };

export async function getLimitSettings(): Promise<LimitSettings> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING } });
  return row ? { ...DEFAULTS, ...JSON.parse(row.value) } : DEFAULTS;
}

export async function setLimitSettings(input: { limit?: number | null; period?: string | null }) {
  const current = await getLimitSettings();
  const next: LimitSettings = {
    limit: input.limit === undefined ? current.limit : input.limit === null ? null : Math.max(0, Math.floor(input.limit)),
    period: input.period === 'month' || input.period === 'total' || input.period === 'day' ? input.period : current.period,
  };
  const value = JSON.stringify(next);
  await prisma.setting.upsert({ where: { key: SETTING }, create: { key: SETTING, value }, update: { value } });
  return next;
}

// Periods follow UTC so every user resets at the same moment.
function periodWindow(period: LimitPeriod, now = new Date()) {
  if (period === 'day') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return { start, resetsAt: new Date(start.getTime() + 24 * 3600 * 1000) };
  }
  if (period === 'month') {
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
    };
  }
  return { start: null, resetsAt: null };
}

export interface Usage {
  used: number;
  limit: number | null;
  remaining: number | null;
  percentLeft: number | null;
  spentUsd: number;
  period: LimitPeriod;
  resetsAt: Date | null;
  source: 'default' | 'custom' | 'unlimited' | 'admin';
}

export async function usageFor(user: Pick<User, 'id' | 'role' | 'creditLimit' | 'unlimitedCredits'>): Promise<Usage> {
  const settings = await getLimitSettings();
  const { start, resetsAt } = periodWindow(settings.period);
  // Every AI call made for this person counts, including reports written
  // inside a chat and conversation titles.
  const spent = await prisma.aiUsage.aggregate({
    _sum: { cost: true },
    where: { userId: user.id, ...(start ? { createdAt: { gte: start } } : {}) },
  });
  const spentUsd = spent._sum.cost ?? 0;
  const used = Math.ceil(spentUsd / CREDIT_USD);

  let limit: number | null;
  let source: Usage['source'];
  if (user.role === 'ADMIN') {
    limit = null;
    source = 'admin';
  } else if (user.unlimitedCredits) {
    limit = null;
    source = 'unlimited';
  } else if (user.creditLimit !== null) {
    limit = user.creditLimit;
    source = 'custom';
  } else {
    limit = settings.limit;
    source = 'default';
  }
  const remaining = limit === null ? null : Math.max(0, limit - used);
  const percentLeft = limit === null ? null : limit === 0 ? 0 : Math.floor((remaining! / limit) * 100);
  return { used, limit, remaining, percentLeft, spentUsd, period: settings.period, resetsAt, source };
}

function limitMessage(usage: Usage) {
  if (usage.period === 'day') {
    return "You've used today's consultation allowance. It refreshes tomorrow, and everything you've received so far is saved in My readings.";
  }
  if (usage.period === 'month') {
    const when = usage.resetsAt!.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    return `You've used this month's consultation allowance. It refreshes on ${when}, and everything you've received so far is saved in My readings.`;
  }
  return "You've used the consultation allowance included with your account. Everything you've received so far is saved in My readings.";
}

// Throws a friendly error once the allowance is used up. A single reply can
// go slightly over; the next one is then refused.
export async function assertCanInteract(user: User) {
  const usage = await usageFor(user);
  if (usage.remaining !== null && usage.remaining <= 0) {
    throw new GraphQLError(limitMessage(usage), { extensions: { code: 'LIMIT_REACHED' } });
  }
}
