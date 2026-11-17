'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, Search, Send, X, XCircle } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
import { ErrorNote, Markdown, PageTitle, Spinner, Tip, formatDate } from '@/components/ui';
import { gql } from '@/lib/gql';

interface Person {
  id: string;
  name: string;
  email: string;
  disabled: boolean;
  emailVerified: boolean;
}

interface LogEntry {
  id: string;
  to: string;
  subject: string;
  kind: string;
  status: string;
  error: string | null;
  createdAt: string;
}

const KINDS: [string, string][] = [
  ['', 'All'],
  ['campaign', 'Your messages'],
  ['reading', 'Readings'],
  ['payment', 'Payments'],
  ['verification', 'Confirmation codes'],
  ['alert', 'Admin alerts'],
  ['test', 'Tests'],
];

export default function AdminEmails() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [total, setTotal] = useState(0);
  const [everyone, setEveryone] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [chosen, setChosen] = useState<Person[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('Namaste {name},\n\n');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const [logKind, setLogKind] = useState('');
  const [log, setLog] = useState<LogEntry[] | null>(null);

  useEffect(() => {
    gql<{ adminSettings: { mail: { configured: boolean } } }>(`{ adminSettings { mail { configured } } }`).then((d) => setConfigured(d.adminSettings.mail.configured));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      gql<{ adminUsers: { total: number; items: Person[] } }>(
        `query($s: String) { adminUsers(search: $s, take: 50) { total items { id name email disabled emailVerified } } }`,
        { s: search || null },
      ).then((d) => {
        setResults(d.adminUsers.items);
        if (!search) setTotal(d.adminUsers.total);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  function loadLog() {
    gql<{ adminEmailLog: LogEntry[] }>(`query($k: String) { adminEmailLog(kind: $k, take: 100) { id to subject kind status error createdAt } }`, { k: logKind || null }).then((d) => setLog(d.adminEmailLog));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadLog, [logKind]);

  const toggle = (p: Person) => setChosen((c) => (c.some((x) => x.id === p.id) ? c.filter((x) => x.id !== p.id) : [...c, p]));
  const selectable = results.filter((p) => !p.disabled);
  const allShownChosen = selectable.length > 0 && selectable.every((p) => chosen.some((c) => c.id === p.id));
  const count = everyone ? total : chosen.length;

  async function send() {
    if (!confirm(`Send "${subject}" to ${count} ${count === 1 ? 'person' : 'people'}?`)) return;
    setBusy(true);
    setError(null);
    setSent(null);
    try {
      const { sendEmailToUsers } = await gql<{ sendEmailToUsers: number }>(
        `mutation($ids: [ID!], $all: Boolean, $s: String!, $b: String!) { sendEmailToUsers(userIds: $ids, everyone: $all, subject: $s, body: $b) }`,
        { ids: everyone ? null : chosen.map((c) => c.id), all: everyone, s: subject, b: body },
      );
      setSent(sendEmailToUsers);
      setSubject('');
      setBody('Namaste {name},\n\n');
      setChosen([]);
      setEveryone(false);
      setTimeout(loadLog, 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <PageTitle title="Emails" subtitle="Write to your customers, and see every email Jotaish has sent." />
      {configured === false && (
        <div className="mb-6">
          <Tip>
            Email isn&apos;t set up yet, so nothing can be sent. Add your SMTP details in <Link href="/admin/settings" className="text-gold underline">Settings</Link> first.
          </Tip>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card space-y-5 p-6">
          <h2 className="font-display text-2xl text-ink">New message</h2>

          <div>
            <span className="label">To</span>
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setEveryone(false)} className={`rounded-xl border p-3 text-left text-sm ${!everyone ? 'border-gold bg-gold/10' : 'border-line hover:border-gold/40'}`}>
                <span className="block text-ink">Chosen people</span>
                <span className="text-xs text-muted">Pick from the list below</span>
              </button>
              <button type="button" onClick={() => setEveryone(true)} className={`rounded-xl border p-3 text-left text-sm ${everyone ? 'border-gold bg-gold/10' : 'border-line hover:border-gold/40'}`}>
                <span className="block text-ink">Everyone</span>
                <span className="text-xs text-muted">All {total} accounts, except blocked ones</span>
              </button>
            </div>
            {!everyone && (
              <>
                {chosen.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {chosen.map((c) => (
                      <button key={c.id} type="button" onClick={() => toggle(c)} className="chip border-gold/40 text-gold-soft">
                        {c.name} <X size={12} />
                      </button>
                    ))}
                  </div>
                )}
                <div className="relative mb-2">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
                  <input className="input pl-10" placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="max-h-64 overflow-y-auto rounded-xl border border-line">
                  <label className="flex items-center gap-3 border-b border-line px-4 py-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      className="accent-[var(--color-gold)]"
                      checked={allShownChosen}
                      onChange={() =>
                        setChosen((c) => (allShownChosen ? c.filter((x) => !selectable.some((p) => p.id === x.id)) : [...c, ...selectable.filter((p) => !c.some((x) => x.id === p.id))]))
                      }
                    />
                    Select all {search ? 'matching' : 'shown'} ({selectable.length})
                  </label>
                  {results.map((p) => (
                    <label key={p.id} className={`flex items-center gap-3 px-4 py-2 text-sm ${p.disabled ? 'opacity-50' : 'cursor-pointer hover:bg-raised/50'}`}>
                      <input type="checkbox" className="accent-[var(--color-gold)]" disabled={p.disabled} checked={chosen.some((c) => c.id === p.id)} onChange={() => toggle(p)} />
                      <span className="flex-1 truncate text-ink">{p.name} <span className="text-faint">{p.email}</span></span>
                      {p.disabled && <span className="text-xs text-danger">blocked</span>}
                    </label>
                  ))}
                  {results.length === 0 && <p className="px-4 py-3 text-sm text-muted">No one matches.</p>}
                </div>
              </>
            )}
          </div>

          <div>
            <label className="label" htmlFor="subject">Subject</label>
            <input id="subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Your free monthly horoscope is ready" />
          </div>
          <div>
            <label className="label" htmlFor="body">Message</label>
            <textarea id="body" className="input min-h-48" value={body} onChange={(e) => setBody(e.target.value)} />
            <p className="hint">{'{name}'} becomes each person&apos;s first name. You can use **bold**, lists with &quot;- &quot;, and links like [our site](https://www.jotaish.online).</p>
          </div>

          <ErrorNote message={error} />
          {sent !== null && (
            <p className="flex items-center gap-1.5 text-sm text-ok"><CheckCircle2 size={16} /> Sending to {sent} {sent === 1 ? 'person' : 'people'}. They go out one per second; progress shows in the log.</p>
          )}
          <button className="btn-primary" onClick={send} disabled={busy || !configured || !subject.trim() || !body.trim() || count === 0}>
            {busy ? <Spinner /> : <Send size={16} />} Send to {count} {count === 1 ? 'person' : 'people'}
          </button>
        </section>

        <section className="card p-6">
          <h2 className="mb-3 font-display text-2xl text-ink">Preview</h2>
          <div className="overflow-hidden rounded-xl bg-[#f4f1ea] p-4">
            <div className="overflow-hidden rounded-xl bg-white">
              <div className="flex items-center gap-2 bg-[#15132b] px-6 py-4 font-display text-xl text-[#f3d79b]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/mark.svg" width={30} height={30} alt="" /> Jotaish
              </div>
              <div className="px-6 py-5 text-[#2a2540]">
                <h3 className="mb-3 font-display text-2xl text-[#15132b]">{subject || 'Your subject'}</h3>
                <Markdown tone="light">{body.replace(/\{name\}/g, (everyone ? null : chosen[0]?.name.split(' ')[0]) ?? 'Priya')}</Markdown>
              </div>
            </div>
          </div>
          <p className="hint">Shown with {everyone || !chosen[0] ? 'a sample name' : `${chosen[0].name.split(' ')[0]}'s name`}.</p>
        </section>
      </div>

      <section className="card mt-8 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-ink">Email log</h2>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map(([k, l]) => (
              <button key={k} onClick={() => setLogKind(k)} className={`chip px-3 py-1 ${logKind === k ? 'border-gold text-gold-soft' : ''}`}>{l}</button>
            ))}
            <button onClick={loadLog} className="chip px-3 py-1">Refresh</button>
          </div>
        </div>
        {!log ? <Spinner /> : log.length === 0 ? <p className="text-sm text-muted">No emails yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase text-faint"><tr><th className="pb-2">When</th><th className="pb-2">To</th><th className="pb-2">Subject</th><th className="pb-2">Type</th><th className="pb-2">Status</th></tr></thead>
              <tbody className="divide-y divide-line">
                {log.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 text-muted">{formatDate(e.createdAt, true)}</td>
                    <td className="py-2 text-ink">{e.to}</td>
                    <td className="py-2 text-muted">{e.subject}</td>
                    <td className="py-2 text-muted">{KINDS.find(([k]) => k === e.kind)?.[1] ?? e.kind}</td>
                    <td className="py-2">{e.status === 'sent' ? <span className="text-ok">Sent</span> : <span className="flex items-center gap-1 text-danger" title={e.error ?? ''}><XCircle size={14} /> Failed</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
