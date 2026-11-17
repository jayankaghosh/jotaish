import jwt from 'jsonwebtoken';
import { GraphQLError } from 'graphql';
import type { User } from '@prisma/client';
import { prisma } from './db';
import { env } from './env';

export interface Context {
  user: User | null;
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
  if (!ctx.user) throw new GraphQLError('Please sign in to continue.', { extensions: { code: 'UNAUTHENTICATED' } });
  return ctx.user;
}

export function requireAdmin(ctx: Context): User {
  const user = requireUser(ctx);
  if (user.role !== 'ADMIN') throw new GraphQLError('Admins only.', { extensions: { code: 'FORBIDDEN' } });
  return user;
}

export function userError(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
}
