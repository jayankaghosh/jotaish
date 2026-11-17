import { prisma } from '../lib/db';
import { NAKSHATRAS, SIGNS, siderealLongitudes, signOf } from '../astro/vedic';
import { chartFor } from './readings';

// Today's sky, worked out from the planets alone, so it costs no credits:
// where the Moon is, the lunar day, and what that means for this person.
export async function todaySky(userId: string, now = new Date()) {
  const sid = siderealLongitudes(now);
  const elongation = (((sid.Moon - sid.Sun) % 360) + 360) % 360;
  const moonSign = signOf(sid.Moon);
  const tithi = Math.floor(elongation / 12) + 1;

  const self = await prisma.birthProfile.findFirst({ where: { userId, relation: 'self' }, orderBy: { createdAt: 'asc' } });
  let personal = null;
  if (self) {
    const chart = chartFor(self);
    const natalMoon = SIGNS.indexOf(chart.moonSign.sign as (typeof SIGNS)[number]);
    personal = {
      name: self.name,
      moonSign: chart.moonSign.sign,
      // Counting the natal Moon's sign as the first house (Chandra gochara).
      houseFromMoon: ((moonSign - natalMoon + 12) % 12) + 1,
      dasha: chart.currentDasha,
    };
  }

  return {
    date: now.toISOString().slice(0, 10),
    moonSign: SIGNS[moonSign],
    nakshatra: NAKSHATRAS[Math.floor(sid.Moon / (360 / 27)) % 27],
    paksha: tithi <= 15 ? 'shukla' : 'krishna',
    tithi: tithi <= 15 ? tithi : tithi - 15,
    illumination: Math.round(((1 - Math.cos((elongation * Math.PI) / 180)) / 2) * 100) / 100,
    waxing: elongation < 180,
    personal,
  };
}
