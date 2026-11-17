'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminShell } from '@/components/AdminShell';
import { ReadingView } from '@/components/ReadingView';
import { ErrorNote, Spinner } from '@/components/ui';
import { gql } from '@/lib/gql';
import { ADMIN_READING_FIELDS } from '@/lib/fragments';
import type { Reading } from '@/lib/types';

export default function AdminReading({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [reading, setReading] = useState<Reading | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gql<{ adminReading: Reading }>(`query($id: ID!) { adminReading(id: $id) { ${ADMIN_READING_FIELDS} } }`, { id })
      .then((d) => setReading(d.adminReading))
      .catch((e) => setError(e.message));
  }, [id]);

  return (
    <AdminShell>
      <button onClick={() => router.back()} className="mb-6 text-sm text-muted hover:text-gold-soft">← Back</button>
      <ErrorNote message={error} />
      {!reading ? (!error && <Spinner />) : (
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-2 font-display text-4xl text-ink">{reading.title}</h1>
          <p className="mb-8 text-sm text-muted">Written by {reading.model ?? 'unknown model'}</p>
          <ReadingView reading={reading} />
          <details className="card mt-6 p-4 text-xs">
            <summary className="cursor-pointer text-muted">Raw input and computed data</summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-faint">{JSON.stringify({ input: { ...reading.input, imageDataUrl: reading.input.imageDataUrl ? '[photo]' : undefined }, data: reading.data }, null, 2)}</pre>
          </details>
        </div>
      )}
    </AdminShell>
  );
}
