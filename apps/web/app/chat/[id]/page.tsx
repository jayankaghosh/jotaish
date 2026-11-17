'use client';

import Link from 'next/link';
import { Suspense, use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Plus } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { ChatSidebar } from '@/components/ChatSidebar';
import { ChatView } from '@/components/ChatView';
import { Spinner } from '@/components/ui';
import { gql } from '@/lib/gql';
import { useConversationTitle, useT } from '@/lib/i18n';
import { MESSAGE_FIELDS } from '@/lib/fragments';
import type { Conversation } from '@/lib/types';

function ConversationScreen({ id }: { id: string }) {
  const prompt = useSearchParams().get('q');
  const router = useRouter();
  const t = useT();
  const titleOf = useConversationTitle();
  const [conversation, setConversation] = useState<Conversation | null | undefined>(undefined);
  const [sidebarKey, setSidebarKey] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setConversation(undefined);
    gql<{ conversation: Conversation | null }>(`query($id: ID!) { conversation(id: $id) { id title messages { ${MESSAGE_FIELDS} } } }`, { id })
      .then((d) => setConversation(d.conversation))
      .catch(() => setConversation(null));
  }, [id]);

  async function startNew() {
    setCreating(true);
    const { startConversation } = await gql(`mutation { startConversation { id } }`);
    router.push(`/chat/${startConversation.id}`);
    setCreating(false);
  }

  return (
    <div className="flex h-dvh flex-col lg:grid lg:h-[calc(100dvh-8rem)] lg:grid-cols-[280px_1fr] lg:gap-6">
      <div className="hidden lg:block"><ChatSidebar activeId={id} refreshKey={sidebarKey} /></div>

      <div className="flex min-h-0 flex-1 flex-col lg:card lg:p-6">
        {/* On phones the conversation has its own header in place of the app's. */}
        <header className="flex items-center gap-2 border-b border-line/70 bg-night/85 px-2 py-2 backdrop-blur-xl lg:mb-4 lg:border-line lg:bg-transparent lg:px-0 lg:pb-3 lg:pt-0">
          <Link href="/chat" className="rounded-full p-2 text-muted hover:text-ink lg:hidden" aria-label={t('chat.all')}>
            <ChevronLeft size={22} />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.svg" alt="" className="h-9 w-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-semibold text-ink lg:text-xl">
              {conversation ? titleOf(conversation.title) : 'Jotaish'}
            </h1>
            <p className="text-xs text-ok">● {t('chat.online')}</p>
          </div>
          <button onClick={startNew} disabled={creating} className="rounded-full p-2 text-muted hover:text-gold lg:hidden" aria-label={t('chat.new')}>
            {creating ? <Spinner /> : <Plus size={22} />}
          </button>
        </header>

        <div className="min-h-0 flex-1 px-3 lg:px-0">
          {conversation === undefined && <div className="flex justify-center py-10"><Spinner /></div>}
          {conversation === null && (
            <p className="p-4 text-muted">{t('chat.notFound')} <Link href="/chat" className="text-gold">{t('chat.startOne')}</Link></p>
          )}
          {conversation && (
            <ChatView
              conversationId={conversation.id}
              initialMessages={conversation.messages ?? []}
              initialPrompt={prompt}
              onTitle={(title) => {
                setConversation((c) => (c ? { ...c, title } : c));
                setSidebarKey((k) => k + 1);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Shell wide immersive>
      <Suspense>
        <ConversationScreen id={id} />
      </Suspense>
    </Shell>
  );
}
