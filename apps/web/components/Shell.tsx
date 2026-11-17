'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { BookOpen, Coins, LayoutGrid, LogOut, Menu, MessageCircle, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Logo } from './Logo';
import { Spinner } from './ui';
import { VerifyCode } from './VerifyCode';

const NAV = [
  { href: '/dashboard', label: 'Home', icon: LayoutGrid },
  { href: '/chat', label: 'Ask Jyotaish', icon: MessageCircle },
  { href: '/readings', label: 'My readings', icon: BookOpen },
  { href: '/credits', label: 'Credits', icon: Coins },
  { href: '/profile', label: 'Profile', icon: UserIcon },
];

export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { user, loading, signOut, aiReady, signIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  useEffect(() => setOpen(false), [pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        <Spinner /> <span className="ml-3">Loading…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-night/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${active ? 'bg-raised text-gold-soft' : 'text-muted hover:text-ink'}`}
                >
                  <Icon size={16} /> {label}
                </Link>
              );
            })}
            <button
              onClick={() => {
                signOut();
                router.push('/');
              }}
              className="ml-2 rounded-full p-2 text-faint hover:text-ink"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </nav>
          <button className="rounded-full p-2 text-muted md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {open && (
          <nav className="border-t border-line px-4 py-3 md:hidden">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-3 text-ink hover:bg-raised">
                <Icon size={18} /> {label}
              </Link>
            ))}
            <button
              onClick={() => {
                signOut();
                router.push('/');
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-muted hover:bg-raised"
            >
              <LogOut size={18} /> Sign out
            </button>
          </nav>
        )}
      </header>
      {!aiReady && (
        <div className="border-b border-gold/30 bg-gold/10 px-4 py-2 text-center text-sm text-gold-soft">
          Readings are being set up and will be available shortly. You can still save your birth details.
        </div>
      )}
      {user.needsVerification ? (
        // Accounts created before email confirmation existed get asked once.
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-night/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="card w-full max-w-md p-8">
            <p className="mb-4 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-center text-sm text-gold-soft">
              Your email address isn&apos;t confirmed yet. Please confirm it to keep using Jotaish.
            </p>
            <VerifyCode email={user.email} sendOnOpen onVerified={async (token) => { await signIn(token); }} />
            <button className="mt-4 w-full text-center text-xs text-faint hover:text-muted" onClick={() => { signOut(); router.push('/'); }}>Sign out</button>
          </div>
        </div>
      ) : (
        <main className={`mx-auto px-4 py-8 ${wide ? 'max-w-7xl' : 'max-w-6xl'}`}>{children}</main>
      )}
    </div>
  );
}
