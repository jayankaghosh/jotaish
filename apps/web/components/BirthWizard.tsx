'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Calendar, Check, Clock, MapPin, User } from 'lucide-react';
import { gql } from '@/lib/gql';
import { PROFILE_FIELDS } from '@/lib/fragments';
import type { BirthProfile, Place } from '@/lib/types';
import { PlaceSearch } from './PlaceSearch';
import { ErrorNote, Spinner, Tip } from './ui';

const RELATIONS = ['self', 'partner', 'spouse', 'child', 'parent', 'sibling', 'friend', 'other'];

type TimeMode = 'exact' | 'approx' | 'unknown';

interface Props {
  initial?: Partial<BirthProfile>;
  askName?: boolean;
  onSaved: (p: BirthProfile) => void;
  onCancel?: () => void;
  saveLabel?: string;
}

const APPROX = [
  { label: 'Early morning', hint: '4 to 8 am', time: '06:00' },
  { label: 'Morning', hint: '8 am to noon', time: '10:00' },
  { label: 'Afternoon', hint: 'noon to 4 pm', time: '14:00' },
  { label: 'Evening', hint: '4 to 8 pm', time: '18:00' },
  { label: 'Night', hint: '8 pm to midnight', time: '22:00' },
  { label: 'Late night', hint: 'midnight to 4 am', time: '02:00' },
];

export function BirthWizard({ initial, askName = true, onSaved, onCancel, saveLabel = 'Save birth details' }: Props) {
  const steps = [...(askName ? ['who'] : []), 'date', 'time', 'place', 'review'] as const;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name ?? '');
  const [relation, setRelation] = useState(initial?.relation ?? (askName ? 'partner' : 'self'));
  const [gender, setGender] = useState(initial?.gender ?? '');
  const [date, setDate] = useState(initial?.birthDate ?? '');
  const [timeMode, setTimeMode] = useState<TimeMode>(initial?.id && !initial.birthTime ? 'unknown' : 'exact');
  const [time, setTime] = useState(initial?.birthTime ?? '');
  const [place, setPlace] = useState<Place | null>(
    initial?.birthPlace ? { name: initial.birthPlace, label: initial.birthPlace, latitude: initial.latitude!, longitude: initial.longitude!, timezone: initial.timezone! } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = steps[step];
  const canNext =
    (current === 'who' && name.trim().length > 0) ||
    (current === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(date)) ||
    (current === 'time' && (timeMode === 'unknown' || /^\d{2}:\d{2}$/.test(time))) ||
    (current === 'place' && place !== null) ||
    current === 'review';

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const { saveProfile } = await gql<{ saveProfile: BirthProfile }>(
        `mutation($input: ProfileInput!) { saveProfile(input: $input) { ${PROFILE_FIELDS} } }`,
        {
          input: {
            id: initial?.id,
            name: name.trim(),
            relation,
            gender: gender || null,
            birthDate: date,
            birthTime: timeMode === 'unknown' ? null : time,
            birthPlace: place!.label,
            latitude: place!.latitude,
            longitude: place!.longitude,
            timezone: place!.timezone,
          },
        },
      );
      onSaved(saveProfile);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const pretty = date ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <div>
      <div className="mb-8 flex items-center gap-2" aria-label={`Step ${step + 1} of ${steps.length}`}>
        {steps.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition ${i <= step ? 'bg-gold' : 'bg-line'}`} />
        ))}
      </div>

      {current === 'who' && (
        <section className="space-y-5">
          <Header icon={<User />} title="Who is this chart for?" body="You can save details for family and friends too, for example to check compatibility with a partner." />
          <div>
            <label className="label" htmlFor="pname">Their name</label>
            <input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul" autoFocus />
          </div>
          <div>
            <span className="label">How are they related to you?</span>
            <div className="flex flex-wrap gap-2">
              {RELATIONS.map((r) => (
                <button key={r} type="button" onClick={() => setRelation(r)} className={`chip capitalize ${relation === r ? 'border-gold bg-gold/15 text-gold-soft' : 'hover:text-ink'}`}>
                  {r === 'self' ? 'Myself' : r}
                </button>
              ))}
            </div>
          </div>
          <GenderPicker value={gender} onChange={setGender} />
        </section>
      )}

      {current === 'date' && (
        <section className="space-y-5">
          <Header icon={<Calendar />} title={askName ? `When was ${name || 'they'} born?` : 'When were you born?'} body="Your date of birth decides your Sun sign and where the slow-moving planets were." />
          <div>
            <label className="label" htmlFor="bdate">Date of birth</label>
            <input id="bdate" type="date" className="input" value={date} max={new Date().toISOString().slice(0, 10)} min="1900-01-01" onChange={(e) => setDate(e.target.value)} autoFocus />
            {pretty && <p className="hint">That's {pretty}.</p>}
          </div>
          {!askName && <GenderPicker value={gender} onChange={setGender} />}
        </section>
      )}

      {current === 'time' && (
        <section className="space-y-5">
          <Header icon={<Clock />} title="What time were you born?" body="The time sets your ascendant (lagna) and houses, which change every two hours. It is usually on the birth certificate or hospital record." />
          <div className="grid gap-2 sm:grid-cols-3">
            {([
              ['exact', 'I know the time'],
              ['approx', 'Roughly'],
              ['unknown', "I don't know"],
            ] as [TimeMode, string][]).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setTimeMode(mode);
                  if (mode === 'unknown') setTime('');
                }}
                className={`rounded-xl border px-4 py-3 text-sm transition ${timeMode === mode ? 'border-gold bg-gold/10 text-gold-soft' : 'border-line text-muted hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {timeMode === 'exact' && (
            <div>
              <label className="label" htmlFor="btime">Time of birth (local time where you were born)</label>
              <input id="btime" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} autoFocus />
            </div>
          )}
          {timeMode === 'approx' && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {APPROX.map((a) => (
                <button key={a.label} type="button" onClick={() => setTime(a.time)} className={`rounded-xl border px-3 py-3 text-left text-sm ${time === a.time ? 'border-gold bg-gold/10' : 'border-line hover:border-gold/40'}`}>
                  <span className="block text-ink">{a.label}</span>
                  <span className="text-xs text-faint">{a.hint}</span>
                </button>
              ))}
            </div>
          )}
          {timeMode === 'approx' && (
            <Tip>
              That works. We'll use the middle of that window. Your Moon sign and nakshatra will almost certainly be right; the
              ascendant may shift. You can add the exact time later from your profile.
            </Tip>
          )}
          {timeMode === 'unknown' && (
            <Tip>
              No problem. We'll read your chart from your Moon sign, which is still very meaningful. You can add the exact time later
              from your profile and every new reading will become more precise.
            </Tip>
          )}
        </section>
      )}

      {current === 'place' && (
        <section className="space-y-5">
          <Header icon={<MapPin />} title="Where were you born?" body="The place gives us the latitude, longitude and time zone, so the planets are placed correctly in the sky above you." />
          <PlaceSearch value={place} onSelect={setPlace} />
          {place && <p className="hint">Selected: {place.label} ({place.latitude.toFixed(2)}, {place.longitude.toFixed(2)}, {place.timezone})</p>}
          <p className="hint">If your village isn't listed, choose the nearest town. A few kilometres makes almost no difference.</p>
        </section>
      )}

      {current === 'review' && (
        <section className="space-y-5">
          <Header icon={<Check />} title="Does this look right?" body="Please check once. You can always edit these later from your profile." />
          <dl className="divide-y divide-line rounded-xl border border-line">
            {[
              ['Name', name],
              ['Date of birth', pretty],
              ['Time of birth', timeMode === 'unknown' ? 'Not known' : `${time}${timeMode === 'approx' ? ' (approximate)' : ''}`],
              ['Place of birth', place?.label],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <ErrorNote message={error} />
        </section>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        {step > 0 ? (
          <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)} disabled={busy}>
            <ArrowLeft size={16} /> Back
          </button>
        ) : onCancel ? (
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        ) : (
          <span />
        )}
        {current === 'review' ? (
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>
            {busy ? <Spinner /> : <Check size={16} />} {saveLabel}
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={() => setStep(step + 1)} disabled={!canNext}>
            Continue <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function Header({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="mb-3 inline-flex rounded-full bg-gold/15 p-3 text-gold">{icon}</div>
      <h2 className="font-display text-3xl text-ink">{title}</h2>
      <p className="mt-1 text-muted">{body}</p>
    </div>
  );
}

function GenderPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="label">Gender <span className="font-normal text-faint">(optional)</span></span>
      <div className="flex flex-wrap gap-2">
        {['female', 'male', 'other'].map((g) => (
          <button key={g} type="button" onClick={() => onChange(value === g ? '' : g)} className={`chip capitalize ${value === g ? 'border-gold bg-gold/15 text-gold-soft' : 'hover:text-ink'}`}>
            {g}
          </button>
        ))}
      </div>
      <p className="hint">Some traditional readings, like matching, use it.</p>
    </div>
  );
}
