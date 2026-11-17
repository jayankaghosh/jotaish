'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { ChatSidebar } from '@/components/ChatSidebar';
import { Spinner } from '@/components/ui';
import { gql } from '@/lib/gql';
import { useT } from '@/lib/i18n';

function ChatHome() {
  const router = useRouter();
  const t = useT();
  const params = useSearchParams();
  const started = useRef(false);
  const wantsNew = params.get('new') === '1';

  useEffect(() => {
    if (!wantsNew || started.current) return;
    started.current = true;
    const q = params.get('q');
    gql(`mutation { startConversation { id } }`).then(({ startConversation }) => {
      router.replace(`/chat/${startConversation.id}${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    });
  }, [wantsNew, params, router]);

  if (wantsNew) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-muted">
        <Spinner /> {t('chat.opening')}
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] gap-6 md:grid-cols-[260px_1fr]">
      <div className="hidden md:block"><ChatSidebar /></div>
      <div className="card flex flex-col items-center justify-center p-8 text-center">
        <MessageCircle size={36} className="mb-4 text-gold" />
        <h1 className="font-display text-3xl text-ink">{t('landing.talk')}</h1>
        <p className="mt-2 max-w-md text-muted">
          {t('chat.homeBody')}
        </p>
        <button onClick={() => router.push('/chat?new=1')} className="btn-primary mt-6">{t('chat.startNew')}</button>
        <div className="mt-8 w-full max-w-xs md:hidden"><ChatSidebar /></div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Shell wide>
      <Suspense>
        <ChatHome />
      </Suspense>
    </Shell>
  );
}
