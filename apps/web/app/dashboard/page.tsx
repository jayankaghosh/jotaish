'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, MessageCircle, Sparkles, UserPlus } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { CardOfTheDay, NumberOfTheDay, SkyCard, TODAY_QUERY, type TodaySky } from '@/components/today';
import { formatDate } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useConversationTitle, useI18n, type MessageKey } from '@/lib/i18n';
import { gql } from '@/lib/gql';
import { READING_SUMMARY } from '@/lib/fragments';
import { SERVICES, serviceByType, serviceKey } from '@/lib/services';
import type { Conversation, Reading } from '@/lib/types';

const QUESTIONS: MessageKey[] = ['dashboard.q1', 'dashboard.q2', 'dashboard.q3', 'dashboard.q4'];

export default function Today() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const titleOf = useConversationTitle();
  const [sky, setSky] = useState<TodaySky | null>(null);
  const [readings, setReadings] = useState<Reading[] | null>(null);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);

  useEffect(() => {
    gql<{ today: TodaySky }>(TODAY_QUERY).then((d) => setSky(d.today)).catch(() => setSky(null));
    gql<{ myReadings: Reading[]; myConversations: Conversation[] }>(`{ myReadings { ${READING_SUMMARY} } myConversations { id title updatedAt lastMessage } }`)
      .then((d) => {
        setReadings(d.myReadings);
        setConversations(d.myConversations);
      })
      .catch(() => {
        setReadings([]);
        setConversations([]);
      });
    // Sign and nakshatra names follow the language.
  }, [lang, user?.profiles.length]);

  const hasProfile = Boolean(user?.profiles.length);
  const self = user?.profiles.find((p) => p.relation === 'self');
  const hasKundli = readings?.some((r) => r.type === 'BIRTH_CHART');
  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? 'dashboard.morning' : hour < 17 ? 'dashboard.afternoon' : 'dashboard.evening', { name: user?.name.split(' ')[0] ?? '' });
  const dateLine = new Intl.DateTimeFormat(`${lang}-IN`, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  // The single most useful next step for where this person is.
  const next = !hasProfile
    ? { key: 'addDetails', href: '/welcome', icon: UserPlus }
    : !hasKundli
      ? { key: 'kundli', href: '/services/kundli', icon: BookOpen }
      : null;
  const lastChat = conversations?.[0];

  return (
    <Shell>
      <div className="animate-rise">
        <p className="text-sm text-muted">{dateLine}</p>
        <h1 className="mt-0.5 font-display text-3xl font-semibold text-ink sm:text-4xl">{greeting}</h1>
      </div>

      {next && readings && (
        <Link href={next.href} className="mt-5 flex items-center gap-4 rounded-3xl border border-gold/35 bg-gold/[0.07] p-4 transition hover:border-gold/60">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold"><next.icon size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-ink">{t(`dashboard.next.${next.key}.title` as MessageKey)}</span>
            <span className="block text-sm text-muted">{t(`dashboard.next.${next.key}.body` as MessageKey)}</span>
          </span>
          <ArrowRight size={18} className="shrink-0 text-gold" />
        </Link>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sky ? <SkyCard sky={sky} /> : <div className="card h-72 animate-pulse" />}
        <div className="space-y-4">
          {user && <CardOfTheDay seed={user.id} />}
          {self && <NumberOfTheDay birthDate={self.birthDate} />}
          <section className="card p-5 sm:p-6">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/mark.svg" alt="" className="h-10 w-10" />
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">{t('dashboard.askTitle')}</h2>
                <p className="text-sm text-muted">{t('dashboard.askBody')}</p>
              </div>
            </div>
            <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              {QUESTIONS.map((k) => (
                <Link key={k} href={`/chat?new=1&q=${encodeURIComponent(t(k))}`} className="shrink-0 rounded-full border border-line bg-raised/60 px-4 py-2 text-sm text-ink hover:border-gold/50">
                  {t(k)}
                </Link>
              ))}
            </div>
            {lastChat ? (
              <Link href={`/chat/${lastChat.id}`} className="mt-4 flex items-center gap-3 rounded-2xl border border-line p-3 hover:border-gold/40">
                <MessageCircle size={18} className="shrink-0 text-violet" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-faint">{t('today.continue')}</span>
                  <span className="block truncate text-sm text-ink">{titleOf(lastChat.title)}</span>
                </span>
                <ArrowRight size={16} className="shrink-0 text-faint" />
              </Link>
            ) : (
              <Link href="/chat?new=1" className="btn-primary mt-4 w-full"><Sparkles size={16} /> {t('dashboard.startChat')}</Link>
            )}
          </section>
        </div>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-ink">{t('today.forYouToday')}</h2>
          <Link href="/explore" className="text-sm text-gold">{t('common.seeAll')}</Link>
        </div>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0">
          {SERVICES.filter((s) => s.slug !== 'kundli' || !hasKundli).slice(0, 4).map((s) => (
            <Link key={s.slug} href={`/services/${s.slug}`} className="card w-40 shrink-0 snap-start p-4 transition hover:border-gold/50 lg:w-auto">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gold/12 text-gold"><s.icon size={20} /></span>
              <span className="block font-medium text-ink">{t(serviceKey(s, 'title'))}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted">{t(serviceKey(s, 'short'))}</span>
            </Link>
          ))}
        </div>
      </section>

      {readings && readings.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-ink">{t('dashboard.recentReadings')}</h2>
            <Link href="/readings" className="text-sm text-gold">{t('common.seeAll')}</Link>
          </div>
          <ul className="space-y-2">
            {readings.slice(0, 3).map((r) => {
              const Icon = serviceByType(r.type).icon;
              return (
                <li key={r.id}>
                  <Link href={`/readings/${r.id}`} className="card flex items-center gap-3 p-4 hover:border-gold/50">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised text-gold"><Icon size={17} /></span>
                    <span className="min-w-0 flex-1 truncate text-ink">{r.title}</span>
                    <span className="shrink-0 text-xs text-faint">{formatDate(r.createdAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Shell>
  );
}
