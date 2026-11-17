// Loads towns and villages from GeoNames (https://www.geonames.org, CC BY 4.0)
// into the Place tables used by the birthplace search: every populated place
// in India, plus towns of 1,000+ people elsewhere for people born abroad.
//
// Run: npm run places:import -w apps/api   (takes a few minutes; safe to repeat)
import 'dotenv/config';
import { inflateRawSync } from 'node:zlib';
import { PrismaClient } from '@prisma/client';
import { placeKey } from '../src/astro/geo';

const prisma = new PrismaClient();
const BASE = 'https://download.geonames.org/export/dump/';

async function download(file: string) {
  const res = await fetch(BASE + file);
  if (!res.ok) throw new Error(`Could not download ${file}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// The one text file inside a GeoNames zip, read from the zip's directory.
function unzip(zip: Buffer, name: string) {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let at = zip.readUInt32LE(end + 16);
  for (let i = 0; i < zip.readUInt16LE(end + 10); i++) {
    const method = zip.readUInt16LE(at + 10);
    const size = zip.readUInt32LE(at + 20);
    const nameLen = zip.readUInt16LE(at + 28);
    const extraLen = zip.readUInt16LE(at + 30);
    const commentLen = zip.readUInt16LE(at + 32);
    const local = zip.readUInt32LE(at + 42);
    if (zip.toString('utf8', at + 46, at + 46 + nameLen) === name) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(data) : data).toString('utf8');
    }
    at += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${name} not found in zip`);
}

const rows = (text: string) => text.split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t'));

// Names worth searching: the English and old names (Calicut, Bangalore), and
// names in Indian scripts. Other scripts, airport codes and machine
// romanisations ("kolikkotu") are left out.
const INDIC = /[ऀ-෿]/;
function searchNames(name: string, ascii: string, alternates: string) {
  const keep = new Set([placeKey(name), placeKey(ascii)]);
  for (const alt of alternates ? alternates.split(',') : []) {
    const latin = /^[\p{Script=Latin}\s'’.\-()]+$/u.test(alt);
    if (INDIC.test(alt) || (latin && /^\p{Lu}/u.test(alt) && !/^[A-Z]{2,4}$/.test(alt))) keep.add(placeKey(alt));
  }
  keep.delete('');
  return [...keep];
}

// Populated places that still exist (not abandoned, historical or destroyed).
const LIVING = (code: string) => code.startsWith('PPL') && !['PPLQ', 'PPLH', 'PPLW', 'PPLCH'].includes(code);

async function main() {
  console.log('Downloading from GeoNames…');
  const [india, world, admin1Txt, admin2Txt, countryTxt] = await Promise.all([
    download('IN.zip'),
    download('cities1000.zip'),
    download('admin1CodesASCII.txt'),
    download('admin2Codes.txt'),
    download('countryInfo.txt'),
  ]);
  const states = new Map(rows(admin1Txt.toString('utf8')).map((r) => [r[0], r[1]]));
  const districts = new Map(rows(admin2Txt.toString('utf8')).map((r) => [r[0], r[1]]));
  const countries = new Map(rows(countryTxt.toString('utf8')).map((r) => [r[0], r[4]]));

  const places = new Map<number, { place: any; names: string[] }>();
  const add = (r: string[]) => {
    const id = Number(r[0]);
    if (places.has(id) || r[6] !== 'P' || !LIVING(r[7]) || !r[17]) return;
    const [country, a1, a2] = [r[8], r[10], r[11]];
    // Indian villages share names, so the district is part of the label.
    const district = country === 'IN' ? districts.get(`${country}.${a1}.${a2}`) : undefined;
    const parts = [r[1], district, states.get(`${country}.${a1}`), countries.get(country)].filter(Boolean) as string[];
    // "Delhi, Delhi, India" reads better as "Delhi, India".
    const label = parts.filter((p, i) => p !== parts[i - 1] && !(i > 0 && p === r[1])).join(', ');
    places.set(id, {
      place: { id, name: r[1], label, country, latitude: Number(r[4]), longitude: Number(r[5]), timezone: r[17], population: Number(r[14]) || 0 },
      names: searchNames(r[1], r[2], r[3]),
    });
  };
  rows(unzip(india, 'IN.txt')).forEach(add);
  rows(unzip(world, 'cities1000.txt')).forEach(add);
  console.log(`${places.size.toLocaleString('en-IN')} places. Saving…`);

  // Replace everything in one transaction, so searches never see half a list.
  const all = [...places.values()];
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('TRUNCATE "Place" CASCADE');
      for (let i = 0; i < all.length; i += 5000) {
        const batch = all.slice(i, i + 5000);
        await tx.place.createMany({ data: batch.map((b) => b.place) });
        await tx.placeName.createMany({ data: batch.flatMap((b) => b.names.map((name) => ({ placeId: b.place.id, name }))), skipDuplicates: true });
        if ((i / 5000) % 20 === 0) console.log(`  ${(i + batch.length).toLocaleString('en-IN')} / ${all.length.toLocaleString('en-IN')}`);
      }
    },
    { timeout: 30 * 60_000, maxWait: 60_000 },
  );
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
