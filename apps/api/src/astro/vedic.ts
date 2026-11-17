import * as Astronomy from 'astronomy-engine';

export const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

export const RASHIS = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrishchika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
] as const;

const SIGN_LORDS = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
];

export const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu',
  'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta',
  'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha',
  'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada',
  'Uttara Bhadrapada', 'Revati',
];

const DASHA_ORDER = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
const DASHA_YEARS: Record<string, number> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
};

const EXALTED: Record<string, number> = { Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6 };
const OWN: Record<string, number[]> = {
  Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10],
};

const BODIES: [string, Astronomy.Body][] = [
  ['Mercury', Astronomy.Body.Mercury],
  ['Venus', Astronomy.Body.Venus],
  ['Mars', Astronomy.Body.Mars],
  ['Jupiter', Astronomy.Body.Jupiter],
  ['Saturn', Astronomy.Body.Saturn],
];

const norm = (deg: number) => ((deg % 360) + 360) % 360;
const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const YEAR_MS = 365.2425 * 24 * 3600 * 1000;

function centuries(time: Astronomy.AstroTime) {
  return time.tt / 36525;
}

// Lahiri (Chitrapaksha) ayanamsa, good to a few arc seconds for modern dates.
export function lahiriAyanamsa(time: Astronomy.AstroTime): number {
  const t = centuries(time);
  return 23.85306 + 1.396971 * t + 0.000308 * t * t;
}

function meanObliquity(time: Astronomy.AstroTime) {
  const t = centuries(time);
  return 23.439291 - 0.0130042 * t;
}

// Mean lunar node, the convention most Indian almanacs use for Rahu.
function meanNode(time: Astronomy.AstroTime) {
  const t = centuries(time);
  return norm(125.04452 - 1934.136261 * t + 0.0020708 * t * t + (t * t * t) / 450000);
}

// Tropical ecliptic longitudes of the navagraha at an instant.
export function tropicalLongitudes(date: Date): Record<string, number> {
  const time = Astronomy.MakeTime(date);
  const out: Record<string, number> = {
    Sun: Astronomy.SunPosition(time).elon,
    Moon: Astronomy.EclipticGeoMoon(time).lon,
  };
  for (const [name, body] of BODIES) {
    out[name] = Astronomy.Ecliptic(Astronomy.GeoVector(body, time, true)).elon;
  }
  out.Rahu = meanNode(time);
  out.Ketu = norm(out.Rahu + 180);
  return out;
}

export function siderealLongitudes(date: Date): Record<string, number> {
  const ayan = lahiriAyanamsa(Astronomy.MakeTime(date));
  const tropical = tropicalLongitudes(date);
  return Object.fromEntries(Object.entries(tropical).map(([k, v]) => [k, norm(v - ayan)]));
}

// Tropical ascendant for a place, in degrees.
export function tropicalAscendant(date: Date, latitude: number, longitude: number): number {
  const time = Astronomy.MakeTime(date);
  const ramc = rad(norm(Astronomy.SiderealTime(time) * 15 + longitude));
  const eps = rad(meanObliquity(time));
  const phi = rad(latitude);
  const asc = Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps)));
  return norm(deg(asc));
}

export function signOf(lon: number) {
  return Math.floor(norm(lon) / 30);
}

function formatDegree(lon: number) {
  const inSign = norm(lon) % 30;
  const d = Math.floor(inSign);
  const m = Math.floor((inSign - d) * 60);
  return `${d}°${String(m).padStart(2, '0')}'`;
}

export function nakshatraOf(lon: number) {
  const span = 360 / 27;
  const index = Math.floor(norm(lon) / span);
  const within = norm(lon) - index * span;
  return {
    index,
    name: NAKSHATRAS[index],
    pada: Math.floor(within / (span / 4)) + 1,
    lord: DASHA_ORDER[index % 9],
    fraction: within / span,
  };
}

function dignity(planet: string, sign: number): string | null {
  if (EXALTED[planet] === sign) return 'exalted';
  if (EXALTED[planet] !== undefined && (EXALTED[planet] + 6) % 12 === sign) return 'debilitated';
  if (OWN[planet]?.includes(sign)) return 'own sign';
  return null;
}

function addYears(date: Date, years: number) {
  return new Date(date.getTime() + years * YEAR_MS);
}

export interface DashaPeriod {
  lord: string;
  start: string;
  end: string;
  current?: boolean;
  antardashas?: DashaPeriod[];
}

// Vimshottari mahadashas from birth, with antardashas for each.
export function vimshottari(birth: Date, moonLon: number, now = new Date()): DashaPeriod[] {
  const nak = nakshatraOf(moonLon);
  const startIndex = DASHA_ORDER.indexOf(nak.lord);
  // Back-date the first period so its elapsed share sits before birth.
  let cursor = addYears(birth, -DASHA_YEARS[nak.lord] * nak.fraction);
  const periods: DashaPeriod[] = [];
  for (let i = 0; i < 10; i++) {
    const lord = DASHA_ORDER[(startIndex + i) % 9];
    const years = DASHA_YEARS[lord];
    const end = addYears(cursor, years);
    const subs: DashaPeriod[] = [];
    let subCursor = cursor;
    for (let j = 0; j < 9; j++) {
      const sub = DASHA_ORDER[(DASHA_ORDER.indexOf(lord) + j) % 9];
      const subEnd = addYears(subCursor, (years * DASHA_YEARS[sub]) / 120);
      subs.push({
        lord: sub,
        start: subCursor.toISOString().slice(0, 10),
        end: subEnd.toISOString().slice(0, 10),
        current: now >= subCursor && now < subEnd,
      });
      subCursor = subEnd;
    }
    periods.push({
      lord,
      start: cursor.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      current: now >= cursor && now < end,
      antardashas: subs,
    });
    cursor = end;
  }
  return periods;
}

export interface PlanetPlacement {
  planet: string;
  longitude: number;
  sign: string;
  rashi: string;
  degree: string;
  house: number | null;
  nakshatra: string;
  pada: number;
  retrograde: boolean;
  dignity: string | null;
  navamsaSign: string;
}

export interface BirthChartInput {
  name: string;
  birthDate: string;
  birthTime?: string | null;
  birthPlace: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface BirthChart {
  ayanamsa: number;
  birthTimeKnown: boolean;
  ascendant: { sign: string; rashi: string; degree: string; nakshatra: string } | null;
  planets: PlanetPlacement[];
  // Whole sign houses: houses[0] is the sign index of house 1.
  houses: { house: number; sign: string; lord: string; planets: string[] }[];
  moonSign: { sign: string; rashi: string };
  sunSign: { sidereal: string; tropical: string };
  janmaNakshatra: { name: string; pada: number; lord: string };
  dashas: DashaPeriod[];
  currentDasha: { mahadasha: string; antardasha: string; until: string } | null;
  yogas: { name: string; present: boolean; note: string }[];
  sadeSati: { active: boolean; phase: string | null; note: string };
}

export function computeBirthChart(input: BirthChartInput, utc: Date, now = new Date()): BirthChart {
  const time = Astronomy.MakeTime(utc);
  const ayan = lahiriAyanamsa(time);
  const birthTimeKnown = Boolean(input.birthTime);
  const sid = siderealLongitudes(utc);
  const later = siderealLongitudes(new Date(utc.getTime() + 6 * 3600 * 1000));
  const tropicalSun = tropicalLongitudes(utc).Sun;

  const ascLon = birthTimeKnown ? norm(tropicalAscendant(utc, input.latitude, input.longitude) - ayan) : null;
  // Without a birth time, fall back to the Moon sign as house 1 (Chandra lagna).
  const firstHouseSign = ascLon !== null ? signOf(ascLon) : signOf(sid.Moon);

  const planets: PlanetPlacement[] = Object.entries(sid).map(([planet, lon]) => {
    const sign = signOf(lon);
    const nak = nakshatraOf(lon);
    let delta = later[planet] - lon;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return {
      planet,
      longitude: Number(lon.toFixed(4)),
      sign: SIGNS[sign],
      rashi: RASHIS[sign],
      degree: formatDegree(lon),
      house: ((sign - firstHouseSign + 12) % 12) + 1,
      nakshatra: nak.name,
      pada: nak.pada,
      // Nodes always move backwards; Sun and Moon never do.
      retrograde: planet === 'Rahu' || planet === 'Ketu' ? true : delta < 0,
      dignity: dignity(planet, sign),
      navamsaSign: SIGNS[Math.floor(lon / (10 / 3)) % 12],
    };
  });

  const houses = Array.from({ length: 12 }, (_, i) => {
    const sign = (firstHouseSign + i) % 12;
    return {
      house: i + 1,
      sign: SIGNS[sign],
      lord: SIGN_LORDS[sign],
      planets: planets.filter((p) => signOf(p.longitude) === sign).map((p) => p.planet),
    };
  });

  const moonNak = nakshatraOf(sid.Moon);
  const dashas = vimshottari(utc, sid.Moon, now);
  const md = dashas.find((d) => d.current);
  const ad = md?.antardashas?.find((d) => d.current);

  const houseOf = (p: string) => planets.find((x) => x.planet === p)!.house!;
  const moonSignIdx = signOf(sid.Moon);
  const jupiterFromMoon = ((signOf(sid.Jupiter) - moonSignIdx + 12) % 12) + 1;
  const marsHouse = houseOf('Mars');
  const rahu = sid.Rahu;
  const between = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].map((p) => norm(sid[p] - rahu));
  const kaalSarp = between.every((d) => d < 180) || between.every((d) => d > 180);

  const yogas = [
    {
      name: 'Manglik (Kuja) Dosha',
      present: [1, 2, 4, 7, 8, 12].includes(marsHouse),
      note: `Mars sits in house ${marsHouse}${birthTimeKnown ? '' : ' counted from the Moon, since birth time is unknown'}.`,
    },
    {
      name: 'Gajakesari Yoga',
      present: [1, 4, 7, 10].includes(jupiterFromMoon),
      note: `Jupiter is in house ${jupiterFromMoon} from the Moon.`,
    },
    {
      name: 'Kaal Sarp Dosha',
      present: kaalSarp,
      note: kaalSarp ? 'All seven planets fall on one side of the Rahu-Ketu axis.' : 'Planets fall on both sides of the Rahu-Ketu axis.',
    },
    {
      name: 'Budhaditya Yoga',
      present: signOf(sid.Sun) === signOf(sid.Mercury),
      note: 'Sun and Mercury together in one sign.',
    },
  ];

  const saturnNow = signOf(siderealLongitudes(now).Saturn);
  const fromMoon = (saturnNow - moonSignIdx + 12) % 12;
  const phase = fromMoon === 11 ? 'rising (first phase)' : fromMoon === 0 ? 'peak (second phase)' : fromMoon === 1 ? 'setting (third phase)' : null;

  return {
    ayanamsa: Number(ayan.toFixed(4)),
    birthTimeKnown,
    ascendant: ascLon === null ? null : {
      sign: SIGNS[signOf(ascLon)],
      rashi: RASHIS[signOf(ascLon)],
      degree: formatDegree(ascLon),
      nakshatra: nakshatraOf(ascLon).name,
    },
    planets,
    houses,
    moonSign: { sign: SIGNS[moonSignIdx], rashi: RASHIS[moonSignIdx] },
    sunSign: { sidereal: SIGNS[signOf(sid.Sun)], tropical: SIGNS[signOf(tropicalSun)] },
    janmaNakshatra: { name: moonNak.name, pada: moonNak.pada, lord: moonNak.lord },
    dashas,
    currentDasha: md && ad ? { mahadasha: md.lord, antardasha: ad.lord, until: ad.end } : null,
    yogas,
    sadeSati: {
      active: phase !== null,
      phase,
      note: `Saturn is transiting ${SIGNS[saturnNow]}; Moon sign is ${SIGNS[moonSignIdx]}.`,
    },
  };
}

// Current sidereal and tropical positions, used for horoscopes and transits.
export function currentTransits(now = new Date()) {
  const sid = siderealLongitudes(now);
  const trop = tropicalLongitudes(now);
  return Object.keys(sid).map((planet) => ({
    planet,
    siderealSign: SIGNS[signOf(sid[planet])],
    tropicalSign: SIGNS[signOf(trop[planet])],
    degree: formatDegree(sid[planet]),
    nakshatra: nakshatraOf(sid[planet]).name,
  }));
}
