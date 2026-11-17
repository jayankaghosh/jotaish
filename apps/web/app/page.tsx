'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, MessageCircle } from 'lucide-react';
import { LegalFooter } from '@/components/LegalPage';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/lib/auth';
import { SERVICES } from '@/lib/services';

const STEPS = [
  { title: 'Create your free account', body: 'Just your name, email and a password.' },
  { title: 'Share your birth details', body: 'We guide you through date, time and place, one step at a time.' },
  { title: 'Talk to Jyotaish', body: 'Ask anything. Every chart and reading is saved for you to come back to.' },
];

export default function Landing() {
  const { user } = useAuth();
  const start = user ? '/dashboard' : '/register';

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4">
        <Logo />
        <div className="flex items-center gap-2">
          {user ? (
            <Link href="/dashboard" className="btn-primary">Go to my space</Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">Sign in</Link>
              <Link href="/register" className="btn-primary">Get started</Link>
            </>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 text-center sm:pt-20">
        <p className="chip mx-auto mb-6 border-gold/40 text-gold-soft">Vedic · Western · Tarot · Numerology · Palm · Dreams</p>
        <h1 className="mx-auto max-w-3xl font-display text-5xl font-semibold leading-tight text-ink sm:text-6xl">
          Your personal astrologer, <span className="text-gold">whenever you need guidance</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          Meet Jyotaish, an astrologer who listens, explains everything in plain words and walks you through each step. Your
          Kundli, horoscopes and readings stay safe in your profile.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={start} className="btn-primary px-8 py-3 text-base">
            Start my free reading <ArrowRight size={18} />
          </Link>
          <Link href={user ? '/chat' : '/register'} className="btn-ghost px-8 py-3 text-base">
            <MessageCircle size={18} /> Talk to Jyotaish
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="mb-2 text-center font-display text-3xl text-ink">What would you like to explore?</h2>
        <p className="mb-10 text-center text-muted">Pick any of these, or simply tell Jyotaish what is on your mind.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map(({ slug, title, short, icon: Icon }) => (
            <Link key={slug} href={user ? `/services/${slug}` : '/register'} className="card group p-6 transition hover:border-gold/50">
              <Icon className="mb-4 text-gold" size={28} />
              <h3 className="font-display text-xl text-ink">{title}</h3>
              <p className="mt-1 text-sm text-muted">{short}</p>
            </Link>
          ))}
          <Link href={user ? '/chat' : '/register'} className="card group flex flex-col justify-between border-gold/30 bg-gold/5 p-6 transition hover:border-gold/60">
            <MessageCircle className="mb-4 text-gold" size={28} />
            <div>
              <h3 className="font-display text-xl text-ink">Not sure where to begin?</h3>
              <p className="mt-1 text-sm text-muted">Tell Jyotaish what you are going through and get pointed to the right reading.</p>
            </div>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-24">
        <div className="card p-8 sm:p-10">
          <h2 className="mb-8 text-center font-display text-3xl text-ink">How it works</h2>
          <ol className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 font-display text-xl text-gold">{i + 1}</div>
                <h3 className="font-medium text-ink">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <ul className="mx-auto mt-10 grid max-w-2xl gap-2 text-sm text-muted sm:grid-cols-2">
            {['Real planetary calculations, not generic text', 'Your readings are private to you', 'Explained simply, no jargon', 'Ask follow-up questions any time'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-ok" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <LegalFooter />
    </div>
  );
}
