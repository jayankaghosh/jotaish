import { createRequire } from 'node:module';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { marked, type Token, type Tokens } from 'marked';
import type { Reading } from '@prisma/client';
import { tr, type Lang } from '../i18n';

// DejaVu covers ₹ and the accented letters used in Sanskrit transliteration,
// which the built-in PDF fonts can't print, for English readings.
const req = createRequire(import.meta.url);
const fontDir = path.join(path.dirname(req.resolve('dejavu-fonts-ttf/package.json')), 'ttf');
const LATIN = {
  body: path.join(fontDir, 'DejaVuSans.ttf'),
  bold: path.join(fontDir, 'DejaVuSans-Bold.ttf'),
  serif: path.join(fontDir, 'DejaVuSerif.ttf'),
  serifBold: path.join(fontDir, 'DejaVuSerif-Bold.ttf'),
};

// Noto fonts for Indian scripts; they also contain Latin letters, digits
// and ₹, so mixed text prints from a single font.
function noto(script: string) {
  const dir = path.dirname(req.resolve(`@expo-google-fonts/noto-sans-${script}/package.json`));
  const file = (weight: string) => path.join(dir, weight, readdirSync(path.join(dir, weight)).find((f) => f.endsWith('.ttf'))!);
  const regular = file('400Regular');
  const bold = file('700Bold');
  return { body: regular, bold, serif: regular, serifBold: bold };
}

const SCRIPT: Partial<Record<Lang, string>> = { hi: 'devanagari', ml: 'malayalam', kn: 'kannada', bn: 'bengali' };
const fontsFor = (lang: Lang) => (SCRIPT[lang] ? noto(SCRIPT[lang]!) : LATIN);

const INK = '#2a2540';
const MUTED = '#6f6a96';
const GOLD = '#b8862f';
const NIGHT = '#0c0a1c';
const LOGO = fileURLToPath(new URL('../../assets/logo.png', import.meta.url));

const TYPE_LABEL: Record<string, string> = {
  BIRTH_CHART: 'Kundli (Birth chart)',
  HOROSCOPE: 'Horoscope',
  COMPATIBILITY: 'Compatibility',
  TAROT: 'Tarot reading',
  NUMEROLOGY: 'Numerology',
  PALM: 'Palm reading',
  DREAM: 'Dream interpretation',
};

type Doc = PDFKit.PDFDocument;

// The shaper picks one script for a whole run of text, so a line that starts
// in English and goes on in an Indian script ("Priya-ന്റെ ജാതകം") comes out
// mis-joined. Split text into same-script runs and draw them as one line.
const INDIC_RUN = /([\u0900-\u0DFF\u200C\u200D]+(?:[\s\u0964\u0965]+[\u0900-\u0DFF\u200C\u200D]+)*)/;
const scriptRuns = (text: string) => text.split(INDIC_RUN).filter(Boolean);

function write(doc: Doc, text: string, opts: PDFKit.Mixins.TextOptions = {}, at?: [number, number]) {
  const runs = scriptRuns(text);
  if (!runs.length) runs.push('');
  runs.forEach((run, i) => {
    const o = { ...opts, continued: i < runs.length - 1 || Boolean(opts.continued) };
    if (i === 0 && at) doc.text(run, at[0], at[1], o);
    else doc.text(run, o);
  });
}

// Writes inline Markdown (bold, italic, code) as one flowing paragraph.
function inline(doc: Doc, tokens: Token[] | undefined, fallback: string, opts: PDFKit.Mixins.TextOptions = {}) {
  const parts: { text: string; bold: boolean }[] = [];
  const walk = (list: Token[], bold: boolean) => {
    for (const t of list) {
      if (t.type === 'strong') walk((t as Tokens.Strong).tokens, true);
      else if (t.type === 'em') walk((t as Tokens.Em).tokens, bold);
      else if ('tokens' in t && Array.isArray((t as any).tokens) && t.type !== 'text') walk((t as any).tokens, bold);
      else if (t.type === 'br') parts.push({ text: '\n', bold });
      else parts.push({ text: decode((t as any).text ?? t.raw), bold });
    }
  };
  walk(tokens ?? [], false);
  if (!parts.length) parts.push({ text: decode(fallback), bold: false });
  parts.forEach((p, i) => {
    doc.font(p.bold ? 'bold' : 'body');
    write(doc, p.text, { ...opts, continued: i < parts.length - 1 });
  });
}

function decode(s: string) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function markdown(doc: Doc, md: string) {
  for (const token of marked.lexer(md)) {
    switch (token.type) {
      case 'heading': {
        const t = token as Tokens.Heading;
        doc.moveDown(t.depth <= 2 ? 0.8 : 0.5);
        doc.font('serifBold').fontSize(t.depth === 1 ? 18 : t.depth === 2 ? 15 : 12.5).fillColor(t.depth <= 2 ? NIGHT : GOLD);
        write(doc, decode(t.text.replace(/\*\*/g, '')));
        doc.moveDown(0.3).fontSize(10.5).fillColor(INK);
        break;
      }
      case 'paragraph': {
        const t = token as Tokens.Paragraph;
        doc.fontSize(10.5).fillColor(INK);
        inline(doc, t.tokens, t.text, { lineGap: 2.5 });
        doc.moveDown(0.6);
        break;
      }
      case 'list': {
        const t = token as Tokens.List;
        t.items.forEach((item, i) => {
          const marker = t.ordered ? `${Number(t.start || 1) + i}.` : '•';
          const y = doc.y;
          doc.font('body').fontSize(10.5).fillColor(GOLD).text(marker, doc.page.margins.left, y, { width: 18 });
          doc.fillColor(INK);
          const inner = (item.tokens.find((x) => x.type === 'text' || x.type === 'paragraph') as any) ?? null;
          doc.text('', doc.page.margins.left + 18, y);
          inline(doc, inner?.tokens, item.text, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 18, lineGap: 2 });
          doc.moveDown(0.25);
        });
        doc.x = doc.page.margins.left;
        doc.moveDown(0.4);
        break;
      }
      case 'blockquote': {
        const t = token as Tokens.Blockquote;
        doc.font('body').fontSize(10.5).fillColor(MUTED);
        write(doc, decode(t.text), { indent: 12, lineGap: 2 });
        doc.moveDown(0.6).fillColor(INK);
        break;
      }
      case 'table': {
        const t = token as Tokens.Table;
        const rows = [t.header.map((h) => h.text), ...t.rows.map((r) => r.map((c) => c.text))];
        table(doc, rows.map((r) => r.map((c) => decode(c.replace(/\*\*/g, '')))));
        break;
      }
      case 'hr':
        rule(doc);
        break;
      case 'space':
        break;
      default:
        if ('text' in token && typeof token.text === 'string' && token.text.trim()) {
          doc.font('body').fontSize(10.5).fillColor(INK);
          write(doc, decode(token.text));
          doc.moveDown(0.6);
        }
    }
  }
}

function rule(doc: Doc) {
  doc.moveDown(0.4);
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).lineWidth(0.5).strokeColor('#d9d3c4').stroke();
  doc.moveDown(0.6);
}

function table(doc: Doc, rows: string[][]) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const cols = Math.max(...rows.map((r) => r.length));
  const colWidth = width / cols;
  rows.forEach((row, i) => {
    const heights = row.map((cell) => doc.font(i === 0 ? 'bold' : 'body').fontSize(9).heightOfString(cell, { width: colWidth - 8 }));
    const h = Math.max(...heights) + 8;
    if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const y = doc.y;
    if (i === 0) doc.rect(left, y, width, h).fill('#f4f1ea');
    row.forEach((cell, j) => {
      doc.font(i === 0 ? 'bold' : 'body').fontSize(9).fillColor(INK);
      write(doc, cell, { width: colWidth - 8 }, [left + j * colWidth + 4, y + 4]);
    });
    doc.y = y + h;
    doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(0.3).strokeColor('#e3ddcf').stroke();
  });
  doc.x = left;
  doc.moveDown(0.8);
}

function facts(doc: Doc, reading: Reading, lang: Lang) {
  const t = (text: string, vars?: Record<string, string | number>) => tr(text, vars, lang);
  const data = reading.data as any;
  if (reading.type !== 'BIRTH_CHART' || !data?.planets) return;
  const rows: [string, string][] = [
    [t('Ascendant (Lagna)'), data.ascendant ? `${t(data.ascendant.sign)} (${t(data.ascendant.rashi)}) ${data.ascendant.degree}` : t('Needs birth time')],
    [t('Moon sign (Rashi)'), `${t(data.moonSign.sign)} (${t(data.moonSign.rashi)})`],
    [t('Birth star (Nakshatra)'), t('{name}, pada {pada}', { name: t(data.janmaNakshatra.name), pada: data.janmaNakshatra.pada })],
    [t('Sun sign'), t('{vedic} (Vedic) · {western} (Western)', { vedic: t(data.sunSign.sidereal), western: t(data.sunSign.tropical) })],
  ];
  if (data.currentDasha) {
    rows.push([
      t('Current dasha'),
      t('{maha} / {antar} until {date}', { maha: t(data.currentDasha.mahadasha), antar: t(data.currentDasha.antardasha), date: data.currentDasha.until }),
    ]);
  }
  table(doc, [[t('Key facts'), ''], ...rows]);
  table(doc, [
    [t('Planet'), t('Sign'), t('Degree'), t('House'), t('Nakshatra'), t('Notes')],
    ...data.planets.map((p: any) => [
      t(p.planet),
      t(p.sign),
      p.degree,
      String(p.house),
      `${t(p.nakshatra)} ${p.pada}`,
      [p.dignity && t(p.dignity), p.retrograde && !['Rahu', 'Ketu'].includes(p.planet) ? t('retrograde') : null].filter(Boolean).join(', '),
    ]),
  ]);
}

export function readingPdf(reading: Reading, personName: string, lang: Lang = 'en'): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 56, left: 56, right: 56 }, info: { Title: reading.title, Author: 'Jotaish' } });
    for (const [name, file] of Object.entries(fontsFor(lang))) doc.registerFont(name, file);
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(0, 0, doc.page.width, 70).fill(NIGHT);
    doc.image(LOGO, 56, 17, { width: 36, height: 36 });
    doc.font('serif').fontSize(20).fillColor('#fde98c').text('Jotaish', 100, 24);
    doc.font('body').fontSize(9).fillColor('#a59fc9').text(tr(TYPE_LABEL[reading.type] ?? 'Reading', undefined, lang), 56, 30, { align: 'right' });

    doc.y = 100;
    doc.x = 56;
    doc.font('serifBold').fontSize(22).fillColor(NIGHT);
    write(doc, reading.title);
    doc.font('body').fontSize(9.5).fillColor(MUTED);
    write(
      doc,
      tr('Prepared for {name} on {date}', {
        name: personName,
        date: reading.createdAt.toLocaleDateString(`${lang}-IN`, { day: 'numeric', month: 'long', year: 'numeric' }),
      }, lang),
    );
    rule(doc);
    facts(doc, reading, lang);
    markdown(doc, reading.interpretation);

    rule(doc);
    doc.font('body').fontSize(8.5).fillColor(MUTED);
    write(doc, tr('Readings are for guidance and reflection. For medical, legal or financial decisions, please consult a professional.', undefined, lang));
    doc.end();
  });
}
