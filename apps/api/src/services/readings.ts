import type { BirthProfile, Prisma, ReadingType } from '@prisma/client';
import { prisma } from '../lib/db';
import { userError } from '../lib/auth';
import { complete, type ChatMessage, type ContentPart } from '../ai/openrouter';
import { REPORT_PROMPTS, languageInstruction, regionInstruction, toRegion, type Region } from '../ai/prompts';
import { currentLang, tr } from '../i18n';
import { computeBirthChart, currentTransits, SIGNS } from '../astro/vedic';
import { drawSpread, SPREADS } from '../astro/tarot';
import { computeNumerology } from '../astro/numerology';
import { isValidDate, localToUtc } from '../astro/time';
import { emailReading } from './notifications';

interface Owner {
  userId: string;
  conversationId?: string | null;
}

async function profileFor(userId: string, profileId?: string | null): Promise<BirthProfile> {
  const profile = profileId
    ? await prisma.birthProfile.findFirst({ where: { id: profileId, userId } })
    : await prisma.birthProfile.findFirst({ where: { userId, relation: 'self' }, orderBy: { createdAt: 'asc' } });
  if (!profile) throw userError('Please add birth details first, so the chart can be calculated.');
  return profile;
}

// Without a choice, guess the tradition from the language being used.
function defaultRegion(): Region {
  const lang = currentLang();
  return lang === 'ml' || lang === 'kn' ? 'south' : lang === 'bn' ? 'east' : 'north';
}

function chartFor(profile: BirthProfile) {
  const utc = localToUtc(profile.birthDate, profile.birthTime ?? '12:00', profile.timezone);
  return computeBirthChart(profile, utc);
}

function birthSummary(profile: BirthProfile) {
  return {
    name: profile.name,
    birthDate: profile.birthDate,
    birthTime: profile.birthTime ?? 'unknown',
    birthPlace: profile.birthPlace,
    timezone: profile.timezone,
  };
}

async function save(
  owner: Owner,
  type: ReadingType,
  title: string,
  input: Prisma.InputJsonValue,
  data: Prisma.InputJsonValue,
  interpretation: string,
  model: string,
  profileId?: string,
) {
  const reading = await prisma.reading.create({
    data: {
      userId: owner.userId,
      conversationId: owner.conversationId ?? null,
      profileId: profileId ?? null,
      type,
      title,
      input,
      data,
      interpretation,
      model,
    },
  });
  emailReading(reading.id);
  return reading;
}

// Room for the full report. Some models spend part of this on internal
// reasoning, so it is set well above the visible length.
const REPORT_TOKENS: Partial<Record<keyof typeof REPORT_PROMPTS, number>> = { birth_chart: 12000, compatibility: 8000 };
const MAX_CONTINUATIONS = 2;

async function writeReport(task: keyof typeof REPORT_PROMPTS, userId: string, payload: unknown, image?: string, region?: Region) {
  const text = `Here is the data for this reading as JSON:\n\n${JSON.stringify(payload, null, 1)}`;
  const content: string | ContentPart[] = image
    ? [{ type: 'text', text }, { type: 'image_url', image_url: { url: image } }]
    : text;
  const messages: ChatMessage[] = [
    { role: 'system', content: REPORT_PROMPTS[task] + (region ? regionInstruction(region) : '') + languageInstruction(currentLang()) },
    { role: 'user', content },
  ];
  const maxTokens = REPORT_TOKENS[task] ?? 6000;
  let reply = await complete({ task, userId, messages, maxTokens });
  let report = reply.content;

  // If the model ran out of room, ask it to carry on so a report never ends
  // mid-sentence.
  for (let i = 0; reply.truncated && i < MAX_CONTINUATIONS; i++) {
    // Resume from the last complete line so the seam is clean.
    const lastLine = report.lastIndexOf('\n');
    if (lastLine > report.length / 2) report = report.slice(0, lastLine + 1);
    reply = await complete({
      task,
      userId,
      maxTokens,
      messages: [
        ...messages,
        { role: 'assistant', content: report },
        { role: 'user', content: 'Continue the report exactly where you stopped, without repeating anything or adding a preamble.' },
      ],
    });
    report += reply.content;
  }
  return { model: reply.model, content: report };
}

export async function createBirthChart(owner: Owner, profileId?: string | null, regionInput?: string | null) {
  const profile = await profileFor(owner.userId, profileId);
  const region = toRegion(regionInput ?? defaultRegion());
  const chart = chartFor(profile);
  const report = await writeReport('birth_chart', owner.userId, { person: birthSummary(profile), chart }, undefined, region);
  return save(owner, 'BIRTH_CHART', tr('Kundli for {name}', { name: profile.name }), { ...birthSummary(profile), region }, chart as any, report.content, report.model, profile.id);
}

export async function createHoroscope(
  owner: Owner,
  args: { profileId?: string | null; sign?: string | null; period?: string | null; system?: string | null; region?: string | null },
) {
  const period = ['today', 'week', 'month'].includes(args.period ?? '') ? args.period! : 'today';
  const system = args.system === 'western' ? 'western' : 'vedic';
  let sign = args.sign && SIGNS.includes(args.sign as any) ? args.sign : null;
  let person: string | null = null;
  let profileId: string | undefined;

  if (!sign) {
    const profile = await profileFor(owner.userId, args.profileId);
    const chart = chartFor(profile);
    // Vedic horoscopes are read from the Moon sign, Western ones from the Sun sign.
    sign = system === 'vedic' ? chart.moonSign.sign : chart.sunSign.tropical;
    person = profile.name;
    profileId = profile.id;
  }

  const today = new Date().toISOString().slice(0, 10);
  const transits = currentTransits();
  const payload = { sign, system, period, date: today, transits };
  const region = system === 'vedic' ? toRegion(args.region ?? defaultRegion()) : undefined;
  const report = await writeReport('horoscope', owner.userId, payload, undefined, region);
  const label = tr(period === 'today' ? 'Today' : period === 'week' ? 'This week' : 'This month');
  const signLabel = tr(system === 'vedic' ? '{sign} (Moon sign)' : '{sign} (Sun sign)', { sign: tr(sign) });
  return save(
    owner,
    'HOROSCOPE',
    person ? tr('{period}: {sign} for {name}', { period: label, sign: signLabel, name: person }) : `${label}: ${signLabel}`,
    { sign, system, period, date: today, region: region ?? null },
    payload as any,
    report.content,
    report.model,
    profileId,
  );
}

export async function createCompatibility(owner: Owner, profileA: string, profileB: string) {
  const [a, b] = await Promise.all([profileFor(owner.userId, profileA), profileFor(owner.userId, profileB)]);
  if (a.id === b.id) throw userError('Please choose two different people to compare.');
  const pick = (c: ReturnType<typeof chartFor>) => ({
    ascendant: c.ascendant,
    moonSign: c.moonSign,
    nakshatra: c.janmaNakshatra,
    planets: c.planets,
    seventhHouse: c.houses[6],
    manglik: c.yogas.find((y) => y.name.startsWith('Manglik')),
    currentDasha: c.currentDasha,
  });
  const data = { personA: { ...birthSummary(a), chart: pick(chartFor(a)) }, personB: { ...birthSummary(b), chart: pick(chartFor(b)) } };
  const report = await writeReport('compatibility', owner.userId, data);
  return save(owner, 'COMPATIBILITY', tr('{a} & {b}: compatibility', { a: a.name, b: b.name }), { profileA: a.id, profileB: b.id }, data as any, report.content, report.model, a.id);
}

export async function createTarot(owner: Owner, args: { question?: string | null; spread?: string | null }) {
  const spread = args.spread && SPREADS[args.spread] ? args.spread : 'three';
  const question = args.question?.trim() || tr('General guidance for the path ahead');
  const cards = drawSpread(spread);
  const report = await writeReport('tarot', owner.userId, { question, spread: SPREADS[spread].label, cards });
  return save(owner, 'TAROT', tr('Tarot: {question}', { question: question.slice(0, 60) }), { question, spread }, { spread: SPREADS[spread].label, cards }, report.content, report.model);
}

export async function createNumerology(owner: Owner, args: { fullName: string; birthDate: string }) {
  if (!args.fullName?.trim()) throw userError('Please enter the full name as it is usually written.');
  // Numerology counts the letters A to Z, so a name in another script gives nothing.
  if (!/[a-z]/i.test(args.fullName)) throw userError('Please write the name in English letters, as numerology counts the letters A to Z.');
  if (!isValidDate(args.birthDate)) throw userError('Please enter the date of birth as YYYY-MM-DD.');
  const numbers = computeNumerology(args.fullName.trim(), args.birthDate);
  const report = await writeReport('numerology', owner.userId, numbers);
  return save(owner, 'NUMEROLOGY', tr('Numerology for {name}', { name: args.fullName.trim() }), args, numbers, report.content, report.model);
}

export async function createPalm(owner: Owner, args: { imageDataUrl: string; hand?: string | null; question?: string | null }) {
  if (!args.imageDataUrl?.startsWith('data:image/')) throw userError('Please attach a photo of your palm.');
  if (args.imageDataUrl.length > 7_000_000) throw userError('That photo is too large. Please use one under 5 MB.');
  const hand = args.hand === 'left' ? 'left' : 'right';
  const payload = { hand, question: args.question ?? null };
  const report = await writeReport('palm', owner.userId, payload, args.imageDataUrl);
  return save(owner, 'PALM', tr(hand === 'left' ? 'Palm reading (left hand)' : 'Palm reading (right hand)'), { ...payload, imageDataUrl: args.imageDataUrl }, payload, report.content, report.model);
}

export async function createDream(owner: Owner, args: { dream: string; feeling?: string | null }) {
  if (!args.dream || args.dream.trim().length < 10) throw userError('Please describe the dream in a sentence or two.');
  const payload = { dream: args.dream.trim(), feeling: args.feeling ?? null };
  const report = await writeReport('dream', owner.userId, payload);
  return save(owner, 'DREAM', tr('Dream: {dream}', { dream: payload.dream.slice(0, 60) }), payload, payload, report.content, report.model);
}
