// Loads towns and villages from GeoNames (https://www.geonames.org, CC BY 4.0)
// into the Place tables used by the birthplace search: every populated place
// in India, plus towns of 1,000+ people elsewhere for people born abroad.
//
// The files are large (India alone is 150 MB unzipped), so they are saved to
// disk and read line by line; memory stays small even on a 1 GB server.
//
// Run: npm run places:import -w apps/api   (takes a few minutes; safe to repeat)
import 'dotenv/config';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInflateRaw } from 'node:zlib';
import { Prisma, PrismaClient } from '@prisma/client';
import { placeKey } from '../src/astro/geo';

const prisma = new PrismaClient();
const BASE = 'https://download.geonames.org/export/dump/';
const BATCH = 2000;

async function download(file: string, dir: string) {
  const res = await fetch(BASE + file);
  if (!res.ok || !res.body) throw new Error(`Could not download ${file}: ${res.status}`);
  const to = path.join(dir, file);
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(to));
  return to;
}

// Lines of a plain text file, or of the one text file inside a GeoNames zip,
// read without loading the whole file.
async function* lines(file: string, inZip?: string): AsyncGenerator<string[]> {
  let input: NodeJS.ReadableStream = createReadStream(file);
  if (inZip) {
    const fh = await open(file);
    const { size } = await fh.stat();
    const tail = Buffer.alloc(Math.min(size, 65_557));
    await fh.read(tail, 0, tail.length, size - tail.length);
    const end = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const dir = Buffer.alloc(tail.readUInt32LE(end + 12));
    await fh.read(dir, 0, dir.length, tail.readUInt32LE(end + 16));
    let at = 0;
    let entry: { local: number; size: number; method: number } | null = null;
    while (at < dir.length && !entry) {
      const nameLen = dir.readUInt16LE(at + 28);
      if (dir.toString('utf8', at + 46, at + 46 + nameLen) === inZip) {
        entry = { method: dir.readUInt16LE(at + 10), size: dir.readUInt32LE(at + 20), local: dir.readUInt32LE(at + 42) };
      }
      at += 46 + nameLen + dir.readUInt16LE(at + 30) + dir.readUInt16LE(at + 32);
    }
    if (!entry) throw new Error(`${inZip} not found in ${file}`);
    const header = Buffer.alloc(30);
    await fh.read(header, 0, 30, entry.local);
    await fh.close();
    const start = entry.local + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
    const raw = createReadStream(file, { start, end: start + entry.size - 1 });
    input = entry.method === 8 ? raw.pipe(createInflateRaw()) : raw;
  }
  for await (const line of createInterface({ input, crlfDelay: Infinity })) {
    if (line && !line.startsWith('#')) yield line.split('\t');
  }
}

async function lookup(file: string, value: number) {
  const map = new Map<string, string>();
  for await (const r of lines(file)) map.set(r[0], r[value]);
  return map;
}

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
  const dir = await mkdtemp(path.join(tmpdir(), 'geonames-'));
  try {
    console.log('Downloading from GeoNames…');
    const india = await download('IN.zip', dir);
    const world = await download('cities1000.zip', dir);
    const states = await lookup(await download('admin1CodesASCII.txt', dir), 1);
    const districts = await lookup(await download('admin2Codes.txt', dir), 1);
    const countries = await lookup(await download('countryInfo.txt', dir), 4);

    let count = 0;
    // Replace everything in one transaction, so searches never see half a list.
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('TRUNCATE "Place" CASCADE');
        let places: Prisma.PlaceCreateManyInput[] = [];
        let names: Prisma.PlaceNameCreateManyInput[] = [];
        const flush = async () => {
          if (!places.length) return;
          await tx.place.createMany({ data: places });
          await tx.placeName.createMany({ data: names, skipDuplicates: true });
          count += places.length;
          if (count % 100_000 < BATCH) console.log(`  ${count.toLocaleString('en-IN')} places`);
          places = [];
          names = [];
        };
        // India first, in full; the world list then skips India.
        for (const [file, inZip, skipIndia] of [[india, 'IN.txt', false], [world, 'cities1000.txt', true]] as const) {
          for await (const r of lines(file, inZip)) {
            const [country, a1, a2] = [r[8], r[10], r[11]];
            if (r[6] !== 'P' || !LIVING(r[7]) || !r[17] || (skipIndia && country === 'IN')) continue;
            const id = Number(r[0]);
            // Indian villages share names, so the district is part of the label.
            const district = country === 'IN' ? districts.get(`${country}.${a1}.${a2}`) : undefined;
            const parts = [r[1], district, states.get(`${country}.${a1}`), countries.get(country)].filter(Boolean) as string[];
            // "Delhi, Delhi, India" reads better as "Delhi, India".
            const label = parts.filter((p, i) => p !== parts[i - 1] && !(i > 0 && p === r[1])).join(', ');
            places.push({ id, name: r[1], label, country, latitude: Number(r[4]), longitude: Number(r[5]), timezone: r[17], population: Number(r[14]) || 0 });
            for (const name of searchNames(r[1], r[2], r[3])) names.push({ placeId: id, name });
            if (places.length >= BATCH) await flush();
          }
        }
        await flush();
      },
      { timeout: 30 * 60_000, maxWait: 60_000 },
    );
    console.log(`Done: ${count.toLocaleString('en-IN')} places.`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
