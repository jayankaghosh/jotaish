'use client';

import Link from 'next/link';
import { Coins, Hourglass } from 'lucide-react';
import { formatDayMonth } from '@/lib/dates';
import { useT, type MessageKey } from '@/lib/i18n';
import type { Usage } from '@/lib/types';

const ALLOWANCE: Record<Usage['period'], MessageKey> = { day: 'usage.allowance.day', month: 'usage.allowance.month', total: 'usage.allowance.total' };

export const formatCredits = (n: number) => n.toLocaleString('en-IN');

// Customers see their free allowance as a percentage and bought credits as a
// number, never costs.
export function useUsageLine() {
  const t = useT();
  return (usage: Usage | null | undefined): string | null => {
    if (!usage || usage.percentLeft === null) return null;
    const free = t('usage.percentLeft', { percent: usage.percentLeft, allowance: t(ALLOWANCE[usage.period]) });
    if (usage.balance <= 0) return free;
    if (usage.percentLeft === 0) return t('usage.usingCredits', { credits: formatCredits(usage.balance) });
    return `${free} · ${t('usage.credits', { credits: formatCredits(usage.balance) })}`;
  };
}

export function isOutOfAllowance(usage: Usage | null | undefined) {
  return Boolean(usage && usage.remaining !== null && usage.remaining <= 0 && usage.balance <= 0);
}

// Shown in place of a form or chat box once the person has used everything.
export function OutOfAllowance({ usage }: { usage: Usage }) {
  const t = useT();
  const refresh =
    usage.period === 'day' ? t('usage.refreshTomorrow') : usage.period === 'month' && usage.resetsAt ? t('usage.refreshOn', { date: formatDayMonth(usage.resetsAt) }) : '';
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold/30 bg-gold/5 p-6 text-center">
      <Hourglass className="text-gold" size={28} />
      <p className="font-display text-2xl text-ink">{t('usage.usedUp', { allowance: t(ALLOWANCE[usage.period]) })}</p>
      <p className="max-w-md text-sm text-muted">{refresh} {t('usage.buyHint')}</p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <Link href="/credits" className="btn-primary"><Coins size={16} /> {t('usage.buy')}</Link>
        <Link href="/readings" className="btn-ghost">{t('usage.openReadings')}</Link>
      </div>
    </div>
  );
}
