'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { ErrorNote, Spinner, formatDate } from '@/components/ui';
import { gql } from '@/lib/gql';
import { PAYMENTS_CHANGED } from './AdminShell';
import type { PaymentRequest } from '@/lib/types';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function PaymentCard({ payment, onZoom, onReviewed, showUser = true }: { payment: PaymentRequest; onZoom: (src: string) => void; onReviewed: () => void; showUser?: boolean }) {
  const [credits, setCredits] = useState(String(payment.credits));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function review(approve: boolean) {
    if (!approve && !note.trim()) {
      setError('Please write the reason for rejecting. The customer will see it.');
      return;
    }
    if (!approve && !confirm('Reject this payment? No credits will be added and the customer will see your reason.')) return;
    setBusy(approve ? 'approve' : 'reject');
    setError(null);
    try {
      await gql(`mutation($id: ID!, $a: Boolean!, $c: Int, $n: String) { reviewPayment(id: $id, approve: $a, credits: $c, note: $n) { id } }`, {
        id: payment.id,
        a: approve,
        c: approve ? Number(credits) : null,
        n: note || null,
      });
      window.dispatchEvent(new Event(PAYMENTS_CHANGED));
      onReviewed();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="card flex gap-4 p-4">
      <button type="button" onClick={() => payment.screenshot && onZoom(payment.screenshot)} className="shrink-0" title="View full screenshot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={payment.screenshot} alt="Payment screenshot" className="h-40 w-28 rounded-lg border border-line object-cover" />
      </button>
      <div className="min-w-0 flex-1 space-y-2 text-sm">
        {showUser && payment.user && (
          <Link href={`/admin/users/${payment.user.id}`} className="block truncate text-gold-soft hover:underline">{payment.user.name} <span className="text-faint">{payment.user.email}</span></Link>
        )}
        <p className="text-ink"><span className="font-display text-2xl">{inr(payment.rupees)}</span> for {payment.credits.toLocaleString('en-IN')} credits</p>
        <p className="text-xs text-faint">Sent {formatDate(payment.createdAt, true)}{payment.reviewedAt ? ` · reviewed ${formatDate(payment.reviewedAt, true)}` : ''}</p>
        {payment.status === 'pending' ? (
          <>
            <div className="flex gap-2">
              <input className="input !w-28 !py-2" inputMode="numeric" value={credits} onChange={(e) => setCredits(e.target.value.replace(/[^\d]/g, ''))} aria-label="Credits to add" title="Credits to add" />
              <input className="input !py-2" placeholder="Reason (required to reject, shown to the customer)" value={note} onChange={(e) => { setNote(e.target.value); setError(null); }} />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary !py-2" onClick={() => review(true)} disabled={busy !== null || !Number(credits)}>{busy === 'approve' ? <Spinner /> : <Check size={16} />} Approve and add credits</button>
              <button className="btn-danger !py-2" onClick={() => review(false)} disabled={busy !== null}>{busy === 'reject' ? <Spinner /> : <X size={16} />} Reject</button>
            </div>
            <ErrorNote message={error} />
          </>
        ) : (
          <p>
            {payment.status === 'approved' ? (
              <span className="chip border-ok/40 text-ok">Approved · {(payment.creditsAdded ?? payment.credits).toLocaleString('en-IN')} credits added</span>
            ) : (
              <span className="chip border-danger/40 text-danger">Rejected</span>
            )}
            {payment.note && <span className="mt-1 block text-xs text-muted">{payment.status === 'rejected' ? 'Reason: ' : ''}{payment.note}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
