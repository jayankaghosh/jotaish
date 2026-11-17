'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, MessageCircle, UserPlus } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { formatDate } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { usageLine } from '@/components/UsageNote';
import { gql } from '@/lib/gql';
import { READING_SUMMARY } from '@/lib/fragments';
import { SERVICES, serviceByType } from '@/lib/services';
import type { Conversation, Reading } from '@/lib/types';

const QUESTIONS = [
  'How will my career go this year?',
  'When is a good time for marriage?',
  'What does my current dasha mean for me?',
  'Pick a tarot card for today',
];

export default function Dashboard() {
  const { user } = useAuth();
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
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // The single most useful next step for where this person is.
  const next = !hasProfile
    ? { title: 'Add your birth details', body: 'It takes a minute and unlocks your Kundli, horoscopes and matching.', href: '/welcome', icon: UserPlus, cta: 'Add birth details' }
    : !hasKundli
      ? { title: 'Get your Kundli', body: 'Your full birth chart, explained in simple words. This is the best place to start.', href: '/services/kundli', icon: BookOpen, cta: 'Prepare my Kundli' }
      : { title: "Read today's horoscope", body: 'See what the planets bring today, based on your Moon sign.', href: '/services/horoscope', icon: BookOpen, cta: 'Read my horoscope' };

  return (
    <Shell>
      <h1 className="font-display text-4xl text-ink">{greeting}, {user?.name.split(' ')[0]}</h1>
      <p className="mt-1 text-muted">
        What would you like guidance on today?
        {usageLine(user?.usage) && <span className="ml-2 chip align-middle">{usageLine(user?.usage)}</span>}
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-gold/15 p-2.5 text-gold"><MessageCircle size={20} /></div>
            <div>
              <h2 className="font-display text-2xl text-ink">Ask Jyotaish anything</h2>
              <p className="text-sm text-muted">Not sure which reading you need? Just describe what's on your mind.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {QUESTIONS.map((q) => (
              <Link key={q} href={`/chat?new=1&q=${encodeURIComponent(q)}`} className="chip hover:border-gold/50 hover:text-ink">
                {q}
              </Link>
            ))}
          </div>
          <Link href="/chat?new=1" className="btn-primary mt-6">Start a conversation <ArrowRight size={16} /></Link>
        </div>

        <div className="card flex flex-col justify-between border-gold/30 bg-gold/5 p-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-gold">Suggested next step</p>
            <h2 className="mt-2 font-display text-2xl text-ink">{next.title}</h2>
            <p className="mt-1 text-sm text-muted">{next.body}</p>
          </div>
          <Link href={next.href} className="btn-primary mt-6 self-start">{next.cta} <ArrowRight size={16} /></Link>
        </div>
      </div>

      <h2 className="mb-4 mt-12 font-display text-2xl text-ink">Readings</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SERVICES.map(({ slug, title, short, icon: Icon }) => (
          <Link key={slug} href={`/services/${slug}`} className="card p-5 transition hover:border-gold/50">
            <Icon className="mb-3 text-gold" size={22} />
            <h3 className="text-ink">{title}</h3>
            <p className="text-xs text-muted">{short}</p>
          </Link>
        ))}
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl text-ink">Recent readings</h2>
            <Link href="/readings" className="text-sm text-gold hover:underline">See all</Link>
          </div>
          {readings && readings.length === 0 && <p className="card p-6 text-sm text-muted">Your readings will appear here and stay saved for you. Try one of the readings above to begin.</p>}
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
            <h2 className="font-display text-2xl text-ink">Conversations</h2>
            <Link href="/chat" className="text-sm text-gold hover:underline">See all</Link>
          </div>
          {conversations && conversations.length === 0 && <p className="card p-6 text-sm text-muted">You haven't talked with Jyotaish yet. Pick a question above to start.</p>}
          <ul className="space-y-2">
            {conversations?.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link href={`/chat/${c.id}`} className="card block p-4 hover:border-gold/50">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-ink">{c.title}</span>
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
