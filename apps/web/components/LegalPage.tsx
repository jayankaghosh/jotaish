'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { Logo } from './Logo';
import { Markdown, Tip } from './ui';

// Public pages (privacy policy, terms) that need no sign-in. The legal text
// stays in English; other languages get a note saying so.
export function LegalPage({ title, updated, body }: { title: string; updated: string; body: string }) {
  const { t, lang } = useI18n();
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-20 max-w-3xl items-center justify-between px-4">
        <Link href="/"><Logo /></Link>
        <Link href="/" className="text-sm text-muted hover:text-gold-soft">{t('legal.back')}</Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20">
        {lang !== 'en' && (
          <div className="mb-6">
            <Tip>{t('legal.englishOnly')}</Tip>
          </div>
        )}
        <h1 className="font-display text-4xl text-ink">{title}</h1>
        <p className="mb-8 mt-2 text-sm text-faint">Last updated {updated}</p>
        <div className="card p-6 sm:p-10">
          <Markdown>{body}</Markdown>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}

export function LegalFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-line py-8 text-center text-xs text-faint">
      <p>{t('footer.disclaimer')}</p>
      <p className="mt-2 space-x-4">
        <Link href="/privacy" className="hover:text-muted">{t('footer.privacy')}</Link>
        <Link href="/terms" className="hover:text-muted">{t('footer.terms')}</Link>
        <a href="mailto:jotaish.astrologer@gmail.com" className="hover:text-muted">{t('footer.contact')}</a>
      </p>
    </footer>
  );
}
