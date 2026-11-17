'use client';

import Link from 'next/link';
import { Suspense, use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, MessageCircle, Printer, Share2, Trash2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { ReadingView } from '@/components/ReadingView';
import { BackLink, Spinner } from '@/components/ui';
import { gql } from '@/lib/gql';
import { READING_FIELDS } from '@/lib/fragments';
import { SERVICES, serviceByType, serviceKey } from '@/lib/services';
import { useT } from '@/lib/i18n';
import type { Reading } from '@/lib/types';

function ReadingPageInner({ id }: { id: string }) {
  const router = useRouter();
  const fresh = useSearchParams().get('fresh');
  const t = useT();
  const [reading, setReading] = useState<Reading | null | undefined>(undefined);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    gql<{ reading: Reading | null }>(`query($id: ID!) { reading(id: $id) { ${READING_FIELDS} } }`, { id })
      .then((d) => setReading(d.reading))
      .catch(() => setReading(null));
  }, [id]);

  async function discuss() {
    setStarting(true);
    const { startConversation } = await gql(`mutation($id: ID) { startConversation(readingId: $id, topic: "reading") { id } }`, { id });
    router.push(`/chat/${startConversation.id}`);
  }

  // Shares the gist through the phone's share sheet (WhatsApp, Instagram...),
  // or copies it where sharing isn't available.
  async function share() {
    if (!reading) return;
    const gist = reading.interpretation.replace(/[#*_>`]/g, '').split('\n').find((l) => l.trim().length > 40)?.trim() ?? '';
    const text = `${reading.title}\n\n${gist.length > 280 ? `${gist.slice(0, 277)}…` : gist}\n\n${t('reading.shareFooter')}`;
    const url = window.location.origin;
    try {
      if (navigator.share) await navigator.share({ title: reading.title, text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setCopied(true);
      }
    } catch {
      // Closing the share sheet is not an error.
    }
  }

  async function remove() {
    if (!confirm(t('reading.confirmDelete'))) return;
    await gql(`mutation($id: ID!) { deleteReading(id: $id) }`, { id });
    router.push('/readings');
  }

  if (reading === undefined) return <Spinner />;
  if (reading === null) return <p className="text-muted">{t('reading.notFound')} <Link href="/readings" className="text-gold">{t('reading.seeAll')}</Link></p>;

  const service = serviceByType(reading.type);
  const others = SERVICES.filter((s) => s.type !== reading.type).slice(0, 3);

  return (
    <div className="mx-auto max-w-4xl">
      <BackLink href="/readings" label={t('nav.readings')} />
      {fresh && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
          <CheckCircle2 size={18} /> {t('reading.ready')}
        </div>
      )}
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="chip mb-3"><service.icon size={14} className="text-gold" /> {t(serviceKey(service, 'title'))}</span>
          <h1 className="font-display text-2xl font-semibold leading-tight text-ink sm:text-4xl">{reading.title}</h1>
        </div>
        <div className="flex gap-2 print:hidden">
          <button className="btn-primary flex-1 sm:flex-none" onClick={share}><Share2 size={16} /> {copied ? t('reading.copied') : t('reading.share')}</button>
          <button className="btn-ghost hidden sm:inline-flex" onClick={() => window.print()} title={t('reading.print')} aria-label={t('reading.print')}><Printer size={16} /></button>
          <button className="btn-ghost" onClick={remove} title={t('common.delete')} aria-label={t('common.delete')}><Trash2 size={16} /></button>
        </div>
      </div>

      <ReadingView reading={reading} />

      <div className="card mt-8 flex flex-col items-center gap-4 border-violet/30 bg-violet/[0.08] p-6 text-center sm:p-8 print:hidden">
        <MessageCircle className="text-violet" size={28} />
        <div>
          <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">{t('reading.questionsTitle')}</h2>
          <p className="mt-1 text-sm text-muted">{t('reading.questionsBody')}</p>
        </div>
        <button className="btn-primary w-full sm:w-auto" onClick={discuss} disabled={starting}>{starting ? <Spinner /> : t('reading.discuss')}</button>
      </div>

      <div className="mt-10 print:hidden">
        <h2 className="mb-4 font-display text-xl font-semibold text-ink">{t('reading.alsoLike')}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {others.map((s) => (
            <Link key={s.slug} href={`/services/${s.slug}`} className="card p-4 hover:border-gold/50">
              <s.icon size={20} className="mb-2 text-gold" />
              <p className="text-ink">{t(serviceKey(s, 'title'))}</p>
              <p className="text-xs text-muted">{t(serviceKey(s, 'short'))}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ReadingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Shell>
      <Suspense>
        <ReadingPageInner id={id} />
      </Suspense>
    </Shell>
  );
}
