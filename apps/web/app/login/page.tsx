'use client';

import Link from 'next/link';
import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthCard } from '@/components/AuthCard';
import { ErrorNote, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { GqlError, gql } from '@/lib/gql';
import { useT } from '@/lib/i18n';

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const { signIn } = useAuth();
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { login } = await gql(`mutation($email: String!, $password: String!) { login(email: $email, password: $password) { token } }`, { email, password });
      const user = await signIn(login.token);
      router.replace(next ?? (user?.profiles.length ? '/dashboard' : '/welcome'));
    } catch (err) {
      // Unconfirmed email: a code has just been sent, so go and enter it.
      if (err instanceof GqlError && err.code === 'EMAIL_NOT_VERIFIED') {
        router.replace(`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}${next ? `&next=${encodeURIComponent(next)}` : ''}`);
        return;
      }
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      footer={<>{t('auth.newHere')} <Link href="/register" className="text-gold hover:underline">{t('auth.createFree')}</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">{t('auth.email')}</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">{t('auth.password')}</label>
          <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <ErrorNote message={error} />
        <button className="btn-primary w-full py-3" disabled={busy}>
          {busy ? <Spinner /> : t('auth.signIn')}
        </button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
