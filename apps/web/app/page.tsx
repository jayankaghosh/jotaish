'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, MessageCircle, Sun } from 'lucide-react';
import { LanguagePicker } from '@/components/LanguagePicker';
import { InstallButton } from '@/components/Pwa';
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
    <div className="min-h-dvh overflow-x-hidden">
      <header className="pt-safe mx-auto box-content flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:h-20">
        <Logo />
        <div className="flex items-center gap-1 sm:gap-2">
          <LanguagePicker compact />
          {user ? (
            <Link href="/dashboard" className="btn-primary !px-3 sm:!px-5" aria-label={t('landing.mySpace')}>
              <Sun size={18} /> <span className="hidden sm:inline">{t('landing.mySpace')}</span>
            </Link>
          ) : (
            <Link href="/login" className="btn-ghost">{t('auth.signIn')}</Link>
          )}
        </div>
      </header>

      <section className="relative mx-auto max-w-6xl px-4 pb-14 pt-8 text-center sm:pb-20 sm:pt-16">
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" aria-hidden />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark.svg" alt="" className="mx-auto mb-6 h-24 w-24 drop-shadow-[0_0_30px_rgba(249,194,60,0.35)] sm:h-28 sm:w-28" />
        <h1 className="mx-auto max-w-3xl font-display text-4xl font-semibold leading-[1.1] text-ink [overflow-wrap:anywhere] sm:text-6xl">
          {t('landing.headline1')} <span className="text-gradient">{t('landing.headline2')}</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{t('landing.intro')}</p>
        <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <Link href={start} className="btn-primary h-13 px-8 text-base">
            {t('landing.startFree')} <ArrowRight size={18} />
          </Link>
          <Link href={user ? '/chat' : '/register'} className="btn-ghost h-13 px-8 text-base">
            <MessageCircle size={18} /> {t('landing.talk')}
          </Link>
        </div>
        <div className="mt-4 flex justify-center"><InstallButton className="btn !min-h-9 text-gold hover:text-gold-soft" /></div>
        <p className="mt-4 text-xs text-faint">{t('landing.tags')}</p>
      </section>

      <section className="mx-auto max-w-6xl pb-16 sm:px-4 sm:pb-20">
        <h2 className="mb-1 px-4 text-center font-display text-2xl font-semibold text-ink sm:text-3xl">{t('landing.exploreTitle')}</h2>
        <p className="mb-6 px-4 text-center text-muted sm:mb-10">{t('landing.exploreBody')}</p>
        <div className="flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
          {SERVICES.map((s) => (
            <Link key={s.slug} href={user ? `/services/${s.slug}` : '/register'} className="card w-52 shrink-0 snap-start p-5 transition hover:border-gold/50 sm:w-auto">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-gold/12 text-gold"><s.icon size={22} /></span>
              <h3 className="font-display text-lg font-semibold text-ink">{t(serviceKey(s, 'title'))}</h3>
              <p className="mt-1 text-sm text-muted">{t(serviceKey(s, 'short'))}</p>
            </Link>
          ))}
          <Link href={user ? '/chat' : '/register'} className="card flex w-52 shrink-0 snap-start flex-col justify-between border-violet/30 bg-violet/10 p-5 transition hover:border-violet/60 sm:w-auto">
            <MessageCircle className="mb-4 text-violet" size={26} />
            <div>
              <h3 className="font-display text-lg font-semibold text-ink">{t('landing.unsureTitle')}</h3>
              <p className="mt-1 text-sm text-muted">{t('landing.unsureBody')}</p>
            </div>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-20">
        <div className="card p-6 sm:p-10">
          <h2 className="mb-6 text-center font-display text-2xl font-semibold text-ink sm:mb-8 sm:text-3xl">{t('landing.howTitle')}</h2>
          {/* Steps joined like the circuit nodes in the logo. */}
          <ol className="relative space-y-6 sm:grid sm:grid-cols-3 sm:gap-6 sm:space-y-0">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="relative flex gap-4 sm:flex-col sm:items-center sm:text-center">
                {i < STEPS.length - 1 && <span className="absolute left-5 top-11 h-[calc(100%-1rem)] w-px bg-gold/30 sm:hidden" aria-hidden />}
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-gold/60 bg-night font-display text-lg font-semibold text-gold">{i + 1}</span>
                <span>
                  <span className="block font-medium text-ink">{t(title)}</span>
                  <span className="mt-1 block text-sm text-muted">{t(body)}</span>
                </span>
              </li>
            ))}
          </ol>
          <ul className="mx-auto mt-8 grid max-w-2xl gap-2 text-sm text-muted sm:mt-10 sm:grid-cols-2">
            {PROMISES.map((k) => (
              <li key={k} className="flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0 text-ok" /> {t(k)}
              </li>
            ))}
          </ul>
          {!user && (
            <Link href="/register" className="btn-primary mx-auto mt-8 flex w-full max-w-sm">
              {t('landing.startFree')} <ArrowRight size={18} />
            </Link>
          )}
        </div>
      </section>

      <LegalFooter />
    </div>
  );
}
