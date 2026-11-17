import nodemailer from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';
import { marked } from 'marked';
import { prisma } from '../lib/db';
import { decrypt, encrypt } from '../lib/crypto';
import { env } from '../lib/env';
import { userError } from '../lib/auth';

export interface MailSettings {
  host: string;
  port: number;
  // true for SSL on connect (port 465), false for STARTTLS (port 587)
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  // Where admin notifications go, comma separated.
  adminEmails: string;
  // Customers must confirm their email before signing in.
  requireVerification: boolean;
}

const SETTING = 'smtp';
const DEFAULTS: MailSettings = {
  host: '',
  port: 465,
  secure: true,
  username: '',
  password: '',
  fromName: 'Jotaish',
  fromEmail: '',
  adminEmails: '',
  requireVerification: true,
};

export async function getMailSettings(): Promise<MailSettings> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING } });
  if (!row) return DEFAULTS;
  const saved = JSON.parse(row.value);
  return { ...DEFAULTS, ...saved, password: saved.password ? decrypt(saved.password) : '' };
}

export async function setMailSettings(input: Partial<MailSettings> & { clearPassword?: boolean | null }) {
  const current = await getMailSettings();
  const next: MailSettings = { ...current };
  for (const key of ['host', 'username', 'fromName', 'fromEmail', 'adminEmails'] as const) {
    if (typeof input[key] === 'string') next[key] = input[key]!.trim();
  }
  if (typeof input.port === 'number') next.port = input.port;
  if (typeof input.secure === 'boolean') next.secure = input.secure;
  if (typeof input.requireVerification === 'boolean') next.requireVerification = input.requireVerification;
  // Gmail shows app passwords in groups of four; the spaces aren't part of it.
  if (input.clearPassword) next.password = '';
  else if (input.password?.trim()) next.password = input.password.replace(/\s+/g, '');

  const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (next.fromEmail && !email.test(next.fromEmail)) throw userError('The "from" address does not look like an email address.');
  const admins = splitEmails(next.adminEmails);
  if (admins.some((a) => !email.test(a))) throw userError('One of the admin notification addresses does not look like an email address.');

  const value = JSON.stringify({ ...next, password: next.password ? encrypt(next.password) : '' });
  await prisma.setting.upsert({ where: { key: SETTING }, create: { key: SETTING, value }, update: { value } });
  return next;
}

export function splitEmails(list: string) {
  return list.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
}

export function isConfigured(s: MailSettings) {
  return Boolean(s.host && s.port && s.username && s.password && (s.fromEmail || s.username));
}

// Verification only applies once email can actually be delivered, so nobody
// is locked out by a half-finished setup.
export async function verificationRequired() {
  const s = await getMailSettings();
  return s.requireVerification && isConfigured(s);
}

function transport(s: MailSettings) {
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: { user: s.username, pass: s.password },
    connectionTimeout: 15_000,
  });
}

export interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
  kind: string;
  userId?: string | null;
  attachments?: Attachment[];
}

// Sends one email and records it. Returns false instead of throwing, so a
// mail problem never breaks the action that triggered it.
export async function sendMail(mail: OutgoingMail, settings?: MailSettings): Promise<boolean> {
  const s = settings ?? (await getMailSettings());
  if (!isConfigured(s)) return false;
  try {
    await transport(s).sendMail({
      from: { name: s.fromName || 'Jotaish', address: s.fromEmail || s.username },
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: htmlToText(mail.html),
      attachments: mail.attachments,
    });
    await prisma.emailLog.create({ data: { to: mail.to, subject: mail.subject, kind: mail.kind, status: 'sent', userId: mail.userId ?? null } });
    return true;
  } catch (e) {
    const error = (e as Error).message.slice(0, 500);
    console.error(`Email to ${mail.to} failed: ${error}`);
    await prisma.emailLog
      .create({ data: { to: mail.to, subject: mail.subject, kind: mail.kind, status: 'failed', error, userId: mail.userId ?? null } })
      .catch(() => undefined);
    return false;
  }
}

// Same as sendMail but surfaces the error, for the admin's test button.
export async function sendTestMail(to: string) {
  const s = await getMailSettings();
  if (!isConfigured(s)) throw userError('Please fill in and save the email settings first.');
  await transport(s).verify();
  const ok = await sendMail(
    { to, subject: 'Jotaish email is working', kind: 'test', html: layout('Email is set up', '<p>This is a test from the Jotaish console. Emails to customers and admins will now be sent from this account.</p>') },
    s,
  );
  if (!ok) throw userError('The email server accepted the login but the message could not be sent. Check the email log for details.');
}

export async function notifyAdmins(subject: string, html: string, attachments?: Attachment[]) {
  const s = await getMailSettings();
  if (!isConfigured(s)) return;
  const to = splitEmails(s.adminEmails);
  for (const address of to) await sendMail({ to: address, subject, html, kind: 'alert', attachments }, s);
}

export const siteUrl = (path = '') => `${env.webOrigin.replace(/\/$/, '')}${path}`;

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export { escape as escapeHtml };

export function markdownToHtml(md: string) {
  return marked.parse(md, { async: false }) as string;
}

export function button(label: string, href: string) {
  return `<p style="margin:28px 0"><a href="${href}" style="background:#e8b75d;color:#0b0a1a;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block">${escape(label)}</a></p>`;
}

// One simple, light layout that reads well in every mail app.
export function layout(heading: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:Georgia,'Times New Roman',serif;color:#2a2540">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#15132b;padding:22px 32px;color:#f3d79b;font-size:24px;letter-spacing:1px">&#9790; Jotaish</td></tr>
<tr><td style="padding:32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#2a2540">
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 16px;color:#15132b">${escape(heading)}</h1>
${body}
</td></tr>
<tr><td style="padding:18px 32px;background:#faf8f3;color:#8a849f;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5">
Jotaish readings are for guidance and reflection. For medical, legal or financial decisions, please consult a professional.
</td></tr></table></td></tr></table></body></html>`;
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<(br|\/p|\/h\d|\/li|\/tr)>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#9790;/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
