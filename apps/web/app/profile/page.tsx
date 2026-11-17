'use client';

import { useState, type FormEvent } from 'react';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { BirthWizard } from '@/components/BirthWizard';
import { ErrorNote, PageTitle, Spinner, Tip } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { gql } from '@/lib/gql';
import type { BirthProfile } from '@/lib/types';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [editing, setEditing] = useState<BirthProfile | 'new' | null>(null);

  if (!user) return <Shell>{null}</Shell>;
  const self = user.profiles.find((p) => p.relation === 'self');

  async function remove(p: BirthProfile) {
    if (!confirm(`Remove ${p.name}'s birth details? Their saved readings will stay.`)) return;
    await gql(`mutation($id: ID!) { deleteProfile(id: $id) }`, { id: p.id });
    await refresh();
  }

  return (
    <Shell>
      <PageTitle title="Your profile" subtitle="Manage your account and the birth details Jyotaish uses for charts and matching." />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl text-ink">People and birth details</h2>
            {!editing && (
              <button className="btn-ghost" onClick={() => setEditing('new')}><UserPlus size={16} /> Add person</button>
            )}
          </div>

          {editing ? (
            <div className="rounded-2xl border border-line bg-night/40 p-5 sm:p-8">
              <BirthWizard
                askName={editing === 'new' || editing.relation !== 'self'}
                initial={editing === 'new' ? (self ? undefined : { name: user.name, relation: 'self' }) : editing}
                onCancel={() => setEditing(null)}
                onSaved={async () => {
                  await refresh();
                  setEditing(null);
                }}
              />
            </div>
          ) : (
            <>
              {!self && (
                <div className="mb-4">
                  <Tip>Add your own birth details first. Jyotaish uses them for your Kundli, horoscopes and compatibility.</Tip>
                </div>
              )}
              <ul className="space-y-2">
                {user.profiles.map((p) => (
                  <li key={p.id} className="flex items-center gap-4 rounded-xl border border-line p-4">
                    <div className="flex-1">
                      <p className="text-ink">{p.name} <span className="text-xs capitalize text-faint">({p.relation === 'self' ? 'you' : p.relation})</span></p>
                      <p className="text-sm text-muted">
                        {p.birthDate} · {p.birthTime ?? 'time not known'} · {p.birthPlace}
                      </p>
                      {!p.birthTime && <p className="mt-1 text-xs text-gold-soft">Adding a birth time will make readings more precise.</p>}
                    </div>
                    <button className="rounded-full p-2 text-muted hover:text-gold" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}><Pencil size={16} /></button>
                    <button className="rounded-full p-2 text-muted hover:text-danger" onClick={() => remove(p)} aria-label={`Remove ${p.name}`}><Trash2 size={16} /></button>
                  </li>
                ))}
                {user.profiles.length === 0 && <p className="text-sm text-muted">No one added yet.</p>}
              </ul>
            </>
          )}
        </section>

        <div className="space-y-6">
          <AccountCard />
          <PasswordCard />
        </div>
      </div>
    </Shell>
  );
}

function AccountCard() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [saved, setSaved] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    await gql(`mutation($name: String) { updateMe(name: $name) { id } }`, { name });
    await refresh();
    setSaved(true);
  }

  return (
    <form className="card space-y-4 p-6" onSubmit={save}>
      <h2 className="font-display text-2xl text-ink">Account</h2>
      <div>
        <label className="label" htmlFor="acc-name">Name</label>
        <input id="acc-name" className="input" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
      </div>
      <div>
        <span className="label">Email</span>
        <p className="text-sm text-muted">{user?.email}</p>
      </div>
      <button className="btn-ghost" disabled={!name.trim()}>{saved ? 'Saved' : 'Save'}</button>
    </form>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await gql(`mutation($current: String!, $next: String!) { changePassword(current: $current, next: $next) }`, { current, next });
      setDone(true);
      setCurrent('');
      setNext('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card space-y-4 p-6" onSubmit={save}>
      <h2 className="font-display text-2xl text-ink">Change password</h2>
      <input type="password" className="input" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      <input type="password" className="input" placeholder="New password (8+ characters)" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      <ErrorNote message={error} />
      {done && <p className="text-sm text-ok">Password updated.</p>}
      <button className="btn-ghost" disabled={busy || !current || next.length < 8}>{busy ? <Spinner /> : 'Update password'}</button>
    </form>
  );
}
