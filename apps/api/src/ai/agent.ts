import type { Message, Reading } from '@prisma/client';
import { prisma } from '../lib/db';
import { userError } from '../lib/auth';
import { complete, trackUsage, type ChatMessage, type ContentPart, type ToolDefinition } from './openrouter';
import { astrologerSystemPrompt } from './prompts';
import { LANGUAGE_NAMES, currentLang, tr, withLang, type Lang } from '../i18n';
import { saveProfile } from '../services/profiles';
import { assertCanInteract } from '../services/limits';
import * as readings from '../services/readings';
import { SIGNS } from '../astro/vedic';
import { SPREADS } from '../astro/tarot';

const MAX_STEPS = 6;
const HISTORY_LIMIT = 40;

const TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'save_birth_profile',
      description: 'Save birth details for the user or someone they ask about (partner, child, parent). Call this once you have name, date and place of birth.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          relation: { type: 'string', description: 'self, partner, spouse, child, parent, friend or other' },
          gender: { type: 'string', enum: ['male', 'female', 'other'] },
          birthDate: { type: 'string', description: 'YYYY-MM-DD' },
          birthTime: { type: 'string', description: 'HH:MM in 24-hour local time. Omit if unknown.' },
          birthPlace: { type: 'string', description: 'City and country, e.g. "Pune, India"' },
        },
        required: ['name', 'birthDate', 'birthPlace'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_birth_chart',
      description: 'Compute a Vedic birth chart (Kundli) with dashas, yogas and doshas and write a full report. Uses the user\'s own profile unless profileId is given. If you know which Indian tradition the person follows (north, south or east), pass it as region.',
      parameters: { type: 'object', properties: { profileId: { type: 'string' }, region: { type: 'string', enum: ['north', 'south', 'east'] } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'horoscope',
      description: 'Write a horoscope from current planetary transits, for a saved profile or for a zodiac sign.',
      parameters: {
        type: 'object',
        properties: {
          profileId: { type: 'string' },
          sign: { type: 'string', enum: [...SIGNS] },
          period: { type: 'string', enum: ['today', 'week', 'month'] },
          system: { type: 'string', enum: ['vedic', 'western'] },
          region: { type: 'string', enum: ['north', 'south', 'east'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compatibility',
      description: 'Compare two saved birth profiles for relationship or marriage compatibility.',
      parameters: {
        type: 'object',
        properties: { profileA: { type: 'string' }, profileB: { type: 'string' } },
        required: ['profileA', 'profileB'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draw_tarot',
      description: 'Shuffle and draw a tarot spread for a question, then interpret it.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          spread: { type: 'string', enum: Object.keys(SPREADS) },
        },
        required: ['question'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'numerology',
      description: 'Compute a numerology profile (Pythagorean, Chaldean, Mulank, Bhagyank) from full name and date of birth.',
      parameters: {
        type: 'object',
        properties: { fullName: { type: 'string' }, birthDate: { type: 'string', description: 'YYYY-MM-DD' } },
        required: ['fullName', 'birthDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_palm',
      description: 'Read the palm photo the user attached most recently in this conversation.',
      parameters: {
        type: 'object',
        properties: { hand: { type: 'string', enum: ['left', 'right'] }, question: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'interpret_dream',
      description: 'Interpret a dream the user described.',
      parameters: {
        type: 'object',
        properties: { dream: { type: 'string' }, feeling: { type: 'string', description: 'How the dream felt' } },
        required: ['dream'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_reading',
      description: 'Read the full text of one of the user\'s saved readings.',
      parameters: { type: 'object', properties: { readingId: { type: 'string' } }, required: ['readingId'] },
    },
  },
];

const NODES = new Set(['Rahu', 'Ketu']);

// The computed data behind a reading, compact enough to send with every
// turn, so answers can come from the chart itself and not only the prose.
function readingFacts(reading: Reading): unknown {
  const data = reading.data as any;
  if (reading.type === 'BIRTH_CHART') {
    const current = data.dashas?.find((d: any) => d.current);
    return {
      birthTimeKnown: data.birthTimeKnown,
      ascendant: data.ascendant,
      moonSign: data.moonSign,
      sunSign: data.sunSign,
      janmaNakshatra: data.janmaNakshatra,
      planets: data.planets?.map(
        (p: any) =>
          `${p.planet}: ${p.sign} ${p.degree}, house ${p.house}, ${p.nakshatra} pada ${p.pada}` +
          `${p.retrograde && !NODES.has(p.planet) ? ', retrograde' : ''}${p.dignity ? `, ${p.dignity}` : ''}, navamsa ${p.navamsaSign}`,
      ),
      houses: data.houses?.map((h: any) => `${h.house}: ${h.sign}, lord ${h.lord}${h.planets.length ? `, holds ${h.planets.join(', ')}` : ''}`),
      mahadashas: data.dashas?.map((d: any) => `${d.lord} ${d.start} to ${d.end}${d.current ? ' (current)' : ''}`),
      currentAntardashas: current?.antardashas?.map((a: any) => `${a.lord} ${a.start} to ${a.end}${a.current ? ' (current)' : ''}`),
      yogas: data.yogas,
      sadeSati: data.sadeSati,
    };
  }
  // Palm photos stay out; the written reading describes them.
  if (reading.type === 'PALM') return null;
  return data;
}

function readingResult(reading: Reading) {
  return {
    readingId: reading.id,
    type: reading.type,
    title: reading.title,
    note: 'The full report is saved in the user\'s readings and shown to them as a card. Summarise the key points briefly.',
    facts: readingFacts(reading),
    report: reading.interpretation,
  };
}

async function runTool(name: string, args: any, ctx: { userId: string; conversationId: string; latestImage: string | null }) {
  const owner = { userId: ctx.userId, conversationId: ctx.conversationId };
  switch (name) {
    case 'save_birth_profile': {
      const profile = await saveProfile(ctx.userId, args);
      return { saved: true, profile: { id: profile.id, name: profile.name, relation: profile.relation, birthDate: profile.birthDate, birthTime: profile.birthTime, birthPlace: profile.birthPlace } };
    }
    case 'generate_birth_chart':
      return readingResult(await readings.createBirthChart(owner, args.profileId, args.region));
    case 'horoscope':
      return readingResult(await readings.createHoroscope(owner, args));
    case 'compatibility':
      return readingResult(await readings.createCompatibility(owner, args.profileA, args.profileB));
    case 'draw_tarot':
      return readingResult(await readings.createTarot(owner, args));
    case 'numerology':
      return readingResult(await readings.createNumerology(owner, args));
    case 'read_palm':
      if (!ctx.latestImage) return { error: 'No photo attached yet. Ask the user to attach a clear photo of their open palm with the image button.' };
      return readingResult(await readings.createPalm(owner, { ...args, imageDataUrl: ctx.latestImage }));
    case 'interpret_dream':
      return readingResult(await readings.createDream(owner, args));
    case 'open_reading': {
      const r = await prisma.reading.findFirst({ where: { id: args.readingId, userId: ctx.userId } });
      return r
        ? { title: r.title, type: r.type, createdAt: r.createdAt, input: r.type === 'PALM' ? null : r.input, facts: readingFacts(r), report: r.interpretation }
        : { error: 'Reading not found.' };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

async function personContext(userId: string, focusReadingId: string | null) {
  const [user, profiles, recent, focus] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.birthProfile.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.reading.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 12 }),
    focusReadingId ? prisma.reading.findFirst({ where: { id: focusReadingId, userId } }) : null,
  ]);
  const lines = [
    `Name: ${user.name}. Today is ${new Date().toISOString().slice(0, 10)}.`,
    profiles.length
      ? `Saved birth profiles:\n${profiles.map((p) => `- id=${p.id} ${p.name} (${p.relation}), born ${p.birthDate} at ${p.birthTime ?? 'unknown time'} in ${p.birthPlace}`).join('\n')}`
      : 'No birth details saved yet. Gently ask for them before any chart-based reading.',
    recent.length
      ? `Recent readings (use open_reading for details):\n${recent.map((r) => `- id=${r.id} ${r.type} "${r.title}" on ${r.createdAt.toISOString().slice(0, 10)}`).join('\n')}`
      : 'No readings yet.',
  ];
  if (focus) {
    lines.push(
      `The person opened this conversation to discuss their reading "${focus.title}".\n` +
        `Computed data:\n${JSON.stringify(readingFacts(focus), null, 1)}\n\nFull report:\n${focus.interpretation}`,
    );
  }
  return lines.join('\n\n');
}

function toChatMessages(history: Message[], latestId: string): ChatMessage[] {
  return history.map((m): ChatMessage => {
    if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId!, content: compactToolResult(m.content) };
    if (m.role === 'assistant') {
      const toolCalls = (m.toolCalls as any[] | null) ?? undefined;
      return { role: 'assistant', content: m.content || null, tool_calls: toolCalls?.length ? toolCalls : undefined };
    }
    // Only the newest photo is sent; older ones would only add cost.
    if (m.imageDataUrl && m.id === latestId) {
      const parts: ContentPart[] = [{ type: 'text', text: m.content || 'Here is my photo.' }, { type: 'image_url', image_url: { url: m.imageDataUrl } }];
      return { role: 'user', content: parts };
    }
    return { role: 'user', content: m.imageDataUrl ? `${m.content}\n[photo attached]` : m.content };
  });
}

// A tool reply from an earlier turn keeps the facts but not the full report.
// Reports are long (several times longer outside English) and would otherwise
// be sent again with every later message; the model can open the reading if
// it needs the wording.
function compactToolResult(content: string) {
  try {
    const result = JSON.parse(content);
    if (!result || typeof result.report !== 'string') return content;
    const { report: _report, note: _note, ...rest } = result;
    return JSON.stringify({ ...rest, note: 'Report already shared with the user. Call open_reading with this readingId if you need its details.' });
  } catch {
    return content;
  }
}

// Drops leading messages that would leave a tool reply without its call.
function trimHistory(history: Message[]) {
  const recent = history.slice(-HISTORY_LIMIT);
  while (recent.length && recent[0].role !== 'user') recent.shift();
  return recent;
}

export async function greeting(userId: string, focusTitle?: string) {
  const [user, profileCount, readingCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.birthProfile.count({ where: { userId } }),
    prisma.reading.count({ where: { userId } }),
  ]);
  const first = user.name.split(' ')[0];
  if (focusTitle) return tr('Namaste {name}. I have your reading **{title}** open in front of me. What would you like to understand better?', { name: first, title: focusTitle });
  if (!profileCount) {
    return tr("Namaste {name}, I'm Jotaish, your astrologer. I can prepare your Kundli, read tarot, explain your numbers, read your palm or interpret a dream.\n\nTo begin with anything chart-based, I'll need your **date of birth**, **time of birth** (approximate is fine) and **place of birth**. Would you like to share them, or would you rather start with tarot or a dream?", { name: first });
  }
  if (!readingCount) {
    return tr("Namaste {name}, I'm Jotaish, your astrologer. I have your birth details, so we can begin whenever you're ready. A good first step is your **Kundli**, the full map of your birth chart. Or simply tell me what's on your mind: career, love, family, health or timing.", { name: first });
  }
  return tr("Namaste {name}, welcome back. What's on your mind today? You can ask about career, love, health or timing, or pick one of the suggestions below.", { name: first });
}

export type ChatEvent =
  | { type: 'message'; message: Message }
  | { type: 'token'; text: string }
  | { type: 'status'; text: string }
  | { type: 'title'; text: string }
  | { type: 'error'; text: string };

// What the person sees while a tool runs; reports can take a minute.
const TOOL_STATUS: Record<string, string> = {
  save_birth_profile: 'Saving the birth details…',
  generate_birth_chart: 'Calculating the planets and preparing your Kundli…',
  horoscope: 'Reading today\'s planetary transits…',
  compatibility: 'Comparing both birth charts…',
  draw_tarot: 'Shuffling the deck and drawing your cards…',
  numerology: 'Working out your numbers…',
  read_palm: 'Studying the lines on your palm…',
  interpret_dream: 'Reflecting on the symbols in your dream…',
  open_reading: 'Opening your saved reading…',
};

export function sendMessage(
  userId: string,
  conversationId: string,
  content: string,
  imageDataUrl?: string | null,
  emit: (event: ChatEvent) => void = () => undefined,
) {
  // Every AI call in this reply, reports included, is recorded against the conversation.
  return trackUsage({ conversationId }, () => answer(userId, conversationId, content, imageDataUrl, emit));
}

async function answer(userId: string, conversationId: string, content: string, imageDataUrl: string | null | undefined, emit: (event: ChatEvent) => void) {
  const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, userId } });
  if (!conversation) throw userError('Conversation not found.');
  if (!content.trim() && !imageDataUrl) throw userError('Please type a message.');
  if (imageDataUrl && (!imageDataUrl.startsWith('data:image/') || imageDataUrl.length > 7_000_000)) {
    throw userError('Please attach a JPG or PNG photo under 5 MB.');
  }
  await assertCanInteract(await prisma.user.findUniqueOrThrow({ where: { id: userId } }));

  const created: Message[] = [];
  const record = async (data: Parameters<typeof prisma.message.create>[0]['data']) => {
    const message = await prisma.message.create({ data });
    created.push(message);
    emit({ type: 'message', message });
    return message;
  };

  const userMessage = await record({ conversationId, role: 'user', content: content.trim(), imageDataUrl: imageDataUrl ?? null });
  // Name the conversation alongside the reply rather than after it.
  const naming = conversation.title === 'New consultation' && content.trim() ? nameConversation(userId, conversationId, content.trim()) : null;

  const all = await prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } });
  const latestImage = [...all].reverse().find((m) => m.imageDataUrl)?.imageDataUrl ?? null;
  const system = astrologerSystemPrompt(await personContext(userId, conversation.focusReadingId), currentLang());
  const messages: ChatMessage[] = [{ role: 'system', content: system }, ...toChatMessages(trimHistory(all), userMessage.id)];

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      // On the last step tools are withheld so the model has to answer.
      const tools = step < MAX_STEPS - 1 ? TOOLS : undefined;
      // Indian scripts take several times more tokens than English, and the
      // model's thinking comes out of the same budget, so there is room for
      // a full answer in any language. Light thinking is enough for a chat.
      const reply = await complete({ task: currentLang() === 'en' ? 'chat' : 'chat_languages', userId, messages, tools, maxTokens: 4000, reasoning: 'low', onToken: (text) => emit({ type: 'token', text }) });
      // Never leave the person with a blank reply.
      if (!reply.content.trim() && !reply.toolCalls.length) reply.content = tr("I'm sorry, I couldn't respond just now.");
      await record({
        conversationId,
        role: 'assistant',
        content: reply.content,
        toolCalls: reply.toolCalls.length ? (reply.toolCalls as any) : undefined,
        model: reply.model,
      });
      messages.push({ role: 'assistant', content: reply.content || null, tool_calls: reply.toolCalls.length ? reply.toolCalls : undefined });
      if (!reply.toolCalls.length) break;

      for (const call of reply.toolCalls) {
        emit({ type: 'status', text: tr(TOOL_STATUS[call.function.name] ?? 'Working on it…') });
        let result: unknown;
        try {
          result = await runTool(call.function.name, JSON.parse(call.function.arguments || '{}'), { userId, conversationId, latestImage });
        } catch (e) {
          result = { error: (e as Error).message };
        }
        const text = JSON.stringify(result);
        await record({ conversationId, role: 'tool', content: text, toolCallId: call.id, toolName: call.function.name });
        messages.push({ role: 'tool', tool_call_id: call.id, content: text });
      }
    }
  } catch (e) {
    await record({ conversationId, role: 'assistant', content: `${tr("I'm sorry, I couldn't respond just now.")} ${(e as Error).message}` });
  }

  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  const title = await naming;
  if (title) emit({ type: 'title', text: title });
  return created;
}

// Runs a reply and yields its events as they happen. The reply keeps going
// and is saved even if the person closes the page mid-stream.
export async function* streamMessage(userId: string, conversationId: string, content: string, imageDataUrl: string | null | undefined, lang: Lang) {
  const queue: ChatEvent[] = [];
  let wake: (() => void) | null = null;
  let finished = false;
  const notify = () => {
    wake?.();
    wake = null;
  };

  // The reply runs on after this generator is left, so it carries its own
  // language rather than relying on the request.
  withLang(lang, () =>
    sendMessage(userId, conversationId, content, imageDataUrl, (event) => {
      queue.push(event);
      notify();
    }),
  )
    .catch((e) => queue.push({ type: 'error', text: (e as Error).message }))
    .finally(() => {
      finished = true;
      notify();
    });

  for (;;) {
    if (queue.length) {
      yield queue.shift()!;
      continue;
    }
    if (finished) return;
    await new Promise<void>((resolve) => (wake = resolve));
  }
}

async function nameConversation(userId: string, conversationId: string, firstMessage: string) {
  try {
    const reply = await complete({
      task: 'title',
      userId,
      maxTokens: 20,
      messages: [
        {
          role: 'system',
          content: `Give a 2 to 5 word title, in ${LANGUAGE_NAMES[currentLang()]}, for an astrology consultation that starts with this message. Reply with the title only, no quotes.`,
        },
        { role: 'user', content: firstMessage.slice(0, 500) },
      ],
    });
    const title = reply.content.replace(/["*#]/g, '').trim().slice(0, 60);
    if (!title) return null;
    await prisma.conversation.update({ where: { id: conversationId }, data: { title } });
    return title;
  } catch {
    // A missing title is harmless; the default stays.
    return null;
  }
}
