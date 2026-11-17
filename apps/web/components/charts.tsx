import { ZODIAC } from '@/lib/services';

const ABBR: Record<string, string> = {
  Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke',
};

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
  const retro = new Set(planets.filter((p) => p.retrograde && p.planet !== 'Rahu' && p.planet !== 'Ketu').map((p) => p.planet));
  return (
    <svg viewBox="0 0 400 400" className="w-full max-w-md" role="img" aria-label="North Indian birth chart">
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
                {ABBR[p] ?? p}
                {retro.has(p) ? '*' : ''}
              </text>
            ))}
            {i === 0 && <text x={x} y={y + 40} textAnchor="middle" fontSize="10" fill="var(--color-gold)" letterSpacing="2">LAGNA</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function TarotCardFace({ card, position, reversed, meaning }: { card: string; position: string; reversed: boolean; meaning: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="mb-2 text-xs uppercase tracking-widest text-faint">{position}</p>
      <div className={`flex aspect-[2/3] w-32 flex-col items-center justify-center rounded-xl border-2 border-gold/60 bg-gradient-to-b from-raised to-night p-3 shadow-lg shadow-violet/10 ${reversed ? 'rotate-180' : ''}`}>
        <svg viewBox="0 0 40 40" className="mb-2 h-10 w-10" aria-hidden>
          <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-gold)" strokeWidth="1" />
          <path d="M20 6 L23 17 L34 20 L23 23 L20 34 L17 23 L6 20 L17 17 Z" fill="var(--color-gold)" opacity="0.8" />
        </svg>
        <p className="font-display text-base leading-tight text-gold-soft">{card}</p>
      </div>
      <p className="mt-2 text-xs text-rose">{reversed ? 'Reversed' : 'Upright'}</p>
      <p className="mt-1 max-w-[10rem] text-xs text-muted">{meaning}</p>
    </div>
  );
}
