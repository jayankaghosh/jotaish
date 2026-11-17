'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { EmptyState, PageTitle, Spinner, formatDate } from '@/components/ui';
import { gql } from '@/lib/gql';
import { READING_SUMMARY } from '@/lib/fragments';
import { SERVICES, serviceByType, serviceKey } from '@/lib/services';
import { useT } from '@/lib/i18n';
import type { Reading, ReadingType } from '@/lib/types';

export default function ReadingsPage() {
  const t = useT();
  const [readings, setReadings] = useState<Reading[] | null>(null);
  const [filter, setFilter] = useState<ReadingType | null>(null);

  useEffect(() => {
    gql<{ myReadings: Reading[] }>(`{ myReadings { ${READING_SUMMARY} } }`).then((d) => setReadings(d.myReadings)).catch(() => setReadings([]));
  }, []);

  const shown = readings?.filter((r) => !filter || r.type === filter) ?? [];
  const types = new Set(readings?.map((r) => r.type));

  return (
    <Shell>
      <PageTitle title={t('nav.readings')} subtitle={t('readings.subtitle')} />
      {!readings && <Spinner />}
      {readings && readings.length === 0 && (
        <EmptyState
          icon={<BookOpen size={28} />}
          title={t('readings.emptyTitle')}
          body={t('readings.emptyBody')}
          action={<Link href="/services/kundli" className="btn-primary">{t('dashboard.next.kundli.cta')}</Link>}
        />
      )}
      {readings && readings.length > 0 && (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            <button onClick={() => setFilter(null)} className={`chip px-4 py-1.5 text-sm ${!filter ? 'border-gold text-gold-soft' : ''}`}>{t('readings.all', { count: readings.length })}</button>
            {SERVICES.filter((s) => types.has(s.type)).map((s) => (
              <button key={s.type} onClick={() => setFilter(s.type)} className={`chip px-4 py-1.5 text-sm ${filter === s.type ? 'border-gold text-gold-soft' : ''}`}>{t(serviceKey(s, 'title'))}</button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((r) => {
              const s = serviceByType(r.type);
              return (
                <Link key={r.id} href={`/readings/${r.id}`} className="card p-5 transition hover:border-gold/50">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="chip"><s.icon size={14} className="text-gold" /> {t(serviceKey(s, 'title'))}</span>
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
