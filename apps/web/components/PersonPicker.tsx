'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { BirthProfile } from '@/lib/types';
import { BirthWizard } from './BirthWizard';
import { useI18n } from '@/lib/i18n';

interface Props {
  profiles: BirthProfile[];
  value: string | null;
  onChange: (id: string) => void;
  onAdded: (p: BirthProfile) => void;
  exclude?: string | null;
  addLabel?: string;
}

export function PersonPicker({ profiles, value, onChange, onAdded, exclude, addLabel }: Props) {
  const { t, term } = useI18n();
  const [addRequested, setAdding] = useState(false);
  const options = profiles.filter((p) => p.id !== exclude);
  // With nobody to choose from, adding is the only thing to do.
  const adding = addRequested || options.length === 0;

  if (adding) {
    return (
      <div className="rounded-2xl border border-line bg-night/40 p-5 sm:p-8">
        <BirthWizard
          askName={profiles.length > 0}
          initial={profiles.length === 0 ? { relation: 'self' } : undefined}
          onCancel={options.length ? () => setAdding(false) : undefined}
          onSaved={(p) => {
            onAdded(p);
            onChange(p.id);
            setAdding(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={`rounded-xl border p-4 text-left transition ${value === p.id ? 'border-gold bg-gold/10' : 'border-line hover:border-gold/40'}`}
        >
          <span className="block text-ink">{p.name} <span className="text-xs text-faint">({p.relation === 'self' ? t('person.you') : term('relation', p.relation)})</span></span>
          <span className="text-xs text-muted">{p.birthDate} · {p.birthTime ?? t('person.timeUnknown')} · {p.birthPlace.split(',')[0]}</span>
        </button>
      ))}
      <button type="button" onClick={() => setAdding(true)} className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-line p-4 text-sm text-muted hover:border-gold/50 hover:text-ink">
        <Plus size={16} /> {addLabel ?? t('person.addSomeone')}
      </button>
    </div>
  );
}
