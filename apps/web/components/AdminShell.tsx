'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { BarChart3, IndianRupee, LogOut, Settings, Users } from 'lucide-react';
import { gql } from '@/lib/gql';
import { useAuth } from '@/lib/auth';
import { Logo } from './Logo';
import { Spinner } from './ui';

export const PAYMENTS_CHANGED = 'jotaish:payments-changed';

const TABS = [
  { href: '/admin', label: 'Overview', icon: BarChart3 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/payments', label: 'Payments', icon: IndianRupee },
  { href: '/admin/settings', label: 'AI settings', icon: Settings },
];

// The admin console is separate from the customer app: its own sign-in,
// its own header, and no links between the two.
export function AdminShell({ children }: { children: ReactNode }) {
  const { user, loading, aiReady, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = user?.role === 'ADMIN';
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!allowed) return;
    const load = () => gql<{ adminPendingPayments: number }>(`{ adminPendingPayments }`).then((d) => setPending(d.adminPendingPayments)).catch(() => undefined);
    void load();
    // Payment cards announce reviews so the badge stays current.
    window.addEventListener(PAYMENTS_CHANGED, load);
    return () => window.removeEventListener(PAYMENTS_CHANGED, load);
  }, [allowed, pathname]);

  useEffect(() => {
    if (!loading && !allowed) router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, allowed, router, pathname]);

  if (loading || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        <Spinner /> <span className="ml-3">Loading…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-night/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          <Link href="/admin" className="flex items-center gap-3">
            <Logo />
            <span className="chip border-gold/40 text-gold-soft">Console</span>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {TABS.map(({ href, label, icon: Icon }) => {
              const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
              return (
                <Link key={href} href={href} className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm ${active ? 'bg-gold text-night' : 'text-muted hover:text-ink'}`}>
                  <Icon size={16} /> <span className="hidden sm:inline">{label}</span>
                  {href === '/admin/payments' && pending > 0 && (
                    <span className={`rounded-full px-1.5 text-xs font-semibold ${active ? 'bg-night text-gold' : 'bg-gold text-night'}`}>{pending}</span>
                  )}
                </Link>
              );
            })}
            <button
              onClick={() => {
                signOut();
                router.replace('/admin/login');
              }}
              className="ml-2 rounded-full p-2 text-faint hover:text-ink"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </nav>
        </div>
      </header>
      {!aiReady && (
        <div className="border-b border-gold/30 bg-gold/10 px-4 py-2 text-center text-sm text-gold-soft">
          Readings are switched off until an OpenRouter API key is saved.{' '}
          <Link href="/admin/settings" className="underline">Add it in AI settings</Link>.
        </div>
      )}
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
