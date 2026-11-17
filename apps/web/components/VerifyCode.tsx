'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MailCheck } from 'lucide-react';
import { gql } from '@/lib/gql';
import { ErrorNote, Spinner } from './ui';

interface Props {
  email: string;
  onVerified: (token: string) => void | Promise<void>;
  // Send a code as soon as the form appears (for people who never got one).
  sendOnOpen?: boolean;
}

export function VerifyCode({ email, onVerified, sendOnOpen = false }: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(sendOnOpen ? 60 : 0);
  const sentOnOpen = useRef(false);

  useEffect(() => {
    if (sendOnOpen && !sentOnOpen.current) {
      sentOnOpen.current = true;
      void gql(`mutation($e: String!) { resendVerificationCode(email: $e) }`, { e: email });
    }
  }, [sendOnOpen, email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { verifyEmail } = await gql(`mutation($e: String!, $c: String!) { verifyEmail(email: $e, code: $c) { token } }`, { e: email, c: code });
      await onVerified(verifyEmail.token);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    await gql(`mutation($e: String!) { resendVerificationCode(email: $e) }`, { e: email });
    setResent(true);
    setCooldown(60);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="text-center">
        <div className="mx-auto mb-3 inline-flex rounded-full bg-gold/15 p-3 text-gold"><MailCheck size={28} /></div>
        <h1 className="font-display text-3xl text-ink">Check your email</h1>
        <p className="mt-2 text-sm text-muted">
          We sent a 6-digit code to <span className="text-ink">{email}</span>. Enter it below to confirm your email address.
        </p>
      </div>
      <input
        className="input text-center font-display text-3xl tracking-[0.5em]"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="••••••"
        autoFocus
        aria-label="Verification code"
      />
      <ErrorNote message={error} />
      <button className="btn-primary w-full py-3" disabled={busy || code.length !== 6}>{busy ? <Spinner /> : 'Confirm email'}</button>
      <div className="text-center text-sm text-muted">
        {resent && <p className="mb-1 text-ok">A new code is on its way.</p>}
        <p>
          Didn&apos;t get it? Check your spam folder, or{' '}
          <button type="button" className="text-gold hover:underline disabled:text-faint disabled:no-underline" onClick={resend} disabled={cooldown > 0}>
            {cooldown > 0 ? `send a new code in ${cooldown}s` : 'send a new code'}
          </button>
          .
        </p>
      </div>
    </form>
  );
}
