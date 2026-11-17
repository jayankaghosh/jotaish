import Link from 'next/link';
import { Logo } from './Logo';
import { Markdown } from './ui';

// Public pages (privacy policy, terms) that need no sign-in.
export function LegalPage({ title, updated, body }: { title: string; updated: string; body: string }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-20 max-w-3xl items-center justify-between px-4">
        <Link href="/"><Logo /></Link>
        <Link href="/" className="text-sm text-muted hover:text-gold-soft">Back to Jotaish</Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20">
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
  return (
    <footer className="border-t border-line py-8 text-center text-xs text-faint">
      <p>Jotaish readings are for guidance and reflection. For medical, legal or financial decisions please consult a professional.</p>
      <p className="mt-2 space-x-4">
        <Link href="/privacy" className="hover:text-muted">Privacy policy</Link>
        <Link href="/terms" className="hover:text-muted">Terms of service</Link>
        <a href="mailto:jotaish.astrologer@gmail.com" className="hover:text-muted">Contact</a>
      </p>
    </footer>
  );
}
