'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, MessageCircle } from 'lucide-react';
import { LanguagePicker } from '@/components/LanguagePicker';
import { LegalFooter } from '@/components/LegalPage';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/lib/auth';
import { useT, type MessageKey } from '@/lib/i18n';
import { SERVICES, serviceKey } from '@/lib/services';

const STEPS: [MessageKey, MessageKey][] = [
  ['landing.step1.title', 'landing.step1.body'],
  ['landing.step2.title', 'landing.step2.body'],
  ['landing.step3.title', 'landing.step3.body'],
];

const PROMISES: MessageKey[] = ['landing.promise1', 'landing.promise2', 'landing.promise3', 'landing.promise4'];

export default function Landing() {
  const { user } = useAuth();
  const t = useT();
  const start = user ? '/dashboard' : '/register';

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-2 px-4">
        <Logo />
        <div className="flex items-center gap-2">
          <LanguagePicker />
          {user ? (
            <Link href="/dashboard" className="btn-primary">{t('landing.mySpace')}</Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost hidden sm:inline-flex">{t('auth.signIn')}</Link>
              <Link href="/register" className="btn-primary">{t('landing.getStarted')}</Link>
            </>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 text-center sm:pt-20">
        <p className="chip mx-auto mb-6 border-gold/40 text-gold-soft">{t('landing.tags')}</p>
        <h1 className="mx-auto max-w-3xl font-display text-5xl font-semibold leading-tight text-ink sm:text-6xl">
          {t('landing.headline1')} <span className="text-gold">{t('landing.headline2')}</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">{t('landing.intro')}</p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={start} className="btn-primary px-8 py-3 text-base">
            {t('landing.startFree')} <ArrowRight size={18} />
          </Link>
          <Link href={user ? '/chat' : '/register'} className="btn-ghost px-8 py-3 text-base">
            <MessageCircle size={18} /> {t('landing.talk')}
          </Link>
        </div>
        {!user && (
          <p className="mt-4 text-sm text-muted sm:hidden">
            {t('auth.haveAccount')} <Link href="/login" className="text-gold">{t('auth.signIn')}</Link>
          </p>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="mb-2 text-center font-display text-3xl text-ink">{t('landing.exploreTitle')}</h2>
        <p className="mb-10 text-center text-muted">{t('landing.exploreBody')}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => (
            <Link key={s.slug} href={user ? `/services/${s.slug}` : '/register'} className="card group p-6 transition hover:border-gold/50">
              <s.icon className="mb-4 text-gold" size={28} />
              <h3 className="font-display text-xl text-ink">{t(serviceKey(s, 'title'))}</h3>
              <p className="mt-1 text-sm text-muted">{t(serviceKey(s, 'short'))}</p>
            </Link>
          ))}
          <Link href={user ? '/chat' : '/register'} className="card group flex flex-col justify-between border-gold/30 bg-gold/5 p-6 transition hover:border-gold/60">
            <MessageCircle className="mb-4 text-gold" size={28} />
            <div>
              <h3 className="font-display text-xl text-ink">{t('landing.unsureTitle')}</h3>
              <p className="mt-1 text-sm text-muted">{t('landing.unsureBody')}</p>
            </div>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-24">
        <div className="card p-8 sm:p-10">
          <h2 className="mb-8 text-center font-display text-3xl text-ink">{t('landing.howTitle')}</h2>
          <ol className="grid gap-6 sm:grid-cols-3">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 font-display text-xl text-gold">{i + 1}</div>
                <h3 className="font-medium text-ink">{t(title)}</h3>
                <p className="mt-1 text-sm text-muted">{t(body)}</p>
              </li>
            ))}
          </ol>
          <ul className="mx-auto mt-10 grid max-w-2xl gap-2 text-sm text-muted sm:grid-cols-2">
            {PROMISES.map((k) => (
              <li key={k} className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-ok" /> {t(k)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <LegalFooter />
    </div>
  );
}
