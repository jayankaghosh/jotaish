import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import MailComposer from 'nodemailer/lib/mail-composer';
import type Mail from 'nodemailer/lib/mailer';
import { env } from '../lib/env';
import type { MailSettings } from './mail';

// Sends through the Gmail API over HTTPS, so it works on hosts that block
// SMTP ports. Only the gmail.send permission is asked for: Jotaish can send
// as the account but never read its mail.
const SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'openid', 'email'];

// The state value ties Google's reply to this admin and expires quickly, so
// nobody else can attach their mailbox.
function sign(payload: string) {
  return createHmac('sha256', `gmail:${env.appSecret}`).update(payload).digest('base64url');
}

export function makeState(adminId: string) {
  const payload = `${adminId}.${Date.now()}.${randomBytes(8).toString('hex')}`;
  return `${payload}.${sign(payload)}`;
}

export function checkState(state: string, adminId: string) {
  const parts = state.split('.');
  if (parts.length !== 4) return false;
  const payload = parts.slice(0, 3).join('.');
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(parts[3]);
  const fresh = Date.now() - Number(parts[1]) < 15 * 60_000;
  return parts[0] === adminId && fresh && expected.length === given.length && timingSafeEqual(expected, given);
}

export function authUrl(clientId: string, redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    // Offline access with forced consent is what returns a refresh token.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const json = (await res.json()) as any;
  if (!res.ok) {
    const reason = json.error_description || json.error || `Google returned ${res.status}`;
    throw new Error(json.error === 'invalid_grant' ? `Gmail access was revoked or expired (${reason}). Click "Connect Gmail" again.` : reason);
  }
  return json;
}

export async function exchangeCode(s: Pick<MailSettings, 'gmailClientId' | 'gmailClientSecret'>, code: string, redirectUri: string) {
  const json = await tokenRequest({
    code,
    client_id: s.gmailClientId,
    client_secret: s.gmailClientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  if (!json.refresh_token) throw new Error('Google did not grant offline access. Remove Jotaish under "Third-party apps" in your Google account and connect again.');
  if (!String(json.scope ?? '').includes('gmail.send')) throw new Error('Permission to send email was not granted. Please tick the "Send email on your behalf" box when connecting.');
  // The ID token says which account approved; emails will come from it.
  const claims = JSON.parse(Buffer.from(String(json.id_token).split('.')[1], 'base64url').toString());
  return { refreshToken: json.refresh_token as string, address: String(claims.email ?? '') };
}

let cached: { refreshToken: string; token: string; expires: number } | null = null;

async function accessToken(s: MailSettings) {
  if (cached && cached.refreshToken === s.gmailRefreshToken && cached.expires > Date.now() + 60_000) return cached.token;
  const json = await tokenRequest({
    client_id: s.gmailClientId,
    client_secret: s.gmailClientSecret,
    refresh_token: s.gmailRefreshToken,
    grant_type: 'refresh_token',
  });
  cached = { refreshToken: s.gmailRefreshToken, token: json.access_token, expires: Date.now() + Number(json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export async function sendWithGmail(s: MailSettings, message: Mail.Options) {
  const raw = await new MailComposer(message).compile().build();
  const res = await fetch('https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken(s)}`, 'Content-Type': 'message/rfc822' },
    body: new Uint8Array(raw),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as any;
    throw new Error(json.error?.message ?? `Gmail returned ${res.status}`);
  }
}
