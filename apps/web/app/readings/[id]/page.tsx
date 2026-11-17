'use client';

import Link from 'next/link';
import { Suspense, use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, MessageCircle, Printer, Trash2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { ReadingView } from '@/components/ReadingView';
import { BackLink, Spinner } from '@/components/ui';
import { gql } from '@/lib/gql';
import { READING_FIELDS } from '@/lib/fragments';
import { SERVICES, serviceByType } from '@/lib/services';
import type { Reading } from '@/lib/types';

function ReadingPageInner({ id }: { id: string }) {
  const router = useRouter();
  const fresh = useSearchParams().get('fresh');
  const [reading, setReading] = useState<Reading | null | undefined>(undefined);
  const [starting, setStarting] = useState(false);

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

  async function remove() {
    if (!confirm('Delete this reading? This cannot be undone.')) return;
    await gql(`mutation($id: ID!) { deleteReading(id: $id) }`, { id });
    router.push('/readings');
  }

  if (reading === undefined) return <Spinner />;
  if (reading === null) return <p className="text-muted">This reading could not be found. <Link href="/readings" className="text-gold">See all readings</Link>.</p>;

  const service = serviceByType(reading.type);
  const others = SERVICES.filter((s) => s.type !== reading.type).slice(0, 3);

  return (
    <div className="mx-auto max-w-4xl">
      <BackLink href="/readings" label="My readings" />
      {fresh && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
          <CheckCircle2 size={18} /> Your reading is ready and saved to "My readings".
        </div>
      )}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="chip mb-3"><service.icon size={14} className="text-gold" /> {service.title}</span>
          <h1 className="font-display text-4xl text-ink">{reading.title}</h1>
        </div>
        <div className="flex gap-2 print:hidden">
          <button className="btn-ghost" onClick={() => window.print()} title="Print or save as PDF"><Printer size={16} /></button>
          <button className="btn-ghost" onClick={remove} title="Delete"><Trash2 size={16} /></button>
        </div>
      </div>

      <ReadingView reading={reading} />

      <div className="card mt-10 flex flex-col items-center gap-4 border-gold/30 bg-gold/5 p-8 text-center print:hidden">
        <MessageCircle className="text-gold" size={28} />
        <div>
          <h2 className="font-display text-2xl text-ink">Have questions about this reading?</h2>
          <p className="mt-1 text-sm text-muted">Jyotaish already has it open. Ask what anything means, or what you can do next.</p>
        </div>
        <button className="btn-primary" onClick={discuss} disabled={starting}>{starting ? <Spinner /> : 'Discuss with Jyotaish'}</button>
      </div>

      <div className="mt-10 print:hidden">
        <h2 className="mb-4 font-display text-2xl text-ink">You might also like</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {others.map((s) => (
            <Link key={s.slug} href={`/services/${s.slug}`} className="card p-4 hover:border-gold/50">
              <s.icon size={20} className="mb-2 text-gold" />
              <p className="text-ink">{s.title}</p>
              <p className="text-xs text-muted">{s.short}</p>
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
