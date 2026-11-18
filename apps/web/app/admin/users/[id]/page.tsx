'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { CreditActivity } from '@/components/CreditActivity';
import { PaymentCard } from '@/components/PaymentCard';
import { BackLink, ErrorNote, Spinner, formatDate } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { creditsLeft } from '@/lib/credits';
import { gql } from '@/lib/gql';
import { ADMIN_READING_SUMMARY, USAGE_FIELDS, USER_FIELDS } from '@/lib/fragments';
import { formatDuration } from '@/lib/dates';
import { serviceByType } from '@/lib/services';
import type { Conversation, PaymentRequest, Reading, Usage, User } from '@/lib/types';

type Tab = 'readings' | 'conversations' | 'profiles';

export default function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user: me } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [tab, setTab] = useState<Tab>('readings');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gql<{ adminUser: User; adminUserReadings: Reading[]; adminUserConversations: Conversation[] }>(
      `query($id: ID!) { adminUser(id: $id) { ${USER_FIELDS} } adminUserReadings(userId: $id) { ${ADMIN_READING_SUMMARY} } adminUserConversations(userId: $id) { id title updatedAt lastMessage } }`,
      { id },
    )
      .then((d) => {
        setUser(d.adminUser);
        setReadings(d.adminUserReadings);
        setConversations(d.adminUserConversations);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function update(mutation: string, vars: Record<string, unknown>) {
    setError(null);
    try {
      const d = await gql(mutation, vars);
      setUser((u) => (u ? { ...u, ...Object.values(d)[0] as Partial<User> } : u));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <AdminShell>
      <BackLink href="/admin/users" label="All users" />
      <ErrorNote message={error} />
      {!user ? (!error && <Spinner />) : (
        <>
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-display text-4xl text-ink">{user.name || <span className="text-muted">Name not given yet</span>}</h1>
              <p className="text-muted">
                {user.email}{' '}
                {user.role !== 'ADMIN' && (user.emailVerified ? <span className="chip border-ok/40 text-ok">Email confirmed</span> : <span className="chip border-gold/40 text-gold-soft">Hasn't signed in with a code yet</span>)}
              </p>
              <p className="text-muted">Joined {formatDate(user.createdAt)} · last seen {user.lastSeenAt ? formatDate(user.lastSeenAt, true) : 'never'}</p>
            </div>
            {me?.id !== user.id && (
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => update(`mutation($id: ID!, $role: Role!) { setUserRole(userId: $id, role: $role) { role } }`, { id, role: user.role === 'ADMIN' ? 'USER' : 'ADMIN' })}>
                  {user.role === 'ADMIN' ? 'Remove admin' : 'Make admin'}
                </button>
                <button
                  className={user.disabled ? 'btn-ghost' : 'btn-danger'}
                  onClick={() => {
                    if (!user.disabled && !confirm(`Block ${user.name}? They will be signed out and won't be able to sign in until you unblock them.`)) return;
                    void update(`mutation($id: ID!, $d: Boolean!) { setUserDisabled(userId: $id, disabled: $d) { disabled } }`, { id, d: !user.disabled });
                  }}
                >
                  {user.disabled ? 'Unblock user' : 'Block user'}
                </button>
              </div>
            )}
          </div>

          {user.disabled && (
            <div className="mb-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              This user is blocked. They can't sign in or use Jotaish until you unblock them.
            </div>
          )}

          <LimitCard user={user} onChange={(u) => setUser((prev) => (prev ? { ...prev, ...u } : prev))} />

          <CreditsCard user={user} onChange={(u) => setUser((prev) => (prev ? { ...prev, ...u } : prev))} />

          <CreditActivity userId={user.id} />

          <div className="mb-6 flex gap-2">
            {([['readings', `Readings (${readings.length})`], ['conversations', `Conversations (${conversations.length})`], ['profiles', `Birth details (${user.profiles.length})`]] as [Tab, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`chip px-4 py-2 text-sm ${tab === k ? 'border-gold text-gold-soft' : ''}`}>{l}</button>
            ))}
          </div>

          {tab === 'readings' && (
            <ul className="space-y-2">
              {readings.map((r) => {
                const s = serviceByType(r.type);
                return (
                  <li key={r.id}>
                    <Link href={`/admin/readings/${r.id}`} className="card flex items-center gap-3 p-4 hover:border-gold/50">
                      <s.icon size={18} className="text-gold" />
                      <span className="flex-1 text-ink">{r.title}</span>
                      {r.generationMs != null && <span className="text-xs text-faint" title="Time taken to write">{formatDuration(r.generationMs)}</span>}
                      <span className="text-xs text-faint">{formatDate(r.createdAt, true)}</span>
                    </Link>
                  </li>
                );
              })}
              {readings.length === 0 && <p className="text-muted">No readings yet.</p>}
            </ul>
          )}
          {tab === 'conversations' && (
            <ul className="space-y-2">
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/conversations/${c.id}`} className="card block p-4 hover:border-gold/50">
                    <div className="flex justify-between gap-4"><span className="text-ink">{c.title}</span><span className="text-xs text-faint">{formatDate(c.updatedAt, true)}</span></div>
                    {c.lastMessage && <p className="mt-1 truncate text-sm text-muted">{c.lastMessage}</p>}
                  </Link>
                </li>
              ))}
              {conversations.length === 0 && <p className="text-muted">No conversations yet.</p>}
            </ul>
          )}
          {tab === 'profiles' && (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-line text-left text-xs uppercase text-faint"><tr><th className="p-4">Name</th><th className="p-4">Relation</th><th className="p-4">Date</th><th className="p-4">Time</th><th className="p-4">Place</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {user.profiles.map((p) => (
                    <tr key={p.id}>
                      <td className="p-4 text-ink">{p.name}</td>
                      <td className="p-4 capitalize text-muted">{p.relation}</td>
                      <td className="p-4 text-muted">{p.birthDate}</td>
                      <td className="p-4 text-muted">{p.birthTime ?? 'unknown'}</td>
                      <td className="p-4 text-muted">{p.birthPlace} ({p.timezone})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}

const PERIOD_LABEL = { day: 'today', month: 'this month', total: 'in total' } as const;

function LimitCard({ user, onChange }: { user: User; onChange: (u: Partial<User>) => void }) {
  const initialMode = user.unlimitedCredits ? 'unlimited' : user.creditLimit != null ? 'custom' : 'default';
  const [mode, setMode] = useState<'default' | 'custom' | 'unlimited'>(initialMode);
  const [limit, setLimit] = useState(String(user.creditLimit ?? user.usage?.limit ?? 200));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usage = user.usage;

  async function save() {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const { setUserLimit } = await gql<{ setUserLimit: Partial<User> & { usage: Usage } }>(
        `mutation($id: ID!, $mode: String!, $limit: Int) { setUserLimit(userId: $id, mode: $mode, limit: $limit) { creditLimit unlimitedCredits usage { ${USAGE_FIELDS} } } }`,
        { id: user.id, mode, limit: mode === 'custom' ? Number(limit) : null },
      );
      onChange(setUserLimit);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const invalid = mode === 'custom' && !/^\d+$/.test(limit.trim());

  return (
    <section className="card mb-8 p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="font-display text-2xl text-ink">AI allowance</h2>
        {usage && creditsLeft(usage) !== null && (
          <p className="text-right">
            <span className="text-xs uppercase tracking-wider text-faint">Total credits left</span>
            <span className="ml-2 font-display text-3xl text-gold-soft">{creditsLeft(usage)!.toLocaleString('en-IN')}</span>
            <span className="block text-xs text-muted">{(usage.remaining ?? 0).toLocaleString('en-IN')} free {PERIOD_LABEL[usage.period]} + {usage.balance.toLocaleString('en-IN')} bought</span>
          </p>
        )}
      </div>
      <div>
        {usage && (
          <p className="text-sm text-muted">
            Used <span className="text-ink">{usage.used}</span> credits (${usage.spentUsd.toFixed(3)}) {PERIOD_LABEL[usage.period]}
            {usage.limit !== null ? <> of <span className="text-ink">{usage.limit}</span> · {usage.percentLeft}% left</> : ' · no limit'}
          </p>
        )}
      </div>
      {user.role === 'ADMIN' ? (
        <p className="mt-3 text-sm text-muted">Admins are never limited.</p>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {([
              ['default', 'Use the default', 'Follows the allowance in Settings.'],
              ['custom', 'Custom allowance', 'A different number of credits for this user.'],
              ['unlimited', 'Unlimited', 'No limit for this user.'],
            ] as const).map(([key, title, body]) => (
              <button
                key={key}
                type="button"
                onClick={() => { setMode(key); setSaved(false); }}
                className={`rounded-xl border p-4 text-left transition ${mode === key ? 'border-gold bg-gold/10' : 'border-line hover:border-gold/40'}`}
              >
                <span className="block text-ink">{title}</span>
                <span className="text-xs text-muted">{body}</span>
              </button>
            ))}
          </div>
          {mode === 'custom' && (
            <div className="mt-4">
              <label className="label" htmlFor="user-limit">Credits {usage ? `per ${usage.period === 'total' ? 'account (never resets)' : usage.period}` : ''}</label>
              <input id="user-limit" className="input sm:w-32" inputMode="numeric" value={limit} onChange={(e) => { setLimit(e.target.value); setSaved(false); }} />
              <p className="hint">1 credit = $0.001 of AI cost. The period is the same as the default one in Settings.</p>
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button className="btn-primary" onClick={save} disabled={busy || invalid}>{busy ? <Spinner /> : 'Save'}</button>
            {saved && <span className="text-sm text-ok">Saved.</span>}
          </div>
          <div className="mt-3"><ErrorNote message={error} /></div>
        </>
      )}
    </section>
  );
}

interface Grant {
  id: string;
  credits: number;
  note: string | null;
  grantedBy: string | null;
  createdAt: string;
}

function CreditsCard({ user, onChange }: { user: User; onChange: (u: Partial<User>) => void }) {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [direction, setDirection] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const load = useCallback(() => {
    gql<{ adminUserGrants: Grant[]; adminUserPayments: PaymentRequest[]; adminUser: Pick<User, 'usage'> }>(
      `query($id: ID!) { adminUserGrants(userId: $id) { id credits note grantedBy createdAt } adminUserPayments(userId: $id) { id credits rupees screenshot status creditsAdded note createdAt reviewedAt } adminUser(id: $id) { usage { ${USAGE_FIELDS} } } }`,
      { id: user.id },
    ).then((d) => {
      setGrants(d.adminUserGrants);
      setPayments(d.adminUserPayments);
      onChange({ usage: d.adminUser.usage });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => load(), [load]);

  async function grant() {
    setBusy(true);
    setError(null);
    try {
      const credits = Number(amount) * (direction === 'add' ? 1 : -1);
      await gql(`mutation($id: ID!, $c: Int!, $n: String) { grantCredits(userId: $id, credits: $c, note: $n) { id } }`, { id: user.id, c: credits, n: note || null });
      setAmount('');
      setNote('');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mb-8 p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="font-display text-2xl text-ink">Bought credits</h2>
        <p className="text-sm text-muted">Balance <span className="font-display text-2xl text-gold-soft">{(user.usage?.balance ?? 0).toLocaleString('en-IN')}</span> credits</p>
      </div>
      <p className="mt-1 text-sm text-muted">Used after the free allowance. Give credits for a verified payment, as a goodwill gesture, or remove them to correct a mistake.</p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <select className="input sm:w-36" value={direction} onChange={(e) => setDirection(e.target.value as 'add' | 'remove')} aria-label="Add or remove">
          <option value="add">Give</option>
          <option value="remove">Remove</option>
        </select>
        <input className="input sm:w-32" inputMode="numeric" placeholder="Credits" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
        <input className="input flex-1" placeholder="Reason (kept in the history)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn-primary" onClick={grant} disabled={busy || !Number(amount)}>{busy ? <Spinner /> : direction === 'add' ? 'Give credits' : 'Remove credits'}</button>
      </div>
      <div className="mt-3"><ErrorNote message={error} /></div>

      {payments.length > 0 && (
        <>
          <h3 className="mb-2 mt-6 text-ink">Payments from this user</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {payments.map((p) => <PaymentCard key={p.id} payment={p} onZoom={setZoom} onReviewed={load} showUser={false} />)}
          </div>
        </>
      )}

      {grants.length > 0 && (
        <>
          <h3 className="mb-2 mt-6 text-ink">History</h3>
          <ul className="divide-y divide-line rounded-xl border border-line text-sm">
            {grants.map((g) => (
              <li key={g.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
                <span className={g.credits > 0 ? 'text-ok' : 'text-danger'}>{g.credits > 0 ? '+' : ''}{g.credits.toLocaleString('en-IN')} credits</span>
                <span className="flex-1 text-muted">{g.note ?? ''}</span>
                <span className="text-xs text-faint">{g.grantedBy ? `${g.grantedBy} · ` : ''}{formatDate(g.createdAt, true)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {zoom && (
        <button className="fixed inset-0 z-50 flex items-center justify-center bg-night/90 p-4" onClick={() => setZoom(null)} aria-label="Close screenshot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Payment screenshot" className="max-h-full max-w-full rounded-xl" />
        </button>
      )}
    </section>
  );
}
