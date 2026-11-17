'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { ErrorNote, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { gql } from '@/lib/gql';

function AdminLoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const { signIn, signOut } = useAuth();
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
      if (user?.role !== 'ADMIN') {
        signOut();
        throw new Error('This account does not have console access.');
      }
      router.replace(next?.startsWith('/admin') ? next : '/admin');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 pb-12 pt-[calc(env(safe-area-inset-top)+3rem)]">
      <div className="mb-8 flex items-center gap-3">
        <Logo size="lg" />
        <span className="chip border-gold/40 text-gold-soft">Console</span>
      </div>
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-8">
        <h1 className="font-display text-3xl text-ink">Sign in</h1>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <ErrorNote message={error} />
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? <Spinner /> : 'Sign in'}</button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}
