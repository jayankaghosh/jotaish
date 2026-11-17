'use client';

import { useEffect, useState } from 'react';
import { useI18n, type MessageKey } from '@/lib/i18n';
import type { Reading } from '@/lib/types';
import { Markdown, formatDate } from './ui';
import { BirthChart, TarotCardFace, type ChartStyle } from './charts';
import { preferredRegion, rememberRegion } from '@/lib/region';

const NODES = ['Rahu', 'Ketu'];

export function ReadingView({ reading }: { reading: Reading }) {
  const { t } = useI18n();
  return (
    <div className="space-y-8">
      <ReadingData reading={reading} />
      <section className="card p-6 sm:p-10">
        <Markdown>{reading.interpretation}</Markdown>
      </section>
      <p className="text-center text-xs text-faint">{t('view.prepared', { date: formatDate(reading.createdAt, true) })}</p>
    </div>
  );
}

function ReadingData({ reading }: { reading: Reading }) {
  const { t, term } = useI18n();
  const { data, input } = reading;
  switch (reading.type) {
    case 'BIRTH_CHART':
      return <ChartData data={data} region={input?.region} />;
    case 'TAROT':
      return (
        <section className="card p-6">
          <p className="mb-6 text-center text-muted">{t('view.yourQuestion')} <span className="text-ink">{input.question}</span></p>
          <div className="flex flex-wrap justify-center gap-6">
            {data.cards.map((c: any) => <TarotCardFace key={c.position} {...c} />)}
          </div>
        </section>
      );
    case 'NUMEROLOGY':
      return (
        <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {([
            ['view.num.lifePath', data.lifePath],
            ['view.num.expression', data.expression],
            ['view.num.soulUrge', data.soulUrge],
            ['view.num.personality', data.personality],
            ['view.num.birthday', data.birthday],
            ['view.num.mulank', `${data.mulank} · ${term('planet', data.mulankPlanet)}`],
            ['view.num.bhagyank', `${data.bhagyank} · ${term('planet', data.bhagyankPlanet)}`],
            ['view.num.nameNumber', `${data.chaldeanNameNumber} (${data.chaldeanCompound})`],
            ['view.num.personalYear', data.personalYear],
          ] as [MessageKey, string | number][]).map(([k, v]) => (
            <div key={k} className="card p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-faint">{t(k, { year: data.personalYearFor })}</p>
              <p className="mt-1 font-display text-3xl text-gold-soft">{v}</p>
            </div>
          ))}
        </section>
      );
    case 'PALM':
      return input.imageDataUrl ? (
        <section className="card flex justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={input.imageDataUrl} alt={t('palm.yourPalm')} className="max-h-80 rounded-xl" />
        </section>
      ) : null;
    case 'DREAM':
      return (
        <section className="card p-6">
          <p className="text-xs uppercase tracking-wider text-faint">{t('view.yourDream')}</p>
          <p className="mt-2 whitespace-pre-wrap text-ink">{input.dream}</p>
          {input.feeling && <p className="mt-3 text-sm text-muted">{t('view.itFelt', { feeling: term('feeling', input.feeling) })}</p>}
        </section>
      );
    case 'HOROSCOPE':
      return (
        <section className="card p-6">
          <p className="mb-3 text-xs uppercase tracking-wider text-faint">
            {t(data.system === 'vedic' ? 'view.planetsOnSidereal' : 'view.planetsOnTropical', { date: data.date })}
          </p>
          <div className="flex flex-wrap gap-2">
            {data.transits.map((p: any) => (
              <span key={p.planet} className="chip">
                {t('view.planetIn', { planet: term('planet', p.planet), sign: term('sign', data.system === 'vedic' ? p.siderealSign : p.tropicalSign) })}
              </span>
            ))}
          </div>
        </section>
      );
    case 'COMPATIBILITY':
      return (
        <section className="grid gap-4 sm:grid-cols-2">
          {[data.personA, data.personB].map((p: any) => (
            <div key={p.name} className="card p-5">
              <h3 className="font-display text-2xl text-ink">{p.name}</h3>
              <dl className="mt-3 space-y-1 text-sm">
                <Row k={t('view.ascendant')} v={p.chart.ascendant ? term('sign', p.chart.ascendant.sign) : t('view.birthTimeUnknown')} />
                <Row k={t('view.moonSign')} v={`${term('sign', p.chart.moonSign.sign)} (${term('rashi', p.chart.moonSign.rashi)})`} />
                <Row k={t('view.nakshatra')} v={t('view.nakshatraPada', { name: term('nakshatra', p.chart.nakshatra.name), pada: p.chart.nakshatra.pada })} />
                <Row k={t('view.manglik')} v={p.chart.manglik?.present ? t('view.yes') : t('view.no')} />
              </dl>
            </div>
          ))}
        </section>
      );
    default:
      return null;
  }
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right text-ink">{v}</dd>
    </div>
  );
}

// The API reports the Sade Sati phase in English, e.g. "rising (first phase)".
function sadeSatiPhase(phase: string): MessageKey {
  if (phase.startsWith('rising')) return 'view.sadeSati.rising';
  if (phase.startsWith('peak')) return 'view.sadeSati.peak';
  return 'view.sadeSati.setting';
}

function ChartData({ data, region }: { data: any; region?: ChartStyle }) {
  const { t, term, lang } = useI18n();
  const [showAll, setShowAll] = useState(false);
  // The chart is drawn in the style chosen for this reading; it can be
  // switched any time since the positions are the same.
  const [style, setStyle] = useState<ChartStyle>(region ?? 'north');
  useEffect(() => {
    if (!region) setStyle(preferredRegion(lang));
  }, [region, lang]);
  const current = data.dashas.find((d: any) => d.current);
  const sign = (s: string) => term('sign', s);
  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="card flex flex-col items-center p-6">
          <div className="mb-4 flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label={t('chart.styleLabel')}>
            {(['north', 'south', 'east'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStyle(s);
                  rememberRegion(s);
                }}
                className={`chip px-3 py-1 ${style === s ? 'border-gold bg-gold/15 text-gold-soft' : 'hover:text-ink'}`}
              >
                {t(`region.${s}`)}
              </button>
            ))}
          </div>
          <BirthChart style={style} houses={data.houses} planets={data.planets} />
          <p className="mt-3 text-center text-xs text-faint">
            {style === 'north' ? t('view.chartNote') : t('view.chartNoteFixed')}
            {!data.birthTimeKnown && ` ${t('view.chartNoTime')}`}
          </p>
        </div>
        <div className="card p-6">
          <h3 className="mb-4 font-display text-2xl text-ink">{t('view.keyFacts')}</h3>
          <dl className="space-y-2 text-sm">
            <Row k={t('view.lagna')} v={data.ascendant ? `${sign(data.ascendant.sign)} (${term('rashi', data.ascendant.rashi)}) ${data.ascendant.degree}` : t('view.needsTime')} />
            <Row k={t('view.rashi')} v={`${sign(data.moonSign.sign)} (${term('rashi', data.moonSign.rashi)})`} />
            <Row k={t('view.birthStar')} v={t('view.nakshatraPada', { name: term('nakshatra', data.janmaNakshatra.name), pada: data.janmaNakshatra.pada })} />
            <Row k={t('view.sunSign')} v={t('view.sunSignValue', { vedic: sign(data.sunSign.sidereal), western: sign(data.sunSign.tropical) })} />
            {data.currentDasha && (
              <Row
                k={t('view.currentDasha')}
                v={t('view.dashaUntil', { maha: term('planet', data.currentDasha.mahadasha), antar: term('planet', data.currentDasha.antardasha), date: data.currentDasha.until })}
              />
            )}
            <Row k={t('view.sadeSati')} v={data.sadeSati.active ? t('view.sadeSati.active', { phase: t(sadeSatiPhase(data.sadeSati.phase)) }) : t('view.sadeSati.inactive')} />
          </dl>
          <h4 className="mb-2 mt-6 text-sm font-medium text-ink">{t('view.yogas')}</h4>
          <div className="flex flex-wrap gap-2">
            {data.yogas.map((y: any) => (
              <span key={y.name} title={lang === 'en' ? y.note : undefined} className={`chip ${y.present ? 'border-gold/50 text-gold-soft' : 'opacity-60'}`}>
                {y.present ? '●' : '○'} {term('yoga', y.name)}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="card overflow-x-auto p-6">
        <h3 className="mb-4 font-display text-2xl text-ink">{t('view.planetPositions')}</h3>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-faint">
            <tr>
              <th className="pb-2">{t('view.col.planet')}</th>
              <th className="pb-2">{t('view.col.sign')}</th>
              <th className="pb-2">{t('view.col.degree')}</th>
              <th className="pb-2">{t('view.col.house')}</th>
              <th className="pb-2">{t('view.col.nakshatra')}</th>
              <th className="pb-2">{t('view.col.navamsa')}</th>
              <th className="pb-2">{t('view.col.notes')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.planets.map((p: any) => (
              <tr key={p.planet}>
                <td className="py-2 text-ink">{term('planet', p.planet)}</td>
                <td className="py-2 text-muted">{sign(p.sign)}</td>
                <td className="py-2 text-muted">{p.degree}</td>
                <td className="py-2 text-muted">{p.house}</td>
                <td className="py-2 text-muted">{term('nakshatra', p.nakshatra)} {p.pada}</td>
                <td className="py-2 text-muted">{sign(p.navamsaSign)}</td>
                <td className="py-2 text-gold-soft">
                  {[p.dignity && term('dignity', p.dignity), p.retrograde && !NODES.includes(p.planet) ? term('dignity', 'retrograde') : null].filter(Boolean).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-2xl text-ink">{t('view.dashaTitle')}</h3>
          <button className="text-sm text-gold hover:underline" onClick={() => setShowAll(!showAll)}>{showAll ? t('view.showCurrent') : t('view.showAll')}</button>
        </div>
        <p className="mb-4 text-sm text-muted">{t('view.dashaBody')}</p>
        <ol className="space-y-2">
          {(showAll ? data.dashas : current ? [current] : []).map((d: any) => (
            <li key={d.start} className={`rounded-xl border p-4 ${d.current ? 'border-gold/60 bg-gold/5' : 'border-line'}`}>
              <div className="flex justify-between text-sm">
                <span className="text-ink">
                  {t('view.mahadasha', { planet: term('planet', d.lord) })} {d.current && <span className="ml-2 text-xs text-gold">{t('view.now')}</span>}
                </span>
                <span className="text-faint">{d.start} → {d.end}</span>
              </div>
              {d.current && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {d.antardashas.map((a: any) => (
                    <span key={a.start} className={`chip ${a.current ? 'border-gold text-gold-soft' : ''}`}>{t('view.until', { planet: term('planet', a.lord), date: a.end })}</span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
