'use client';

import Link from 'next/link';
import { use, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Clock, MessageCircle, Sparkles } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PersonPicker } from '@/components/PersonPicker';
import { BackLink, Consulting, ErrorNote, Tip } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { OutOfAllowance, isOutOfAllowance, useUsageLine } from '@/components/UsageNote';
import { gql } from '@/lib/gql';
import { useI18n, useT, type MessageKey } from '@/lib/i18n';
import { photoToDataUrl } from '@/lib/image';
import { preferredRegion, rememberRegion } from '@/lib/region';
import type { ChartStyle } from '@/components/charts';
import { ZODIAC, serviceBySlug, serviceKey, type Service } from '@/lib/services';
import type { BirthProfile } from '@/lib/types';

export default function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const service = serviceBySlug(slug);
  const router = useRouter();
  const t = useT();
  const usageLine = useUsageLine();
  const { user, refresh } = useAuth();
  const [profiles, setProfiles] = useState<BirthProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) setProfiles(user.profiles);
  }, [user]);

  if (!service) {
    return (
      <Shell>
        <p className="text-muted">{t('services.notFound')} <Link href="/dashboard" className="text-gold">{t('services.goHome')}</Link></p>
      </Shell>
    );
  }

  async function run(input: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const { createReading } = await gql(`mutation($input: ReadingInput!) { createReading(input: $input) { id } }`, { input: { type: service!.type, ...input } });
      void refresh();
      router.push(`/readings/${createReading.id}?fresh=1`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const added = (p: BirthProfile) => {
    setProfiles((list) => [...list, p]);
    void refresh();
  };

  const Icon = service.icon;
  return (
    <Shell>
      <BackLink href="/dashboard" label={t('services.allReadings')} />
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-start gap-4">
          <div className="rounded-2xl bg-gold/15 p-3 text-gold"><Icon size={28} /></div>
          <div>
            <h1 className="font-display text-4xl text-ink">{t(serviceKey(service, 'title'))}</h1>
            <p className="mt-2 text-muted">{t(serviceKey(service, 'description'))}</p>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-faint"><Clock size={14} /> {t('services.timeSaved', { time: t(serviceKey(service, 'time')) })}</p>
            {usageLine(user?.usage) && <p className="mt-1 text-xs text-muted">{usageLine(user?.usage)}</p>}
          </div>
        </div>

        {busy ? (
          <Consulting kind={service.slug} />
        ) : isOutOfAllowance(user?.usage) ? (
          <OutOfAllowance usage={user!.usage!} />
        ) : (
          <div className="card p-6 sm:p-8">
            <ServiceForm service={service} profiles={profiles} onAdded={added} onSubmit={run} userName={user?.name ?? ''} />
            <div className="mt-4"><ErrorNote message={error} /></div>
          </div>
        )}

        {!busy && (
          <Link href={`/chat?new=1&q=${encodeURIComponent(t(serviceKey(service, 'ask')))}`} className="mt-6 flex items-center gap-3 rounded-2xl border border-line p-4 text-sm text-muted hover:border-gold/40 hover:text-ink">
            <MessageCircle size={18} className="text-gold" />
            {t('services.talkInstead')}
          </Link>
        )}
      </div>
    </Shell>
  );
}

interface FormProps {
  service: Service;
  profiles: BirthProfile[];
  onAdded: (p: BirthProfile) => void;
  onSubmit: (input: Record<string, unknown>) => void;
  userName: string;
}

function ServiceForm(props: FormProps) {
  switch (props.service.slug) {
    case 'kundli':
      return <KundliForm {...props} />;
    case 'horoscope':
      return <HoroscopeForm {...props} />;
    case 'matching':
      return <MatchingForm {...props} />;
    case 'tarot':
      return <TarotForm {...props} />;
    case 'numerology':
      return <NumerologyForm {...props} />;
    case 'palm':
      return <PalmForm {...props} />;
    default:
      return <DreamForm {...props} />;
  }
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mb-8 last:mb-0">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 text-sm text-gold">{n}</span>
        <div>
          <h2 className="text-lg text-ink">{title}</h2>
          {hint && <p className="text-sm text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Submit({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  return (
    <button type="submit" className="btn-primary w-full py-3 text-base sm:w-auto sm:px-10" disabled={disabled}>
      <Sparkles size={18} /> {children}
    </button>
  );
}

const selfId = (profiles: BirthProfile[]) => profiles.find((p) => p.relation === 'self')?.id ?? profiles[0]?.id ?? null;

// North, South or East Indian tradition: the chart drawing, terms and remedies.
function useRegion() {
  const { lang } = useI18n();
  const [region, setRegion] = useState<ChartStyle>('north');
  useEffect(() => setRegion(preferredRegion(lang)), [lang]);
  return [region, (r: ChartStyle) => { setRegion(r); rememberRegion(r); }] as const;
}

function RegionPicker({ value, onChange }: { value: ChartStyle; onChange: (r: ChartStyle) => void }) {
  const t = useT();
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {(['north', 'south', 'east'] as const).map((r) => (
        <Choice key={r} active={value === r} onClick={() => onChange(r)} title={t(`region.${r}`)} body={t(`region.${r}.body`)} />
      ))}
    </div>
  );
}

function KundliForm({ profiles, onAdded, onSubmit }: FormProps) {
  const t = useT();
  const [profileId, setProfileId] = useState<string | null>(selfId(profiles));
  const [region, setRegion] = useRegion();
  useEffect(() => {
    if (!profileId) setProfileId(selfId(profiles));
  }, [profiles, profileId]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ profileId, region }); }}>
      <Step n={1} title={t('kundli.whose')} hint={profiles.length ? t('kundli.whoseHint') : t('kundli.addFirst')}>
        <PersonPicker profiles={profiles} value={profileId} onChange={setProfileId} onAdded={onAdded} />
      </Step>
      {profileId && (
        <Step n={2} title={t('region.title')} hint={t('region.hintKundli')}>
          <RegionPicker value={region} onChange={setRegion} />
        </Step>
      )}
      {profileId && (
        <Step n={3} title={t('kundli.prepareTitle')} hint={t('kundli.prepareHint')}>
          <Submit disabled={!profileId}>{t('kundli.submit')}</Submit>
        </Step>
      )}
    </form>
  );
}

function HoroscopeForm({ profiles, onAdded, onSubmit }: FormProps) {
  const { t, term } = useI18n();
  const [mode, setMode] = useState<'me' | 'sign'>(profiles.length ? 'me' : 'sign');
  const [profileId, setProfileId] = useState<string | null>(selfId(profiles));
  const [sign, setSign] = useState<string | null>(null);
  const [system, setSystem] = useState<'vedic' | 'western'>('vedic');
  const [period, setPeriod] = useState('today');
  const [region, setRegion] = useRegion();
  const ready = mode === 'me' ? Boolean(profileId) : Boolean(sign);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(mode === 'me' ? { profileId, system, period, region } : { sign, system, period, region }); }}>
      <Step n={1} title={t('horoscope.modeTitle')} hint={t('horoscope.modeHint')}>
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <Choice active={mode === 'me'} onClick={() => setMode('me')} title={t('horoscope.fromDetails')} body={t('horoscope.fromDetailsBody')} />
          <Choice active={mode === 'sign'} onClick={() => setMode('sign')} title={t('horoscope.knowSign')} body={t('horoscope.knowSignBody')} />
        </div>
        {mode === 'me' ? (
          <PersonPicker profiles={profiles} value={profileId} onChange={setProfileId} onAdded={onAdded} />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {ZODIAC.map((z) => (
              <button key={z} type="button" onClick={() => setSign(z)} className={`rounded-xl border px-3 py-2.5 text-sm ${sign === z ? 'border-gold bg-gold/10 text-gold-soft' : 'border-line text-muted hover:text-ink'}`}>{term('sign', z)}</button>
            ))}
          </div>
        )}
      </Step>
      <Step n={2} title={t('horoscope.traditionTitle')}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice active={system === 'vedic'} onClick={() => setSystem('vedic')} title={t('horoscope.vedic')} body={t(mode === 'me' ? 'horoscope.vedicMe' : 'horoscope.vedicSign')} />
          <Choice active={system === 'western'} onClick={() => setSystem('western')} title={t('horoscope.western')} body={t(mode === 'me' ? 'horoscope.westernMe' : 'horoscope.westernSign')} />
        </div>
      </Step>
      {system === 'vedic' && (
        <Step n={3} title={t('region.title')} hint={t('region.hintHoroscope')}>
          <RegionPicker value={region} onChange={setRegion} />
        </Step>
      )}
      <Step n={system === 'vedic' ? 4 : 3} title={t('horoscope.periodTitle')}>
        <div className="flex flex-wrap gap-2">
          {(['today', 'week', 'month'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setPeriod(k)} className={`chip px-4 py-2 text-sm ${period === k ? 'border-gold bg-gold/15 text-gold-soft' : 'hover:text-ink'}`}>{t(`horoscope.period.${k}`)}</button>
          ))}
        </div>
      </Step>
      <Submit disabled={!ready}>{t('horoscope.submit')}</Submit>
    </form>
  );
}

function MatchingForm({ profiles, onAdded, onSubmit }: FormProps) {
  const t = useT();
  const [a, setA] = useState<string | null>(selfId(profiles));
  const [b, setB] = useState<string | null>(null);
  useEffect(() => {
    if (!a) setA(selfId(profiles));
  }, [profiles, a]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ profileId: a, profileB: b }); }}>
      <Step n={1} title={t('matching.first')} hint={t('matching.firstHint')}>
        <PersonPicker profiles={profiles} value={a} onChange={setA} onAdded={onAdded} exclude={b} />
      </Step>
      {a && (
        <Step n={2} title={t('matching.second')} hint={t('matching.secondHint')}>
          <PersonPicker profiles={profiles} value={b} onChange={setB} onAdded={onAdded} exclude={a} addLabel={t('matching.addTheirs')} />
        </Step>
      )}
      {a && b && <Submit disabled={false}>{t('matching.submit')}</Submit>}
    </form>
  );
}

const EXAMPLE_QUESTIONS: MessageKey[] = ['tarot.example1', 'tarot.example2', 'tarot.example3', 'tarot.example4'];
const SPREADS = ['single', 'three', 'relationship', 'celtic'] as const;

function TarotForm({ onSubmit }: FormProps) {
  const t = useT();
  const [question, setQuestion] = useState('');
  const [spread, setSpread] = useState('three');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ question, spread }); }}>
      <Step n={1} title={t('tarot.questionTitle')} hint={t('tarot.questionHint')}>
        <textarea className="input min-h-24" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('tarot.questionPlaceholder')} />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((k) => (
            <button key={k} type="button" className="chip hover:text-ink" onClick={() => setQuestion(t(k))}>{t(k)}</button>
          ))}
        </div>
      </Step>
      <Step n={2} title={t('tarot.spreadTitle')}>
        <div className="grid gap-2 sm:grid-cols-2">
          {SPREADS.map((s) => <Choice key={s} active={spread === s} onClick={() => setSpread(s)} title={t(`tarot.spread.${s}`)} body={t(`tarot.spread.${s}.body`)} />)}
        </div>
      </Step>
      <Step n={3} title={t('tarot.breathTitle')} hint={t('tarot.breathHint')}>
        <Submit disabled={false}>{t('tarot.submit')}</Submit>
      </Step>
    </form>
  );
}

function NumerologyForm({ profiles, onSubmit, userName }: FormProps) {
  const t = useT();
  const self = profiles.find((p) => p.relation === 'self');
  const [fullName, setFullName] = useState(userName);
  const [birthDate, setBirthDate] = useState(self?.birthDate ?? '');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ fullName, birthDate }); }}>
      <Step n={1} title={t('numerology.nameTitle')} hint={t('numerology.nameHint')}>
        <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('numerology.namePlaceholder')} />
        {fullName.trim() && !/[a-z]/i.test(fullName) && <p className="hint text-gold-soft">{t('numerology.englishLetters')}</p>}
      </Step>
      <Step n={2} title={t('numerology.dateTitle')}>
        <input type="date" className="input" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
        {self && <p className="hint">{t('numerology.filled')}</p>}
      </Step>
      <Submit disabled={!/[a-z]/i.test(fullName) || !birthDate}>{t('numerology.submit')}</Submit>
    </form>
  );
}

function PalmForm({ onSubmit }: FormProps) {
  const t = useT();
  const [hand, setHand] = useState<'right' | 'left'>('right');
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ hand, imageDataUrl: photo }); }}>
      <Step n={1} title={t('palm.handTitle')} hint={t('palm.handHint')}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice active={hand === 'right'} onClick={() => setHand('right')} title={t('palm.right')} body={t('palm.rightBody')} />
          <Choice active={hand === 'left'} onClick={() => setHand('left')} title={t('palm.left')} body={t('palm.leftBody')} />
        </div>
      </Step>
      <Step n={2} title={t('palm.photoTitle')}>
        <Tip>
          <ul className="list-disc space-y-1 pl-4">
            <li>{t('palm.tip1')}</li>
            <li>{t('palm.tip2')}</li>
            <li>{t('palm.tip3')}</li>
          </ul>
        </Tip>
        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line p-8 text-center hover:border-gold/50">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={t('palm.yourPalm')} className="max-h-64 rounded-xl" />
          ) : (
            <>
              <Camera className="text-gold" size={32} />
              <span className="text-ink">{t('palm.tapPhoto')}</span>
              <span className="text-xs text-faint">{t('palm.formats')}</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                setError(null);
                setPhoto(await photoToDataUrl(file));
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          />
        </label>
        {photo && <p className="hint">{t('palm.looksGood')}</p>}
        <div className="mt-3"><ErrorNote message={error} /></div>
      </Step>
      <Submit disabled={!photo}>{t('palm.submit')}</Submit>
    </form>
  );
}

const FEELINGS = ['Peaceful', 'Happy', 'Confused', 'Anxious', 'Scared', 'Sad', 'Excited', 'Strange'];

function DreamForm({ onSubmit }: FormProps) {
  const { t, term } = useI18n();
  const [dream, setDream] = useState('');
  const [feeling, setFeeling] = useState<string | null>(null);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ dream, feeling }); }}>
      <Step n={1} title={t('dream.describeTitle')} hint={t('dream.describeHint')}>
        <textarea className="input min-h-40" value={dream} onChange={(e) => setDream(e.target.value)} placeholder={t('dream.placeholder')} />
        <p className="hint">{dream.trim().length < 10 ? t('dream.short') : t('dream.enough')}</p>
      </Step>
      <Step n={2} title={t('dream.feelTitle')} hint={t('dream.feelHint')}>
        <div className="flex flex-wrap gap-2">
          {FEELINGS.map((f) => (
            <button key={f} type="button" onClick={() => setFeeling(feeling === f ? null : f)} className={`chip px-4 py-2 text-sm ${feeling === f ? 'border-gold bg-gold/15 text-gold-soft' : 'hover:text-ink'}`}>{term('feeling', f)}</button>
          ))}
        </div>
      </Step>
      <Submit disabled={dream.trim().length < 10}>{t('dream.submit')}</Submit>
    </form>
  );
}

function Choice({ active, onClick, title, body }: { active: boolean; onClick: () => void; title: string; body: string }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border p-4 text-left transition ${active ? 'border-gold bg-gold/10' : 'border-line hover:border-gold/40'}`}>
      <span className="block text-ink">{title}</span>
      <span className="text-xs text-muted">{body}</span>
    </button>
  );
}
