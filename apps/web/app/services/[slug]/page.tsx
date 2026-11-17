'use client';

import Link from 'next/link';
import { use, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Clock, MessageCircle, X } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PersonPicker } from '@/components/PersonPicker';
import { StepFlow, type FlowStep } from '@/components/StepFlow';
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
  const intro = (
    <div className="mb-6 rounded-3xl border border-line bg-surface/60 p-4">
      <p className="text-sm leading-relaxed text-muted">{t(serviceKey(service, 'description'))}</p>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-faint"><Clock size={13} /> {t('services.timeSaved', { time: t(serviceKey(service, 'time')) })}</p>
      {usageLine(user?.usage) && <p className="mt-1 text-xs text-faint">{usageLine(user?.usage)}</p>}
    </div>
  );
  const talk = (
    <Link href={`/chat?new=1&q=${encodeURIComponent(t(serviceKey(service, 'ask')))}`} className="mt-8 flex items-center gap-3 rounded-2xl border border-line p-4 text-sm text-muted hover:border-violet/50 hover:text-ink">
      <MessageCircle size={18} className="shrink-0 text-violet" />
      {t('services.talkInstead')}
    </Link>
  );

  return (
    <Shell immersive>
      {/* A focused flow: its own header on phones, no tab bar. */}
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line/70 bg-night/85 px-2 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur-xl lg:hidden">
        <Link href="/explore" className="rounded-full p-2 text-muted hover:text-ink" aria-label={t('services.allReadings')}>
          <X size={22} />
        </Link>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-gold"><Icon size={16} /></span>
        <h1 className="truncate font-display text-base font-semibold text-ink">{t(serviceKey(service, 'title'))}</h1>
      </header>

      <div className="mx-auto max-w-2xl px-4 pb-32 pt-6 lg:pb-12">
        <div className="mb-6 hidden lg:block">
          <BackLink href="/explore" label={t('services.allReadings')} />
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15 text-gold"><Icon size={26} /></span>
            <h1 className="font-display text-4xl font-semibold text-ink">{t(serviceKey(service, 'title'))}</h1>
          </div>
        </div>

        {busy ? (
          <Consulting kind={service.slug} />
        ) : isOutOfAllowance(user?.usage) ? (
          <>
            {intro}
            <OutOfAllowance usage={user!.usage!} />
          </>
        ) : (
          <>
            <ErrorNote message={error} />
            <ServiceForm service={service} profiles={profiles} onAdded={added} onSubmit={run} userName={user?.name ?? ''} intro={intro} footer={talk} />
          </>
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
  intro: ReactNode;
  footer: ReactNode;
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
    <div className="grid gap-2">
      {(['north', 'south', 'east'] as const).map((r) => (
        <Choice key={r} active={value === r} onClick={() => onChange(r)} title={t(`region.${r}`)} body={t(`region.${r}.body`)} />
      ))}
    </div>
  );
}

function KundliForm({ profiles, onAdded, onSubmit, intro, footer }: FormProps) {
  const t = useT();
  const [profileId, setProfileId] = useState<string | null>(selfId(profiles));
  const [region, setRegion] = useRegion();
  useEffect(() => {
    if (!profileId) setProfileId(selfId(profiles));
  }, [profiles, profileId]);
  return (
    <StepFlow
      intro={intro}
      footer={footer}
      finishLabel={t('kundli.submit')}
      onFinish={() => onSubmit({ profileId, region })}
      steps={[
        {
          key: 'person',
          title: t('kundli.whose'),
          hint: profiles.length ? t('kundli.whoseHint') : t('kundli.addFirst'),
          ready: Boolean(profileId),
          content: <PersonPicker profiles={profiles} value={profileId} onChange={setProfileId} onAdded={onAdded} />,
        },
        { key: 'region', title: t('region.title'), hint: t('region.hintKundli'), ready: true, content: <RegionPicker value={region} onChange={setRegion} /> },
      ]}
    />
  );
}

function HoroscopeForm({ profiles, onAdded, onSubmit, intro, footer }: FormProps) {
  const { t, term } = useI18n();
  const [mode, setMode] = useState<'me' | 'sign'>(profiles.length ? 'me' : 'sign');
  const [profileId, setProfileId] = useState<string | null>(selfId(profiles));
  const [sign, setSign] = useState<string | null>(null);
  const [system, setSystem] = useState<'vedic' | 'western'>('vedic');
  const [period, setPeriod] = useState('today');
  const [region, setRegion] = useRegion();

  const steps: FlowStep[] = [
    {
      key: 'who',
      title: t('horoscope.modeTitle'),
      hint: t('horoscope.modeHint'),
      ready: mode === 'me' ? Boolean(profileId) : Boolean(sign),
      content: (
        <>
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <Choice active={mode === 'me'} onClick={() => setMode('me')} title={t('horoscope.fromDetails')} body={t('horoscope.fromDetailsBody')} />
            <Choice active={mode === 'sign'} onClick={() => setMode('sign')} title={t('horoscope.knowSign')} body={t('horoscope.knowSignBody')} />
          </div>
          {mode === 'me' ? (
            <PersonPicker profiles={profiles} value={profileId} onChange={setProfileId} onAdded={onAdded} />
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {ZODIAC.map((z) => (
                <button key={z} type="button" onClick={() => setSign(z)} className={`min-h-12 rounded-2xl border px-2 py-2.5 text-sm ${sign === z ? 'border-gold bg-gold/10 text-gold-soft' : 'border-line text-muted hover:text-ink'}`}>{term('sign', z)}</button>
              ))}
            </div>
          )}
        </>
      ),
    },
    {
      key: 'system',
      title: t('horoscope.traditionTitle'),
      ready: true,
      auto: true,
      value: system,
      content: (
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice active={system === 'vedic'} onClick={() => setSystem('vedic')} title={t('horoscope.vedic')} body={t(mode === 'me' ? 'horoscope.vedicMe' : 'horoscope.vedicSign')} />
          <Choice active={system === 'western'} onClick={() => setSystem('western')} title={t('horoscope.western')} body={t(mode === 'me' ? 'horoscope.westernMe' : 'horoscope.westernSign')} />
        </div>
      ),
    },
  ];
  if (system === 'vedic') {
    steps.push({ key: 'region', title: t('region.title'), hint: t('region.hintHoroscope'), ready: true, auto: true, value: region, content: <RegionPicker value={region} onChange={setRegion} /> });
  }
  steps.push({
    key: 'period',
    title: t('horoscope.periodTitle'),
    ready: true,
    content: (
      <div className="grid gap-2">
        {(['today', 'week', 'month'] as const).map((k) => (
          <Choice key={k} active={period === k} onClick={() => setPeriod(k)} title={t(`horoscope.period.${k}`)} />
        ))}
      </div>
    ),
  });

  return (
    <StepFlow
      intro={intro}
      footer={footer}
      finishLabel={t('horoscope.submit')}
      onFinish={() => onSubmit(mode === 'me' ? { profileId, system, period, region } : { sign, system, period, region })}
      steps={steps}
    />
  );
}

function MatchingForm({ profiles, onAdded, onSubmit, intro, footer }: FormProps) {
  const t = useT();
  const [a, setA] = useState<string | null>(selfId(profiles));
  const [b, setB] = useState<string | null>(null);
  useEffect(() => {
    if (!a) setA(selfId(profiles));
  }, [profiles, a]);
  return (
    <StepFlow
      intro={intro}
      footer={footer}
      finishLabel={t('matching.submit')}
      onFinish={() => onSubmit({ profileId: a, profileB: b })}
      steps={[
        { key: 'a', title: t('matching.first'), hint: t('matching.firstHint'), ready: Boolean(a), content: <PersonPicker profiles={profiles} value={a} onChange={setA} onAdded={onAdded} exclude={b} /> },
        {
          key: 'b',
          title: t('matching.second'),
          hint: t('matching.secondHint'),
          ready: Boolean(b),
          content: <PersonPicker profiles={profiles} value={b} onChange={setB} onAdded={onAdded} exclude={a} addLabel={t('matching.addTheirs')} />,
        },
      ]}
    />
  );
}

const EXAMPLE_QUESTIONS: MessageKey[] = ['tarot.example1', 'tarot.example2', 'tarot.example3', 'tarot.example4'];
const SPREADS = ['single', 'three', 'relationship', 'celtic'] as const;
const SPREAD_SIZE: Record<(typeof SPREADS)[number], number> = { single: 1, three: 3, relationship: 5, celtic: 10 };
const DECK_SIZE = 78;

// The whole deck face down, fanned out to scroll through. The server
// shuffles; the places tapped decide which cards are turned.
function CardFan({ need, picks, onChange }: { need: number; picks: number[]; onChange: (p: number[]) => void }) {
  const t = useT();
  const toggle = (i: number) => {
    if (picks.includes(i)) onChange(picks.filter((p) => p !== i));
    else if (picks.length < need) onChange([...picks, i]);
  };
  const drawForMe = () => {
    const pool = Array.from({ length: DECK_SIZE }, (_, i) => i);
    const chosen: number[] = [];
    while (chosen.length < need) chosen.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    onChange(chosen);
  };
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{t('tarot.picked', { count: picks.length, total: need })}</p>
        <button type="button" onClick={picks.length ? () => onChange([]) : drawForMe} className="text-sm font-medium text-gold">
          {picks.length ? t('tarot.clearPicks') : t('tarot.drawForMe')}
        </button>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-4 pt-6 [scrollbar-width:none]">
        <div className="flex pl-1 pr-6">
          {Array.from({ length: DECK_SIZE }, (_, i) => {
            const order = picks.indexOf(i);
            const chosen = order >= 0;
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={chosen}
                aria-label={t('tarot.cardN', { n: i + 1 })}
                className={`relative -ml-7 aspect-[300/503] w-14 shrink-0 rounded-lg border bg-raised shadow-md shadow-black/40 transition first:ml-0 ${
                  chosen ? 'z-10 -translate-y-5 border-gold ring-2 ring-gold/40' : 'border-gold/30 hover:-translate-y-2'
                }`}
              >
                <span className="absolute inset-1 rounded-md border border-gold/15" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/mark.svg" alt="" className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 opacity-70" />
                {chosen && <span className="absolute -top-2.5 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-gold text-[11px] font-semibold text-night">{order + 1}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <p className="hint text-center">{t('tarot.swipeHint')}</p>
    </div>
  );
}

function TarotForm({ onSubmit, intro, footer }: FormProps) {
  const t = useT();
  const [question, setQuestion] = useState('');
  const [spread, setSpread] = useState<(typeof SPREADS)[number]>('three');
  const [picks, setPicks] = useState<number[]>([]);
  useEffect(() => setPicks([]), [spread]);
  return (
    <StepFlow
      intro={intro}
      footer={footer}
      finishLabel={t('tarot.reveal')}
      onFinish={() => onSubmit({ question, spread, picks })}
      steps={[
        {
          key: 'question',
          title: t('tarot.questionTitle'),
          hint: t('tarot.questionHint'),
          ready: true,
          content: (
            <>
              <textarea className="input min-h-28" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('tarot.questionPlaceholder')} />
              <div className="mt-3 flex flex-wrap gap-2">
                {EXAMPLE_QUESTIONS.map((k) => (
                  <button key={k} type="button" className="rounded-full border border-line bg-raised/60 px-3.5 py-2 text-left text-sm text-muted hover:text-ink" onClick={() => setQuestion(t(k))}>{t(k)}</button>
                ))}
              </div>
            </>
          ),
        },
        {
          key: 'spread',
          title: t('tarot.spreadTitle'),
          ready: true,
          auto: true,
          value: spread,
          content: (
            <div className="grid gap-2 sm:grid-cols-2">
              {SPREADS.map((s) => <Choice key={s} active={spread === s} onClick={() => setSpread(s)} title={t(`tarot.spread.${s}`)} body={t(`tarot.spread.${s}.body`)} />)}
            </div>
          ),
        },
        {
          key: 'pick',
          title: SPREAD_SIZE[spread] === 1 ? t('tarot.pickOne') : t('tarot.pickTitle', { count: SPREAD_SIZE[spread] }),
          hint: t('tarot.breathHint'),
          ready: picks.length === SPREAD_SIZE[spread],
          content: <CardFan need={SPREAD_SIZE[spread]} picks={picks} onChange={setPicks} />,
        },
      ]}
    />
  );
}

function NumerologyForm({ profiles, onSubmit, userName, intro, footer }: FormProps) {
  const t = useT();
  const self = profiles.find((p) => p.relation === 'self');
  const [fullName, setFullName] = useState(userName);
  const [birthDate, setBirthDate] = useState(self?.birthDate ?? '');
  return (
    <StepFlow
      intro={intro}
      footer={footer}
      finishLabel={t('numerology.submit')}
      onFinish={() => onSubmit({ fullName, birthDate })}
      steps={[
        {
          key: 'name',
          title: t('numerology.nameTitle'),
          hint: t('numerology.nameHint'),
          ready: /[a-z]/i.test(fullName),
          content: (
            <>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('numerology.namePlaceholder')} autoComplete="name" />
              {fullName.trim() && !/[a-z]/i.test(fullName) && <p className="hint text-gold-soft">{t('numerology.englishLetters')}</p>}
            </>
          ),
        },
        {
          key: 'date',
          title: t('numerology.dateTitle'),
          ready: Boolean(birthDate),
          content: (
            <>
              <input type="date" className="input" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
              {self && <p className="hint">{t('numerology.filled')}</p>}
            </>
          ),
        },
      ]}
    />
  );
}

function PalmForm({ onSubmit, intro, footer }: FormProps) {
  const t = useT();
  const [hand, setHand] = useState<'right' | 'left'>('right');
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <StepFlow
      intro={intro}
      footer={footer}
      finishLabel={t('palm.submit')}
      onFinish={() => onSubmit({ hand, imageDataUrl: photo })}
      steps={[
        {
          key: 'hand',
          title: t('palm.handTitle'),
          hint: t('palm.handHint'),
          ready: true,
          auto: true,
          value: hand,
          content: (
            <div className="grid gap-2 sm:grid-cols-2">
              <Choice active={hand === 'right'} onClick={() => setHand('right')} title={t('palm.right')} body={t('palm.rightBody')} />
              <Choice active={hand === 'left'} onClick={() => setHand('left')} title={t('palm.left')} body={t('palm.leftBody')} />
            </div>
          ),
        },
        {
          key: 'photo',
          title: t('palm.photoTitle'),
          ready: Boolean(photo),
          content: (
            <>
              <Tip>
                <ul className="list-disc space-y-1 pl-4">
                  <li>{t('palm.tip1')}</li>
                  <li>{t('palm.tip2')}</li>
                  <li>{t('palm.tip3')}</li>
                </ul>
              </Tip>
              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line p-8 text-center hover:border-gold/50">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt={t('palm.yourPalm')} className="max-h-64 rounded-2xl" />
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
            </>
          ),
        },
      ]}
    />
  );
}

const FEELINGS = ['Peaceful', 'Happy', 'Confused', 'Anxious', 'Scared', 'Sad', 'Excited', 'Strange'];

function DreamForm({ onSubmit, intro, footer }: FormProps) {
  const { t, term } = useI18n();
  const [dream, setDream] = useState('');
  const [feeling, setFeeling] = useState<string | null>(null);
  return (
    <StepFlow
      intro={intro}
      footer={footer}
      finishLabel={t('dream.submit')}
      onFinish={() => onSubmit({ dream, feeling })}
      steps={[
        {
          key: 'dream',
          title: t('dream.describeTitle'),
          hint: t('dream.describeHint'),
          ready: dream.trim().length >= 10,
          content: (
            <>
              <textarea className="input min-h-44" value={dream} onChange={(e) => setDream(e.target.value)} placeholder={t('dream.placeholder')} />
              <p className="hint">{dream.trim().length < 10 ? t('dream.short') : t('dream.enough')}</p>
            </>
          ),
        },
        {
          key: 'feeling',
          title: t('dream.feelTitle'),
          hint: t('dream.feelHint'),
          ready: true,
          content: (
            <div className="grid grid-cols-2 gap-2">
              {FEELINGS.map((f) => (
                <button key={f} type="button" onClick={() => setFeeling(feeling === f ? null : f)} className={`min-h-12 rounded-2xl border px-3 py-2.5 text-sm ${feeling === f ? 'border-gold bg-gold/10 text-gold-soft' : 'border-line text-muted hover:text-ink'}`}>{term('feeling', f)}</button>
              ))}
            </div>
          ),
        },
      ]}
    />
  );
}

function Choice({ active, onClick, title, body }: { active: boolean; onClick: () => void; title: string; body?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-14 items-center gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.99] ${active ? 'border-gold bg-gold/10' : 'border-line bg-surface/50 hover:border-gold/40'}`}
    >
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${active ? 'border-gold bg-gold' : 'border-faint'}`}>
        {active && <span className="h-2 w-2 rounded-full bg-night" />}
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-ink">{title}</span>
        {body && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{body}</span>}
      </span>
    </button>
  );
}
