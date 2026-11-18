'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { AuthCard } from '@/components/AuthCard';
import { ErrorNote, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { gql } from '@/lib/gql';
import { useI18n } from '@/lib/i18n';

// One screen for everyone: email, then the emailed code, then (first time
// only) the person's name. There are no passwords.
type Step = 'email' | 'code' | 'details';

interface CodeStatus {
  email: string;
  expiresIn: number;
  resendIn: number;
  codesLeft: number;
}

const STATUS = 'email expiresIn resendIn codesLeft';

// A countdown in whole seconds to a moment that was this many seconds away.
function useCountdown(seconds: number, startedAt: number) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, seconds - Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [seconds, startedAt]);
  return left;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const { user, loading, signIn, refresh } = useAuth();
  const { t, lang } = useI18n();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<{ info: CodeStatus; at: number } | null>(null);

  // Signed in already: straight home, or on to the name if it was skipped.
  useEffect(() => {
    if (loading || !user || step === 'details') return;
    if (user.name) router.replace(next ?? '/dashboard');
    else setStep('details');
  }, [loading, user, step, next, router]);

  if (loading) return <div className="flex min-h-dvh items-center justify-center text-muted"><Spinner /></div>;

  if (step === 'details') {
    return (
      <AuthCard title={t('auth.detailsTitle')} subtitle={t('auth.detailsSubtitle')} footer={null}>
        <DetailsForm
          onDone={async () => {
            await refresh();
            router.replace('/welcome');
          }}
        />
      </AuthCard>
    );
  }

  if (step === 'code' && status) {
    return (
      <AuthCard title="" subtitle="" footer={null}>
        <CodeForm
          status={status}
          onResent={(info) => setStatus({ info, at: Date.now() })}
          onBack={() => setStep('email')}
          onVerified={async (token, isNew) => {
            await signIn(token);
            if (isNew) setStep('details');
            else router.replace(next ?? '/dashboard');
          }}
          lang={lang}
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('auth.title')} subtitle={t('auth.subtitle')} footer={null}>
      <EmailForm
        email={email}
        setEmail={setEmail}
        onSent={(info) => {
          setStatus({ info, at: Date.now() });
          setStep('code');
        }}
      />
    </AuthCard>
  );
}

function EmailForm({ email, setEmail, onSent }: { email: string; setEmail: (v: string) => void; onSent: (s: CodeStatus) => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { requestSignInCode } = await gql<{ requestSignInCode: CodeStatus }>(`mutation($e: String!) { requestSignInCode(email: $e) { ${STATUS} } }`, { e: email });
      onSent(requestSignInCode);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">{t('auth.email')}</label>
        <input id="email" type="email" inputMode="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus placeholder="you@example.com" />
        <p className="hint">{t('auth.emailHint')}</p>
      </div>
      <ErrorNote message={error} />
      <button className="btn-primary w-full py-3" disabled={busy || !email.trim()}>{busy ? <Spinner /> : t('auth.sendCode')}</button>
    </form>
  );
}

interface CodeProps {
  status: { info: CodeStatus; at: number };
  onResent: (s: CodeStatus) => void;
  onBack: () => void;
  onVerified: (token: string, isNew: boolean) => Promise<void>;
  lang: string;
}

function CodeForm({ status, onResent, onBack, onVerified, lang }: CodeProps) {
  const { t } = useI18n();
  const { info, at } = status;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expiresIn = useCountdown(info.expiresIn, at);
  const resendIn = useCountdown(info.resendIn, at);
  const submitted = useRef('');

  async function verify(value: string) {
    if (value.length !== 6 || submitted.current === value) return;
    submitted.current = value;
    setBusy(true);
    setError(null);
    try {
      const { verifySignInCode } = await gql<{ verifySignInCode: { token: string; isNew: boolean } }>(
        `mutation($e: String!, $c: String!, $l: String) { verifySignInCode(email: $e, code: $c, language: $l) { token isNew } }`,
        { e: info.email, c: value, l: lang },
      );
      await onVerified(verifySignInCode.token, verifySignInCode.isNew);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function resend() {
    setSending(true);
    setError(null);
    try {
      const { requestSignInCode } = await gql<{ requestSignInCode: CodeStatus }>(`mutation($e: String!) { requestSignInCode(email: $e) { ${STATUS} } }`, { e: info.email });
      onResent(requestSignInCode);
      setResent(true);
      setCode('');
      submitted.current = '';
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitted.current = '';
        void verify(code);
      }}
      className="space-y-5"
    >
      <button type="button" onClick={onBack} className="-mt-2 flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> {t('auth.changeEmail')}
      </button>
      <div className="text-center">
        <div className="mx-auto mb-3 inline-flex rounded-full bg-gold/15 p-3 text-gold"><MailCheck size={28} /></div>
        <h1 className="font-display text-3xl text-ink">{t('auth.codeTitle')}</h1>
        <p className="mt-2 break-words text-sm text-muted">{t('auth.codeBody', { email: info.email })}</p>
      </div>
      <input
        className="input text-center font-display text-3xl tracking-[0.5em]"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => {
          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
          setCode(value);
          // The full code (typed or filled from the email) goes straight in.
          if (value.length === 6) void verify(value);
        }}
        placeholder="••••••"
        autoFocus
        disabled={busy}
        aria-label={t('auth.codeLabel')}
      />
      {expiresIn > 0 ? (
        <p className="text-center text-xs text-muted">{t('auth.expiresIn', { time: clock(expiresIn) })}</p>
      ) : (
        <p className="rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-center text-sm text-gold-soft">{t('auth.expired')}</p>
      )}
      <ErrorNote message={error} />
      <button className="btn-primary w-full py-3" disabled={busy || code.length !== 6 || expiresIn === 0}>{busy ? <Spinner /> : t('auth.verify')}</button>
      <div className="space-y-2 text-center text-sm text-muted">
        {resent && <p className="text-ok">{t('auth.resent')}</p>}
        {info.codesLeft === 0 ? (
          <p className="text-xs text-faint">{t('auth.lastCode')}</p>
        ) : (
          <>
            <p className="text-xs">{t('auth.notReceived')}</p>
            <button type="button" className="text-gold hover:underline disabled:text-faint disabled:no-underline" onClick={resend} disabled={sending || resendIn > 0}>
              {sending ? <Spinner /> : resendIn > 0 ? t('auth.resendIn', { seconds: resendIn }) : t('auth.resend')}
            </button>
          </>
        )}
      </div>
    </form>
  );
}

function DetailsForm({ onDone }: { onDone: () => Promise<void> }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await gql(`mutation($n: String!) { updateMe(name: $n) { id name } }`, { n: name.trim() });
      await onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">{t('auth.yourName')}</label>
        <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" autoFocus placeholder={t('auth.namePlaceholder')} />
        <p className="hint">{t('auth.nameHint')}</p>
      </div>
      <ErrorNote message={error} />
      <button className="btn-primary w-full py-3" disabled={busy || !name.trim()}>{busy ? <Spinner /> : t('auth.continue')}</button>
      <p className="text-center text-xs text-faint">
        {t('auth.agreePrefix')}{' '}
        <Link href="/terms" className="underline hover:text-muted">{t('footer.terms')}</Link> {t('auth.agreeAnd')}{' '}
        <Link href="/privacy" className="underline hover:text-muted">{t('footer.privacy')}</Link>{t('auth.agreeSuffix')}
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}
