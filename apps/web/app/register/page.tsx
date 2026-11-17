'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/AuthCard';
import { ErrorNote, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { gql } from '@/lib/gql';
import { useI18n } from '@/lib/i18n';

export default function RegisterPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { t, lang } = useI18n();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { register } = await gql(`mutation($input: RegisterInput!) { register(input: $input) { token verificationRequired } }`, { input: { ...form, language: lang } });
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
      title={t('auth.registerTitle')}
      subtitle={t('auth.registerSubtitle')}
      footer={<>{t('auth.haveAccount')} <Link href="/login" className="text-gold hover:underline">{t('auth.signIn')}</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">{t('auth.yourName')}</label>
          <input id="name" className="input" value={form.name} onChange={set('name')} required autoComplete="name" placeholder={t('auth.namePlaceholder')} />
          <p className="hint">{t('auth.nameHint')}</p>
        </div>
        <div>
          <label className="label" htmlFor="email">{t('auth.email')}</label>
          <input id="email" type="email" className="input" value={form.email} onChange={set('email')} required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">{t('auth.password')}</label>
          <input id="password" type="password" className="input" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />
          <p className="hint">{t('auth.passwordHint')}</p>
        </div>
        <ErrorNote message={error} />
        <button className="btn-primary w-full py-3" disabled={busy}>
          {busy ? <Spinner /> : t('auth.createAccount')}
        </button>
        <p className="text-center text-xs text-faint">
          {t('auth.agreePrefix')}{' '}
          <Link href="/terms" className="underline hover:text-muted">{t('footer.terms')}</Link> {t('auth.agreeAnd')}{' '}
          <Link href="/privacy" className="underline hover:text-muted">{t('footer.privacy')}</Link>{t('auth.agreeSuffix')}
        </p>
      </form>
    </AuthCard>
  );
}
