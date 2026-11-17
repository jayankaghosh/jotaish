'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { BookOpen, Coins, Compass, LogOut, Sparkles, Sun, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useT, type MessageKey } from '@/lib/i18n';
import type { Usage } from '@/lib/types';
import { LanguagePicker } from './LanguagePicker';
import { Logo } from './Logo';
import { Spinner } from './ui';
import { formatCredits } from './UsageNote';
import { VerifyCode } from './VerifyCode';

const TABS: { href: string; label: MessageKey; icon: typeof Sun; centre?: boolean }[] = [
  { href: '/dashboard', label: 'nav.today', icon: Sun },
  { href: '/explore', label: 'nav.explore', icon: Compass },
  { href: '/chat', label: 'nav.askShort', icon: Sparkles, centre: true },
  { href: '/readings', label: 'nav.readingsShort', icon: BookOpen },
  { href: '/profile', label: 'nav.me', icon: UserIcon },
];

const isActive = (pathname: string, href: string) =>
  pathname === href || (href !== '/dashboard' && pathname.startsWith(href)) || (href === '/explore' && pathname.startsWith('/services'));

interface ShellProps {
  children: ReactNode;
  wide?: boolean;
  // Full-height screens such as a conversation: on phones the page brings its
  // own header and the tab bar steps aside.
  immersive?: boolean;
}

export function Shell({ children, wide = false, immersive = false }: ShellProps) {
  const { user, loading, signOut, aiReady, signIn } = useAuth();
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        <Spinner /> <span className="ml-3">{t('common.loading')}</span>
      </div>
    );
  }

  const leave = () => {
    signOut();
    router.push('/');
  };

  if (user.needsVerification) {
    // Accounts created before email confirmation existed get asked once.
    return (
      <div className="flex min-h-dvh items-center justify-center p-4" role="dialog" aria-modal="true">
        <div className="card w-full max-w-md p-6 sm:p-8">
          <div className="mb-6 flex justify-center"><Logo /></div>
          <p className="mb-4 rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-center text-sm text-gold-soft">{t('shell.confirmEmail')}</p>
          <VerifyCode email={user.email} sendOnOpen onVerified={async (token) => { await signIn(token); }} />
          <button className="mt-4 w-full text-center text-xs text-faint hover:text-muted" onClick={leave}>{t('nav.signOut')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className={`sticky top-0 z-30 border-b border-line/60 bg-night/80 backdrop-blur-xl ${immersive ? 'hidden lg:block' : ''}`}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 lg:h-16">
          <Link href="/dashboard" aria-label={t('nav.today')}>
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {TABS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm transition ${isActive(pathname, href) ? 'bg-raised text-gold-soft' : 'text-muted hover:text-ink'}`}
              >
                <Icon size={16} /> {t(label)}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <CreditChip usage={user.usage} />
            <LanguagePicker compact />
            <button onClick={leave} className="hidden rounded-full p-2 text-faint hover:text-ink lg:block" title={t('nav.signOut')}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
        {!aiReady && <div className="border-t border-gold/30 bg-gold/10 px-4 py-2 text-center text-sm text-gold-soft">{t('shell.notReady')}</div>}
      </header>

      <main
        className={
          immersive
            ? `mx-auto lg:px-4 lg:py-6 ${wide ? 'max-w-7xl' : 'max-w-6xl'}`
            : `mx-auto px-4 pb-32 pt-5 lg:pb-12 lg:pt-8 ${wide ? 'max-w-7xl' : 'max-w-6xl'}`
        }
      >
        {children}
      </main>

      {!immersive && <TabBar pathname={pathname} />}
    </div>
  );
}

function TabBar({ pathname }: { pathname: string }) {
  const t = useT();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-surface/90 backdrop-blur-xl lg:hidden" aria-label={t('nav.menu')}>
      <ul className="mx-auto grid max-w-md grid-cols-5 px-2">
        {TABS.map(({ href, label, icon: Icon, centre }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? 'page' : undefined} className="flex flex-col items-center gap-1 pb-2 pt-2 text-[11px]">
                {centre ? (
                  <span className={`-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-linear-135 from-gold-soft via-gold to-gold-deep text-night shadow-lg shadow-gold/25 ring-4 ring-night ${active ? 'scale-105' : ''}`}>
                    <Icon size={24} strokeWidth={2} />
                  </span>
                ) : (
                  <span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${active ? 'bg-gold/15 text-gold' : 'text-muted'}`}>
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                )}
                <span className={`max-w-full truncate ${active ? 'font-medium text-gold-soft' : 'text-muted'}`}>{t(label)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// What's left, at a glance: the free allowance as a percentage, or bought
// credits once the allowance is used.
function CreditChip({ usage }: { usage?: Usage | null }) {
  const t = useT();
  if (!usage || usage.percentLeft === null) return null;
  const onCredits = usage.percentLeft === 0 && usage.balance > 0;
  const low = !onCredits && usage.percentLeft <= 15;
  return (
    <Link
      href="/credits"
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${low ? 'border-danger/40 text-danger' : 'border-gold/30 text-gold-soft'}`}
      title={t('nav.credits')}
    >
      <Coins size={14} />
      {onCredits ? formatCredits(usage.balance) : `${usage.percentLeft}%`}
    </Link>
  );
}
