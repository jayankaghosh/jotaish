'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, MessageCircle, Sparkles } from 'lucide-react';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { cardImage, dailyCard } from '@/lib/tarot';

export interface TodaySky {
  date: string;
  moonSign: string;
  nakshatra: string;
  paksha: 'shukla' | 'krishna';
  tithi: number;
  illumination: number;
  waxing: boolean;
  personal: {
    name: string;
    moonSign: string;
    houseFromMoon: number;
    dasha: { mahadasha: string; antardasha: string; until: string } | null;
  } | null;
}

export const TODAY_QUERY = `{ today { date moonSign nakshatra paksha tithi illumination waxing personal { name moonSign houseFromMoon dasha { mahadasha antardasha until } } } }`;

// The Moon as it looks tonight: the lit part is drawn with two arcs.
export function MoonPhase({ illumination, waxing, size = 72 }: { illumination: number; waxing: boolean; size?: number }) {
  const r = 30;
  // The terminator is an ellipse whose width runs from r (new) to -r (full).
  const rx = Math.abs(1 - 2 * illumination) * r;
  const litOnRight = waxing;
  const outer = litOnRight ? 1 : 0;
  const inner = illumination > 0.5 ? outer : 1 - outer;
  const d = `M36 6 A${r} ${r} 0 0 ${outer} 36 66 A${rx} ${r} 0 0 ${inner} 36 6Z`;
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden>
      <defs>
        <radialGradient id="moonlit" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#fff8d6" />
          <stop offset="0.6" stopColor="var(--color-gold-soft)" />
          <stop offset="1" stopColor="var(--color-gold)" />
        </radialGradient>
      </defs>
      <circle cx="36" cy="36" r={r + 4} fill="var(--color-gold)" opacity="0.08" />
      <circle cx="36" cy="36" r={r} fill="var(--color-raised)" stroke="var(--color-line)" />
      <path d={d} fill="url(#moonlit)" />
    </svg>
  );
}

export function SkyCard({ sky }: { sky: TodaySky }) {
  const { t, term } = useI18n();
  const p = sky.personal;
  return (
    <section className="card relative overflow-hidden p-5 sm:p-6">
      <Orbit />
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">{t('today.skyTitle')}</p>
      <div className="mt-3 flex items-center gap-4">
        <MoonPhase illumination={sky.illumination} waxing={sky.waxing} />
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold text-ink">{t('today.moonIn', { sign: term('sign', sky.moonSign) })}</h2>
          <p className="mt-1 text-sm text-muted">
            {t('today.nakshatra', { name: term('nakshatra', sky.nakshatra) })}
          </p>
          <p className="text-sm text-muted">
            {t(`today.paksha.${sky.paksha}`)} · {t('today.tithi', { day: sky.tithi })} · {t('today.lit', { percent: Math.round(sky.illumination * 100) })}
          </p>
        </div>
      </div>

      {p ? (
        <div className="mt-5 rounded-2xl border border-gold/25 bg-gold/[0.06] p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-gold-soft"><Sparkles size={13} /> {t('today.forYou')}</p>
          <p className="mt-1.5 leading-relaxed text-ink">{t(`today.house.${p.houseFromMoon}` as MessageKey)}</p>
          {p.dasha && (
            <p className="mt-3 text-sm text-muted">
              {t('today.dasha', { maha: term('planet', p.dasha.mahadasha), antar: term('planet', p.dasha.antardasha), date: p.dasha.until })}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-line bg-raised/50 p-4">
          <p className="text-sm text-muted">{t('today.addDetails')}</p>
          <Link href="/welcome" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-gold">{t('today.addDetailsCta')} <ArrowRight size={14} /></Link>
        </div>
      )}

      <Link href="/services/horoscope" className="btn-ghost mt-4 w-full">{t('today.horoscopeCta')} <ArrowRight size={16} /></Link>
    </section>
  );
}

// Faint orbit and planets from the logo, behind a hero card.
function Orbit() {
  return (
    <svg className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 opacity-40" viewBox="0 0 200 200" aria-hidden>
      <circle cx="100" cy="100" r="80" fill="none" stroke="var(--color-gold)" strokeOpacity="0.35" strokeWidth="1" />
      <circle cx="100" cy="100" r="56" fill="none" stroke="var(--color-violet)" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 5" />
      <circle cx="157" cy="44" r="4" fill="var(--color-gold)" />
      <circle cx="180" cy="100" r="3" fill="var(--color-gold-soft)" />
      <circle cx="44" cy="157" r="2.5" fill="var(--color-violet)" />
    </svg>
  );
}

export function CardOfTheDay({ seed }: { seed: string }) {
  const { t, term } = useI18n();
  const { index, card } = dailyCard(seed);
  const storageKey = `jotaish_card_${new Date().toDateString()}`;
  const [shown, setShown] = useState(false);

  useEffect(() => {
    try {
      setShown(localStorage.getItem(storageKey) === '1');
    } catch {
      // Private browsing: the card simply starts face down.
    }
  }, [storageKey]);

  function turn() {
    setShown(true);
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // Not remembered; nothing else depends on it.
    }
  }

  const name = term('tarot', card);
  return (
    <section className="card p-5 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">{t('today.cardTitle')}</p>
      <div className="mt-4 flex items-center gap-5">
        <button
          type="button"
          onClick={turn}
          disabled={shown}
          className="group relative aspect-[300/503] w-28 shrink-0 [perspective:800px]"
          aria-label={shown ? name : t('today.cardTap')}
        >
          <span className={`absolute inset-0 transition-transform duration-700 [transform-style:preserve-3d] ${shown ? '[transform:rotateY(180deg)]' : ''}`}>
            <span className="absolute inset-0 flex items-center justify-center rounded-xl border border-gold/40 bg-raised [backface-visibility:hidden]">
              <span className="absolute inset-2 rounded-lg border border-gold/20" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/mark.svg" alt="" className="h-12 w-12 animate-twinkle" />
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardImage(card) ?? ''}
              alt=""
              className="absolute inset-0 h-full w-full rounded-xl border border-gold/40 object-cover shadow-lg shadow-violet/20 [backface-visibility:hidden] [transform:rotateY(180deg)]"
            />
          </span>
        </button>
        <div className="min-w-0">
          {shown ? (
            <div className="animate-rise">
              <h3 className="font-display text-xl font-semibold text-gold-soft">{name}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink">{t(`today.card.${index}` as MessageKey)}</p>
              <Link
                href={`/chat?new=1&q=${encodeURIComponent(t('today.cardAskQ', { card: name }))}`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gold"
              >
                <MessageCircle size={15} /> {t('today.cardAsk')}
              </Link>
            </div>
          ) : (
            <>
              <h3 className="font-display text-lg font-semibold text-ink">{t('today.cardTap')}</h3>
              <p className="mt-1 text-sm text-muted">{t('today.cardBody')}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

const digitSum = (n: number): number => {
  while (n > 9) n = String(n).split('').reduce((a, d) => a + Number(d), 0);
  return n;
};

// Numerology's Personal Day: birth month and day with the current year give
// the Personal Year; add the month, then the day.
export function personalDay(birthDate: string, now = new Date()) {
  const [, m, d] = birthDate.split('-').map(Number);
  const year = digitSum(digitSum(m) + digitSum(d) + digitSum(now.getFullYear()));
  const month = digitSum(year + digitSum(now.getMonth() + 1));
  return digitSum(month + digitSum(now.getDate()));
}

export function NumberOfTheDay({ birthDate }: { birthDate: string }) {
  const { t } = useI18n();
  const n = personalDay(birthDate);
  return (
    <section className="card flex items-center gap-4 p-5 sm:p-6">
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/[0.08] font-display text-3xl font-semibold text-gradient">{n}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">{t('today.numberTitle')}</p>
        <p className="mt-1 leading-relaxed text-ink">{t(`today.number.${n}` as MessageKey)}</p>
        <Link href="/services/numerology" className="mt-1.5 inline-flex items-center gap-1 text-sm text-gold">{t('today.numberMore')} <ArrowRight size={14} /></Link>
      </div>
    </section>
  );
}
