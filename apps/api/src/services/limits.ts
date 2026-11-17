import type { User } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { prisma } from '../lib/db';
import { currentLang, tr } from '../i18n';
import { emailCreditsExhausted } from './notifications';

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
  // Bought or granted credits left, used after the free allowance.
  balance: number;
  period: LimitPeriod;
  resetsAt: Date | null;
  source: 'default' | 'custom' | 'unlimited' | 'admin';
}

type UsageUser = Pick<User, 'id' | 'role' | 'creditLimit' | 'unlimitedCredits' | 'creditBalance'>;

export async function usageFor(user: UsageUser): Promise<Usage> {
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
  return { used, limit, remaining, percentLeft, spentUsd, balance: Math.floor(user.creditBalance), period: settings.period, resetsAt, source };
}

function limitMessage(usage: Usage) {
  const buy = tr('You can buy more credits from the Credits page to continue right away.');
  if (usage.period === 'day') return `${tr("You've used today's free allowance. It refreshes tomorrow.")} ${buy}`;
  if (usage.period === 'month') {
    const when = usage.resetsAt!.toLocaleDateString(`${currentLang()}-IN`, { day: 'numeric', month: 'long', timeZone: 'UTC' });
    return `${tr("You've used this month's free allowance. It refreshes on {date}.", { date: when })} ${buy}`;
  }
  return `${tr("You've used the free allowance included with your account.")} ${buy}`;
}

export function isOutOfCredits(usage: Usage) {
  return usage.remaining !== null && usage.remaining <= 0 && usage.balance <= 0;
}

// Throws a friendly error once both the free allowance and any bought
// credits are used up. A single reply can go slightly over; the next one is
// then refused.
export async function assertCanInteract(user: User) {
  const usage = await usageFor(user);
  if (isOutOfCredits(usage)) {
    throw new GraphQLError(limitMessage(usage), { extensions: { code: 'LIMIT_REACHED' } });
  }
}

// Called after each AI call is recorded: whatever part of it went beyond the
// free allowance is taken from the user's bought credits.
export async function chargeOverflow(userId: string, costUsd: number) {
  if (costUsd <= 0) return;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.creditBalance <= 0) return;
  const usage = await usageFor(user);
  if (usage.limit === null) return;
  const callCredits = costUsd / CREDIT_USD;
  const usedAfter = usage.spentUsd / CREDIT_USD;
  const usedBefore = usedAfter - callCredits;
  const overflow = usedAfter - Math.max(usage.limit, usedBefore);
  if (overflow <= 0) return;
  const balance = Math.max(0, user.creditBalance - overflow);
  await prisma.user.update({ where: { id: userId }, data: { creditBalance: balance } });
  // Tell the admins once, at the moment the last credit goes.
  if (balance < 1 && user.creditBalance >= 1) emailCreditsExhausted(user);
}
