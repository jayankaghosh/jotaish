import { createHash, randomInt } from 'node:crypto';
import type { User } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { prisma } from '../lib/db';
import { env } from '../lib/env';
import { userError } from '../lib/auth';
import { verificationRequired } from './mail';
import { verificationEmail } from './notifications';

const CODE_MINUTES = 30;
const RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 5;

const hash = (userId: string, code: string) => createHash('sha256').update(`${userId}:${code}:${env.appSecret}`).digest('hex');

// Settings change rarely, so avoid a lookup on every request.
let cached: { at: number; value: boolean } | null = null;
export async function isVerificationRequired() {
  if (!cached || Date.now() - cached.at > 30_000) cached = { at: Date.now(), value: await verificationRequired() };
  return cached.value;
}
export function forgetVerificationSetting() {
  cached = null;
}

export async function needsVerification(user: Pick<User, 'role' | 'emailVerifiedAt'>) {
  return user.role !== 'ADMIN' && !user.emailVerifiedAt && (await isVerificationRequired());
}

// Emails a fresh code unless one went out in the last minute. Returns
// whether a new email was sent.
export async function sendCode(user: User): Promise<boolean> {
  if (user.verifyCodeSentAt && Date.now() - user.verifyCodeSentAt.getTime() < RESEND_SECONDS * 1000) return false;
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await prisma.user.update({
    where: { id: user.id },
    data: {
      verifyCodeHash: hash(user.id, code),
      verifyCodeExpiresAt: new Date(Date.now() + CODE_MINUTES * 60_000),
      verifyCodeSentAt: new Date(),
      verifyAttempts: 0,
    },
  });
  return verificationEmail(user, code);
}

export function notVerifiedError(email: string) {
  return new GraphQLError(`Please confirm your email first. We've sent a 6-digit code to ${email}.`, {
    extensions: { code: 'EMAIL_NOT_VERIFIED', email },
  });
}

export async function confirmCode(email: string, code: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) throw userError('That code is not correct. Please check the latest email from us.');
  if (user.emailVerifiedAt) return user;
  if (!user.verifyCodeHash || !user.verifyCodeExpiresAt || user.verifyCodeExpiresAt < new Date()) {
    throw userError('That code has expired. Tap "Send a new code" and use the newest email.');
  }
  if (user.verifyAttempts >= MAX_ATTEMPTS) throw userError('Too many wrong tries. Tap "Send a new code" to get a fresh one.');
  if (hash(user.id, code.trim()) !== user.verifyCodeHash) {
    await prisma.user.update({ where: { id: user.id }, data: { verifyAttempts: { increment: 1 } } });
    throw userError('That code is not correct. Please check the latest email from us.');
  }
  return prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date(), verifyCodeHash: null, verifyCodeExpiresAt: null, verifyAttempts: 0 },
  });
}
