'use client';

import { useState, type FormEvent } from 'react';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { BirthWizard } from '@/components/BirthWizard';
import { ErrorNote, PageTitle, Spinner, Tip } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { gql } from '@/lib/gql';
import { LANGUAGES, useI18n } from '@/lib/i18n';
import type { BirthProfile } from '@/lib/types';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const { t, term } = useI18n();
  const [editing, setEditing] = useState<BirthProfile | 'new' | null>(null);

  if (!user) return <Shell>{null}</Shell>;
  const self = user.profiles.find((p) => p.relation === 'self');

  async function remove(p: BirthProfile) {
    if (!confirm(t('profile.confirmRemove', { name: p.name }))) return;
    await gql(`mutation($id: ID!) { deleteProfile(id: $id) }`, { id: p.id });
    await refresh();
  }

  return (
    <Shell>
      <PageTitle title={t('profile.title')} subtitle={t('profile.subtitle')} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl text-ink">{t('profile.people')}</h2>
            {!editing && (
              <button className="btn-ghost" onClick={() => setEditing('new')}><UserPlus size={16} /> {t('profile.addPerson')}</button>
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
                  <Tip>{t('profile.addOwnFirst')}</Tip>
                </div>
              )}
              <ul className="space-y-2">
                {user.profiles.map((p) => (
                  <li key={p.id} className="flex items-center gap-4 rounded-xl border border-line p-4">
                    <div className="flex-1">
                      <p className="text-ink">{p.name} <span className="text-xs text-faint">({p.relation === 'self' ? t('person.you') : term('relation', p.relation)})</span></p>
                      <p className="text-sm text-muted">
                        {p.birthDate} · {p.birthTime ?? t('profile.timeNotKnown')} · {p.birthPlace}
                      </p>
                      {!p.birthTime && <p className="mt-1 text-xs text-gold-soft">{t('profile.addTime')}</p>}
                    </div>
                    <button className="rounded-full p-2 text-muted hover:text-gold" onClick={() => setEditing(p)} aria-label={t('profile.edit', { name: p.name })}><Pencil size={16} /></button>
                    <button className="rounded-full p-2 text-muted hover:text-danger" onClick={() => remove(p)} aria-label={t('profile.remove', { name: p.name })}><Trash2 size={16} /></button>
                  </li>
                ))}
                {user.profiles.length === 0 && <p className="text-sm text-muted">{t('profile.noOne')}</p>}
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
  const { t, lang, setLang } = useI18n();
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
      <h2 className="font-display text-2xl text-ink">{t('profile.account')}</h2>
      <div>
        <label className="label" htmlFor="acc-name">{t('wizard.review.name')}</label>
        <input id="acc-name" className="input" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
      </div>
      <div>
        <span className="label">{t('auth.email')}</span>
        <p className="text-sm text-muted">{user?.email}</p>
      </div>
      <div>
        <label className="label" htmlFor="acc-lang">{t('profile.language')}</label>
        <select id="acc-lang" className="input" value={lang} onChange={(e) => setLang(e.target.value as typeof lang)}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.native}{l.code !== 'en' ? ` (${l.name})` : ''}</option>
          ))}
        </select>
        <p className="hint">{t('profile.languageHint')}</p>
      </div>
      <button className="btn-ghost" disabled={!name.trim()}>{saved ? t('common.saved') : t('common.save')}</button>
    </form>
  );
}

function PasswordCard() {
  const { t } = useI18n();
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
      <h2 className="font-display text-2xl text-ink">{t('profile.changePassword')}</h2>
      <input type="password" className="input" placeholder={t('profile.currentPassword')} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      <input type="password" className="input" placeholder={t('profile.newPassword')} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      <ErrorNote message={error} />
      {done && <p className="text-sm text-ok">{t('profile.passwordUpdated')}</p>}
      <button className="btn-ghost" disabled={busy || !current || next.length < 8}>{busy ? <Spinner /> : t('profile.updatePassword')}</button>
    </form>
  );
}
