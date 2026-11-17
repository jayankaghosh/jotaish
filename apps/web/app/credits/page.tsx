'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, Clock, Copy, Smartphone, XCircle } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { ErrorNote, PageTitle, Spinner, Tip, formatDate } from '@/components/ui';
import { formatCredits, useUsageLine } from '@/components/UsageNote';
import { useT, type MessageKey } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { gql } from '@/lib/gql';
import { photoToDataUrl } from '@/lib/image';
import type { CreditPack, PaymentRequest } from '@/lib/types';

interface Info {
  available: boolean;
  upiId: string | null;
  payeeName: string;
  qrCode: string | null;
  packs: CreditPack[];
}

interface Quote {
  ok: boolean;
  rupees: number | null;
  credits: number | null;
  message: string | null;
  suggestions: CreditPack[];
}

type Step = 'amount' | 'pay' | 'proof' | 'done';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export default function CreditsPage() {
  const { user, refresh } = useAuth();
  const t = useT();
  const usageLine = useUsageLine();
  const [info, setInfo] = useState<Info | null>(null);
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [step, setStep] = useState<Step>('amount');
  const [chosen, setChosen] = useState<CreditPack | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  function loadPayments() {
    gql<{ myPayments: PaymentRequest[] }>(`{ myPayments { id credits rupees screenshot status creditsAdded note createdAt reviewedAt } }`).then((d) => setPayments(d.myPayments));
  }

  useEffect(() => {
    gql<{ buyCreditsInfo: Info }>(`{ buyCreditsInfo { available upiId payeeName qrCode packs { rupees credits } } }`).then((d) => setInfo(d.buyCreditsInfo));
    loadPayments();
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usage = user?.usage;

  return (
    <Shell>
      <PageTitle
        title={t('nav.credits')}
        subtitle={t('credits.subtitle')}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {!info ? (
            <Spinner />
          ) : !info.available ? (
            <div className="card p-8 text-center text-muted">{t('credits.notOpen')}</div>
          ) : (
            <div className="card p-6 sm:p-8">
              <Progress step={step} />
              {step === 'amount' && (
                <AmountStep
                  packs={info.packs}
                  onNext={(pack) => {
                    setChosen(pack);
                    setStep('pay');
                  }}
                />
              )}
              {step === 'pay' && chosen && <PayStep info={info} chosen={chosen} onBack={() => setStep('amount')} onNext={() => setStep('proof')} />}
              {step === 'proof' && chosen && (
                <ProofStep
                  chosen={chosen}
                  onBack={() => setStep('pay')}
                  onDone={() => {
                    setStep('done');
                    loadPayments();
                  }}
                />
              )}
              {step === 'done' && chosen && (
                <div className="py-6 text-center">
                  <CheckCircle2 className="mx-auto mb-3 text-ok" size={40} />
                  <h2 className="font-display text-3xl text-ink">{t('credits.thanks')}</h2>
                  <p className="mx-auto mt-2 max-w-md text-muted">{t('credits.thanksBody', { credits: formatCredits(chosen.credits) })}</p>
                  <button className="btn-ghost mt-6" onClick={() => { setChosen(null); setStep('amount'); }}>{t('credits.buyMore')}</button>
                </div>
              )}
            </div>
          )}

          {payments.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 font-display text-2xl text-ink">{t('credits.yourPayments')}</h2>
              <ul className="space-y-2">
                {payments.map((p) => (
                  <li key={p.id} className="card flex gap-4 p-4">
                    <button type="button" onClick={() => p.screenshot && setZoom(p.screenshot)} className="shrink-0" title={t('credits.viewScreenshot')}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.screenshot} alt={t('credits.screenshotAlt')} className="h-24 w-16 rounded-lg border border-line object-cover" />
                    </button>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="text-ink">{t('credits.creditsFor', { credits: formatCredits(p.credits), amount: inr(p.rupees) })}</p>
                      <p className="text-xs text-faint">
                        {t('credits.sent', { date: formatDate(p.createdAt, true) })}
                        {p.reviewedAt ? ` · ${t('credits.checked', { date: formatDate(p.reviewedAt, true) })}` : ''}
                      </p>
                      <StatusChip payment={p} />
                      {p.status === 'rejected' && p.note && <p className="text-sm text-muted">{t('credits.reason', { reason: p.note })}</p>}
                      {p.status === 'approved' && p.note && <p className="text-sm text-muted">{p.note}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {zoom && (
          <button className="fixed inset-0 z-50 flex items-center justify-center bg-night/90 p-4" onClick={() => setZoom(null)} aria-label={t('credits.closeScreenshot')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom} alt={t('credits.screenshotAlt')} className="max-h-full max-w-full rounded-xl" />
          </button>
        )}

        <aside className="card h-fit space-y-4 p-6">
          <h2 className="font-display text-2xl text-ink">{t('credits.balance')}</h2>
          <div>
            <p className="text-xs uppercase tracking-wider text-faint">{t('nav.credits')}</p>
            <p className="font-display text-4xl text-gold-soft">{formatCredits(usage?.balance ?? 0)}</p>
          </div>
          {usage?.percentLeft != null && (
            <div>
              <p className="text-xs uppercase tracking-wider text-faint">{t('credits.freeAllowance')}</p>
              <div className="mt-1 h-2 rounded-full bg-line"><div className="h-2 rounded-full bg-gold" style={{ width: `${usage.percentLeft}%` }} /></div>
              <p className="mt-1 text-xs text-muted">{usageLine({ ...usage, balance: 0 })}</p>
            </div>
          )}
          <p className="text-xs text-muted">{t('credits.longerUseMore')}</p>
        </aside>
      </div>
    </Shell>
  );
}

function Progress({ step }: { step: Step }) {
  const t = useT();
  const steps: [Step, MessageKey][] = [['amount', 'credits.step.amount'], ['pay', 'credits.step.pay'], ['proof', 'credits.step.proof']];
  const index = step === 'done' ? 3 : steps.findIndex(([s]) => s === step);
  return (
    <ol className="mb-8 grid grid-cols-3 gap-2 text-xs">
      {steps.map(([key, label], i) => (
        <li key={key}>
          <div className={`mb-1.5 h-1.5 rounded-full ${i <= index ? 'bg-gold' : 'bg-line'}`} />
          <span className={i <= index ? 'text-ink' : 'text-faint'}>{i + 1}. {t(label)}</span>
        </li>
      ))}
    </ol>
  );
}

function StatusChip({ payment }: { payment: PaymentRequest }) {
  const t = useT();
  if (payment.status === 'approved') {
    return <span className="chip border-ok/40 text-ok"><Check size={12} /> {t('credits.approved', { credits: formatCredits(payment.creditsAdded ?? payment.credits) })}</span>;
  }
  if (payment.status === 'rejected') return <span className="chip border-danger/40 text-danger"><XCircle size={12} /> {t('credits.rejected')}</span>;
  return <span className="chip border-gold/40 text-gold-soft"><Clock size={12} /> {t('credits.checking')}</span>;
}

function AmountStep({ packs, onNext }: { packs: CreditPack[]; onNext: (p: CreditPack) => void }) {
  const t = useT();
  const [mode, setMode] = useState<'credits' | 'rupees'>('credits');
  const [value, setValue] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [checking, setChecking] = useState(false);

  // Most credits per rupee gets a "best value" tag.
  const bestRate = useMemo(() => Math.max(...packs.map((p) => p.credits / p.rupees)), [packs]);

  useEffect(() => {
    setQuote(null);
    const n = Number(value);
    if (!value.trim()) return;
    if (!Number.isInteger(n) || n <= 0) {
      setQuote({ ok: false, rupees: null, credits: null, message: t('credits.wholeNumber'), suggestions: [] });
      return;
    }
    setChecking(true);
    const timer = setTimeout(() => {
      gql<{ creditQuote: Quote }>(`query($c: Int, $r: Int) { creditQuote(credits: $c, rupees: $r) { ok rupees credits message suggestions { rupees credits } } }`, mode === 'credits' ? { c: n } : { r: n })
        .then((d) => setQuote(d.creditQuote))
        .finally(() => setChecking(false));
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, mode]);

  const pick = (p: CreditPack) => {
    setMode('credits');
    setValue(String(p.credits));
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-3xl text-ink">{t('credits.howMany')}</h2>
        <p className="mt-1 text-muted">{t('credits.howManyBody')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {packs.map((p) => (
          <button key={p.rupees} type="button" onClick={() => pick(p)} className={`relative rounded-xl border p-4 text-left transition ${quote?.ok && quote.credits === p.credits ? 'border-gold bg-gold/10' : 'border-line hover:border-gold/40'}`}>
            {packs.length > 1 && p.credits / p.rupees === bestRate && <span className="chip absolute right-3 top-3 border-ok/40 text-ok">{t('credits.bestValue')}</span>}
            <span className="block font-display text-3xl text-gold-soft">{formatCredits(p.credits)}</span>
            <span className="text-sm text-muted">{t('credits.creditsForAmount', { amount: inr(p.rupees) })}</span>
          </button>
        ))}
      </div>
      <div>
        <div className="mb-2 flex gap-2">
          {(['credits', 'rupees'] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); setValue(''); }} className={`chip px-4 py-1.5 text-sm ${mode === m ? 'border-gold bg-gold/15 text-gold-soft' : 'hover:text-ink'}`}>
              {m === 'credits' ? t('credits.modeCredits') : t('credits.modeRupees')}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs">
          {mode === 'rupees' && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">₹</span>}
          <input className={`input ${mode === 'rupees' ? 'pl-8' : ''}`} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ''))} placeholder={mode === 'credits' ? t('credits.egCredits') : t('credits.egRupees')} />
          {checking && <span className="absolute right-4 top-1/2 -translate-y-1/2"><Spinner size={16} /></span>}
        </div>
        {quote?.ok && (
          <p className="mt-3 text-ink">
            <span className="font-display text-2xl text-gold-soft">{t('credits.creditsFor', { credits: formatCredits(quote.credits!), amount: inr(quote.rupees!) })}</span>
          </p>
        )}
        {quote && !quote.ok && (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-muted">{quote.message}</p>
            <div className="flex flex-wrap gap-2">
              {quote.suggestions.map((s) => (
                <button key={s.rupees} type="button" className="chip px-3 py-1.5 text-sm hover:border-gold/50 hover:text-ink" onClick={() => pick(s)}>
                  {t('usage.credits', { credits: formatCredits(s.credits) })} · {inr(s.rupees)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <button className="btn-primary" disabled={!quote?.ok} onClick={() => onNext({ rupees: quote!.rupees!, credits: quote!.credits! })}>
        {t('credits.toPayment')} <ArrowRight size={16} />
      </button>
    </section>
  );
}

function PayStep({ info, chosen, onBack, onNext }: { info: Info; chosen: CreditPack; onBack: () => void; onNext: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const upiLink = `upi://pay?pa=${encodeURIComponent(info.upiId!)}&pn=${encodeURIComponent(info.payeeName)}&am=${chosen.rupees}&cu=INR&tn=${encodeURIComponent('Jotaish credits')}`;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-3xl text-ink">{t('credits.payTitle', { amount: inr(chosen.rupees) })}</h2>
        <p className="mt-1 text-muted">{t('credits.payBody', { amount: inr(chosen.rupees), credits: formatCredits(chosen.credits) })}</p>
      </div>
      <div className="grid items-start gap-6 sm:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div>
            <p className="label">{t('credits.sendTo')}</p>
            <div className="flex items-center gap-2">
              <code className="rounded-xl border border-line bg-night/60 px-4 py-3 text-lg text-gold-soft">{info.upiId}</code>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  void navigator.clipboard?.writeText(info.upiId!).then(() => setCopied(true));
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? t('credits.copied') : t('credits.copy')}
              </button>
            </div>
            <p className="hint">{t('credits.payingTo', { name: info.payeeName })}</p>
          </div>
          <a href={upiLink} className="btn-primary sm:hidden"><Smartphone size={16} /> {t('credits.payApp')}</a>
          <Tip>{t('credits.screenshotTip')}</Tip>
        </div>
        {info.qrCode && (
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={info.qrCode} alt={t('credits.qrAlt')} className="mx-auto w-52 rounded-xl bg-white p-2" />
            <p className="hint">{t('credits.orScan')}</p>
          </div>
        )}
      </div>
      <div className="flex justify-between gap-3">
        <button className="btn-ghost" onClick={onBack}><ArrowLeft size={16} /> {t('credits.changeAmount')}</button>
        <button className="btn-primary" onClick={onNext}>{t('credits.paid')} <ArrowRight size={16} /></button>
      </div>
    </section>
  );
}

function ProofStep({ chosen, onBack, onDone }: { chosen: CreditPack; onBack: () => void; onDone: () => void }) {
  const t = useT();
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await gql(`mutation($c: Int!, $r: Int!, $s: String!) { submitPayment(credits: $c, rupees: $r, screenshot: $s) { id } }`, { c: chosen.credits, r: chosen.rupees, s: shot });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-3xl text-ink">{t('credits.proofTitle')}</h2>
        <p className="mt-1 text-muted">{t('credits.proofBody')}</p>
      </div>
      <dl className="divide-y divide-line rounded-xl border border-line text-sm">
        <div className="flex justify-between px-4 py-3"><dt className="text-muted">{t('credits.requested')}</dt><dd className="text-ink">{formatCredits(chosen.credits)}</dd></div>
        <div className="flex justify-between px-4 py-3"><dt className="text-muted">{t('credits.amountPaid')}</dt><dd className="text-ink">{inr(chosen.rupees)}</dd></div>
      </dl>
      <div>
        <span className="label">{t('credits.screenshotLabel')}</span>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line p-8 text-center hover:border-gold/50">
          {shot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot} alt={t('credits.screenshotAlt')} className="max-h-72 rounded-xl" />
          ) : (
            <>
              <Camera className="text-gold" size={32} />
              <span className="text-ink">{t('credits.tapScreenshot')}</span>
              <span className="text-xs text-faint">{t('credits.screenshotShould')}</span>
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
                setShot(await photoToDataUrl(f, 1600));
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          />
        </label>
        {shot && <p className="hint">{t('credits.tapDifferent')}</p>}
      </div>
      <ErrorNote message={error} />
      <div className="flex justify-between gap-3">
        <button className="btn-ghost" onClick={onBack} disabled={busy}><ArrowLeft size={16} /> {t('common.back')}</button>
        <button className="btn-primary" onClick={submit} disabled={!shot || busy}>{busy ? <Spinner /> : <Check size={16} />} {t('credits.submitProof')}</button>
      </div>
    </section>
  );
}
