import { prisma } from '../lib/db';
import { userError } from '../lib/auth';
import { isValidDate, isValidTime } from '../astro/time';
import { searchPlaces } from '../astro/geo';

export interface ProfileInput {
  id?: string | null;
  name: string;
  relation?: string | null;
  gender?: string | null;
  birthDate: string;
  birthTime?: string | null;
  birthPlace: string;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
}

export async function saveProfile(userId: string, input: ProfileInput) {
  if (!input.name?.trim()) throw userError('Please enter a name.');
  if (!isValidDate(input.birthDate)) throw userError('Please enter the date of birth as YYYY-MM-DD.');
  const birthTime = input.birthTime?.trim() || null;
  if (birthTime && !isValidTime(birthTime)) throw userError('Please enter the birth time as HH:MM (24-hour), or leave it empty if unknown.');

  let { latitude, longitude, timezone } = input;
  let birthPlace = input.birthPlace?.trim();
  if (latitude == null || longitude == null || !timezone) {
    const [place] = await searchPlaces(birthPlace ?? '');
    if (!place) throw userError('We could not find "{place}". Try the nearest city, for example "Varanasi, India".', { place: birthPlace ?? '' });
    ({ latitude, longitude, timezone } = place);
    birthPlace = place.label;
  }

  const data = {
    name: input.name.trim(),
    relation: input.relation?.trim() || 'self',
    gender: input.gender ?? null,
    birthDate: input.birthDate,
    birthTime,
    birthPlace,
    latitude,
    longitude,
    timezone,
  };

  if (input.id) {
    const existing = await prisma.birthProfile.findFirst({ where: { id: input.id, userId } });
    if (!existing) throw userError('Profile not found.');
    return prisma.birthProfile.update({ where: { id: input.id }, data });
  }
  return prisma.birthProfile.create({ data: { ...data, userId } });
}
