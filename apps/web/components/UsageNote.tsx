'use client';

import Link from 'next/link';
import { Coins, Hourglass } from 'lucide-react';
import type { Usage } from '@/lib/types';

const ALLOWANCE = { day: "today's free allowance", month: "this month's free allowance", total: 'your free allowance' } as const;

export const formatCredits = (n: number) => n.toLocaleString('en-IN');

// Customers see their free allowance as a percentage and bought credits as a
// number, never costs.
export function usageLine(usage: Usage | null | undefined): string | null {
  if (!usage || usage.percentLeft === null) return null;
  const free = `${usage.percentLeft}% of ${ALLOWANCE[usage.period]} left`;
  if (usage.balance <= 0) return free;
  if (usage.percentLeft === 0) return `Using your credits: ${formatCredits(usage.balance)} left`;
  return `${free} · ${formatCredits(usage.balance)} credits`;
}

export function isOutOfAllowance(usage: Usage | null | undefined) {
  return Boolean(usage && usage.remaining !== null && usage.remaining <= 0 && usage.balance <= 0);
}

function refreshText(usage: Usage) {
  if (usage.period === 'day') return 'It refreshes tomorrow.';
  if (usage.period === 'month' && usage.resetsAt) {
    return `It refreshes on ${new Date(usage.resetsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}.`;
  }
  return '';
}

// Shown in place of a form or chat box once the person has used everything.
export function OutOfAllowance({ usage }: { usage: Usage }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold/30 bg-gold/5 p-6 text-center">
      <Hourglass className="text-gold" size={28} />
      <p className="font-display text-2xl text-ink">You've used {ALLOWANCE[usage.period]}</p>
      <p className="max-w-md text-sm text-muted">
        {refreshText(usage)} To continue now, you can buy credits. Everything you've received so far is saved in My readings.
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <Link href="/credits" className="btn-primary"><Coins size={16} /> Buy credits</Link>
        <Link href="/readings" className="btn-ghost">Open My readings</Link>
      </div>
    </div>
  );
}
