'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
import { Spinner } from '@/components/ui';
import { gql } from '@/lib/gql';

// Google sends the admin back here after they approve (or refuse) sending.
function GmailReturn() {
  const params = useSearchParams();
  const router = useRouter();
  const started = useRef(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const denied = params.get('error');
    const code = params.get('code');
    const state = params.get('state');
    if (denied || !code || !state) {
      setResult({ ok: false, message: denied === 'access_denied' ? 'You cancelled the Google approval, so Gmail was not connected.' : 'Google did not send back an approval. Please try again.' });
      return;
    }
    gql<{ connectGmail: { gmailAddress: string } }>(`mutation($c: String!, $s: String!, $r: String!) { connectGmail(code: $c, state: $s, redirectUri: $r) { gmailAddress } }`, {
      c: code,
      s: state,
      r: `${window.location.origin}/admin/settings/gmail`,
    })
      .then(({ connectGmail }) => {
        setResult({ ok: true, message: `Gmail is connected. Emails will be sent from ${connectGmail.gmailAddress}.` });
        setTimeout(() => router.replace('/admin/settings'), 2500);
      })
      .catch((e) => setResult({ ok: false, message: (e as Error).message }));
  }, [params, router]);

  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      {!result ? (
        <p className="flex items-center justify-center gap-3 text-muted"><Spinner /> Connecting Gmail…</p>
      ) : (
        <>
          {result.ok ? <CheckCircle2 className="mx-auto mb-3 text-ok" size={36} /> : <XCircle className="mx-auto mb-3 text-danger" size={36} />}
          <p className="text-ink">{result.message}</p>
          <Link href="/admin/settings" className="btn-ghost mt-6">Back to Settings</Link>
        </>
      )}
    </div>
  );
}

export default function GmailReturnPage() {
  return (
    <AdminShell>
      <Suspense>
        <GmailReturn />
      </Suspense>
    </AdminShell>
  );
}
