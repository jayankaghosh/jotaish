'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { gql } from '@/lib/gql';
import type { Place } from '@/lib/types';
import { Spinner } from './ui';

export function PlaceSearch({ value, onSelect }: { value: Place | null; onSelect: (p: Place | null) => void }) {
  const [query, setQuery] = useState(value?.label ?? '');
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (value && query === value.label) return;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const { searchPlaces } = await gql<{ searchPlaces: Place[] }>(
          `query($q: String!) { searchPlaces(query: $q) { name label latitude longitude timezone } }`,
          { q: query },
        );
        setResults(searchPlaces);
        setOpen(true);
      } finally {
        setBusy(false);
      }
    }, 350);
  }, [query, value]);

  return (
    <div className="relative">
      <div className="relative">
        <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
        <input
          className="input pl-11"
          placeholder="Start typing a town or city, e.g. Jaipur"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onSelect(null);
          }}
          onFocus={() => results.length && setOpen(true)}
          autoComplete="off"
        />
        {busy && <span className="absolute right-4 top-1/2 -translate-y-1/2"><Spinner size={16} /></span>}
      </div>
      {open && results.length > 0 && !value && (
        <ul className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-line bg-raised shadow-xl">
          {results.map((p) => (
            <li key={`${p.label}-${p.latitude}`}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-4 py-3 text-left hover:bg-surface"
                onClick={() => {
                  onSelect(p);
                  setQuery(p.label);
                  setOpen(false);
                }}
              >
                <span className="text-ink">{p.label}</span>
                <span className="text-xs text-faint">Time zone {p.timezone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !busy && query.trim().length >= 2 && results.length === 0 && !value && (
        <p className="hint">No matches yet. Try the nearest larger town, or add the country, e.g. "Kota, India".</p>
      )}
    </div>
  );
}
