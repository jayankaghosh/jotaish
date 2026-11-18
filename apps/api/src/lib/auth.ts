import jwt from 'jsonwebtoken';
import { GraphQLError } from 'graphql';
import type { User } from '@prisma/client';
import { prisma } from './db';
import { env } from './env';
import { tr, type Lang } from '../i18n';

export interface Context {
  user: User | null;
  lang: Lang;
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.appSecret, { expiresIn: '30d' });
}

export async function userFromHeader(header: string | null): Promise<User | null> {
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const { sub } = jwt.verify(header.slice(7), env.appSecret) as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user || user.disabled) return null;
    return user;
  } catch {
    return null;
  }
}

export function requireUser(ctx: Context): User {
  if (!ctx.user) throw new GraphQLError(tr('Please sign in to continue.'), { extensions: { code: 'UNAUTHENTICATED' } });
  return ctx.user;
}

export function requireAdmin(ctx: Context): User {
  const user = requireUser(ctx);
  if (user.role !== 'ADMIN') throw new GraphQLError('Admins only.', { extensions: { code: 'FORBIDDEN' } });
  return user;
}

// Messages are written in English and translated for the person asking;
// {name}-style placeholders are filled from vars.
export function userError(message: string, vars?: Record<string, string | number>): GraphQLError {
  return new GraphQLError(tr(message, vars), { extensions: { code: 'BAD_USER_INPUT' } });
}
