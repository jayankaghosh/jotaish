'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { EmptyState, PageTitle, Spinner, formatDate } from '@/components/ui';
import { gql } from '@/lib/gql';
import { READING_SUMMARY } from '@/lib/fragments';
import { SERVICES, serviceByType } from '@/lib/services';
import type { Reading, ReadingType } from '@/lib/types';

export default function ReadingsPage() {
  const [readings, setReadings] = useState<Reading[] | null>(null);
  const [filter, setFilter] = useState<ReadingType | null>(null);

  useEffect(() => {
    gql<{ myReadings: Reading[] }>(`{ myReadings { ${READING_SUMMARY} } }`).then((d) => setReadings(d.myReadings)).catch(() => setReadings([]));
  }, []);

  const shown = readings?.filter((r) => !filter || r.type === filter) ?? [];
  const types = new Set(readings?.map((r) => r.type));

  return (
    <Shell>
      <PageTitle title="My readings" subtitle="Every Kundli, horoscope and reading you've received is kept here, so you can return to it whenever you like." />
      {!readings && <Spinner />}
      {readings && readings.length === 0 && (
        <EmptyState
          icon={<BookOpen size={28} />}
          title="No readings yet"
          body="Your first reading is just a few taps away. Most people start with their Kundli."
          action={<Link href="/services/kundli" className="btn-primary">Prepare my Kundli</Link>}
        />
      )}
      {readings && readings.length > 0 && (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            <button onClick={() => setFilter(null)} className={`chip px-4 py-1.5 text-sm ${!filter ? 'border-gold text-gold-soft' : ''}`}>All ({readings.length})</button>
            {SERVICES.filter((s) => types.has(s.type)).map((s) => (
              <button key={s.type} onClick={() => setFilter(s.type)} className={`chip px-4 py-1.5 text-sm ${filter === s.type ? 'border-gold text-gold-soft' : ''}`}>{s.title}</button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((r) => {
              const s = serviceByType(r.type);
              return (
                <Link key={r.id} href={`/readings/${r.id}`} className="card p-5 transition hover:border-gold/50">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="chip"><s.icon size={14} className="text-gold" /> {s.title}</span>
                    <span className="text-xs text-faint">{formatDate(r.createdAt)}</span>
                  </div>
                  <h3 className="font-display text-xl text-ink">{r.title}</h3>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </Shell>
  );
}
