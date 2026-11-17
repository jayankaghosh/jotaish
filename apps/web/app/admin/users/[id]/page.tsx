'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { BackLink, ErrorNote, Spinner, formatDate } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { gql } from '@/lib/gql';
import { READING_SUMMARY, USER_FIELDS } from '@/lib/fragments';
import { serviceByType } from '@/lib/services';
import type { Conversation, Reading, User } from '@/lib/types';

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
      `query($id: ID!) { adminUser(id: $id) { ${USER_FIELDS} } adminUserReadings(userId: $id) { ${READING_SUMMARY} } adminUserConversations(userId: $id) { id title updatedAt lastMessage } }`,
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
              <h1 className="font-display text-4xl text-ink">{user.name}</h1>
              <p className="text-muted">{user.email} · joined {formatDate(user.createdAt)} · last seen {user.lastSeenAt ? formatDate(user.lastSeenAt, true) : 'never'}</p>
            </div>
            {me?.id !== user.id && (
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => update(`mutation($id: ID!, $role: Role!) { setUserRole(userId: $id, role: $role) { role } }`, { id, role: user.role === 'ADMIN' ? 'USER' : 'ADMIN' })}>
                  {user.role === 'ADMIN' ? 'Remove admin' : 'Make admin'}
                </button>
                <button className={user.disabled ? 'btn-ghost' : 'btn-danger'} onClick={() => update(`mutation($id: ID!, $d: Boolean!) { setUserDisabled(userId: $id, disabled: $d) { disabled } }`, { id, d: !user.disabled })}>
                  {user.disabled ? 'Enable account' : 'Disable account'}
                </button>
              </div>
            )}
          </div>

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
