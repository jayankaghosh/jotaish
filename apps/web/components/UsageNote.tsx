'use client';

import Link from 'next/link';
import { Hourglass } from 'lucide-react';
import type { Usage } from '@/lib/types';

const ALLOWANCE = { day: "today's allowance", month: "this month's allowance", total: 'your allowance' } as const;

// Customers see a percentage, never credits or prices.
export function usageLine(usage: Usage | null | undefined): string | null {
  if (!usage || usage.percentLeft === null) return null;
  return `${usage.percentLeft}% of ${ALLOWANCE[usage.period]} left`;
}

export function isOutOfAllowance(usage: Usage | null | undefined) {
  return Boolean(usage && usage.remaining !== null && usage.remaining <= 0);
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
        {refreshText(usage)} Everything you've received so far is saved, and you can read it any time.
      </p>
      <Link href="/readings" className="btn-ghost mt-1">Open My readings</Link>
    </div>
  );
}
