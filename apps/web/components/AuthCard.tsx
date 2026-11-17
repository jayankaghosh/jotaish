'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { LanguagePicker } from './LanguagePicker';
import { Logo } from './Logo';

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 pb-12 pt-[calc(env(safe-area-inset-top)+3rem)]">
      <div className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)]"><LanguagePicker /></div>
      <Link href="/" className="mb-8">
        <Logo size="lg" />
      </Link>
      <div className="card w-full max-w-md p-8">
        <h1 className="font-display text-3xl text-ink">{title}</h1>
        <p className="mb-6 mt-1 text-sm text-muted">{subtitle}</p>
        {children}
      </div>
      <p className="mt-6 text-sm text-muted">{footer}</p>
    </div>
  );
}
