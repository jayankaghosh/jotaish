'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { VerifyCode } from '@/components/VerifyCode';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { LanguagePicker } from '@/components/LanguagePicker';

function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { signIn } = useAuth();
  const t = useT();
  const email = params.get('email') ?? '';
  const isNew = params.get('new') === '1';

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4"><LanguagePicker /></div>
      <Link href="/" className="mb-8"><Logo size="lg" /></Link>
      <div className="card w-full max-w-md p-8">
        {email ? (
          <VerifyCode
            email={email}
            onVerified={async (token) => {
              const user = await signIn(token);
              router.replace(isNew || !user?.profiles.length ? '/welcome' : params.get('next') ?? '/dashboard');
            }}
          />
        ) : (
          <p className="text-center text-muted"><Link href="/login" className="text-gold">{t('verify.signInAgain')}</Link></p>
        )}
      </div>
      <p className="mt-6 text-sm text-muted">{t('verify.wrongEmail')} <Link href="/register" className="text-gold hover:underline">{t('verify.createAgain')}</Link></p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyInner />
    </Suspense>
  );
}
