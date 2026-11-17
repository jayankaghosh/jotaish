import { prisma } from '../lib/db';

export interface Place {
  name: string;
  label: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

// How a place name is stored and searched: lower case, Latin accents and
// punctuation removed ("Kozsíkóde" → "kozsikode"), joiners dropped so
// Malayalam and other scripts match however they were typed. Indian vowel
// signs are kept; only Latin accents (U+0300–036F) are stripped.
export function placeKey(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ‌‍]/g, '')
    .toLowerCase()
    .replace(/['’`.()]/g, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Searches our own copy of GeoNames (see prisma/places.ts). "Rampur, Bareilly"
// searches for Rampur and keeps those whose label mentions Bareilly.
// A complete name ("London", "Calicut") beats a place that merely starts
// with it; otherwise bigger places win, with Indian places weighted up.
export async function searchPlaces(query: string, limit = 8): Promise<Place[]> {
  const [first, ...rest] = query.split(',').map((p) => p.trim()).filter(Boolean);
  const key = placeKey(first ?? '');
  if (key.length < 2) return [];
  const prefix = key.replace(/[\\%_]/g, (c) => `\\${c}`) + '%';
  const within = rest.map((r) => `%${r.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);

  return prisma.$queryRawUnsafe<Place[]>(
    `SELECT p.name, p.label, p.latitude, p.longitude, p.timezone
       FROM "Place" p
       JOIN (SELECT "placeId", bool_or(name = $1) AS exact FROM "PlaceName" WHERE name LIKE $2 GROUP BY "placeId") m ON m."placeId" = p.id
      ${within.map((_, i) => `AND p.label ILIKE $${i + 3}`).join(' ').replace(/^AND/, 'WHERE')}
      ORDER BY (m.exact AND length($1) >= 4) DESC,
               p.population::bigint * (CASE WHEN p.country = 'IN' THEN 10 ELSE 1 END) DESC,
               (p.country = 'IN') DESC, p.label
      LIMIT ${Math.min(Math.max(limit, 1), 20)}`,
    key,
    prefix,
    ...within,
  );
}
