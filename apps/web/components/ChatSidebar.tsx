'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { gql } from '@/lib/gql';
import { useConversationTitle, useT } from '@/lib/i18n';
import type { Conversation } from '@/lib/types';
import { Spinner, formatDate } from './ui';

export function ChatSidebar({ activeId, refreshKey = 0, hideNew = false }: { activeId?: string; refreshKey?: number; hideNew?: boolean }) {
  const router = useRouter();
  const t = useT();
  const titleOf = useConversationTitle();
  const [list, setList] = useState<Conversation[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    gql<{ myConversations: Conversation[] }>(`{ myConversations { id title updatedAt } }`).then((d) => setList(d.myConversations)).catch(() => setList([]));
  }, [refreshKey, activeId]);

  async function startNew() {
    setCreating(true);
    const { startConversation } = await gql(`mutation { startConversation { id } }`);
    router.push(`/chat/${startConversation.id}`);
    setCreating(false);
  }

  async function remove(id: string) {
    if (!confirm(t('chat.confirmDelete'))) return;
    await gql(`mutation($id: ID!) { deleteConversation(id: $id) }`, { id });
    setList((l) => l?.filter((c) => c.id !== id) ?? null);
    if (id === activeId) router.push('/chat');
  }

  return (
    <aside className="flex h-full flex-col">
      {!hideNew && (
        <button onClick={startNew} className="btn-primary mb-4 w-full" disabled={creating}>
          {creating ? <Spinner /> : <Plus size={16} />} {t('chat.new')}
        </button>
      )}
      <p className="mb-2 px-1 text-xs uppercase tracking-wider text-faint">{t('chat.yours')}</p>
      <ul className="flex-1 space-y-1 overflow-y-auto">
        {!list && <Spinner />}
        {list?.length === 0 && <p className="px-1 text-sm text-muted">{t('chat.nothingYet')}</p>}
        {list?.map((c) => (
          <li key={c.id} className="group relative">
            <Link href={`/chat/${c.id}`} className={`block rounded-2xl px-3 py-3 pr-10 ${c.id === activeId ? 'bg-raised text-gold-soft' : 'text-muted hover:bg-raised/60 hover:text-ink'}`}>
              <span className="block truncate text-sm">{titleOf(c.title)}</span>
              <span className="text-xs text-faint">{formatDate(c.updatedAt)}</span>
            </Link>
            <button onClick={() => remove(c.id)} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-2 text-faint hover:text-danger lg:hidden lg:group-hover:block" aria-label={t('chat.deleteConversation')}>
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
