'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { VerifyCode } from '@/components/VerifyCode';
import { useAuth } from '@/lib/auth';

function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { signIn } = useAuth();
  const email = params.get('email') ?? '';
  const isNew = params.get('new') === '1';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
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
          <p className="text-center text-muted">Please <Link href="/login" className="text-gold">sign in</Link> again to get a new code.</p>
        )}
      </div>
      <p className="mt-6 text-sm text-muted">Wrong email? <Link href="/register" className="text-gold hover:underline">Create the account again</Link></p>
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
