import type { AiUsage } from '@prisma/client';
import { prisma } from '../lib/db';
import { AI_TASKS, type AiTask } from '../ai/settings';
import { CREDIT_USD } from './limits';

// Where a user's credits went: their AI calls grouped into the things they
// did (a reading, a stretch of chat), newest first.

// Calls further apart than this start a new entry, even for the same chat.
const GAP_MS = 10 * 60_000;
const MAX_ROWS = 3000;

interface Entry {
  key: string;
  rows: AiUsage[];
}

const credits = (cost: number | null) => (cost ?? 0) / CREDIT_USD;
const taskLabel = (task: string) => AI_TASKS[task as AiTask]?.label ?? task;

function sum(rows: AiUsage[]) {
  return {
    calls: rows.length,
    promptTokens: rows.reduce((n, r) => n + r.promptTokens, 0),
    completionTokens: rows.reduce((n, r) => n + r.completionTokens, 0),
    credits: rows.reduce((n, r) => n + credits(r.cost), 0),
    failed: rows.filter((r) => r.error).length,
  };
}

function totalsBy(rows: AiUsage[], key: (r: AiUsage) => string) {
  const groups = new Map<string, AiUsage[]>();
  for (const r of rows) groups.set(key(r), [...(groups.get(key(r)) ?? []), r]);
  return [...groups.entries()].map(([k, g]) => ({ key: k, ...sum(g) })).sort((a, b) => b.credits - a.credits);
}

export async function creditActivity(userId: string, days: number) {
  const since = new Date(Date.now() - days * 24 * 3600_000);
  // Newest first so a very busy account keeps its latest calls, then oldest
  // first for grouping.
  const rows = (await prisma.aiUsage.findMany({ where: { userId, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: MAX_ROWS })).reverse();

  const entries: Entry[] = [];
  for (const row of rows) {
    // Calls recorded before this was tracked have no reading or conversation.
    const key = row.readingId ? `r:${row.readingId}` : row.conversationId ? `c:${row.conversationId}` : `t:${row.task}`;
    const last = entries.at(-1);
    if (last && last.key === key && row.createdAt.getTime() - last.rows.at(-1)!.createdAt.getTime() < GAP_MS) last.rows.push(row);
    else entries.push({ key, rows: [row] });
  }

  const readingIds = [...new Set(rows.map((r) => r.readingId).filter(Boolean))] as string[];
  const conversationIds = [...new Set(rows.map((r) => r.conversationId).filter(Boolean))] as string[];
  const [readings, conversations] = await Promise.all([
    prisma.reading.findMany({ where: { id: { in: readingIds } }, select: { id: true, title: true, type: true } }),
    prisma.conversation.findMany({ where: { id: { in: conversationIds } }, select: { id: true, title: true } }),
  ]);
  const readingById = new Map(readings.map((r) => [r.id, r]));
  const conversationById = new Map(conversations.map((c) => [c.id, c]));

  const items = entries.reverse().map(({ rows: group }) => {
    const first = group[0];
    const reading = first.readingId ? readingById.get(first.readingId) : undefined;
    const conversation = first.conversationId ? conversationById.get(first.conversationId) : undefined;
    const tasks = [...new Set(group.map((r) => taskLabel(r.task)))];
    return {
      id: first.id,
      kind: reading || first.readingId ? 'reading' : conversation || first.conversationId ? 'chat' : 'other',
      title: reading?.title ?? (first.readingId ? 'Deleted reading' : conversation ? conversation.title : first.conversationId ? 'Deleted conversation' : taskLabel(first.task)),
      readingId: reading?.id ?? null,
      readingType: reading?.type ?? null,
      // A reading made inside a chat links to the reading itself.
      conversationId: reading ? null : (conversation?.id ?? null),
      tasks,
      language: first.language,
      models: [...new Set(group.map((r) => r.model))],
      startedAt: first.createdAt,
      endedAt: group.at(-1)!.createdAt,
      ...sum(group),
    };
  });

  return {
    days,
    truncated: rows.length === MAX_ROWS,
    ...sum(rows),
    byTask: totalsBy(rows, (r) => r.task).map((t) => ({ ...t, task: t.key, label: taskLabel(t.key) })),
    // Calls recorded before languages were tracked show as unknown.
    byLanguage: totalsBy(rows, (r) => r.language ?? '').map((t) => ({ ...t, language: t.key || null })),
    items,
  };
}
