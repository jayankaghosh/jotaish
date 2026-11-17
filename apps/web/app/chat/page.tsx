'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
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
    <div className="grid grid-cols-1 gap-6 lg:h-[calc(100dvh-8rem)] lg:grid-cols-[280px_1fr]">
      <div className="hidden lg:block"><ChatSidebar /></div>
      <div>
        <section className="card relative overflow-hidden p-6 text-center lg:flex lg:h-full lg:flex-col lg:items-center lg:justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.svg" alt="" className="mx-auto mb-3 h-16 w-16" />
          <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{t('landing.talk')}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted sm:text-base">{t('chat.homeBody')}</p>
          <button onClick={() => router.push('/chat?new=1')} className="btn-primary mt-5 w-full sm:w-auto"><Sparkles size={16} /> {t('chat.startNew')}</button>
        </section>
        <div className="mt-6 lg:hidden"><ChatSidebar hideNew /></div>
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
