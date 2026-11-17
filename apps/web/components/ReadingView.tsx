'use client';

import { useState } from 'react';
import type { Reading } from '@/lib/types';
import { Markdown, formatDate } from './ui';
import { NorthIndianChart, TarotCardFace } from './charts';

export function ReadingView({ reading }: { reading: Reading }) {
  return (
    <div className="space-y-8">
      <ReadingData reading={reading} />
      <section className="card p-6 sm:p-10">
        <Markdown>{reading.interpretation}</Markdown>
      </section>
      <p className="text-center text-xs text-faint">
        Prepared on {formatDate(reading.createdAt, true)}. Readings are for guidance and reflection, not a substitute for professional advice.
      </p>
    </div>
  );
}

function ReadingData({ reading }: { reading: Reading }) {
  const { data, input } = reading;
  switch (reading.type) {
    case 'BIRTH_CHART':
      return <ChartData data={data} />;
    case 'TAROT':
      return (
        <section className="card p-6">
          <p className="mb-6 text-center text-muted">Your question: <span className="text-ink">{input.question}</span></p>
          <div className="flex flex-wrap justify-center gap-6">
            {data.cards.map((c: any) => <TarotCardFace key={c.position} {...c} />)}
          </div>
        </section>
      );
    case 'NUMEROLOGY':
      return (
        <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ['Life Path', data.lifePath],
            ['Expression', data.expression],
            ['Soul Urge', data.soulUrge],
            ['Personality', data.personality],
            ['Birthday', data.birthday],
            ['Mulank', `${data.mulank} · ${data.mulankPlanet}`],
            ['Bhagyank', `${data.bhagyank} · ${data.bhagyankPlanet}`],
            ['Name number', `${data.chaldeanNameNumber} (${data.chaldeanCompound})`],
            [`Personal year ${data.personalYearFor}`, data.personalYear],
          ].map(([k, v]) => (
            <div key={k} className="card p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-faint">{k}</p>
              <p className="mt-1 font-display text-3xl text-gold-soft">{v}</p>
            </div>
          ))}
        </section>
      );
    case 'PALM':
      return input.imageDataUrl ? (
        <section className="card flex justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={input.imageDataUrl} alt="Palm photo" className="max-h-80 rounded-xl" />
        </section>
      ) : null;
    case 'DREAM':
      return (
        <section className="card p-6">
          <p className="text-xs uppercase tracking-wider text-faint">Your dream</p>
          <p className="mt-2 whitespace-pre-wrap text-ink">{input.dream}</p>
          {input.feeling && <p className="mt-3 text-sm text-muted">It felt: {input.feeling}</p>}
        </section>
      );
    case 'HOROSCOPE':
      return (
        <section className="card p-6">
          <p className="mb-3 text-xs uppercase tracking-wider text-faint">Planets on {data.date} ({data.system === 'vedic' ? 'sidereal' : 'tropical'})</p>
          <div className="flex flex-wrap gap-2">
            {data.transits.map((t: any) => (
              <span key={t.planet} className="chip">
                {t.planet} in {data.system === 'vedic' ? t.siderealSign : t.tropicalSign}
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
                <Row k="Ascendant" v={p.chart.ascendant ? p.chart.ascendant.sign : 'Birth time unknown'} />
                <Row k="Moon sign" v={`${p.chart.moonSign.sign} (${p.chart.moonSign.rashi})`} />
                <Row k="Nakshatra" v={`${p.chart.nakshatra.name}, pada ${p.chart.nakshatra.pada}`} />
                <Row k="Manglik" v={p.chart.manglik?.present ? 'Yes' : 'No'} />
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

function ChartData({ data }: { data: any }) {
  const [showAll, setShowAll] = useState(false);
  const current = data.dashas.find((d: any) => d.current);
  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="card flex flex-col items-center p-6">
          <NorthIndianChart houses={data.houses} planets={data.planets} />
          <p className="mt-3 text-center text-xs text-faint">
            North Indian style. Numbers are signs (1 = Aries). * marks a retrograde planet.
            {!data.birthTimeKnown && ' Houses are counted from the Moon because the birth time is unknown.'}
          </p>
        </div>
        <div className="card p-6">
          <h3 className="mb-4 font-display text-2xl text-ink">Key facts</h3>
          <dl className="space-y-2 text-sm">
            <Row k="Ascendant (Lagna)" v={data.ascendant ? `${data.ascendant.sign} (${data.ascendant.rashi}) ${data.ascendant.degree}` : 'Needs birth time'} />
            <Row k="Moon sign (Rashi)" v={`${data.moonSign.sign} (${data.moonSign.rashi})`} />
            <Row k="Birth star (Nakshatra)" v={`${data.janmaNakshatra.name}, pada ${data.janmaNakshatra.pada}`} />
            <Row k="Sun sign" v={`${data.sunSign.sidereal} (Vedic) · ${data.sunSign.tropical} (Western)`} />
            {data.currentDasha && <Row k="Current dasha" v={`${data.currentDasha.mahadasha} / ${data.currentDasha.antardasha} until ${data.currentDasha.until}`} />}
            <Row k="Sade Sati" v={data.sadeSati.active ? `Active, ${data.sadeSati.phase}` : 'Not active'} />
          </dl>
          <h4 className="mb-2 mt-6 text-sm font-medium text-ink">Yogas and doshas</h4>
          <div className="flex flex-wrap gap-2">
            {data.yogas.map((y: any) => (
              <span key={y.name} title={y.note} className={`chip ${y.present ? 'border-gold/50 text-gold-soft' : 'opacity-60'}`}>
                {y.present ? '●' : '○'} {y.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="card overflow-x-auto p-6">
        <h3 className="mb-4 font-display text-2xl text-ink">Planet positions</h3>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-faint">
            <tr>
              <th className="pb-2">Planet</th><th className="pb-2">Sign</th><th className="pb-2">Degree</th><th className="pb-2">House</th><th className="pb-2">Nakshatra</th><th className="pb-2">Navamsa</th><th className="pb-2">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.planets.map((p: any) => (
              <tr key={p.planet}>
                <td className="py-2 text-ink">{p.planet}</td>
                <td className="py-2 text-muted">{p.sign}</td>
                <td className="py-2 text-muted">{p.degree}</td>
                <td className="py-2 text-muted">{p.house}</td>
                <td className="py-2 text-muted">{p.nakshatra} {p.pada}</td>
                <td className="py-2 text-muted">{p.navamsaSign}</td>
                <td className="py-2 text-gold-soft">{[p.dignity, p.retrograde && !['Rahu', 'Ketu'].includes(p.planet) ? 'retrograde' : null].filter(Boolean).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-2xl text-ink">Vimshottari dasha</h3>
          <button className="text-sm text-gold hover:underline" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show current only' : 'Show full timeline'}</button>
        </div>
        <p className="mb-4 text-sm text-muted">Dashas are planetary periods. Each one colours that stretch of life with the themes of its planet.</p>
        <ol className="space-y-2">
          {(showAll ? data.dashas : current ? [current] : []).map((d: any) => (
            <li key={d.start} className={`rounded-xl border p-4 ${d.current ? 'border-gold/60 bg-gold/5' : 'border-line'}`}>
              <div className="flex justify-between text-sm">
                <span className="text-ink">{d.lord} mahadasha {d.current && <span className="ml-2 text-xs text-gold">now</span>}</span>
                <span className="text-faint">{d.start} → {d.end}</span>
              </div>
              {d.current && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {d.antardashas.map((a: any) => (
                    <span key={a.start} className={`chip ${a.current ? 'border-gold text-gold-soft' : ''}`}>{a.lord} until {a.end}</span>
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
