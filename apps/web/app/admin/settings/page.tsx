'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, Gauge, KeyRound, XCircle } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
import { ErrorNote, PageTitle, Spinner, Tip } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { gql } from '@/lib/gql';

interface TaskSetting { task: string; label: string; hint: string; needs: string[]; model: string }
interface Recommended { id: string; label: string; strengths: string; vision: boolean; tools: boolean }
interface Settings {
  apiKeySet: boolean;
  apiKeyPreview: string | null;
  apiKeySource: string;
  temperature: number;
  creditLimit: number | null;
  creditPeriod: 'day' | 'month' | 'total';
  creditUsd: number;
  tasks: TaskSetting[];
  recommendedModels: Recommended[];
}
interface CatalogModel { id: string; name: string; promptPrice: number; completionPrice: number; vision: boolean; tools: boolean }

const SETTINGS_FIELDS = `apiKeySet apiKeyPreview apiKeySource temperature creditLimit creditPeriod creditUsd tasks { task label hint needs model } recommendedModels { id label strengths vision tools }`;

export default function AdminSettings() {
  const { refresh } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<Record<string, string>>({});
  const [temperature, setTemperature] = useState(0.7);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  function apply(s: Settings) {
    setSettings(s);
    setModels(Object.fromEntries(s.tasks.map((t) => [t.task, t.model])));
    setTemperature(s.temperature);
  }

  useEffect(() => {
    gql<{ adminSettings: Settings }>(`{ adminSettings { ${SETTINGS_FIELDS} } }`).then((d) => apply(d.adminSettings)).catch((e) => setError(e.message));
    gql<{ openRouterModels: CatalogModel[] }>(`{ openRouterModels { id name promptPrice completionPrice vision tools } }`).then((d) => setCatalog(d.openRouterModels)).catch(() => undefined);
  }, []);

  const byId = useMemo(() => new Map(catalog.map((m) => [m.id, m])), [catalog]);

  async function save(extra: Record<string, unknown> = {}) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const { updateSettings } = await gql<{ updateSettings: Settings }>(`mutation($input: SettingsInput!) { updateSettings(input: $input) { ${SETTINGS_FIELDS} } }`, {
        input: { apiKey: apiKey || null, temperature, models: Object.entries(models).map(([task, model]) => ({ task, model })), ...extra },
      });
      apply(updateSettings);
      setApiKey('');
      setSaved(true);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTest(null);
    const { testOpenRouter } = await gql(`mutation { testOpenRouter { ok message } }`);
    setTest(testOpenRouter);
    setTesting(false);
  }

  if (!settings) return <AdminShell>{error ? <ErrorNote message={error} /> : <Spinner />}</AdminShell>;

  return (
    <AdminShell>
      <PageTitle title="AI settings" subtitle="Connect OpenRouter and choose which model handles each kind of reading." />

      <div className="space-y-6">
        <section className="card p-6">
          <div className="mb-4 flex items-center gap-3">
            <KeyRound className="text-gold" />
            <h2 className="font-display text-2xl text-ink">OpenRouter API key</h2>
            {settings.apiKeySet ? <span className="chip border-ok/40 text-ok">Connected</span> : <span className="chip border-danger/40 text-danger">Not set</span>}
          </div>
          {!settings.apiKeySet && (
            <div className="mb-4">
              <Tip>
                Create a key at <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-gold underline">openrouter.ai/keys</a>, add some credit, then paste it below.
                The key is encrypted before it is stored.
              </Tip>
            </div>
          )}
          {settings.apiKeySet && (
            <p className="mb-3 text-sm text-muted">
              Current key <code className="text-ink">{settings.apiKeyPreview}</code>
              {settings.apiKeySource === 'environment' && ' (from the server environment; saving a key here overrides it)'}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className="input flex-1" type="password" placeholder={settings.apiKeySet ? 'Paste a new key to replace it' : 'sk-or-v1-…'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
            <button className="btn-primary" onClick={() => save()} disabled={saving || !apiKey.trim()}>{saving ? <Spinner /> : 'Save key'}</button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="btn-ghost" onClick={runTest} disabled={testing || !settings.apiKeySet}>{testing ? <Spinner /> : 'Test connection'}</button>
            {settings.apiKeySource === 'settings' && (
              <button className="text-sm text-faint hover:text-danger" onClick={() => confirm('Remove the saved key? Readings will stop until a new key is added.') && save({ clearApiKey: true, apiKey: null })}>Remove saved key</button>
            )}
            {test && (
              <span className={`flex items-center gap-1.5 text-sm ${test.ok ? 'text-ok' : 'text-danger'}`}>
                {test.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {test.message}
              </span>
            )}
          </div>
        </section>

        <LimitSettings settings={settings} onSaved={apply} />

        <section className="card p-6">
          <h2 className="font-display text-2xl text-ink">Model for each task</h2>
          <p className="mb-6 mt-1 text-sm text-muted">
            Pick from the recommended list or type any model id from OpenRouter. Prices are per million tokens (input / output).
          </p>
          <datalist id="catalog">
            {catalog.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </datalist>
          <div className="space-y-5">
            {settings.tasks.map((t) => {
              const chosen = byId.get(models[t.task]);
              const missing = t.needs.filter((n) => chosen && !(n === 'vision' ? chosen.vision : chosen.tools));
              return (
                <div key={t.task} className="grid gap-3 border-b border-line pb-5 last:border-0 md:grid-cols-[1fr_1.3fr]">
                  <div>
                    <p className="text-ink">{t.label}</p>
                    <p className="text-xs text-muted">{t.hint}</p>
                  </div>
                  <div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select className="input sm:w-56" value={settings.recommendedModels.some((r) => r.id === models[t.task]) ? models[t.task] : ''} onChange={(e) => e.target.value && setModels({ ...models, [t.task]: e.target.value })}>
                        <option value="">Custom model…</option>
                        {settings.recommendedModels.filter((r) => t.needs.every((n) => (n === 'vision' ? r.vision : r.tools))).map((r) => (
                          <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                      </select>
                      <input className="input flex-1 font-mono text-xs" list="catalog" value={models[t.task] ?? ''} onChange={(e) => setModels({ ...models, [t.task]: e.target.value })} />
                    </div>
                    <p className="hint">
                      {chosen
                        ? `$${chosen.promptPrice.toFixed(2)} / $${chosen.completionPrice.toFixed(2)}${chosen.vision ? ' · images' : ''}${chosen.tools ? ' · tools' : ''}`
                        : catalog.length ? 'Not found in the OpenRouter catalogue. Check the id.' : ''}
                    </p>
                    {missing.length > 0 && <p className="mt-1 text-xs text-danger">This model does not support {missing.join(' and ')}, which this task needs.</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 max-w-md">
            <label className="label" htmlFor="temp">Creativity (temperature): {temperature.toFixed(1)}</label>
            <input id="temp" type="range" min={0} max={1.2} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="w-full accent-[var(--color-gold)]" />
            <p className="hint">Lower is more consistent, higher is more expressive. 0.7 suits readings well.</p>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button className="btn-primary" onClick={() => save()} disabled={saving}>{saving ? <Spinner /> : 'Save model settings'}</button>
            {saved && <span className="text-sm text-ok">Saved.</span>}
          </div>
          <div className="mt-3"><ErrorNote message={error} /></div>
        </section>

        <section className="card p-6">
          <div className="mb-4 flex items-center gap-2"><Eye className="text-gold" size={20} /><h2 className="font-display text-2xl text-ink">Recommended models</h2></div>
          <div className="grid gap-3 md:grid-cols-2">
            {settings.recommendedModels.map((r) => (
              <div key={r.id} className="rounded-xl border border-line p-4">
                <div className="flex items-center justify-between">
                  <p className="text-ink">{r.label}</p>
                  <div className="flex gap-1">
                    {r.vision && <span className="chip">images</span>}
                    {r.tools && <span className="chip">tools</span>}
                  </div>
                </div>
                <p className="font-mono text-xs text-faint">{r.id}</p>
                <p className="mt-1 text-sm text-muted">{r.strengths}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function LimitSettings({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const [unlimited, setUnlimited] = useState(settings.creditLimit === null);
  const [limit, setLimit] = useState(String(settings.creditLimit ?? 200));
  const [period, setPeriod] = useState(settings.creditPeriod);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const { updateSettings } = await gql<{ updateSettings: Settings }>(`mutation($input: SettingsInput!) { updateSettings(input: $input) { ${SETTINGS_FIELDS} } }`, {
        input: { limits: { limit: unlimited ? null : Number(limit), period } },
      });
      onSaved(updateSettings);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const valid = unlimited || /^\d+$/.test(limit.trim());
  const dollars = valid && !unlimited ? Number(limit) * settings.creditUsd : null;

  return (
    <section className="card p-6">
      <div className="mb-1 flex items-center gap-3">
        <Gauge className="text-gold" />
        <h2 className="font-display text-2xl text-ink">Default AI allowance per user</h2>
      </div>
      <p className="mb-5 text-sm text-muted">
        Each user can spend this many credits on AI per period. Credits follow the real OpenRouter cost of every call made for
        them (1 credit = ${settings.creditUsd}), so heavier models and long reports use more. Customers only see a percentage of
        their allowance left. You can give individual users a different allowance from their user page; admins are never limited.
      </p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div>
          <label className="label" htmlFor="limit">Credits</label>
          <input id="limit" className="input sm:w-32" inputMode="numeric" value={unlimited ? '' : limit} disabled={unlimited} onChange={(e) => { setLimit(e.target.value); setSaved(false); }} placeholder={unlimited ? 'No limit' : ''} />
        </div>
        <div>
          <label className="label" htmlFor="period">Per</label>
          <select id="period" className="input sm:w-44" value={period} disabled={unlimited} onChange={(e) => { setPeriod(e.target.value as Settings['creditPeriod']); setSaved(false); }}>
            <option value="day">Day</option>
            <option value="month">Month</option>
            <option value="total">In total (never resets)</option>
          </select>
        </div>
        <label className="flex items-center gap-2 pb-3 text-sm text-ink">
          <input type="checkbox" checked={unlimited} onChange={(e) => { setUnlimited(e.target.checked); setSaved(false); }} className="accent-[var(--color-gold)]" />
          No limit
        </label>
      </div>
      <p className="hint">
        {dollars !== null ? `That is up to $${dollars.toFixed(2)} of AI cost per user ${period === 'total' ? 'in total' : `per ${period}`}. ` : ''}
        For a sense of scale, a short chat reply is about 5 to 10 credits and a full Kundli report about 60 to 80, depending on the models chosen below.
        Days and months reset at midnight UTC.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={busy || !valid}>{busy ? <Spinner /> : 'Save allowance'}</button>
        {saved && <span className="text-sm text-ok">Saved.</span>}
      </div>
      <div className="mt-3"><ErrorNote message={error} /></div>
    </section>
  );
}
