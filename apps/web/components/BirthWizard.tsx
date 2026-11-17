'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Calendar, Check, Clock, MapPin, User } from 'lucide-react';
import { gql } from '@/lib/gql';
import { formatDate } from '@/lib/dates';
import { useI18n, type MessageKey } from '@/lib/i18n';
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

const APPROX: { key: string; time: string }[] = [
  { key: 'earlyMorning', time: '06:00' },
  { key: 'morning', time: '10:00' },
  { key: 'afternoon', time: '14:00' },
  { key: 'evening', time: '18:00' },
  { key: 'night', time: '22:00' },
  { key: 'lateNight', time: '02:00' },
];

export function BirthWizard({ initial, askName = true, onSaved, onCancel, saveLabel }: Props) {
  const { t, term } = useI18n();
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

  const pretty = date ? formatDate(`${date}T00:00:00`) : '';

  return (
    <div>
      <div className="mb-8 flex items-center gap-2" aria-label={t('wizard.stepOf', { step: step + 1, total: steps.length })}>
        {steps.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition ${i <= step ? 'bg-gold' : 'bg-line'}`} />
        ))}
      </div>

      {current === 'who' && (
        <section className="space-y-5">
          <Header icon={<User />} title={t('wizard.who.title')} body={t('wizard.who.body')} />
          <div>
            <label className="label" htmlFor="pname">{t('wizard.theirName')}</label>
            <input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('wizard.theirNamePlaceholder')} autoFocus />
          </div>
          <div>
            <span className="label">{t('wizard.relation')}</span>
            <div className="flex flex-wrap gap-2">
              {RELATIONS.map((r) => (
                <button key={r} type="button" onClick={() => setRelation(r)} className={`chip capitalize ${relation === r ? 'border-gold bg-gold/15 text-gold-soft' : 'hover:text-ink'}`}>
                  {term('relation', r)}
                </button>
              ))}
            </div>
          </div>
          <GenderPicker value={gender} onChange={setGender} />
        </section>
      )}

      {current === 'date' && (
        <section className="space-y-5">
          <Header icon={<Calendar />} title={askName ? t('wizard.date.titleOther', { name: name || t('wizard.they') }) : t('wizard.date.title')} body={t('wizard.date.body')} />
          <div>
            <label className="label" htmlFor="bdate">{t('wizard.dateOfBirth')}</label>
            <input id="bdate" type="date" className="input" value={date} max={new Date().toISOString().slice(0, 10)} min="1900-01-01" onChange={(e) => setDate(e.target.value)} autoFocus />
            {pretty && <p className="hint">{t('wizard.thatIs', { date: pretty })}</p>}
          </div>
          {!askName && <GenderPicker value={gender} onChange={setGender} />}
        </section>
      )}

      {current === 'time' && (
        <section className="space-y-5">
          <Header icon={<Clock />} title={t('wizard.time.title')} body={t('wizard.time.body')} />
          <div className="grid gap-2 sm:grid-cols-3">
            {([
              ['exact', 'wizard.time.exact'],
              ['approx', 'wizard.time.approx'],
              ['unknown', 'wizard.time.unknown'],
            ] as [TimeMode, MessageKey][]).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setTimeMode(mode);
                  if (mode === 'unknown') setTime('');
                }}
                className={`rounded-xl border px-4 py-3 text-sm transition ${timeMode === mode ? 'border-gold bg-gold/10 text-gold-soft' : 'border-line text-muted hover:text-ink'}`}
              >
                {t(label)}
              </button>
            ))}
          </div>
          {timeMode === 'exact' && (
            <div>
              <label className="label" htmlFor="btime">{t('wizard.timeLabel')}</label>
              <input id="btime" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} autoFocus />
            </div>
          )}
          {timeMode === 'approx' && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {APPROX.map((a) => (
                <button key={a.key} type="button" onClick={() => setTime(a.time)} className={`rounded-xl border px-3 py-3 text-left text-sm ${time === a.time ? 'border-gold bg-gold/10' : 'border-line hover:border-gold/40'}`}>
                  <span className="block text-ink">{t(`wizard.approx.${a.key}` as MessageKey)}</span>
                  <span className="text-xs text-faint">{t(`wizard.approx.${a.key}.hint` as MessageKey)}</span>
                </button>
              ))}
            </div>
          )}
          {timeMode === 'approx' && (
            <Tip>{t('wizard.approxTip')}</Tip>
          )}
          {timeMode === 'unknown' && (
            <Tip>{t('wizard.unknownTip')}</Tip>
          )}
        </section>
      )}

      {current === 'place' && (
        <section className="space-y-5">
          <Header icon={<MapPin />} title={t('wizard.place.title')} body={t('wizard.place.body')} />
          <PlaceSearch value={place} onSelect={setPlace} />
          {place && <p className="hint">{t('wizard.selected', { place: `${place.label} (${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)}, ${place.timezone})` })}</p>}
          <p className="hint">{t('wizard.placeHint')}</p>
        </section>
      )}

      {current === 'review' && (
        <section className="space-y-5">
          <Header icon={<Check />} title={t('wizard.review.title')} body={t('wizard.review.body')} />
          <dl className="divide-y divide-line rounded-xl border border-line">
            {[
              [t('wizard.review.name'), name],
              [t('wizard.dateOfBirth'), pretty],
              [t('wizard.review.time'), timeMode === 'unknown' ? t('wizard.review.notKnown') : `${time}${timeMode === 'approx' ? ` (${t('wizard.review.approximate')})` : ''}`],
              [t('wizard.review.place'), place?.label],
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
            <ArrowLeft size={16} /> {t('common.back')}
          </button>
        ) : onCancel ? (
          <button type="button" className="btn-ghost" onClick={onCancel}>{t('common.cancel')}</button>
        ) : (
          <span />
        )}
        {current === 'review' ? (
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>
            {busy ? <Spinner /> : <Check size={16} />} {saveLabel ?? t('wizard.save')}
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={() => setStep(step + 1)} disabled={!canNext}>
            {t('common.continue')} <ArrowRight size={16} />
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
  const { t } = useI18n();
  return (
    <div>
      <span className="label">{t('wizard.gender')} <span className="font-normal text-faint">{t('wizard.optional')}</span></span>
      <div className="flex flex-wrap gap-2">
        {['female', 'male', 'other'].map((g) => (
          <button key={g} type="button" onClick={() => onChange(value === g ? '' : g)} className={`chip capitalize ${value === g ? 'border-gold bg-gold/15 text-gold-soft' : 'hover:text-ink'}`}>
            {t(`wizard.gender.${g}` as MessageKey)}
          </button>
        ))}
      </div>
      <p className="hint">{t('wizard.genderHint')}</p>
    </div>
  );
}
