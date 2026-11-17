'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { BirthWizard } from '@/components/BirthWizard';
import { useAuth } from '@/lib/auth';
import { SERVICES, serviceKey } from '@/lib/services';
import { useT } from '@/lib/i18n';

type Stage = 'intro' | 'details' | 'next';

export default function WelcomePage() {
  const { user, refresh } = useAuth();
  const t = useT();
  const [stage, setStage] = useState<Stage>('intro');
  const self = user?.profiles.find((p) => p.relation === 'self');

  return (
    <Shell>
      <div className="mx-auto max-w-2xl">
        {stage === 'intro' && (
          <div className="card p-8 text-center sm:p-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mark.svg" alt="" className="mx-auto mb-4 h-16 w-16" />
            <h1 className="font-display text-4xl text-ink">{t('welcome.title', { name: user?.name.split(' ')[0] ?? '' })}</h1>
            <p className="mx-auto mt-3 max-w-lg text-muted">{t('welcome.intro')}</p>
            <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm text-muted">
              <li>1. {t('welcome.item1')}</li>
              <li>2. {t('welcome.item2')}</li>
              <li>3. {t('welcome.item3')}</li>
            </ul>
            <div className="mt-8 flex flex-col items-center gap-3">
              <button className="btn-primary px-8 py-3" onClick={() => setStage('details')}>
                {t('welcome.begin')} <ArrowRight size={16} />
              </button>
              <button className="text-sm text-faint hover:text-muted" onClick={() => setStage('next')}>
                {t('welcome.skip')}
              </button>
            </div>
          </div>
        )}

        {stage === 'details' && user && (
          <div className="card p-6 sm:p-10">
            <BirthWizard
              askName={false}
              initial={self ?? { name: user.name, relation: 'self' }}
              saveLabel={t('welcome.saveContinue')}
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
              <h1 className="font-display text-4xl text-ink">{self || user?.profiles.length ? t('welcome.allSet') : t('welcome.whereStart')}</h1>
              <p className="mt-2 text-muted">{t('welcome.firstSteps')}</p>
            </div>
            <Link href="/chat?new=1" className="card mb-4 flex items-center gap-4 border-gold/40 bg-gold/5 p-6 transition hover:border-gold">
              <div className="rounded-full bg-gold/15 p-3 text-gold"><MessageCircle /></div>
              <div className="flex-1">
                <h2 className="font-display text-2xl text-ink">{t('landing.talk')}</h2>
                <p className="text-sm text-muted">{t('welcome.talkBody')}</p>
              </div>
              <ArrowRight className="text-gold" />
            </Link>
            <div className="grid gap-3 sm:grid-cols-2">
              {SERVICES.map((s) => (
                <Link key={s.slug} href={`/services/${s.slug}`} className="card flex items-center gap-3 p-4 transition hover:border-gold/50">
                  <s.icon className="shrink-0 text-gold" size={22} />
                  <div>
                    <h3 className="text-ink">{t(serviceKey(s, 'title'))}</h3>
                    <p className="text-xs text-muted">{t(serviceKey(s, 'short'))}</p>
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
