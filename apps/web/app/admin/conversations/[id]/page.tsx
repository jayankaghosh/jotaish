'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminShell } from '@/components/AdminShell';
import { ChatView } from '@/components/ChatView';
import { ErrorNote, Spinner, formatDate } from '@/components/ui';
import { gql } from '@/lib/gql';
import { ADMIN_MESSAGE_FIELDS } from '@/lib/fragments';
import type { Conversation } from '@/lib/types';

export default function AdminConversation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gql<{ adminConversation: Conversation }>(`query($id: ID!) { adminConversation(id: $id) { id title createdAt messages { ${ADMIN_MESSAGE_FIELDS} } } }`, { id })
      .then((d) => setConversation(d.adminConversation))
      .catch((e) => setError(e.message));
  }, [id]);

  const models = new Set(conversation?.messages?.map((m) => m.model).filter(Boolean));
  const tools = conversation?.messages?.filter((m) => m.role === 'tool').map((m) => m.toolName) ?? [];

  return (
    <AdminShell>
      <button onClick={() => router.back()} className="mb-6 text-sm text-muted hover:text-gold-soft">← Back</button>
      <ErrorNote message={error} />
      {!conversation ? (!error && <Spinner />) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="card p-6">
            <h1 className="mb-4 border-b border-line pb-3 font-display text-3xl text-ink">{conversation.title}</h1>
            <ChatView conversationId={conversation.id} initialMessages={conversation.messages ?? []} readOnly readingHref="/admin/readings" />
          </div>
          <aside className="card h-fit space-y-4 p-6 text-sm">
            <div><p className="text-xs uppercase text-faint">Started</p><p className="text-ink">{formatDate(conversation.createdAt, true)}</p></div>
            <div><p className="text-xs uppercase text-faint">Messages</p><p className="text-ink">{conversation.messages?.filter((m) => m.role !== 'tool').length}</p></div>
            <div><p className="text-xs uppercase text-faint">Models used</p>{[...models].map((m) => <p key={m} className="text-ink">{m}</p>)}</div>
            <div><p className="text-xs uppercase text-faint">Tools called</p>{tools.length ? tools.map((t, i) => <p key={i} className="text-ink">{t}</p>) : <p className="text-muted">None</p>}</div>
          </aside>
        </div>
      )}
    </AdminShell>
  );
}
