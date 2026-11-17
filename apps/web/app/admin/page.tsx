'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { ErrorNote, PageTitle, Spinner, formatDate } from '@/components/ui';
import { gql } from '@/lib/gql';
import en from '@/lib/locales/en';
import { serviceByType, serviceKey } from '@/lib/services';
import type { ReadingType } from '@/lib/types';

interface Stats {
  users: number;
  newUsersThisWeek: number;
  conversations: number;
  messages: number;
  readings: number;
  readingsByType: { key: string; count: number }[];
  aiCalls: number;
  aiErrors: number;
  aiCost: number;
  usageByModel: { model: string; calls: number; promptTokens: number; completionTokens: number; cost: number }[];
  recentUsage: { id: string; task: string; model: string; promptTokens: number; completionTokens: number; cost: number | null; latencyMs: number; error: string | null; userName: string | null; createdAt: string }[];
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gql<{ adminStats: Stats }>(`{ adminStats {
      users newUsersThisWeek conversations messages readings aiCalls aiErrors aiCost
      readingsByType { key count }
      usageByModel { model calls promptTokens completionTokens cost }
      recentUsage { id task model promptTokens completionTokens cost latencyMs error userName createdAt }
    } }`)
      .then((d) => setStats(d.adminStats))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <AdminShell>
      <PageTitle title="Overview" subtitle="How people are using Jotaish, and what the AI is costing." />
      <ErrorNote message={error} />
      {!stats && !error && <Spinner />}
      {stats && (
        <div className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Users" value={stats.users} sub={`${stats.newUsersThisWeek} new this week`} />
            <Stat label="Readings" value={stats.readings} />
            <Stat label="Conversations" value={stats.conversations} sub={`${stats.messages} user messages`} />
            <Stat label="AI spend" value={`$${stats.aiCost.toFixed(3)}`} sub={`${stats.aiCalls} calls, ${stats.aiErrors} failed`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-6">
              <h2 className="mb-4 font-display text-2xl text-ink">Readings by type</h2>
              {stats.readingsByType.length === 0 && <p className="text-sm text-muted">No readings yet.</p>}
              <ul className="space-y-3">
                {stats.readingsByType.sort((a, b) => b.count - a.count).map((r) => (
                  <li key={r.key}>
                    <div className="mb-1 flex justify-between text-sm"><span className="text-ink">{en[serviceKey(serviceByType(r.key as ReadingType), 'title')]}</span><span className="text-muted">{r.count}</span></div>
                    <div className="h-2 rounded-full bg-line"><div className="h-2 rounded-full bg-gold" style={{ width: `${(r.count / Math.max(1, stats.readings)) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            </section>
            <section className="card overflow-x-auto p-6">
              <h2 className="mb-4 font-display text-2xl text-ink">Usage by model</h2>
              {stats.usageByModel.length === 0 && <p className="text-sm text-muted">No AI calls yet.</p>}
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-faint"><tr><th className="pb-2">Model</th><th className="pb-2 text-right">Calls</th><th className="pb-2 text-right">Tokens</th><th className="pb-2 text-right">Cost</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {stats.usageByModel.map((m) => (
                    <tr key={m.model}>
                      <td className="py-2 text-ink">{m.model}</td>
                      <td className="py-2 text-right text-muted">{m.calls}</td>
                      <td className="py-2 text-right text-muted">{(m.promptTokens + m.completionTokens).toLocaleString()}</td>
                      <td className="py-2 text-right text-muted">${m.cost.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <section className="card overflow-x-auto p-6">
            <h2 className="mb-4 font-display text-2xl text-ink">Recent AI calls</h2>
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase text-faint"><tr><th className="pb-2">When</th><th className="pb-2">User</th><th className="pb-2">Task</th><th className="pb-2">Model</th><th className="pb-2 text-right">Tokens</th><th className="pb-2 text-right">Time</th><th className="pb-2">Status</th></tr></thead>
              <tbody className="divide-y divide-line">
                {stats.recentUsage.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2 text-muted">{formatDate(u.createdAt, true)}</td>
                    <td className="py-2 text-ink">{u.userName ?? '-'}</td>
                    <td className="py-2 text-muted">{u.task}</td>
                    <td className="py-2 text-muted">{u.model}</td>
                    <td className="py-2 text-right text-muted">{u.promptTokens + u.completionTokens}</td>
                    <td className="py-2 text-right text-muted">{(u.latencyMs / 1000).toFixed(1)}s</td>
                    <td className="py-2">{u.error ? <span className="text-danger" title={u.error}>Failed</span> : <span className="text-ok">OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </AdminShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-1 font-display text-4xl text-gold-soft">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}
