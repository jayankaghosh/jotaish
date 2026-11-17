import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from './env';

const key = createHash('sha256').update(`secrets:${env.appSecret}`).digest();

// AES-256-GCM, stored as iv.tag.ciphertext in base64.
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function decrypt(stored: string): string {
  const [iv, tag, data] = stored.split('.').map((s) => Buffer.from(s, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function maskSecret(secret: string): string {
  return secret.length <= 10 ? '••••' : `${secret.slice(0, 6)}••••${secret.slice(-4)}`;
}
