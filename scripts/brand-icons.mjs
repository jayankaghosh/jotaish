// Builds every icon from the logo mark in apps/web/public/brand/mark.svg:
// favicons, the home-screen icons, and the PNG used in emails and PDFs.
// Run after changing the mark: node scripts/brand-icons.mjs
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const sharp = createRequire(import.meta.url)('sharp');
const MARK = 'apps/web/public/brand/mark.svg';
const NIGHT = '#15132b';

// The mark on its own, transparent.
const plain = (size) => sharp(MARK, { density: 600 }).resize(size, size).png().toBuffer();

// The mark centred on the night background, for home screens. Maskable
// icons get extra room because launchers crop them to a circle.
async function onNight(size, scale) {
  const inner = Math.round(size * scale);
  return sharp({ create: { width: size, height: size, channels: 4, background: NIGHT } })
    .composite([{ input: await plain(inner), gravity: 'centre' }])
    .png()
    .toBuffer();
}

// An .ico file may hold PNG images directly.
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, at);
    header.writeUInt8(size >= 256 ? 0 : size, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(data.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

copyFileSync(MARK, 'apps/web/app/icon.svg');
writeFileSync('apps/web/app/favicon.ico', ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await plain(size) })))));
writeFileSync('apps/web/app/apple-icon.png', await onNight(180, 0.78));
writeFileSync('apps/web/public/brand/icon-192.png', await onNight(192, 0.78));
writeFileSync('apps/web/public/brand/icon-512.png', await onNight(512, 0.78));
writeFileSync('apps/web/public/brand/icon-maskable-512.png', await onNight(512, 0.6));
writeFileSync('apps/web/public/brand/mark-256.png', await plain(256));
mkdirSync('apps/api/assets', { recursive: true });
writeFileSync('apps/api/assets/logo.png', await plain(256));
console.log('Icons written');
