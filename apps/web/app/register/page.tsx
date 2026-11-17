'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/AuthCard';
import { ErrorNote, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { gql } from '@/lib/gql';

export default function RegisterPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { register } = await gql(`mutation($input: RegisterInput!) { register(input: $input) { token verificationRequired } }`, { input: form });
      if (register.verificationRequired) {
        router.replace(`/verify?new=1&email=${encodeURIComponent(form.email.trim().toLowerCase())}`);
        return;
      }
      await signIn(register.token);
      router.replace('/welcome');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <AuthCard
      title="Create your free account"
      subtitle="It takes less than a minute. Next, we'll help you set up your birth details."
      footer={<>Already have an account? <Link href="/login" className="text-gold hover:underline">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" className="input" value={form.name} onChange={set('name')} required autoComplete="name" placeholder="e.g. Priya Sharma" />
          <p className="hint">This is how Jyotaish will greet you.</p>
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={form.email} onChange={set('email')} required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />
          <p className="hint">At least 8 characters.</p>
        </div>
        <ErrorNote message={error} />
        <button className="btn-primary w-full py-3" disabled={busy}>
          {busy ? <Spinner /> : 'Create account'}
        </button>
        <p className="text-center text-xs text-faint">Your details and readings are private to you.</p>
      </form>
    </AuthCard>
  );
}
