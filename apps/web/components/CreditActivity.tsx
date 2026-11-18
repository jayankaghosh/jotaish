'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MessageCircle, Sparkles } from 'lucide-react';
import { ErrorNote, Spinner, formatDate } from '@/components/ui';
import { gql } from '@/lib/gql';
import { LANGUAGES } from '@/lib/i18n';
import { serviceByType } from '@/lib/services';
import type { ReadingType } from '@/lib/types';

interface Totals {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  credits: number;
  failed: number;
}

interface Item extends Totals {
  id: string;
  kind: 'reading' | 'chat' | 'other';
  title: string;
  readingId: string | null;
  readingType: ReadingType | null;
  conversationId: string | null;
  tasks: string[];
  language: string | null;
  models: string[];
  startedAt: string;
}

interface Activity extends Totals {
  days: number;
  truncated: boolean;
  byTask: (Totals & { task: string; label: string })[];
  byLanguage: (Totals & { language: string | null })[];
  items: Item[];
}

const TOTALS = 'calls promptTokens completionTokens credits failed';
const PERIODS = [
  [1, 'Last 24 hours'],
  [7, '7 days'],
  [30, '30 days'],
  [90, '90 days'],
] as const;

const languageName = (code: string | null) => (code ? (LANGUAGES.find((l) => l.code === code)?.name ?? code) : 'Not recorded');
const formatCredits = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: n < 10 ? 1 : 0 });
const formatTokens = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000).toLocaleString('en-IN')}K` : n.toLocaleString('en-IN'));
// Model ids read better without the provider.
const shortModel = (id: string) => id.split('/').pop() ?? id;

export function CreditActivity({ userId }: { userId: string }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    gql<{ adminUserActivity: Activity }>(
      `query($id: ID!, $days: Int) { adminUserActivity(userId: $id, days: $days) { days truncated ${TOTALS} byTask { task label ${TOTALS} } byLanguage { language ${TOTALS} } items { id kind title readingId readingType conversationId tasks language models startedAt ${TOTALS} } } }`,
      { id: userId, days },
    )
      .then((d) => setData(d.adminUserActivity))
      .catch((e) => setError(e.message));
  }, [userId, days]);

  return (
    <section className="card mb-8 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 className="font-display text-2xl text-ink">Where credits went</h2>
          <p className="mt-1 text-sm text-muted">Every AI call made for this user, grouped into what they did. 1 credit = $0.001 of AI cost.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map(([d, label]) => (
            <button key={d} onClick={() => setDays(d)} className={`chip px-3 py-1.5 text-xs ${days === d ? 'border-gold text-gold-soft' : ''}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="mt-3"><ErrorNote message={error} /></div>
      {!data ? (!error && <div className="py-6"><Spinner /></div>) : data.calls === 0 ? (
        <p className="mt-4 text-muted">No AI use in this period.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">
            <span className="font-display text-3xl text-gold-soft">{formatCredits(data.credits)}</span> credits across {data.calls.toLocaleString('en-IN')} AI calls
            {' '}({formatTokens(data.promptTokens)} tokens sent, {formatTokens(data.completionTokens)} written)
            {data.failed > 0 && <span className="text-danger"> · {data.failed} failed</span>}
          </p>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <Breakdown title="By kind of work" total={data.credits} rows={data.byTask.map((t) => ({ ...t, key: t.task }))} />
            <Breakdown title="By language" total={data.credits} rows={data.byLanguage.map((l) => ({ key: l.language ?? '', label: languageName(l.language), ...l }))} />
          </div>

          <h3 className="mb-2 mt-6 text-ink">Activity</h3>
          <ul className="divide-y divide-line rounded-xl border border-line text-sm">
            {data.items.map((item) => <ActivityRow key={item.id} item={item} />)}
          </ul>
          {data.truncated && <p className="hint mt-2">Showing the most recent calls only. Pick a shorter period to see all of them.</p>}
          <p className="hint mt-2">Calls made before 18 November 2026 have no language and aren&apos;t linked to a reading or conversation.</p>
        </>
      )}
    </section>
  );
}

function Breakdown({ title, total, rows }: { title: string; total: number; rows: (Totals & { key: string; label: string })[] }) {
  return (
    <div>
      <h3 className="mb-2 text-ink">{title}</h3>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-ink">{r.label}</span>
              <span className="shrink-0 whitespace-nowrap text-muted">{formatCredits(r.credits)} credits · {r.calls} {r.calls === 1 ? 'call' : 'calls'}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-line">
              <div className="h-1.5 rounded-full bg-gold" style={{ width: `${total > 0 ? Math.max(1, (r.credits / total) * 100) : 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActivityRow({ item }: { item: Item }) {
  const Icon = item.readingType ? serviceByType(item.readingType).icon : item.kind === 'chat' ? MessageCircle : Sparkles;
  const href = item.readingId ? `/admin/readings/${item.readingId}` : item.conversationId ? `/admin/conversations/${item.conversationId}` : null;
  const title = <span className="text-ink">{item.title}</span>;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Icon size={18} className="mt-0.5 shrink-0 text-gold" />
      <div className="min-w-0 flex-1">
        {href ? <Link href={href} className="hover:underline">{title}</Link> : title}
        <p className="text-xs text-muted">
          {item.tasks.join(', ')} · {languageName(item.language)} · {item.models.map(shortModel).join(', ')}
        </p>
        <p className="text-xs text-faint">
          {formatDate(item.startedAt, true)} · {item.calls} {item.calls === 1 ? 'call' : 'calls'} · {formatTokens(item.promptTokens)} sent, {formatTokens(item.completionTokens)} written
          {item.failed > 0 && <span className="text-danger"> · {item.failed} failed</span>}
        </p>
      </div>
      <span className="shrink-0 text-right text-ink">{formatCredits(item.credits)}<span className="block text-xs text-faint">credits</span></span>
    </li>
  );
}
