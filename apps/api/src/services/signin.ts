import { createHash, randomInt } from 'node:crypto';
import { prisma } from '../lib/db';
import { env } from '../lib/env';
import { userError } from '../lib/auth';
import { currentLang } from '../i18n';
import { isConfigured, getMailSettings } from './mail';
import { signInCodeEmail } from './notifications';

// Customers sign in with a 6-digit code emailed to them; there are no
// passwords. The numbers below are the defaults; admins can change them in
// Settings.
export interface SignInSettings {
  // How long a code works.
  codeMinutes: number;
  // How long before another code can be sent.
  resendSeconds: number;
  // At most this many codes per email address within windowMinutes.
  maxCodes: number;
  windowMinutes: number;
  // Wrong guesses allowed per code.
  maxAttempts: number;
}

const SETTING = 'sign_in_codes';
export const SIGN_IN_DEFAULTS: SignInSettings = { codeMinutes: 5, resendSeconds: 30, maxCodes: 5, windowMinutes: 60, maxAttempts: 5 };
const LIMITS: Record<keyof SignInSettings, [number, number]> = {
  codeMinutes: [1, 60],
  resendSeconds: [10, 600],
  maxCodes: [1, 50],
  windowMinutes: [5, 1440],
  maxAttempts: [1, 20],
};

export async function getSignInSettings(): Promise<SignInSettings> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING } });
  return row ? { ...SIGN_IN_DEFAULTS, ...JSON.parse(row.value) } : SIGN_IN_DEFAULTS;
}

export async function setSignInSettings(input: Partial<Record<keyof SignInSettings, number | null>>) {
  const next = await getSignInSettings();
  for (const key of Object.keys(LIMITS) as (keyof SignInSettings)[]) {
    const v = input[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const [min, max] = LIMITS[key];
    next[key] = Math.min(max, Math.max(min, Math.round(v)));
  }
  const value = JSON.stringify(next);
  await prisma.setting.upsert({ where: { key: SETTING }, create: { key: SETTING, value }, update: { value } });
  return next;
}

export const normalEmail = (email: string) => email.trim().toLowerCase();
const hash = (email: string, code: string) => createHash('sha256').update(`${email}:${code}:${env.appSecret}`).digest('hex');
const secondsUntil = (date: Date) => Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));

export interface CodeStatus {
  email: string;
  // Seconds until the code stops working, and until another can be sent.
  expiresIn: number;
  resendIn: number;
  // Codes this address can still ask for in the current window.
  codesLeft: number;
}

// Emails a new code, unless one went out too recently (then it just reports
// how long to wait). The same answer whether or not an account exists.
export async function requestCode(rawEmail: string): Promise<CodeStatus> {
  const email = normalEmail(rawEmail);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) throw userError('Please enter a valid email address.');
  const s = await getSignInSettings();
  const since = new Date(Date.now() - s.windowMinutes * 60_000);
  const recent = await prisma.signInCode.findMany({ where: { email, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' } });
  const last = recent[0];

  if (last && !last.usedAt) {
    const resendAt = new Date(last.createdAt.getTime() + s.resendSeconds * 1000);
    if (resendAt > new Date()) {
      return { email, expiresIn: secondsUntil(last.expiresAt), resendIn: secondsUntil(resendAt), codesLeft: Math.max(0, s.maxCodes - recent.length) };
    }
  }
  if (recent.length >= s.maxCodes) {
    // The oldest code in the window has to age out first.
    const minutes = Math.max(1, Math.ceil(secondsUntil(new Date(recent[recent.length - 1].createdAt.getTime() + s.windowMinutes * 60_000)) / 60));
    throw userError("You've asked for a lot of codes. Please try again in {minutes} min, or use the latest code we sent.", { minutes });
  }

  const mail = await getMailSettings();
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const row = await prisma.signInCode.create({
    data: { email, codeHash: hash(email, code), expiresAt: new Date(Date.now() + s.codeMinutes * 60_000) },
  });
  // Older codes for this address stop working once a new one is sent.
  await prisma.signInCode.updateMany({ where: { email, id: { not: row.id }, usedAt: null }, data: { usedAt: new Date() } });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, language: true } });
  if (!isConfigured(mail) && process.env.NODE_ENV !== 'production') {
    console.log(`Sign-in code for ${email}: ${code} (email isn't set up, so it is only shown here)`);
  } else if (!(await signInCodeEmail({ email, userId: user?.id, name: user?.name ?? '', language: user?.language ?? currentLang() }, code, s.codeMinutes))) {
    await prisma.signInCode.delete({ where: { id: row.id } });
    throw userError("We couldn't send the email just now. Please check the address and try again in a minute.");
  }

  // Tidy away codes nobody can use any more.
  await prisma.signInCode.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 2 * 24 * 3600_000) } } });
  return { email, expiresIn: s.codeMinutes * 60, resendIn: s.resendSeconds, codesLeft: s.maxCodes - recent.length - 1 };
}

// Checks the code and marks it used. Returns the confirmed address.
export async function checkCode(rawEmail: string, rawCode: string): Promise<string> {
  const email = normalEmail(rawEmail);
  const code = rawCode.replace(/\D/g, '');
  const s = await getSignInSettings();
  const latest = await prisma.signInCode.findFirst({ where: { email }, orderBy: { createdAt: 'desc' } });
  if (!latest || latest.usedAt) throw userError('That code is not correct. Please use the latest code we emailed you.');
  if (latest.expiresAt < new Date()) throw userError('That code has expired. Tap "Send a new code" to get a fresh one.');
  if (latest.attempts >= s.maxAttempts) throw userError('Too many wrong tries. Tap "Send a new code" to get a fresh one.');
  if (hash(email, code) !== latest.codeHash) {
    const { attempts } = await prisma.signInCode.update({ where: { id: latest.id }, data: { attempts: { increment: 1 } } });
    if (attempts >= s.maxAttempts) throw userError('Too many wrong tries. Tap "Send a new code" to get a fresh one.');
    throw userError('That code is not correct. Attempts left: {left}.', { left: s.maxAttempts - attempts });
  }
  // Only one sign-in per code, even if two requests race.
  const { count } = await prisma.signInCode.updateMany({ where: { id: latest.id, usedAt: null }, data: { usedAt: new Date() } });
  if (!count) throw userError('That code is not correct. Please use the latest code we emailed you.');
  return email;
}
