'use client';

import Link from 'next/link';
import { ArrowRight, Clock, MessageCircle } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { useT } from '@/lib/i18n';
import { SERVICES, serviceKey } from '@/lib/services';

export default function Explore() {
  const t = useT();
  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">{t('explore.title')}</h1>
      <p className="mt-1 text-muted">{t('explore.subtitle')}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s, i) => (
          <Link
            key={s.slug}
            href={`/services/${s.slug}`}
            className={`card group flex items-start gap-4 p-5 transition hover:border-gold/50 ${i === 0 ? 'border-gold/35 sm:col-span-2 lg:col-span-1' : ''}`}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/12 text-gold"><s.icon size={22} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg font-semibold text-ink">{t(serviceKey(s, 'title'))}</span>
              <span className="mt-0.5 block text-sm text-muted">{t(serviceKey(s, 'short'))}</span>
              <span className="mt-2 flex items-center gap-1 text-xs text-faint"><Clock size={12} /> {t(serviceKey(s, 'time'))}</span>
            </span>
            <ArrowRight size={18} className="mt-1 shrink-0 text-faint transition group-hover:text-gold" />
          </Link>
        ))}
      </div>

      <Link href="/chat?new=1" className="mt-6 flex items-center gap-4 rounded-3xl border border-violet/30 bg-violet/10 p-5 hover:border-violet/60">
        <MessageCircle size={22} className="shrink-0 text-violet" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-ink">{t('explore.notSure')}</span>
          <span className="block text-sm text-muted">{t('explore.notSureBody')}</span>
        </span>
        <ArrowRight size={18} className="shrink-0 text-violet" />
      </Link>
    </Shell>
  );
}
