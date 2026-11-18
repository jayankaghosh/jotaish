import { AsyncLocalStorage } from 'node:async_hooks';
import { prisma } from '../lib/db';
import { env } from '../lib/env';
import { getApiKey, getModels, getTemperature, type AiTask } from './settings';
import { chargeOverflow } from '../services/limits';
import { currentLang, tr } from '../i18n';

// What the AI calls made inside a piece of work were for, recorded with each
// call so admins can see where a user's credits went.
interface UsageScope {
  conversationId?: string | null;
  // Ids of the usage rows recorded in this scope, so a reading can claim them
  // once it is saved.
  ids: string[];
}

const usageScope = new AsyncLocalStorage<UsageScope>();

// Runs fn in a scope of its own, keeping the conversation of the outer one.
export async function trackUsage<T>(context: { conversationId?: string | null }, fn: (ids: string[]) => Promise<T>): Promise<T> {
  const scope: UsageScope = { conversationId: context.conversationId ?? usageScope.getStore()?.conversationId, ids: [] };
  return usageScope.run(scope, () => fn(scope.ids));
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | ContentPart[] }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string };

export interface ToolDefinition {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

// Errors safe to show customers. The technical reason stays in `detail`,
// which only the admin console sees.
export class AiError extends Error {
  readonly expose = true;
  constructor(message: string, readonly detail: string) {
    super(message);
  }
}

export class AiNotConfiguredError extends AiError {
  constructor() {
    super(tr('Readings are not available right now. Please try again a little later.'), 'No OpenRouter API key is set.');
  }
}

interface CompletionOptions {
  task: AiTask;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  userId?: string | null;
  maxTokens?: number;
  model?: string;
  // When set, the reply is streamed and each text fragment is passed here.
  onToken?: (text: string) => void;
  // How much hidden thinking a reasoning model may do before it writes.
  // Ignored by models that don't think.
  reasoning?: 'low' | 'medium' | 'high';
}

export interface Completion {
  model: string;
  content: string;
  toolCalls: ToolCall[];
  // True when the model stopped because it hit maxTokens.
  truncated: boolean;
}

export async function complete(opts: CompletionOptions): Promise<Completion> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new AiNotConfiguredError();
  const model = opts.model ?? (await getModels())[opts.task];
  const started = Date.now();
  let usage: { prompt_tokens?: number; completion_tokens?: number; cost?: number } = {};
  let error: string | null = null;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.webOrigin,
        'X-Title': 'Jotaish',
      },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        tools: opts.tools?.length ? opts.tools : undefined,
        temperature: await getTemperature(),
        max_tokens: opts.maxTokens ?? 4000,
        usage: { include: true },
        stream: Boolean(opts.onToken),
        reasoning: opts.reasoning ? { effort: opts.reasoning } : undefined,
      }),
    });
    if (opts.onToken && res.ok && res.body) {
      const streamed = await readStream(res.body, opts.onToken);
      usage = streamed.usage;
      return { model: streamed.model || model, content: streamed.content, toolCalls: streamed.toolCalls, truncated: streamed.finishReason === 'length' };
    }
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok || json.error) {
      throw new Error(json.error?.message ?? `OpenRouter returned ${res.status}`);
    }
    usage = json.usage ?? {};
    const message = json.choices?.[0]?.message ?? {};
    return {
      model: json.model ?? model,
      content: message.content ?? '',
      toolCalls: message.tool_calls ?? [],
      truncated: json.choices?.[0]?.finish_reason === 'length',
    };
  } catch (e) {
    error = (e as Error).message;
    throw new AiError(tr('Jotaish could not answer just now. Please try again in a moment.'), error);
  } finally {
    const promptTokens = usage.prompt_tokens ?? 0;
    const completionTokens = usage.completion_tokens ?? 0;
    // Allowances depend on cost, so estimate it when OpenRouter doesn't say.
    const cost = usage.cost ?? (promptTokens || completionTokens ? await estimateCost(model, promptTokens, completionTokens) : null);
    const scope = usageScope.getStore();
    const row = await prisma.aiUsage
      .create({
        data: {
          userId: opts.userId ?? null,
          task: opts.task,
          model,
          promptTokens,
          completionTokens,
          cost,
          latencyMs: Date.now() - started,
          error,
          language: currentLang(),
          conversationId: scope?.conversationId ?? null,
        },
      })
      .catch(() => null);
    if (row) scope?.ids.push(row.id);
    if (opts.userId && cost && row) await chargeOverflow(opts.userId, row).catch(() => undefined);
  }
}

// Parses OpenRouter's server-sent events, rebuilding text and tool calls.
export async function readStream(body: ReadableStream<Uint8Array>, onToken: (text: string) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const toolCalls: ToolCall[] = [];
  let buffer = '';
  let content = '';
  let model = '';
  let usage = {};
  let finishReason: string | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      // Lines starting with ':' are keep-alive comments.
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      let chunk: any;
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }
      if (chunk.error) throw new Error(chunk.error.message ?? 'The stream was interrupted');
      model = chunk.model ?? model;
      if (chunk.usage) usage = chunk.usage;
      finishReason = chunk.choices?.[0]?.finish_reason ?? finishReason;
      const delta = chunk.choices?.[0]?.delta ?? {};
      if (delta.content) {
        content += delta.content;
        onToken(delta.content);
      }
      for (const part of delta.tool_calls ?? []) {
        const call = (toolCalls[part.index ?? 0] ??= { id: '', type: 'function', function: { name: '', arguments: '' } });
        if (part.id) call.id = part.id;
        if (part.function?.name) call.function.name ||= part.function.name;
        if (part.function?.arguments) call.function.arguments += part.function.arguments;
      }
    }
  }
  return { content, model, usage, finishReason, toolCalls: toolCalls.filter(Boolean) };
}

let priceCache: { at: number; prices: Map<string, { prompt: number; completion: number }> } | null = null;

async function estimateCost(model: string, promptTokens: number, completionTokens: number): Promise<number | null> {
  try {
    if (!priceCache || Date.now() - priceCache.at > 3600_000) {
      const models = await listOpenRouterModels();
      // Prices from the catalogue are per million tokens.
      priceCache = { at: Date.now(), prices: new Map(models.map((m) => [m.id, { prompt: m.promptPrice / 1e6, completion: m.completionPrice / 1e6 }])) };
    }
    const price = priceCache.prices.get(model);
    return price ? promptTokens * price.prompt + completionTokens * price.completion : null;
  } catch {
    return null;
  }
}

export async function listOpenRouterModels() {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) return [];
  const json = (await res.json()) as { data: any[] };
  return json.data.map((m) => ({
    id: m.id as string,
    name: m.name as string,
    contextLength: m.context_length as number,
    promptPrice: Number(m.pricing?.prompt ?? 0) * 1e6,
    completionPrice: Number(m.pricing?.completion ?? 0) * 1e6,
    vision: (m.architecture?.input_modalities ?? []).includes('image'),
    tools: (m.supported_parameters ?? []).includes('tools'),
  }));
}
