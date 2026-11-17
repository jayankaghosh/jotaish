'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { PaymentCard } from '@/components/PaymentCard';
import { PageTitle, Spinner } from '@/components/ui';
import { gql } from '@/lib/gql';
import type { PaymentRequest } from '@/lib/types';

const TABS = [
  ['pending', 'Waiting for review'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['all', 'All'],
] as const;

const PAGE = 20;

export default function AdminPayments() {
  const [status, setStatus] = useState<(typeof TABS)[number][0]>('pending');
  const [skip, setSkip] = useState(0);
  const [data, setData] = useState<{ total: number; items: PaymentRequest[] } | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const load = useCallback(() => {
    gql<{ adminPayments: { total: number; items: PaymentRequest[] } }>(
      `query($s: String, $skip: Int, $take: Int) { adminPayments(status: $s, skip: $skip, take: $take) { total items { id credits rupees screenshot status creditsAdded note createdAt reviewedAt user { id name email } } } }`,
      { s: status, skip, take: PAGE },
    ).then((d) => setData(d.adminPayments));
  }, [status, skip]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  return (
    <AdminShell>
      <PageTitle title="Payments" subtitle="Payment screenshots sent by customers. Check each one against your UPI app, then approve it to add the credits, or reject it with a reason the customer will see." />
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => { setStatus(key); setSkip(0); }} className={`chip px-4 py-2 text-sm ${status === key ? 'border-gold text-gold-soft' : ''}`}>{label}</button>
        ))}
      </div>

      {!data ? <Spinner /> : data.items.length === 0 ? (
        <p className="card p-8 text-center text-muted">{status === 'pending' ? 'Nothing waiting. All payments have been reviewed.' : 'No payments here yet.'}</p>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.items.map((p) => <PaymentCard key={p.id} payment={p} onZoom={setZoom} onReviewed={load} />)}
          </div>
          <div className="mt-6 flex items-center justify-between text-sm text-muted">
            <span>{data.total} payments</span>
            <div className="flex gap-2">
              <button className="btn-ghost !py-1.5" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))}>Previous</button>
              <button className="btn-ghost !py-1.5" disabled={skip + PAGE >= data.total} onClick={() => setSkip(skip + PAGE)}>Next</button>
            </div>
          </div>
        </>
      )}

      {zoom && (
        <button className="fixed inset-0 z-50 flex items-center justify-center bg-night/90 p-4" onClick={() => setZoom(null)} aria-label="Close screenshot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Payment screenshot" className="max-h-full max-w-full rounded-xl" />
        </button>
      )}
    </AdminShell>
  );
}
