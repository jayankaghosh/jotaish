'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Coins, Languages } from 'lucide-react';
import { LANGUAGES, useI18n } from '@/lib/i18n';

export function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === lang)!;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted hover:text-ink"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t('language.choose')}
      >
        <Languages size={16} /> {!compact && current.native}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-raised shadow-xl">
          <ul className="py-1" role="listbox">
            {LANGUAGES.map((l) => (
              <li key={l.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={l.code === lang}
                  onClick={() => {
                    setLang(l.code);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-ink hover:bg-surface"
                >
                  <span>
                    {l.native}
                    {l.code !== 'en' && <span className="ml-2 text-xs text-faint">{l.name}</span>}
                    {/* Readings in Indian scripts cost several times more to write. */}
                    {l.code !== 'en' && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-gold-soft">
                        <Coins size={12} aria-hidden /> {t('language.moreCredits')}
                      </span>
                    )}
                  </span>
                  {l.code === lang && <Check size={14} className="text-gold" />}
                </button>
              </li>
            ))}
          </ul>
          <p className="flex gap-2 border-t border-line px-4 py-3 text-xs text-muted">
            <Coins size={14} className="mt-0.5 shrink-0 text-gold" aria-hidden />
            {t('language.creditsNote')}
          </p>
        </div>
      )}
    </div>
  );
}
