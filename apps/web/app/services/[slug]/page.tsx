'use client';

import Link from 'next/link';
import { use, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Clock, MessageCircle, Sparkles } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PersonPicker } from '@/components/PersonPicker';
import { BackLink, Consulting, ErrorNote, Tip } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { OutOfAllowance, isOutOfAllowance, usageLine } from '@/components/UsageNote';
import { gql } from '@/lib/gql';
import { photoToDataUrl } from '@/lib/image';
import { ZODIAC, serviceBySlug, type Service } from '@/lib/services';
import type { BirthProfile } from '@/lib/types';

export default function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const service = serviceBySlug(slug);
  const router = useRouter();
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
        <p className="text-muted">That reading does not exist. <Link href="/dashboard" className="text-gold">Go back home</Link>.</p>
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
      <BackLink href="/dashboard" label="All readings" />
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-start gap-4">
          <div className="rounded-2xl bg-gold/15 p-3 text-gold"><Icon size={28} /></div>
          <div>
            <h1 className="font-display text-4xl text-ink">{service.title}</h1>
            <p className="mt-2 text-muted">{service.description}</p>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-faint"><Clock size={14} /> {service.time}. Your reading is saved to your profile automatically.</p>
            {usageLine(user?.usage) && <p className="mt-1 text-xs text-muted">{usageLine(user?.usage)}</p>}
          </div>
        </div>

        {busy ? (
          <Consulting />
        ) : isOutOfAllowance(user?.usage) ? (
          <OutOfAllowance usage={user!.usage!} />
        ) : (
          <div className="card p-6 sm:p-8">
            <ServiceForm service={service} profiles={profiles} onAdded={added} onSubmit={run} userName={user?.name ?? ''} />
            <div className="mt-4"><ErrorNote message={error} /></div>
          </div>
        )}

        {!busy && (
          <Link href={`/chat?new=1&q=${encodeURIComponent(service.askPrompt)}`} className="mt-6 flex items-center gap-3 rounded-2xl border border-line p-4 text-sm text-muted hover:border-gold/40 hover:text-ink">
            <MessageCircle size={18} className="text-gold" />
            Prefer to talk it through? Ask Jyotaish, who will guide you step by step.
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

function KundliForm({ profiles, onAdded, onSubmit }: FormProps) {
  const [profileId, setProfileId] = useState<string | null>(selfId(profiles));
  useEffect(() => {
    if (!profileId) setProfileId(selfId(profiles));
  }, [profiles, profileId]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ profileId }); }}>
      <Step n={1} title="Whose Kundli should we prepare?" hint={profiles.length ? 'Choose a person, or add someone new.' : "Let's add your birth details first."}>
        <PersonPicker profiles={profiles} value={profileId} onChange={setProfileId} onAdded={onAdded} />
      </Step>
      {profileId && (
        <Step n={2} title="Prepare the chart" hint="We calculate exact planetary positions, then write your full report.">
          <Submit disabled={!profileId}>Prepare Kundli</Submit>
        </Step>
      )}
    </form>
  );
}

function HoroscopeForm({ profiles, onAdded, onSubmit }: FormProps) {
  const [mode, setMode] = useState<'me' | 'sign'>(profiles.length ? 'me' : 'sign');
  const [profileId, setProfileId] = useState<string | null>(selfId(profiles));
  const [sign, setSign] = useState<string | null>(null);
  const [system, setSystem] = useState<'vedic' | 'western'>('vedic');
  const [period, setPeriod] = useState('today');
  const ready = mode === 'me' ? Boolean(profileId) : Boolean(sign);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(mode === 'me' ? { profileId, system, period } : { sign, system, period }); }}>
      <Step n={1} title="Personal or by sign?" hint="A personal horoscope uses your exact birth chart and is more accurate.">
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <Choice active={mode === 'me'} onClick={() => setMode('me')} title="From my birth details" body="Recommended. We work out your sign for you." />
          <Choice active={mode === 'sign'} onClick={() => setMode('sign')} title="I know my sign" body="Quick, no birth details needed." />
        </div>
        {mode === 'me' ? (
          <PersonPicker profiles={profiles} value={profileId} onChange={setProfileId} onAdded={onAdded} />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {ZODIAC.map((z) => (
              <button key={z} type="button" onClick={() => setSign(z)} className={`rounded-xl border px-3 py-2.5 text-sm ${sign === z ? 'border-gold bg-gold/10 text-gold-soft' : 'border-line text-muted hover:text-ink'}`}>{z}</button>
            ))}
          </div>
        )}
      </Step>
      <Step n={2} title="Which tradition?">
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice active={system === 'vedic'} onClick={() => setSystem('vedic')} title="Vedic (Indian)" body={mode === 'me' ? 'Read from your Moon sign (rashi).' : 'Use your rashi (Moon sign).'} />
          <Choice active={system === 'western'} onClick={() => setSystem('western')} title="Western" body={mode === 'me' ? 'Read from your Sun sign.' : 'Use your Sun sign, as in magazines.'} />
        </div>
      </Step>
      <Step n={3} title="For which period?">
        <div className="flex flex-wrap gap-2">
          {[['today', 'Today'], ['week', 'This week'], ['month', 'This month']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setPeriod(k)} className={`chip px-4 py-2 text-sm ${period === k ? 'border-gold bg-gold/15 text-gold-soft' : 'hover:text-ink'}`}>{l}</button>
          ))}
        </div>
      </Step>
      <Submit disabled={!ready}>Read my horoscope</Submit>
    </form>
  );
}

function MatchingForm({ profiles, onAdded, onSubmit }: FormProps) {
  const [a, setA] = useState<string | null>(selfId(profiles));
  const [b, setB] = useState<string | null>(null);
  useEffect(() => {
    if (!a) setA(selfId(profiles));
  }, [profiles, a]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ profileId: a, profileB: b }); }}>
      <Step n={1} title="First person" hint="Usually yourself.">
        <PersonPicker profiles={profiles} value={a} onChange={setA} onAdded={onAdded} exclude={b} />
      </Step>
      {a && (
        <Step n={2} title="Second person" hint="Your partner or the person you are considering. Their birth details are kept private to you.">
          <PersonPicker profiles={profiles} value={b} onChange={setB} onAdded={onAdded} exclude={a} addLabel="Add their birth details" />
        </Step>
      )}
      {a && b && <Submit disabled={false}>Check compatibility</Submit>}
    </form>
  );
}

const EXAMPLE_QUESTIONS = [
  'What do I need to know about my career right now?',
  'Where is my relationship heading?',
  'What is blocking me from moving forward?',
  'What energy should I bring into this month?',
];

const SPREADS = [
  { key: 'single', title: 'One card', body: 'A quick message for today.' },
  { key: 'three', title: 'Past, present, future', body: 'The most popular. Good for most questions.' },
  { key: 'relationship', title: 'Relationship', body: 'Five cards about you, them and the bond.' },
  { key: 'celtic', title: 'Celtic cross', body: 'Ten cards for a deep look at a big question.' },
];

function TarotForm({ onSubmit }: FormProps) {
  const [question, setQuestion] = useState('');
  const [spread, setSpread] = useState('three');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ question, spread }); }}>
      <Step n={1} title="What would you like guidance on?" hint="Open questions ('what', 'how') work better than yes or no questions.">
        <textarea className="input min-h-24" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Type your question, or pick one below" />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button key={q} type="button" className="chip hover:text-ink" onClick={() => setQuestion(q)}>{q}</button>
          ))}
        </div>
      </Step>
      <Step n={2} title="Choose a spread">
        <div className="grid gap-2 sm:grid-cols-2">
          {SPREADS.map((s) => <Choice key={s.key} active={spread === s.key} onClick={() => setSpread(s.key)} title={s.title} body={s.body} />)}
        </div>
      </Step>
      <Step n={3} title="Take a calm breath" hint="Hold your question in mind for a moment, then draw your cards.">
        <Submit disabled={false}>Shuffle and draw</Submit>
      </Step>
    </form>
  );
}

function NumerologyForm({ profiles, onSubmit, userName }: FormProps) {
  const self = profiles.find((p) => p.relation === 'self');
  const [fullName, setFullName] = useState(userName);
  const [birthDate, setBirthDate] = useState(self?.birthDate ?? '');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ fullName, birthDate }); }}>
      <Step n={1} title="Your full name" hint="Use the name you use most often, including middle name if you use it. Spelling matters in numerology.">
        <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Priya Anand Sharma" />
      </Step>
      <Step n={2} title="Your date of birth">
        <input type="date" className="input" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
        {self && <p className="hint">Filled in from your birth details.</p>}
      </Step>
      <Submit disabled={!fullName.trim() || !birthDate}>Reveal my numbers</Submit>
    </form>
  );
}

function PalmForm({ onSubmit }: FormProps) {
  const [hand, setHand] = useState<'right' | 'left'>('right');
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ hand, imageDataUrl: photo }); }}>
      <Step n={1} title="Which hand?" hint="In palmistry, your dominant hand shows your present and what you've made of life; the other shows what you were born with.">
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice active={hand === 'right'} onClick={() => setHand('right')} title="Right hand" body="Most people write with this one." />
          <Choice active={hand === 'left'} onClick={() => setHand('left')} title="Left hand" body="Choose this if you are left-handed." />
        </div>
      </Step>
      <Step n={2} title="Take a clear photo">
        <Tip>
          <ul className="list-disc space-y-1 pl-4">
            <li>Open your palm flat, fingers slightly apart.</li>
            <li>Use daylight or a bright lamp, no harsh shadows.</li>
            <li>Fill the frame with your palm, wrist to fingertips.</li>
          </ul>
        </Tip>
        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line p-8 text-center hover:border-gold/50">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Your palm" className="max-h-64 rounded-xl" />
          ) : (
            <>
              <Camera className="text-gold" size={32} />
              <span className="text-ink">Tap to take or choose a photo</span>
              <span className="text-xs text-faint">JPG or PNG</span>
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
        {photo && <p className="hint">Looks good? You can tap the photo to choose a different one.</p>}
        <div className="mt-3"><ErrorNote message={error} /></div>
      </Step>
      <Submit disabled={!photo}>Read my palm</Submit>
    </form>
  );
}

const FEELINGS = ['Peaceful', 'Happy', 'Confused', 'Anxious', 'Scared', 'Sad', 'Excited', 'Strange'];

function DreamForm({ onSubmit }: FormProps) {
  const [dream, setDream] = useState('');
  const [feeling, setFeeling] = useState<string | null>(null);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ dream, feeling }); }}>
      <Step n={1} title="Describe your dream" hint="Write whatever you remember, even fragments. These questions can help: Where were you? Who was there? What happened? What stood out?">
        <textarea className="input min-h-40" value={dream} onChange={(e) => setDream(e.target.value)} placeholder="I was walking by a river at night, and a white snake…" />
        <p className="hint">{dream.trim().length < 10 ? 'A sentence or two is enough to begin.' : 'Thank you. More detail gives a richer reading, but this is enough.'}</p>
      </Step>
      <Step n={2} title="How did it feel?" hint="The feeling often matters as much as the images.">
        <div className="flex flex-wrap gap-2">
          {FEELINGS.map((f) => (
            <button key={f} type="button" onClick={() => setFeeling(feeling === f ? null : f)} className={`chip px-4 py-2 text-sm ${feeling === f ? 'border-gold bg-gold/15 text-gold-soft' : 'hover:text-ink'}`}>{f}</button>
          ))}
        </div>
      </Step>
      <Submit disabled={dream.trim().length < 10}>Interpret my dream</Submit>
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
