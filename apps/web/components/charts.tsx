'use client';

import { useI18n } from '@/lib/i18n';
import { ZODIAC } from '@/lib/services';
import { cardImage } from '@/lib/tarot';

// Label anchor for each house in the North Indian diamond layout.
const HOUSE_POS: [number, number][] = [
  [200, 105], [100, 45], [45, 100], [105, 200], [45, 300], [100, 355],
  [200, 295], [300, 355], [355, 300], [295, 200], [355, 100], [300, 45],
];

interface House {
  house: number;
  sign: string;
  planets: string[];
}

export function NorthIndianChart({ houses, planets }: { houses: House[]; planets: { planet: string; retrograde: boolean }[] }) {
  const { t, term } = useI18n();
  const retro = new Set(planets.filter((p) => p.retrograde && p.planet !== 'Rahu' && p.planet !== 'Ketu').map((p) => p.planet));
  return (
    <svg viewBox="0 0 400 400" className="w-full max-w-md" role="img" aria-label={t('chart.aria')}>
      <rect x="2" y="2" width="396" height="396" fill="none" stroke="var(--color-gold)" strokeWidth="1.5" rx="6" />
      <g stroke="var(--color-gold)" strokeOpacity="0.55" strokeWidth="1.2">
        <line x1="2" y1="2" x2="398" y2="398" />
        <line x1="398" y1="2" x2="2" y2="398" />
        <polygon points="200,2 398,200 200,398 2,200" fill="none" />
      </g>
      {houses.map((h, i) => {
        const [x, y] = HOUSE_POS[i];
        const signNum = ZODIAC.indexOf(h.sign) + 1;
        return (
          <g key={h.house}>
            <text x={x} y={y - 18} textAnchor="middle" fontSize="12" fill="var(--color-faint)">{signNum}</text>
            {h.planets.map((p, j) => (
              <text
                key={p}
                x={x + ((j % 3) - (Math.min(h.planets.length, 3) - 1) / 2) * 28}
                y={y + Math.floor(j / 3) * 18}
                textAnchor="middle"
                fontSize="14"
                fontWeight="600"
                fill={p === 'Rahu' || p === 'Ketu' ? 'var(--color-violet)' : 'var(--color-gold-soft)'}
              >
                {term('planetShort', p)}
                {retro.has(p) ? '*' : ''}
              </text>
            ))}
            {i === 0 && <text x={x} y={y + 40} textAnchor="middle" fontSize="10" fill="var(--color-gold)" letterSpacing="2">{t('chart.lagna')}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export type ChartStyle = 'north' | 'south' | 'east';

interface ChartProps {
  houses: House[];
  planets: { planet: string; retrograde: boolean }[];
}

// Planet labels for one box of a chart, wrapped into rows.
function PlanetLabels({ names, x, y, retro, perRow = 3, size = 13 }: { names: string[]; x: number; y: number; retro: Set<string>; perRow?: number; size?: number }) {
  const { term } = useI18n();
  return (
    <>
      {names.map((p, j) => (
        <text
          key={p}
          x={x + ((j % perRow) - (Math.min(names.length, perRow) - 1) / 2) * (size * 1.9)}
          y={y + Math.floor(j / perRow) * (size + 4)}
          textAnchor="middle"
          fontSize={size}
          fontWeight="600"
          fill={p === 'Rahu' || p === 'Ketu' ? 'var(--color-violet)' : 'var(--color-gold-soft)'}
        >
          {term('planetShort', p)}
          {retro.has(p) ? '*' : ''}
        </text>
      ))}
    </>
  );
}

const retrograde = (planets: ChartProps['planets']) =>
  new Set(planets.filter((p) => p.retrograde && p.planet !== 'Rahu' && p.planet !== 'Ketu').map((p) => p.planet));

// South Indian style: signs stay in fixed boxes around a square, Pisces at
// top left running clockwise; the lagna is marked in its sign's box.
const SOUTH_CELL: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 3], [3, 2], [3, 1], [3, 0], [2, 0], [1, 0], [0, 0],
];

export function SouthIndianChart({ houses, planets }: ChartProps) {
  const { t, term } = useI18n();
  const retro = retrograde(planets);
  const bySign = new Map(houses.map((h) => [h.sign, h.planets]));
  const lagnaSign = houses[0]?.sign;
  return (
    <svg viewBox="0 0 400 400" className="w-full max-w-md" role="img" aria-label={t('chart.ariaSouth')}>
      <rect x="2" y="2" width="396" height="396" fill="none" stroke="var(--color-gold)" strokeWidth="1.5" rx="6" />
      <g stroke="var(--color-gold)" strokeOpacity="0.55" strokeWidth="1.2" fill="none">
        <line x1="100" y1="2" x2="100" y2="398" />
        <line x1="300" y1="2" x2="300" y2="398" />
        <line x1="2" y1="100" x2="398" y2="100" />
        <line x1="2" y1="300" x2="398" y2="300" />
        <line x1="200" y1="2" x2="200" y2="100" />
        <line x1="200" y1="300" x2="200" y2="398" />
        <line x1="2" y1="200" x2="100" y2="200" />
        <line x1="300" y1="200" x2="398" y2="200" />
      </g>
      <text x="200" y="205" textAnchor="middle" fontSize="16" fill="var(--color-faint)" letterSpacing="2">{t('chart.rasi')}</text>
      {ZODIAC.map((sign, i) => {
        const [row, col] = SOUTH_CELL[i];
        const x = col * 100 + 50;
        const y = row * 100;
        const isLagna = sign === lagnaSign;
        return (
          <g key={sign}>
            {isLagna && <line x1={col * 100 + 4} y1={row * 100 + 22} x2={col * 100 + 22} y2={row * 100 + 4} stroke="var(--color-gold)" strokeWidth="2" />}
            <text x={x} y={y + 18} textAnchor="middle" fontSize="11" fill={isLagna ? 'var(--color-gold)' : 'var(--color-faint)'}>
              {term('sign', sign)}
            </text>
            <PlanetLabels names={bySign.get(sign) ?? []} x={x} y={y + 50} retro={retro} perRow={3} size={13} />
            {isLagna && <text x={x} y={y + 92} textAnchor="middle" fontSize="10" fill="var(--color-gold)" letterSpacing="1">{t('chart.lagna')}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// East Indian (Bengal, Odisha, Assam) style: fixed signs, Aries at the top
// centre running anticlockwise; corner boxes are split into two triangles.
const EAST_SLOT: { anchor: [number, number]; perRow: number }[] = [
  { anchor: [200, 62], perRow: 3 }, // Aries, top middle
  { anchor: [96, 40], perRow: 2 }, // Taurus, top-left corner, upper triangle
  { anchor: [38, 96], perRow: 1 }, // Gemini, top-left corner, lower triangle
  { anchor: [66, 196], perRow: 2 }, // Cancer, left middle
  { anchor: [38, 300], perRow: 1 }, // Leo, bottom-left corner, side triangle
  { anchor: [96, 362], perRow: 2 }, // Virgo, bottom-left corner, bottom triangle
  { anchor: [200, 330], perRow: 3 }, // Libra, bottom middle
  { anchor: [304, 362], perRow: 2 }, // Scorpio, bottom-right corner, bottom triangle
  { anchor: [362, 300], perRow: 1 }, // Sagittarius, bottom-right corner, side triangle
  { anchor: [334, 196], perRow: 2 }, // Capricorn, right middle
  { anchor: [362, 96], perRow: 1 }, // Aquarius, top-right corner, side triangle
  { anchor: [304, 40], perRow: 2 }, // Pisces, top-right corner, upper triangle
];

export function EastIndianChart({ houses, planets }: ChartProps) {
  const { t, term } = useI18n();
  const retro = retrograde(planets);
  const bySign = new Map(houses.map((h) => [h.sign, h.planets]));
  const lagnaSign = houses[0]?.sign;
  const c = 400 / 3;
  return (
    <svg viewBox="0 0 400 400" className="w-full max-w-md" role="img" aria-label={t('chart.ariaEast')}>
      <rect x="2" y="2" width="396" height="396" fill="none" stroke="var(--color-gold)" strokeWidth="1.5" rx="6" />
      <g stroke="var(--color-gold)" strokeOpacity="0.55" strokeWidth="1.2" fill="none">
        <line x1={c} y1="2" x2={c} y2="398" />
        <line x1={2 * c} y1="2" x2={2 * c} y2="398" />
        <line x1="2" y1={c} x2="398" y2={c} />
        <line x1="2" y1={2 * c} x2="398" y2={2 * c} />
        <line x1="2" y1="2" x2={c} y2={c} />
        <line x1="398" y1="2" x2={2 * c} y2={c} />
        <line x1="2" y1="398" x2={c} y2={2 * c} />
        <line x1="398" y1="398" x2={2 * c} y2={2 * c} />
      </g>
      {ZODIAC.map((sign, i) => {
        const { anchor: [x, y], perRow } = EAST_SLOT[i];
        const isLagna = sign === lagnaSign;
        return (
          <g key={sign}>
            <text x={x} y={y - 14} textAnchor="middle" fontSize="10" fill={isLagna ? 'var(--color-gold)' : 'var(--color-faint)'}>
              {i + 1}
              {isLagna ? ` · ${t('chart.lagna')}` : ''}
            </text>
            <PlanetLabels names={bySign.get(sign) ?? []} x={x} y={y + 4} retro={retro} perRow={perRow} size={12} />
          </g>
        );
      })}
      <text x="200" y="205" textAnchor="middle" fontSize="11" fill="var(--color-faint)">{t('chart.eastNote')}</text>
    </svg>
  );
}

export function BirthChart({ style, ...props }: ChartProps & { style: ChartStyle }) {
  if (style === 'south') return <SouthIndianChart {...props} />;
  if (style === 'east') return <EastIndianChart {...props} />;
  return <NorthIndianChart {...props} />;
}

// Minor arcana come from the API as "<Rank> of <Suit>".
function useCardName() {
  const { t, term } = useI18n();
  return (card: string) => {
    const minor = card.match(/^(\w+) of (\w+)$/);
    return minor ? t('tarot.minor', { rank: term('rank', minor[1]), suit: term('suit', minor[2]) }) : term('tarot', card);
  };
}

export function TarotCardFace({ card, position, reversed, meaning }: { card: string; position: string; reversed: boolean; meaning: string }) {
  const { t, term, lang } = useI18n();
  const cardName = useCardName();
  const image = cardImage(card);
  return (
    <figure className="flex w-36 flex-col items-center text-center sm:w-40">
      <figcaption className="mb-2 text-xs uppercase tracking-widest text-faint">{term('position', position)}</figcaption>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={cardName(card)}
          loading="lazy"
          className={`aspect-[300/503] w-full rounded-lg border border-gold/40 object-cover shadow-lg shadow-violet/20 ${reversed ? 'rotate-180' : ''}`}
        />
      ) : (
        <div className={`flex aspect-[2/3] w-full items-center justify-center rounded-xl border-2 border-gold/60 bg-raised p-3 ${reversed ? 'rotate-180' : ''}`}>
          <p className="font-display text-base leading-tight text-gold-soft">{cardName(card)}</p>
        </div>
      )}
      <p className="mt-3 font-display text-lg leading-tight text-gold-soft">{cardName(card)}</p>
      <p className="mt-1 text-xs text-rose">{reversed ? t('chart.reversed') : t('chart.upright')}</p>
      {/* Card keywords exist only in English; the written reading covers them in other languages. */}
      {lang === 'en' && <p className="mt-1 text-xs text-muted">{meaning}</p>}
    </figure>
  );
}
