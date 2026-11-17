import type { Usage } from './types';

// What a person can still spend: the rest of their free allowance plus any
// bought or granted credits. Null means they have no limit.
export function creditsLeft(usage: Pick<Usage, 'limit' | 'remaining' | 'balance'>): number | null {
  if (usage.limit === null) return null;
  return (usage.remaining ?? 0) + usage.balance;
}
