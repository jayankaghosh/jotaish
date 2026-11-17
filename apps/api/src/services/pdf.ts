import { createRequire } from 'node:module';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { marked, type Token, type Tokens } from 'marked';
import type { Reading } from '@prisma/client';

// DejaVu covers ₹ and the accented letters used in Sanskrit transliteration,
// which the built-in PDF fonts can't print.
const fontDir = path.join(path.dirname(createRequire(import.meta.url).resolve('dejavu-fonts-ttf/package.json')), 'ttf');
const FONTS = {
  body: path.join(fontDir, 'DejaVuSans.ttf'),
  bold: path.join(fontDir, 'DejaVuSans-Bold.ttf'),
  serif: path.join(fontDir, 'DejaVuSerif.ttf'),
  serifBold: path.join(fontDir, 'DejaVuSerif-Bold.ttf'),
};

const INK = '#2a2540';
const MUTED = '#6f6a96';
const GOLD = '#b8862f';
const NIGHT = '#15132b';

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
    doc.font(p.bold ? 'bold' : 'body').text(p.text, { ...opts, continued: i < parts.length - 1 });
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
        doc.text(decode(t.text.replace(/\*\*/g, '')));
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
        doc.font('body').fontSize(10.5).fillColor(MUTED).text(decode(t.text), { indent: 12, lineGap: 2 });
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
          doc.font('body').fontSize(10.5).fillColor(INK).text(decode(token.text));
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
      doc.font(i === 0 ? 'bold' : 'body').fontSize(9).fillColor(INK).text(cell, left + j * colWidth + 4, y + 4, { width: colWidth - 8 });
    });
    doc.y = y + h;
    doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(0.3).strokeColor('#e3ddcf').stroke();
  });
  doc.x = left;
  doc.moveDown(0.8);
}

function facts(doc: Doc, reading: Reading) {
  const data = reading.data as any;
  if (reading.type !== 'BIRTH_CHART' || !data?.planets) return;
  const rows: [string, string][] = [
    ['Ascendant (Lagna)', data.ascendant ? `${data.ascendant.sign} (${data.ascendant.rashi}) ${data.ascendant.degree}` : 'Needs birth time'],
    ['Moon sign (Rashi)', `${data.moonSign.sign} (${data.moonSign.rashi})`],
    ['Birth star (Nakshatra)', `${data.janmaNakshatra.name}, pada ${data.janmaNakshatra.pada}`],
    ['Sun sign', `${data.sunSign.sidereal} (Vedic) · ${data.sunSign.tropical} (Western)`],
  ];
  if (data.currentDasha) rows.push(['Current dasha', `${data.currentDasha.mahadasha} / ${data.currentDasha.antardasha} until ${data.currentDasha.until}`]);
  table(doc, [['Key facts', ''], ...rows]);
  table(doc, [
    ['Planet', 'Sign', 'Degree', 'House', 'Nakshatra', 'Notes'],
    ...data.planets.map((p: any) => [
      p.planet,
      p.sign,
      p.degree,
      String(p.house),
      `${p.nakshatra} ${p.pada}`,
      [p.dignity, p.retrograde && !['Rahu', 'Ketu'].includes(p.planet) ? 'retrograde' : null].filter(Boolean).join(', '),
    ]),
  ]);
}

export function readingPdf(reading: Reading, personName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 56, left: 56, right: 56 }, info: { Title: reading.title, Author: 'Jotaish' } });
    for (const [name, file] of Object.entries(FONTS)) doc.registerFont(name, file);
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(0, 0, doc.page.width, 70).fill(NIGHT);
    doc.font('serif').fontSize(20).fillColor('#f3d79b').text('Jotaish', 56, 24);
    doc.font('body').fontSize(9).fillColor('#a59fc9').text(TYPE_LABEL[reading.type] ?? 'Reading', 56, 30, { align: 'right' });

    doc.y = 100;
    doc.x = 56;
    doc.font('serifBold').fontSize(22).fillColor(NIGHT).text(reading.title);
    doc.font('body').fontSize(9.5).fillColor(MUTED).text(
      `Prepared for ${personName} on ${reading.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    );
    rule(doc);
    facts(doc, reading);
    markdown(doc, reading.interpretation);

    rule(doc);
    doc.font('body').fontSize(8.5).fillColor(MUTED).text('Readings are for guidance and reflection. For medical, legal or financial decisions, please consult a professional.');
    doc.end();
  });
}
