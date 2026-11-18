'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
import { PageTitle, Spinner, formatDate } from '@/components/ui';
import { creditsLeft } from '@/lib/credits';
import { gql } from '@/lib/gql';
import type { User } from '@/lib/types';

const PAGE = 25;

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const [data, setData] = useState<{ total: number; items: User[] } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      gql<{ adminUsers: { total: number; items: User[] } }>(
        `query($search: String, $skip: Int, $take: Int) { adminUsers(search: $search, skip: $skip, take: $take) { total items { id name email role disabled createdAt lastSeenAt readingCount conversationCount usage { used limit remaining balance spentUsd period } } } }`,
        { search: search || null, skip, take: PAGE },
      ).then((d) => setData(d.adminUsers));
    }, 250);
    return () => clearTimeout(t);
  }, [search, skip]);

  return (
    <AdminShell>
      <PageTitle title="Users" subtitle="Everyone who has signed up. Open a user to see their birth details, readings and conversations." />
      <div className="relative mb-4 max-w-md">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
        <input className="input pl-11" placeholder="Search by name or email" value={search} onChange={(e) => { setSearch(e.target.value); setSkip(0); }} />
      </div>
      {!data ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase text-faint">
              <tr><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Joined</th><th className="p-4">Last seen</th><th className="p-4 text-right">Readings</th><th className="p-4 text-right">Chats</th><th className="p-4 text-right">Credits used</th><th className="p-4 text-right">Credits left</th><th className="p-4">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((u) => (
                <tr key={u.id} className="hover:bg-raised/50">
                  <td className="p-4"><Link href={`/admin/users/${u.id}`} className="text-gold-soft hover:underline">{u.name || '(no name yet)'}</Link></td>
                  <td className="p-4 text-muted">{u.email}</td>
                  <td className="p-4 text-muted">{formatDate(u.createdAt)}</td>
                  <td className="p-4 text-muted">{u.lastSeenAt ? formatDate(u.lastSeenAt) : '-'}</td>
                  <td className="p-4 text-right text-muted">{u.readingCount}</td>
                  <td className="p-4 text-right text-muted">{u.conversationCount}</td>
                  <td className="p-4 text-right text-muted">{u.usage ? `${u.usage.used}${u.usage.limit !== null ? ` / ${u.usage.limit}` : ''}` : '-'}{u.usage && <span className="block text-xs text-faint">${u.usage.spentUsd.toFixed(3)}</span>}</td>
                  <td className="p-4 text-right">
                    {u.usage ? (
                      creditsLeft(u.usage) === null ? (
                        <span className="text-muted">Unlimited</span>
                      ) : (
                        <>
                          <span className="text-ink">{creditsLeft(u.usage)!.toLocaleString('en-IN')}</span>
                          <span className="block text-xs text-faint">{(u.usage.remaining ?? 0).toLocaleString('en-IN')} free + {u.usage.balance.toLocaleString('en-IN')} bought</span>
                        </>
                      )
                    ) : '-'}
                  </td>
                  <td className="p-4">
                    {u.role === 'ADMIN' && <span className="chip mr-1 border-gold/50 text-gold-soft">Admin</span>}
                    {u.disabled && <span className="chip border-danger/50 text-danger">Blocked</span>}
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted">No users match.</td></tr>}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-line p-4 text-sm text-muted">
            <span>{data.total} users</span>
            <div className="flex gap-2">
              <button className="btn-ghost !py-1.5" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))}>Previous</button>
              <button className="btn-ghost !py-1.5" disabled={skip + PAGE >= data.total} onClick={() => setSkip(skip + PAGE)}>Next</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
