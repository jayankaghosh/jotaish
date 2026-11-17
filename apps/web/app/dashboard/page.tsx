'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, MessageCircle, UserPlus } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { formatDate } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useUsageLine } from '@/components/UsageNote';
import { useConversationTitle, useT, type MessageKey } from '@/lib/i18n';
import { gql } from '@/lib/gql';
import { READING_SUMMARY } from '@/lib/fragments';
import { SERVICES, serviceByType, serviceKey } from '@/lib/services';
import type { Conversation, Reading } from '@/lib/types';

const QUESTIONS: MessageKey[] = ['dashboard.q1', 'dashboard.q2', 'dashboard.q3', 'dashboard.q4'];

export default function Dashboard() {
  const { user } = useAuth();
  const t = useT();
  const usageLine = useUsageLine();
  const titleOf = useConversationTitle();
  const [readings, setReadings] = useState<Reading[] | null>(null);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);

  useEffect(() => {
    gql<{ myReadings: Reading[]; myConversations: Conversation[] }>(`{ myReadings { ${READING_SUMMARY} } myConversations { id title updatedAt lastMessage } }`)
      .then((d) => {
        setReadings(d.myReadings);
        setConversations(d.myConversations);
      })
      .catch(() => {
        setReadings([]);
        setConversations([]);
      });
  }, []);

  const hasProfile = Boolean(user?.profiles.length);
  const hasKundli = readings?.some((r) => r.type === 'BIRTH_CHART');
  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? 'dashboard.morning' : hour < 17 ? 'dashboard.afternoon' : 'dashboard.evening', { name: user?.name.split(' ')[0] ?? '' });

  // The single most useful next step for where this person is.
  const next = !hasProfile
    ? { key: 'addDetails', href: '/welcome', icon: UserPlus }
    : !hasKundli
      ? { key: 'kundli', href: '/services/kundli', icon: BookOpen }
      : { key: 'horoscope', href: '/services/horoscope', icon: BookOpen };
  const nextText = (field: 'title' | 'body' | 'cta') => t(`dashboard.next.${next.key}.${field}` as MessageKey);

  return (
    <Shell>
      <h1 className="font-display text-4xl text-ink">{greeting}</h1>
      <p className="mt-1 text-muted">
        {t('dashboard.subtitle')}
        {usageLine(user?.usage) && <span className="ml-2 chip align-middle">{usageLine(user?.usage)}</span>}
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-gold/15 p-2.5 text-gold"><MessageCircle size={20} /></div>
            <div>
              <h2 className="font-display text-2xl text-ink">{t('dashboard.askTitle')}</h2>
              <p className="text-sm text-muted">{t('dashboard.askBody')}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {QUESTIONS.map((k) => (
              <Link key={k} href={`/chat?new=1&q=${encodeURIComponent(t(k))}`} className="chip hover:border-gold/50 hover:text-ink">
                {t(k)}
              </Link>
            ))}
          </div>
          <Link href="/chat?new=1" className="btn-primary mt-6">{t('dashboard.startChat')} <ArrowRight size={16} /></Link>
        </div>

        <div className="card flex flex-col justify-between border-gold/30 bg-gold/5 p-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-gold">{t('dashboard.suggested')}</p>
            <h2 className="mt-2 font-display text-2xl text-ink">{nextText('title')}</h2>
            <p className="mt-1 text-sm text-muted">{nextText('body')}</p>
          </div>
          <Link href={next.href} className="btn-primary mt-6 self-start">{nextText('cta')} <ArrowRight size={16} /></Link>
        </div>
      </div>

      <h2 className="mb-4 mt-12 font-display text-2xl text-ink">{t('dashboard.readings')}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SERVICES.map((s) => (
          <Link key={s.slug} href={`/services/${s.slug}`} className="card p-5 transition hover:border-gold/50">
            <s.icon className="mb-3 text-gold" size={22} />
            <h3 className="text-ink">{t(serviceKey(s, 'title'))}</h3>
            <p className="text-xs text-muted">{t(serviceKey(s, 'short'))}</p>
          </Link>
        ))}
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl text-ink">{t('dashboard.recentReadings')}</h2>
            <Link href="/readings" className="text-sm text-gold hover:underline">{t('common.seeAll')}</Link>
          </div>
          {readings && readings.length === 0 && <p className="card p-6 text-sm text-muted">{t('dashboard.noReadings')}</p>}
          <ul className="space-y-2">
            {readings?.slice(0, 5).map((r) => {
              const Icon = serviceByType(r.type).icon;
              return (
                <li key={r.id}>
                  <Link href={`/readings/${r.id}`} className="card flex items-center gap-3 p-4 hover:border-gold/50">
                    <Icon size={18} className="text-gold" />
                    <span className="flex-1 truncate text-ink">{r.title}</span>
                    <span className="text-xs text-faint">{formatDate(r.createdAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl text-ink">{t('dashboard.conversations')}</h2>
            <Link href="/chat" className="text-sm text-gold hover:underline">{t('common.seeAll')}</Link>
          </div>
          {conversations && conversations.length === 0 && <p className="card p-6 text-sm text-muted">{t('dashboard.noConversations')}</p>}
          <ul className="space-y-2">
            {conversations?.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link href={`/chat/${c.id}`} className="card block p-4 hover:border-gold/50">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-ink">{titleOf(c.title)}</span>
                    <span className="shrink-0 text-xs text-faint">{formatDate(c.updatedAt)}</span>
                  </div>
                  {c.lastMessage && <p className="mt-1 truncate text-xs text-muted">{c.lastMessage}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}
