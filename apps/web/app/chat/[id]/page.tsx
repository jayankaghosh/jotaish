'use client';

import Link from 'next/link';
import { Suspense, use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { ChatSidebar } from '@/components/ChatSidebar';
import { ChatView } from '@/components/ChatView';
import { Spinner } from '@/components/ui';
import { gql } from '@/lib/gql';
import { MESSAGE_FIELDS } from '@/lib/fragments';
import type { Conversation } from '@/lib/types';

function ConversationScreen({ id }: { id: string }) {
  const prompt = useSearchParams().get('q');
  const [conversation, setConversation] = useState<Conversation | null | undefined>(undefined);
  const [sidebarKey, setSidebarKey] = useState(0);

  useEffect(() => {
    setConversation(undefined);
    gql<{ conversation: Conversation | null }>(`query($id: ID!) { conversation(id: $id) { id title messages { ${MESSAGE_FIELDS} } } }`, { id })
      .then((d) => setConversation(d.conversation))
      .catch(() => setConversation(null));
  }, [id]);

  return (
    <div className="grid h-[calc(100vh-8rem)] gap-6 md:grid-cols-[260px_1fr]">
      <div className="hidden md:block"><ChatSidebar activeId={id} refreshKey={sidebarKey} /></div>
      <div className="card flex min-h-0 flex-col p-4 sm:p-6">
        {conversation === undefined && <Spinner />}
        {conversation === null && <p className="text-muted">This conversation could not be found. <Link href="/chat" className="text-gold">Start a new one</Link>.</p>}
        {conversation && (
          <>
            <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
              <h1 className="truncate font-display text-2xl text-ink">{conversation.title}</h1>
              <Link href="/chat" className="text-sm text-gold md:hidden">All chats</Link>
            </div>
            <div className="min-h-0 flex-1">
              <ChatView conversationId={conversation.id} initialMessages={conversation.messages ?? []} initialPrompt={prompt}
                onTitle={(title) => {
                  setConversation((c) => (c ? { ...c, title } : c));
                  setSidebarKey((k) => k + 1);
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Shell wide>
      <Suspense>
        <ConversationScreen id={id} />
      </Suspense>
    </Shell>
  );
}
