import { prisma } from '../lib/db';
import { decrypt, encrypt } from '../lib/crypto';
import { env } from '../lib/env';

// Each AI job can run on its own model, so cheap jobs stay cheap and the
// astrologer conversation gets the strongest reasoning model.
export const AI_TASKS = {
  chat: { label: 'Astrologer conversation', hint: 'Talks to users and calls the reading tools. Needs tool calling.', needs: ['tools'] },
  chat_languages: {
    label: 'Astrologer conversation in other languages',
    hint: 'Used instead of the one above when the person uses Jotaish in Hindi, Malayalam, Kannada or Bengali. Some models, Claude especially, need several times more tokens for Indian scripts; Gemini models need far fewer.',
    needs: ['tools'],
  },
  birth_chart: { label: 'Kundli / birth chart report', hint: 'Long, structured interpretation of computed chart data.', needs: [] },
  horoscope: { label: 'Daily and weekly horoscopes', hint: 'Short readings from current transits. A fast model is enough.', needs: [] },
  compatibility: { label: 'Compatibility matching', hint: 'Compares two charts side by side.', needs: [] },
  tarot: { label: 'Tarot readings', hint: 'Narrative, intuitive writing around the drawn cards.', needs: [] },
  numerology: { label: 'Numerology reports', hint: 'Explains computed numbers. A fast model is enough.', needs: [] },
  palm: { label: 'Palm reading', hint: 'Reads an uploaded palm photo. Needs image input.', needs: ['vision'] },
  dream: { label: 'Dream interpretation', hint: 'Symbolic and psychological reading of a dream.', needs: [] },
  title: { label: 'Conversation titles', hint: 'Names new conversations. Use the cheapest model.', needs: [] },
} as const;

export type AiTask = keyof typeof AI_TASKS;

// A short list of models that suit this product well. Admins can also pick
// any other model id from the live OpenRouter catalogue.
export const RECOMMENDED_MODELS = [
  { id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5', strengths: 'Warm, careful writing and reliable tool use. Best all-rounder for the astrologer.', vision: true, tools: true },
  { id: 'anthropic/claude-opus-5.5', label: 'Claude Opus 5.5', strengths: 'Deepest reasoning for full Kundli reports and complex charts', vision: true, tools: true },
  { id: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5', strengths: 'Very fast and cheap, good for short readings and titles', vision: true, tools: true },
  { id: 'openai/gpt-6.1-sol', label: 'GPT-6.1 Sol', strengths: 'Strong reasoning and long structured reports', vision: true, tools: true },
  { id: 'openai/gpt-6-luna', label: 'GPT-6 Luna', strengths: 'Low cost, quick everyday answers', vision: true, tools: true },
  { id: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', strengths: 'Very long reports and strong image understanding', vision: true, tools: true },
  { id: 'google/gemini-3.8-flash', label: 'Gemini 3.8 Flash', strengths: 'Fast and affordable, good with palm photos', vision: true, tools: true },
  { id: 'qwen/qwen4-max', label: 'Qwen 4 Max', strengths: 'Good multilingual output, including Hindi and Tamil', vision: true, tools: true },
  { id: 'x-ai/grok-4.7', label: 'Grok 4.7', strengths: 'Lively, conversational tone', vision: true, tools: true },
  { id: 'deepseek/deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash', strengths: 'Lowest cost option for high volume', vision: true, tools: true },
];

export const DEFAULT_MODELS: Record<AiTask, string> = {
  chat: 'anthropic/claude-sonnet-5.5',
  chat_languages: 'anthropic/claude-sonnet-5.5',
  birth_chart: 'anthropic/claude-opus-5.5',
  horoscope: 'google/gemini-3.8-flash',
  compatibility: 'anthropic/claude-sonnet-5.5',
  tarot: 'anthropic/claude-sonnet-5.5',
  numerology: 'anthropic/claude-haiku-5.5',
  palm: 'google/gemini-3.8-flash',
  dream: 'anthropic/claude-sonnet-5.5',
  title: 'anthropic/claude-haiku-5.5',
};

const KEY_SETTING = 'openrouter_api_key';
const MODELS_SETTING = 'ai_models';
const TEMPERATURE_SETTING = 'ai_temperature';

export async function getApiKey(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: KEY_SETTING } });
  if (row?.value) return decrypt(row.value);
  return env.openRouterKey;
}

export async function setApiKey(key: string | null) {
  if (!key) {
    await prisma.setting.deleteMany({ where: { key: KEY_SETTING } });
    return;
  }
  await prisma.setting.upsert({
    where: { key: KEY_SETTING },
    create: { key: KEY_SETTING, value: encrypt(key) },
    update: { value: encrypt(key) },
  });
}

export async function getModels(): Promise<Record<AiTask, string>> {
  const row = await prisma.setting.findUnique({ where: { key: MODELS_SETTING } });
  const saved = row ? (JSON.parse(row.value) as Partial<Record<AiTask, string>>) : {};
  return { ...DEFAULT_MODELS, ...saved };
}

export async function setModels(models: Partial<Record<AiTask, string>>) {
  const merged = { ...(await getModels()), ...models };
  const value = JSON.stringify(merged);
  await prisma.setting.upsert({ where: { key: MODELS_SETTING }, create: { key: MODELS_SETTING, value }, update: { value } });
}

export async function getTemperature(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: TEMPERATURE_SETTING } });
  return row ? Number(row.value) : 0.7;
}

export async function setTemperature(t: number) {
  const value = String(Math.min(1.5, Math.max(0, t)));
  await prisma.setting.upsert({ where: { key: TEMPERATURE_SETTING }, create: { key: TEMPERATURE_SETTING, value }, update: { value } });
}
