'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, Gauge, IndianRupee, KeyRound, Lock, Mail, Plus, Trash2, XCircle } from 'lucide-react';
import { imageToDataUrl } from '@/lib/image';
import { AdminShell } from '@/components/AdminShell';
import { ErrorNote, PageTitle, Spinner, Tip } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { gql } from '@/lib/gql';

interface TaskSetting { task: string; label: string; hint: string; needs: string[]; model: string; languagesModel: string | null }
interface Recommended { id: string; label: string; strengths: string; vision: boolean; tools: boolean }
interface Settings {
  apiKeySet: boolean;
  apiKeyPreview: string | null;
  apiKeySource: string;
  temperature: number;
  creditLimit: number | null;
  creditPeriod: 'day' | 'month' | 'total';
  creditUsd: number;
  mail: MailSettings;
  signIn: SignInSettings;
  payment: { upiId: string; payeeName: string; qrCode: string | null; packs: { rupees: number; credits: number }[] };
  tasks: TaskSetting[];
  recommendedModels: Recommended[];
}
interface MailSettings {
  provider: 'smtp' | 'gmail';
  gmailClientId: string;
  gmailClientSecretSet: boolean;
  gmailAddress: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  passwordSet: boolean;
  fromName: string;
  fromEmail: string;
  adminEmails: string;
  configured: boolean;
}
interface SignInSettings { codeMinutes: number; resendSeconds: number; maxCodes: number; windowMinutes: number; maxAttempts: number }
interface CatalogModel { id: string; name: string; promptPrice: number; completionPrice: number; vision: boolean; tools: boolean }

const SETTINGS_FIELDS = `apiKeySet apiKeyPreview apiKeySource temperature creditLimit creditPeriod creditUsd payment { upiId payeeName qrCode packs { rupees credits } } mail { provider gmailClientId gmailClientSecretSet gmailAddress host port secure username passwordSet fromName fromEmail adminEmails configured } signIn { codeMinutes resendSeconds maxCodes windowMinutes maxAttempts } tasks { task label hint needs model languagesModel } recommendedModels { id label strengths vision tools }`;

export default function AdminSettings() {
  const { refresh } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [apiKey, setApiKey] = useState('');
  // Null means a task has no separate other-language model.
  const [models, setModels] = useState<Record<string, string | null>>({});
  const [temperature, setTemperature] = useState(0.7);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  function apply(s: Settings) {
    setSettings(s);
    // Other-language choices are saved as "<task>_languages".
    setModels(Object.fromEntries(s.tasks.flatMap((t) => [[t.task, t.model], [`${t.task}_languages`, t.languagesModel]])));
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
        input: { apiKey: apiKey || null, temperature, models: Object.entries(models).map(([task, model]) => ({ task, model: model ?? '' })), ...extra },
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
      <PageTitle title="Settings" subtitle="AI models and allowances, selling credits, email and sign-in." />

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

        <PaymentSettings settings={settings} onSaved={apply} />

        <EmailSettings settings={settings} onSaved={apply} />
        <SignInCodeSettings settings={settings} onSaved={apply} />

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
              const languagesKey = `${t.task}_languages`;
              const separate = models[languagesKey] != null;
              const picker = (key: string) => (
                <ModelPicker needs={t.needs} value={models[key] ?? ''} onChange={(v) => setModels({ ...models, [key]: v })} recommended={settings.recommendedModels} byId={byId} />
              );
              return (
                <div key={t.task} className="grid gap-3 border-b border-line pb-5 last:border-0 md:grid-cols-[1fr_1.3fr]">
                  <div>
                    <p className="text-ink">{t.label}</p>
                    <p className="text-xs text-muted">{t.hint}</p>
                  </div>
                  <div>
                    {picker(t.task)}
                    <label className="mt-2 flex items-start gap-2 text-sm text-muted">
                      <input
                        type="checkbox"
                        className="mt-1 accent-[var(--color-gold)]"
                        checked={separate}
                        onChange={(e) => setModels({ ...models, [languagesKey]: e.target.checked ? models[t.task] : null })}
                      />
                      <span>Use a different model for Hindi, Malayalam, Kannada and Bengali</span>
                    </label>
                    {separate && (
                      <div className="mt-2 border-l-2 border-gold/30 pl-3">
                        {picker(languagesKey)}
                        <p className="hint">Claude models use about four times as many tokens for Indian scripts as Gemini models do.</p>
                      </div>
                    )}
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

function PaymentSettings({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const [upiId, setUpiId] = useState(settings.payment.upiId);
  const [payeeName, setPayeeName] = useState(settings.payment.payeeName);
  const [qr, setQr] = useState<string | null>(settings.payment.qrCode);
  const [packs, setPacks] = useState(settings.payment.packs.map((p) => ({ rupees: String(p.rupees), credits: String(p.credits) })));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = () => setSaved(false);
  const validPacks = packs.every((p) => /^\d+$/.test(p.rupees) && /^\d+$/.test(p.credits) && Number(p.rupees) > 0 && Number(p.credits) > 0);

  async function save() {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const { updateSettings } = await gql<{ updateSettings: Settings }>(`mutation($input: SettingsInput!) { updateSettings(input: $input) { ${SETTINGS_FIELDS} } }`, {
        input: {
          payment: {
            upiId,
            payeeName,
            qrCode: qr && qr !== settings.payment.qrCode ? qr : null,
            clearQrCode: !qr && Boolean(settings.payment.qrCode),
            packs: packs.map((p) => ({ rupees: Number(p.rupees), credits: Number(p.credits) })),
          },
        },
      });
      onSaved(updateSettings);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-6">
      <div className="mb-1 flex items-center gap-3">
        <IndianRupee className="text-gold" />
        <h2 className="font-display text-2xl text-ink">Selling credits by UPI</h2>
      </div>
      <p className="mb-5 text-sm text-muted">
        Customers see these on their Credits page. They pay to your UPI ID, upload a screenshot, and you approve it in Payments to add the credits.
        Bought credits are used after a user&apos;s free allowance and never expire.
      </p>

      <div className="grid gap-6 md:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="upi">UPI ID</label>
            <input id="upi" className="input" placeholder="yourname@okaxis" value={upiId} onChange={(e) => { setUpiId(e.target.value); dirty(); }} />
          </div>
          <div>
            <label className="label" htmlFor="payee">Name shown to payers</label>
            <input id="payee" className="input" value={payeeName} onChange={(e) => { setPayeeName(e.target.value); dirty(); }} />
          </div>
        </div>
        <div>
          <span className="label">QR code</span>
          <label className="flex h-44 w-44 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-line text-center text-xs text-muted hover:border-gold/50">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="UPI QR code" className="h-full w-full bg-white object-contain p-1" />
            ) : (
              <>
                <Plus className="text-gold" />
                Upload QR image
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  setError(null);
                  setQr(await imageToDataUrl(f));
                  dirty();
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            />
          </label>
          {qr && <button type="button" className="mt-2 text-xs text-faint hover:text-danger" onClick={() => { setQr(null); dirty(); }}>Remove QR code</button>}
        </div>
      </div>

      <h3 className="mb-2 mt-6 text-ink">Price table</h3>
      <p className="mb-3 text-xs text-muted">
        Customers can only buy whole multiples of a row. Give bigger packs a better rate to encourage them. The AI cost column is what those credits cost you at most.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="text-left text-xs uppercase text-faint">
            <tr><th className="pb-2">Price (₹)</th><th className="pb-2">Credits</th><th className="pb-2">Credits per ₹</th><th className="pb-2">AI cost</th><th /></tr>
          </thead>
          <tbody>
            {packs.map((p, i) => {
              const r = Number(p.rupees);
              const c = Number(p.credits);
              return (
                <tr key={i}>
                  <td className="py-1 pr-2"><input className="input !py-2" inputMode="numeric" value={p.rupees} onChange={(e) => { setPacks(packs.map((x, j) => (j === i ? { ...x, rupees: e.target.value } : x))); dirty(); }} /></td>
                  <td className="py-1 pr-2"><input className="input !py-2" inputMode="numeric" value={p.credits} onChange={(e) => { setPacks(packs.map((x, j) => (j === i ? { ...x, credits: e.target.value } : x))); dirty(); }} /></td>
                  <td className="py-1 pr-2 text-muted">{r > 0 && c > 0 ? (c / r).toFixed(1) : '-'}</td>
                  <td className="py-1 pr-2 text-muted">{c > 0 ? `$${(c * settings.creditUsd).toFixed(2)}` : '-'}</td>
                  <td className="py-1 text-right"><button type="button" className="p-2 text-faint hover:text-danger" onClick={() => { setPacks(packs.filter((_, j) => j !== i)); dirty(); }} aria-label="Remove row"><Trash2 size={16} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn-ghost mt-2 !py-1.5" onClick={() => { setPacks([...packs, { rupees: '', credits: '' }]); dirty(); }}><Plus size={14} /> Add row</button>
      {!settings.payment.upiId && !settings.payment.packs.length && (
        <p className="hint">Until a UPI ID and at least one row are saved, customers see &quot;Buying credits isn&apos;t open just yet&quot;.</p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={busy || !validPacks}>{busy ? <Spinner /> : 'Save payment settings'}</button>
        {saved && <span className="text-sm text-ok">Saved.</span>}
      </div>
      <div className="mt-3"><ErrorNote message={error} /></div>
    </section>
  );
}

function EmailSettings({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const m = settings.mail;
  const [provider, setProvider] = useState<'smtp' | 'gmail'>(m.provider);
  const [form, setForm] = useState({
    host: m.host,
    port: String(m.port),
    secure: m.secure,
    username: m.username,
    fromName: m.fromName,
    fromEmail: m.fromEmail,
    adminEmails: m.adminEmails,
    gmailClientId: m.gmailClientId,
  });
  const [password, setPassword] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testTo, setTestTo] = useState(m.adminEmails.split(/[,;\s]+/)[0] || m.gmailAddress || m.username);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [redirectUri, setRedirectUri] = useState('');

  useEffect(() => setRedirectUri(`${window.location.origin}/admin/settings/gmail`), []);

  const set = (patch: Partial<typeof form>) => {
    setForm({ ...form, ...patch });
    setSaved(false);
  };

  async function save() {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const { updateSettings } = await gql<{ updateSettings: Settings }>(`mutation($input: SettingsInput!) { updateSettings(input: $input) { ${SETTINGS_FIELDS} } }`, {
        input: { mail: { ...form, provider, port: Number(form.port), password: password || null, gmailClientSecret: clientSecret || null } },
      });
      onSaved(updateSettings);
      setPassword('');
      setClientSecret('');
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      const { gmailConnectUrl } = await gql<{ gmailConnectUrl: string }>(`mutation($r: String!) { gmailConnectUrl(redirectUri: $r) }`, { r: redirectUri });
      window.location.href = gmailConnectUrl;
    } catch (e) {
      setError((e as Error).message);
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (!confirm('Disconnect Gmail? Emails stop until you connect again.')) return;
    await gql(`mutation { disconnectGmail { provider } }`);
    const { adminSettings } = await gql<{ adminSettings: Settings }>(`{ adminSettings { ${SETTINGS_FIELDS} } }`);
    onSaved(adminSettings);
  }

  async function sendTest() {
    setTesting(true);
    setTest(null);
    try {
      await gql(`mutation($to: String!) { sendTestEmail(to: $to) }`, { to: testTo });
      setTest({ ok: true, message: `Sent. Check the inbox of ${testTo}.` });
    } catch (e) {
      setTest({ ok: false, message: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  const gmailReady = m.gmailClientId && m.gmailClientSecretSet;
  const unsavedGmail = form.gmailClientId !== m.gmailClientId || clientSecret !== '' || provider !== m.provider;

  return (
    <section className="card p-6">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <Mail className="text-gold" />
        <h2 className="font-display text-2xl text-ink">Email</h2>
        {m.configured ? <span className="chip border-ok/40 text-ok">Set up</span> : <span className="chip border-danger/40 text-danger">Not set up</span>}
      </div>
      <p className="mb-5 text-sm text-muted">
        Used to send readings as PDFs, payment updates, email confirmation codes, admin alerts and your own messages from the Emails page.
      </p>

      <span className="label">Send email using</span>
      <div className="mb-6 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => { setProvider('gmail'); setSaved(false); }} className={`rounded-xl border p-4 text-left ${provider === 'gmail' ? 'border-gold bg-gold/10' : 'border-line hover:border-gold/40'}`}>
          <span className="block text-ink">Gmail (API)</span>
          <span className="text-xs text-muted">Sign in with Google. Works even where the host blocks email ports, such as DigitalOcean.</span>
        </button>
        <button type="button" onClick={() => { setProvider('smtp'); setSaved(false); }} className={`rounded-xl border p-4 text-left ${provider === 'smtp' ? 'border-gold bg-gold/10' : 'border-line hover:border-gold/40'}`}>
          <span className="block text-ink">SMTP server</span>
          <span className="text-xs text-muted">Gmail with an App Password, Brevo, Zoho or any other mail service.</span>
        </button>
      </div>

      {provider === 'gmail' ? (
        <div className="space-y-4">
          <Tip>
            You need a Google Cloud OAuth client (free). Add this exact address as an <strong>Authorized redirect URI</strong> on it:
            <code className="mt-2 block break-all rounded-lg bg-night/60 px-3 py-2 text-gold-soft">{redirectUri}</code>
          </Tip>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="g-id">Client ID</label>
              <input id="g-id" className="input font-mono text-xs" placeholder="1234-abc.apps.googleusercontent.com" value={form.gmailClientId} onChange={(e) => set({ gmailClientId: e.target.value })} autoComplete="off" />
            </div>
            <div>
              <label className="label" htmlFor="g-secret">Client secret {m.gmailClientSecretSet && <span className="font-normal text-faint">(saved; leave empty to keep it)</span>}</label>
              <input id="g-secret" className="input font-mono text-xs" type="password" placeholder={m.gmailClientSecretSet ? '••••••••••••' : 'GOCSPX-…'} value={clientSecret} onChange={(e) => { setClientSecret(e.target.value); setSaved(false); }} autoComplete="new-password" />
            </div>
          </div>
          <div className="rounded-xl border border-line p-4">
            {m.gmailAddress ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink"><CheckCircle2 size={16} className="mr-1.5 inline text-ok" />Connected. Emails are sent from <strong>{m.gmailAddress}</strong>.</p>
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost !py-1.5" onClick={connect} disabled={connecting || unsavedGmail}>Reconnect</button>
                  <button type="button" className="btn-danger !py-1.5" onClick={disconnect}>Disconnect</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  {gmailReady && !unsavedGmail ? 'Now connect the Gmail account Jotaish should send from.' : 'Save the Client ID and Client secret, then connect your Gmail account.'}
                </p>
                <button type="button" className="btn-primary" onClick={connect} disabled={connecting || !gmailReady || unsavedGmail}>
                  {connecting ? <Spinner /> : <Mail size={16} />} Connect Gmail
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <button type="button" className="btn-ghost mb-4" onClick={() => set({ host: 'smtp.gmail.com', port: '465', secure: true, fromEmail: form.fromEmail || form.username })}>Fill in Gmail SMTP</button>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="smtp-host">SMTP server</label>
              <input id="smtp-host" className="input" placeholder="smtp.gmail.com" value={form.host} onChange={(e) => set({ host: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="smtp-port">Port</label>
                <input id="smtp-port" className="input" inputMode="numeric" value={form.port} onChange={(e) => set({ port: e.target.value.replace(/\D/g, ''), secure: e.target.value === '465' ? true : e.target.value === '587' ? false : form.secure })} />
              </div>
              <div>
                <label className="label" htmlFor="smtp-sec">Security</label>
                <select id="smtp-sec" className="input" value={form.secure ? 'ssl' : 'starttls'} onChange={(e) => set({ secure: e.target.value === 'ssl' })}>
                  <option value="ssl">SSL (port 465)</option>
                  <option value="starttls">STARTTLS (587 or 2525)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="smtp-user">Username</label>
              <input id="smtp-user" className="input" value={form.username} onChange={(e) => set({ username: e.target.value })} autoComplete="off" />
            </div>
            <div>
              <label className="label" htmlFor="smtp-pass">Password {m.passwordSet && <span className="font-normal text-faint">(saved; leave empty to keep it)</span>}</label>
              <input id="smtp-pass" className="input" type="password" placeholder={m.passwordSet ? '••••••••••••••••' : 'App password or SMTP key'} value={password} onChange={(e) => { setPassword(e.target.value); setSaved(false); }} autoComplete="new-password" />
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="smtp-from">Sender address</label>
              <input id="smtp-from" className="input" placeholder="Usually the same as the username" value={form.fromEmail} onChange={(e) => set({ fromEmail: e.target.value })} />
            </div>
          </div>
        </>
      )}

      <div className="mt-6 grid gap-4 border-t border-line pt-5 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="smtp-from-name">Sender name</label>
          <input id="smtp-from-name" className="input" value={form.fromName} onChange={(e) => set({ fromName: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="smtp-admins">Send admin alerts to</label>
          <input id="smtp-admins" className="input" placeholder="you@gmail.com, partner@example.com" value={form.adminEmails} onChange={(e) => set({ adminEmails: e.target.value })} />
          <p className="hint">New payments to check and customers running out of credits. Separate several addresses with commas.</p>
        </div>
      </div>


      <div className="mt-5 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner /> : 'Save email settings'}</button>
        {saved && <span className="text-sm text-ok">Saved.</span>}
      </div>
      <div className="mt-3"><ErrorNote message={error} /></div>

      <div className="mt-6 border-t border-line pt-5">
        <label className="label" htmlFor="smtp-test">Send a test email to</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="smtp-test" className="input sm:max-w-sm" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          <button className="btn-ghost" onClick={sendTest} disabled={testing || !m.configured || !testTo}>{testing ? <Spinner /> : 'Send test email'}</button>
        </div>
        {!m.configured && <p className="hint">{provider === 'gmail' ? 'Connect Gmail first.' : 'Save the settings first.'}</p>}
        {test && (
          <p className={`mt-2 flex items-center gap-1.5 text-sm ${test.ok ? 'text-ok' : 'text-danger'}`}>
            {test.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {test.message}
          </p>
        )}
      </div>
    </section>
  );
}

const SIGN_IN_FIELDS: { key: keyof SignInSettings; label: string; unit: string; hint: string }[] = [
  { key: 'codeMinutes', label: 'Code works for', unit: 'minutes', hint: 'After this the code expires and a new one is needed.' },
  { key: 'resendSeconds', label: 'Wait before resending', unit: 'seconds', hint: 'How long the "Send a new code" button stays greyed out.' },
  { key: 'maxCodes', label: 'Codes per email address', unit: 'codes', hint: 'Including the first one, within the period below.' },
  { key: 'windowMinutes', label: 'Period for that limit', unit: 'minutes', hint: 'Once the limit is reached, the person waits until the oldest code is this old.' },
  { key: 'maxAttempts', label: 'Wrong tries per code', unit: 'tries', hint: 'Then the code stops working and a new one is needed.' },
];

function SignInCodeSettings({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const [form, setForm] = useState(() => Object.fromEntries(SIGN_IN_FIELDS.map((f) => [f.key, String(settings.signIn[f.key])])) as Record<keyof SignInSettings, string>);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = SIGN_IN_FIELDS.every((f) => /^\d+$/.test(form[f.key].trim()));

  async function save() {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const { updateSettings } = await gql<{ updateSettings: Settings }>(`mutation($input: SettingsInput!) { updateSettings(input: $input) { ${SETTINGS_FIELDS} } }`, {
        input: { signIn: Object.fromEntries(SIGN_IN_FIELDS.map((f) => [f.key, Number(form[f.key])])) },
      });
      onSaved(updateSettings);
      // Values outside the allowed range come back adjusted.
      setForm(Object.fromEntries(SIGN_IN_FIELDS.map((f) => [f.key, String(updateSettings.signIn[f.key])])) as Record<keyof SignInSettings, string>);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-6">
      <div className="mb-1 flex items-center gap-3">
        <Lock className="text-gold" />
        <h2 className="font-display text-2xl text-ink">Sign-in codes</h2>
      </div>
      <p className="mb-5 text-sm text-muted">
        Customers sign in with a 6-digit code emailed to them; there are no passwords. New email addresses get an account the
        first time they enter a code. These limits keep the codes safe and stop anyone flooding an inbox. Admins can still use
        their password on the console sign-in page.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {SIGN_IN_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label" htmlFor={`signin-${f.key}`}>{f.label}</label>
            <div className="flex items-center gap-2">
              <input id={`signin-${f.key}`} className="input w-28" inputMode="numeric" value={form[f.key]} onChange={(e) => { setForm({ ...form, [f.key]: e.target.value }); setSaved(false); }} />
              <span className="text-sm text-muted">{f.unit}</span>
            </div>
            <p className="hint">{f.hint}</p>
          </div>
        ))}
      </div>
      {!settings.mail.configured && (
        <div className="mt-4"><Tip>Email isn&apos;t set up yet, so customers can&apos;t receive codes. Set it up in the Email section above.</Tip></div>
      )}
      <div className="mt-5 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={busy || !valid}>{busy ? <Spinner /> : 'Save sign-in settings'}</button>
        {saved && <span className="text-sm text-ok">Saved.</span>}
      </div>
      <div className="mt-3"><ErrorNote message={error} /></div>
    </section>
  );
}

interface PickerProps {
  needs: string[];
  value: string;
  onChange: (model: string) => void;
  recommended: Recommended[];
  byId: Map<string, CatalogModel>;
}

// A recommended model, or any id from the OpenRouter catalogue, with its price.
function ModelPicker({ needs, value, onChange, recommended, byId }: PickerProps) {
  const chosen = byId.get(value);
  const missing = needs.filter((n) => chosen && !(n === 'vision' ? chosen.vision : chosen.tools));
  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select className="input sm:w-56" value={recommended.some((r) => r.id === value) ? value : ''} onChange={(e) => e.target.value && onChange(e.target.value)}>
          <option value="">Custom model…</option>
          {recommended.filter((r) => needs.every((n) => (n === 'vision' ? r.vision : r.tools))).map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
        <input className="input flex-1 font-mono text-xs" list="catalog" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
      <p className="hint">
        {chosen
          ? `$${chosen.promptPrice.toFixed(2)} / $${chosen.completionPrice.toFixed(2)}${chosen.vision ? ' · images' : ''}${chosen.tools ? ' · tools' : ''}`
          : byId.size ? 'Not found in the OpenRouter catalogue. Check the id.' : ''}
      </p>
      {missing.length > 0 && <p className="mt-1 text-xs text-danger">This model does not support {missing.join(' and ')}, which this task needs.</p>}
    </div>
  );
}
