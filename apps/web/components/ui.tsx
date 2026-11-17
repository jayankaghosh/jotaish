'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertCircle, Info, Loader2 } from 'lucide-react';

export function Spinner({ size = 18 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin text-gold" />;
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-invert max-w-none prose-headings:font-display prose-headings:text-gold-soft prose-h2:text-2xl prose-h3:text-xl prose-strong:text-ink prose-a:text-gold prose-li:marker:text-gold/70">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-4xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
      <AlertCircle size={18} className="mt-0.5 shrink-0" /> <span>{message}</span>
    </div>
  );
}

export function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-violet/30 bg-violet/10 px-4 py-3 text-sm text-ink/90">
      <Info size={18} className="mt-0.5 shrink-0 text-violet" /> <div>{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 rounded-full bg-raised p-4 text-gold">{icon}</div>
      <h3 className="font-display text-2xl text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-muted">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

const CONSULTING_STEPS = [
  'Reading the details you shared…',
  'Calculating planetary positions…',
  'Consulting the classical texts…',
  'Writing your reading with care…',
  'Almost there, adding the final guidance…',
];

// Long AI calls feel shorter when the person can see progress.
export function Consulting({ steps = CONSULTING_STEPS, note }: { steps?: string[]; note?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), 6000);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="relative mb-6 h-20 w-20">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-gold/20 border-t-gold" style={{ animationDuration: '2.4s' }} />
        <div className="absolute inset-3 animate-spin rounded-full border-2 border-violet/20 border-b-violet" style={{ animationDuration: '3.6s', animationDirection: 'reverse' }} />
      </div>
      <p className="font-display text-2xl text-gold-soft">{steps[i]}</p>
      <p className="mt-2 text-sm text-muted">{note ?? 'This usually takes under a minute. Please keep this page open.'}</p>
    </div>
  );
}

export function formatDate(iso: string, withTime = false) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-gold-soft">
      ← {label}
    </Link>
  );
}
