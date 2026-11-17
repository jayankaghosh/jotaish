'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, MessageCircle, Sparkles } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { BirthWizard } from '@/components/BirthWizard';
import { useAuth } from '@/lib/auth';
import { SERVICES } from '@/lib/services';

type Stage = 'intro' | 'details' | 'next';

export default function WelcomePage() {
  const { user, refresh } = useAuth();
  const [stage, setStage] = useState<Stage>('intro');
  const self = user?.profiles.find((p) => p.relation === 'self');

  return (
    <Shell>
      <div className="mx-auto max-w-2xl">
        {stage === 'intro' && (
          <div className="card p-8 text-center sm:p-12">
            <Sparkles className="mx-auto mb-4 text-gold" size={36} />
            <h1 className="font-display text-4xl text-ink">Welcome, {user?.name.split(' ')[0]}</h1>
            <p className="mx-auto mt-3 max-w-lg text-muted">
              I'm Jyotaish, your astrologer. Let's set up your birth details first. It takes about a minute, and it lets me
              prepare your Kundli, horoscopes and matching accurately.
            </p>
            <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm text-muted">
              <li>1. Your date of birth</li>
              <li>2. Your time of birth (approximate or unknown is fine)</li>
              <li>3. Your place of birth</li>
            </ul>
            <div className="mt-8 flex flex-col items-center gap-3">
              <button className="btn-primary px-8 py-3" onClick={() => setStage('details')}>
                Let's begin <ArrowRight size={16} />
              </button>
              <button className="text-sm text-faint hover:text-muted" onClick={() => setStage('next')}>
                Skip for now, I want tarot, dreams or palm reading
              </button>
            </div>
          </div>
        )}

        {stage === 'details' && user && (
          <div className="card p-6 sm:p-10">
            <BirthWizard
              askName={false}
              initial={self ?? { name: user.name, relation: 'self' }}
              saveLabel="Save and continue"
              onSaved={async () => {
                await refresh();
                setStage('next');
              }}
            />
          </div>
        )}

        {stage === 'next' && (
          <div>
            <div className="mb-8 text-center">
              <h1 className="font-display text-4xl text-ink">{self || user?.profiles.length ? "You're all set" : 'Where would you like to start?'}</h1>
              <p className="mt-2 text-muted">Here are a few good first steps. You can come back to any of them later.</p>
            </div>
            <Link href="/chat?new=1" className="card mb-4 flex items-center gap-4 border-gold/40 bg-gold/5 p-6 transition hover:border-gold">
              <div className="rounded-full bg-gold/15 p-3 text-gold"><MessageCircle /></div>
              <div className="flex-1">
                <h2 className="font-display text-2xl text-ink">Talk to Jyotaish</h2>
                <p className="text-sm text-muted">Recommended if you have a question on your mind. Jyotaish will guide you to the right reading.</p>
              </div>
              <ArrowRight className="text-gold" />
            </Link>
            <div className="grid gap-3 sm:grid-cols-2">
              {SERVICES.map(({ slug, title, short, icon: Icon }) => (
                <Link key={slug} href={`/services/${slug}`} className="card flex items-center gap-3 p-4 transition hover:border-gold/50">
                  <Icon className="shrink-0 text-gold" size={22} />
                  <div>
                    <h3 className="text-ink">{title}</h3>
                    <p className="text-xs text-muted">{short}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
