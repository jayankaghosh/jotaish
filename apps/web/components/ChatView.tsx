'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ImagePlus, Send, X } from 'lucide-react';
import { gqlStream } from '@/lib/gql';
import { useAuth } from '@/lib/auth';
import { photoToDataUrl } from '@/lib/image';
import { MESSAGE_FIELDS } from '@/lib/fragments';
import { serviceByType } from '@/lib/services';
import { useT, type MessageKey } from '@/lib/i18n';
import type { Message, ReadingType } from '@/lib/types';
import { ErrorNote, Markdown } from './ui';
import { OutOfAllowance, isOutOfAllowance, useUsageLine } from './UsageNote';

const STARTERS: MessageKey[] = ['chat.starter1', 'chat.starter2', 'chat.starter3', 'chat.starter4', 'chat.starter5', 'chat.starter6'];
const THINKING: MessageKey[] = ['chat.thinking1', 'chat.thinking2', 'chat.thinking3', 'chat.thinking4'];

// A tool result as a card that links to the saved reading.
function ReadingCard({ message, readingHref }: { message: Message; readingHref: string }) {
  const t = useT();
  let result: any;
  try {
    result = JSON.parse(message.content);
  } catch {
    return null;
  }
  if (result.saved && result.profile) {
    return <p className="text-xs text-ok">✓ {t('chat.savedDetails', { name: result.profile.name })}</p>;
  }
  if (!result.readingId) return null;
  const s = serviceByType(result.type as ReadingType);
  return (
    <Link href={`${readingHref}/${result.readingId}`} className="flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/5 p-3 hover:border-gold">
      <s.icon size={20} className="text-gold" />
      <div className="flex-1">
        <p className="text-sm text-ink">{result.title}</p>
        <p className="text-xs text-muted">{t('chat.reportSaved')}</p>
      </div>
      <ArrowRight size={16} className="text-gold" />
    </Link>
  );
}

interface ChatViewProps {
  conversationId: string;
  initialMessages: Message[];
  initialPrompt?: string | null;
  readOnly?: boolean;
  readingHref?: string;
  onTitle?: (title: string) => void;
}

interface ChatEvent {
  type: 'message' | 'token' | 'status' | 'title' | 'error';
  text?: string | null;
  message?: Message | null;
}

export function ChatView({ conversationId, initialMessages, initialPrompt, readOnly = false, readingHref = '/readings', onTitle }: ChatViewProps) {
  const { user, refresh } = useAuth();
  const t = useT();
  const usageLine = useUsageLine();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(0);
  // Text of the reply being written right now, and what Jyotaish is doing.
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => setMessages(initialMessages), [initialMessages]);

  useEffect(() => {
    // Scroll only the message list, never the whole page.
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, draft, status]);

  useEffect(() => {
    if (!busy) return;
    setThinking(0);
    const timer = setInterval(() => setThinking((n) => Math.min(n + 1, THINKING.length - 1)), 5000);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    if (initialPrompt && !sentInitial.current && !readOnly) {
      sentInitial.current = true;
      // Drop ?q= so a refresh doesn't send the question twice.
      window.history.replaceState(null, '', window.location.pathname);
      void send(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  async function send(content: string, image: string | null = null) {
    if ((!content.trim() && !image) || busy) return;
    setBusy(true);
    setError(null);
    setDraft('');
    setStatus(null);
    const optimisticId = `tmp-${Date.now()}`;
    setMessages((m) => [...m, { id: optimisticId, role: 'user', content, imageDataUrl: image, createdAt: new Date().toISOString() }]);
    setText('');
    setPhoto(null);
    let delivered = false;
    const restore = (message: string) => {
      setMessages((m) => m.filter((x) => x.id !== optimisticId));
      setText(content);
      setPhoto(image);
      setError(message);
    };

    try {
      await gqlStream<{ chat: ChatEvent }>(
        `subscription($id: ID!, $content: String!, $image: String) { chat(conversationId: $id, content: $content, imageDataUrl: $image) { type text message { ${MESSAGE_FIELDS} } } }`,
        { id: conversationId, content, image },
        ({ chat: event }) => {
          switch (event.type) {
            case 'token':
              setStatus(null);
              setDraft((d) => d + (event.text ?? ''));
              break;
            case 'status':
              setStatus(event.text ?? null);
              break;
            case 'message': {
              const message = event.message!;
              if (message.role === 'user') {
                delivered = true;
                setMessages((m) => m.map((x) => (x.id === optimisticId ? { ...message, imageDataUrl: image } : x)));
              } else {
                setMessages((m) => [...m, message]);
                if (message.role === 'assistant') setDraft('');
              }
              break;
            }
            case 'title':
              if (event.text) onTitle?.(event.text);
              break;
            case 'error':
              if (delivered) setError(event.text ?? t('chat.somethingWrong'));
              else restore(event.text ?? t('chat.somethingWrong'));
              break;
          }
        },
      );
    } catch (e) {
      if (delivered) setError((e as Error).message);
      else restore((e as Error).message);
    } finally {
      setBusy(false);
      setDraft('');
      setStatus(null);
      // Update the "consultations left" count.
      void refresh();
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void send(text, photo);
  }

  const visible = messages.filter((m) => m.role === 'tool' || m.content.trim() || m.imageDataUrl);
  const onlyGreeting = messages.filter((m) => m.role === 'user').length === 0;

  return (
    <div className="flex h-full flex-col">
      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-1 pb-4">
        {visible.map((m) =>
          m.role === 'tool' ? (
            <div key={m.id} className="ml-11 max-w-xl"><ReadingCard message={m} readingHref={readingHref} /></div>
          ) : m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-violet/25 px-4 py-3 text-ink">
                {m.imageDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.imageDataUrl} alt={t('chat.attached')} className="mb-2 max-h-48 rounded-lg" />
                )}
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-3">
              <Avatar />
              <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3">
                <Markdown>{m.content}</Markdown>
              </div>
            </div>
          ),
        )}
        {busy && draft && !status && (
          <div className="flex gap-3">
            <Avatar />
            <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3">
              <Markdown>{draft}</Markdown>
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-gold align-middle" aria-hidden />
            </div>
          </div>
        )}
        {busy && (!draft || status) && (
          <div className="flex items-center gap-3">
            <Avatar />
            <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted" role="status">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold" style={{ animationDelay: `${i * 150}ms` }} />)}
              </span>
              {status ?? t(THINKING[thinking])}
            </div>
          </div>
        )}
        {onlyGreeting && !busy && !readOnly && !isOutOfAllowance(user?.usage) && (
          <div className="ml-11">
            <p className="mb-2 text-xs text-faint">{t('chat.tryThese')}</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((k) => (
                <button key={k} onClick={() => send(t(k))} className="chip px-3 py-1.5 text-sm hover:border-gold/50 hover:text-ink">{t(k)}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!readOnly && !busy && isOutOfAllowance(user?.usage) && (
        <div className="border-t border-line pt-4">
          <OutOfAllowance usage={user!.usage!} />
        </div>
      )}
      {!readOnly && (busy || !isOutOfAllowance(user?.usage)) && (
        <form onSubmit={submit} className="border-t border-line pt-4">
          <ErrorNote message={error} />
          {photo && (
            <div className="mb-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={t('chat.toSend')} className="h-16 rounded-lg" />
              <button type="button" onClick={() => setPhoto(null)} className="text-faint hover:text-ink" aria-label={t('chat.removePhoto')}><X size={16} /></button>
              <span className="text-xs text-muted">{t('chat.photoAttached')}</span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <label className="cursor-pointer rounded-full border border-line p-3 text-muted hover:border-gold/50 hover:text-gold" title={t('chat.attachPhoto')}>
              <ImagePlus size={20} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    setPhoto(await photoToDataUrl(f));
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
              />
            </label>
            <textarea
              className="input max-h-40 min-h-12 flex-1 resize-none py-3"
              rows={1}
              placeholder={t('chat.placeholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send(text, photo);
                }
              }}
              disabled={busy}
            />
            <button className="btn-primary h-12 w-12 !p-0" disabled={busy || (!text.trim() && !photo)} aria-label={t('chat.send')}>
              <Send size={18} />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-faint">
            {usageLine(user?.usage) ? <span className="text-muted">{usageLine(user?.usage)} · </span> : null}
            {t('chat.footer')}
          </p>
        </form>
      )}
    </div>
  );
}

function Avatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mark.svg" width={24} height={24} alt="" />
    </div>
  );
}
