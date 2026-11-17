'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { BookOpen, Download, RotateCw, Share, SquarePlus, WifiOff, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { useOnline } from '@/lib/offline';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  // 'prompt': the browser can install it; 'ios': show the Share steps.
  install: 'prompt' | 'ios' | null;
  promptInstall: () => Promise<void>;
}

const PwaContext = createContext<PwaState>({ install: null, promptInstall: async () => undefined });

// Registers the service worker (production only, so development never
// serves stale files) and keeps the browser's install prompt for later.
export function PwaProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [install, setInstall] = useState<PwaState['install']>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register(`/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID}`).catch(() => undefined);
    }
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) {
      // Safari ignores the viewport's no-zoom setting, so the installed app
      // stops the pinch itself. In a browser tab, zoom stays available.
      const stop = (e: Event) => e.preventDefault();
      const twoFingers = (e: TouchEvent) => e.touches.length > 1 && e.preventDefault();
      document.addEventListener('gesturestart', stop);
      document.addEventListener('touchmove', twoFingers, { passive: false });
      return () => {
        document.removeEventListener('gesturestart', stop);
        document.removeEventListener('touchmove', twoFingers);
      };
    }
    // iPhones and iPads never fire an install prompt; Safari's Share menu does it.
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios) setInstall('ios');
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
      setInstall('prompt');
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstall(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setInstall(null);
    setDeferred(null);
  }, [deferred]);

  return <PwaContext.Provider value={{ install, promptInstall }}>{children}</PwaContext.Provider>;
}

export const usePwa = () => useContext(PwaContext);

// Offline, only saved readings can be opened, and only when signed in.
// Every other screen shows "No internet".
const OFFLINE_OK = /^\/readings(\/[^/]+)?\/?$/;

export function OfflineGate({ children }: { children: ReactNode }) {
  const online = useOnline();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  if (online || pathname === '/offline') return <>{children}</>;
  if (OFFLINE_OK.test(pathname) && (loading || user)) return <>{children}</>;
  return <NoInternet />;
}

export function NoInternet() {
  const t = useT();
  const { user } = useAuth();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-line bg-surface text-muted">
        <WifiOff size={34} />
      </span>
      <h1 className="font-display text-3xl font-semibold text-ink">{t('offline.title')}</h1>
      <p className="mt-2 max-w-sm text-muted">{t('offline.body')}</p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        {user && (
          <Link href="/readings" className="btn-primary h-12 text-base">
            <BookOpen size={18} /> {t('offline.readings')}
          </Link>
        )}
        <button className="btn-ghost h-12 text-base" onClick={() => window.location.reload()}>
          <RotateCw size={18} /> {t('offline.retry')}
        </button>
      </div>
    </div>
  );
}

export function OfflineBanner() {
  const t = useT();
  const online = useOnline();
  if (online) return null;
  return (
    <div className="flex items-center justify-center gap-2 border-b border-line bg-raised px-4 py-2 text-center text-sm text-muted">
      <WifiOff size={15} /> {t('offline.banner')}
    </div>
  );
}

// "Install app": the browser's own prompt, or the Share steps on iPhone.
export function InstallButton({ className = 'btn-ghost', label }: { className?: string; label?: string }) {
  const t = useT();
  const { install, promptInstall } = usePwa();
  const [steps, setSteps] = useState(false);
  if (!install) return null;
  return (
    <>
      <button type="button" className={className} onClick={() => (install === 'ios' ? setSteps(true) : promptInstall())}>
        <Download size={16} /> {label ?? t('install.cta')}
      </button>
      {steps && <IosSteps onClose={() => setSteps(false)} />}
    </>
  );
}

function IosSteps({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-night/70 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="pb-safe w-full max-w-md animate-rise rounded-t-[28px] border border-line bg-surface p-6 text-left sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
            <h2 className="font-display text-xl font-semibold text-ink">{t('install.iosTitle')}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-faint hover:text-ink" aria-label={t('common.cancel')}><X size={20} /></button>
        </div>
        <ol className="space-y-4 text-ink">
          <li className="flex items-center gap-3"><Step n={1} /> <span className="flex-1">{t('install.ios1')}</span> <Share size={20} className="text-violet" /></li>
          <li className="flex items-center gap-3"><Step n={2} /> <span className="flex-1">{t('install.ios2')}</span> <SquarePlus size={20} className="text-violet" /></li>
          <li className="flex items-center gap-3"><Step n={3} /> <span className="flex-1">{t('install.ios3')}</span></li>
        </ol>
        <button className="btn-primary mt-6 h-12 w-full text-base" onClick={onClose}>{t('install.done')}</button>
      </div>
    </div>
  );
}

const Step = ({ n }: { n: number }) => (
  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 text-sm font-semibold text-gold">{n}</span>
);

// A dismissible invitation on Today, until installed or turned down.
export function InstallBanner() {
  const t = useT();
  const { install } = usePwa();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem('jotaish_install_dismissed') === '1');
    } catch {
      setHidden(false);
    }
  }, []);
  if (!install || hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem('jotaish_install_dismissed', '1');
    } catch {
      // Shown again next time; harmless.
    }
  };
  return (
    <div className="mt-5 flex items-center gap-3 rounded-3xl border border-violet/30 bg-violet/10 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{t('install.title')}</p>
        <p className="text-xs text-muted">{t('install.body')}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <InstallButton className="btn-primary !min-h-9 !px-3 !py-1.5 text-xs" />
        <button className="text-[11px] text-faint hover:text-muted" onClick={dismiss}>{t('install.dismiss')}</button>
      </div>
    </div>
  );
}
