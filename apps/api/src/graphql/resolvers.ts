import bcrypt from 'bcryptjs';
import { GraphQLScalarType, Kind, type ValueNode } from 'graphql';
import type { Prisma, ReadingType, Role, User } from '@prisma/client';
import { prisma } from '../lib/db';
import { requireAdmin, requireUser, signToken, userError, type Context } from '../lib/auth';
import { maskSecret } from '../lib/crypto';
import { searchPlaces } from '../astro/geo';
import { saveProfile, type ProfileInput } from '../services/profiles';
import * as readings from '../services/readings';
import { CREDIT_USD, assertCanInteract, getLimitSettings, setLimitSettings, usageFor } from '../services/limits';
import { getPaymentSettings, grantCredits, quote, reviewPayment, setPaymentSettings, submitPayment } from '../services/payments';
import { disconnectGmail, getMailSettings, isConfigured, saveGmailConnection, sendTestMail, setMailSettings, type MailSettings } from '../services/mail';
import { authUrl, checkState, exchangeCode, makeState } from '../services/gmail';
import { campaignEmail } from '../services/notifications';
import { isLang, toLang } from '../i18n';
import { checkCode, getSignInSettings, requestCode, setSignInSettings } from '../services/signin';
import { greeting, sendMessage, streamMessage, type ChatEvent } from '../ai/agent';
import { AiError, complete, listOpenRouterModels } from '../ai/openrouter';
import {
  AI_TASKS, RECOMMENDED_MODELS, getApiKey, getModels, getTemperature, setApiKey, setModels, setTemperature, type AiTask,
} from '../ai/settings';
import { env } from '../lib/env';
import { todaySky } from '../services/today';

const iso = (field: string) => (parent: any) => (parent[field] ? new Date(parent[field]).toISOString() : null);

// Model names and raw tool calls are internal; only admins get them.
const adminOnly = (field: string) => (parent: any, _: unknown, ctx: Context) => (ctx.user?.role === 'ADMIN' ? parent[field] : null);

function parseLiteral(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.OBJECT:
      return Object.fromEntries(ast.fields.map((f) => [f.name.value, parseLiteral(f.value)]));
    case Kind.LIST:
      return ast.values.map(parseLiteral);
    default:
      return null;
  }
}

const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  serialize: (v) => v,
  parseValue: (v) => v,
  parseLiteral,
});

function mailView(mail: MailSettings) {
  return {
    ...mail,
    password: undefined,
    gmailClientSecret: undefined,
    gmailRefreshToken: undefined,
    passwordSet: Boolean(mail.password),
    gmailClientSecretSet: Boolean(mail.gmailClientSecret),
    configured: isConfigured(mail),
  };
}

async function adminSettings() {
  const [models, stored, temperature, limits, payment, mail, signIn] = await Promise.all([
    getModels(),
    prisma.setting.findUnique({ where: { key: 'openrouter_api_key' } }),
    getTemperature(),
    getLimitSettings(),
    getPaymentSettings(),
    getMailSettings(),
    getSignInSettings(),
  ]);
  const key = await getApiKey();
  return {
    apiKeySet: Boolean(key),
    apiKeyPreview: key ? maskSecret(key) : null,
    apiKeySource: stored ? 'settings' : env.openRouterKey ? 'environment' : 'none',
    temperature,
    creditLimit: limits.limit,
    creditPeriod: limits.period,
    creditUsd: CREDIT_USD,
    payment,
    mail: mailView(mail),
    signIn,
    tasks: (Object.keys(AI_TASKS) as AiTask[]).map((task) => ({ task, ...AI_TASKS[task], needs: [...AI_TASKS[task].needs], model: models[task] })),
    recommendedModels: RECOMMENDED_MODELS,
  };
}

const conversationList = (userId: string) =>
  prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: { messages: { where: { role: { in: ['user', 'assistant'] }, content: { not: '' } }, orderBy: { createdAt: 'desc' }, take: 1 } },
  });

// Strips large photos from list views; the reading page loads them on demand.
function withoutPhoto<T extends { type: ReadingType; input: Prisma.JsonValue }>(r: T): T {
  if (r.type !== 'PALM') return r;
  const { imageDataUrl, ...rest } = (r.input ?? {}) as Record<string, unknown>;
  return { ...r, input: { ...rest, hasPhoto: Boolean(imageDataUrl) } };
}


function createReadingFor(owner: { userId: string }, input: any) {
  switch (input.type as ReadingType) {
    case 'BIRTH_CHART':
      return readings.createBirthChart(owner, input.profileId, input.region);
    case 'HOROSCOPE':
      return readings.createHoroscope(owner, input);
    case 'COMPATIBILITY':
      if (!input.profileId || !input.profileB) throw userError('Please choose both people.');
      return readings.createCompatibility(owner, input.profileId, input.profileB);
    case 'TAROT':
      return readings.createTarot(owner, input);
    case 'NUMEROLOGY':
      return readings.createNumerology(owner, input);
    case 'PALM':
      return readings.createPalm(owner, input);
    case 'DREAM':
      return readings.createDream(owner, input);
    default:
      throw userError('Unknown reading type.');
  }
}

export const resolvers = {
  JSON: JSONScalar,

  User: {
    createdAt: iso('createdAt'),
    lastSeenAt: iso('lastSeenAt'),
    profiles: (u: { id: string }) => prisma.birthProfile.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'asc' } }),
    readingCount: (u: { id: string }) => prisma.reading.count({ where: { userId: u.id } }),
    conversationCount: (u: { id: string }) => prisma.conversation.count({ where: { userId: u.id } }),
    emailVerified: (u: User) => Boolean(u.emailVerifiedAt),
    usage: (u: User, _: unknown, ctx: Context) => (ctx.user && (ctx.user.id === u.id || ctx.user.role === 'ADMIN') ? usageFor(u) : null),
  },
  Usage: { resetsAt: iso('resetsAt') },
  PaymentRequest: {
    createdAt: iso('createdAt'),
    reviewedAt: iso('reviewedAt'),
    user: (p: { userId: string }, _: unknown, ctx: Context) => (ctx.user?.role === 'ADMIN' ? prisma.user.findUnique({ where: { id: p.userId } }) : null),
  },
  EmailLogEntry: { createdAt: iso('createdAt') },
  CreditGrant: {
    createdAt: iso('createdAt'),
    grantedBy: async (g: { grantedById: string | null }) =>
      g.grantedById ? (await prisma.user.findUnique({ where: { id: g.grantedById }, select: { name: true } }))?.name ?? null : null,
  },
  BirthProfile: { createdAt: iso('createdAt') },
  Reading: {
    createdAt: iso('createdAt'),
    model: adminOnly('model'),
    generationMs: adminOnly('generationMs'),
    profile: (r: { profileId: string | null }) => (r.profileId ? prisma.birthProfile.findUnique({ where: { id: r.profileId } }) : null),
  },
  Conversation: {
    createdAt: iso('createdAt'),
    updatedAt: iso('updatedAt'),
    lastMessage: (c: any) => c.messages?.[0]?.content?.slice(0, 140) ?? null,
    messages: (c: any) => c.messages ?? prisma.message.findMany({ where: { conversationId: c.id }, orderBy: { createdAt: 'asc' } }),
  },
  Message: { createdAt: iso('createdAt'), model: adminOnly('model'), toolCalls: adminOnly('toolCalls') },
  UsageRow: { createdAt: iso('createdAt') },

  Query: {
    me: async (_: unknown, __: unknown, ctx: Context) => {
      if (!ctx.user) return null;
      return prisma.user.update({ where: { id: ctx.user.id }, data: { lastSeenAt: new Date() } });
    },
    myProfiles: (_: unknown, __: unknown, ctx: Context) =>
      prisma.birthProfile.findMany({ where: { userId: requireUser(ctx).id }, orderBy: { createdAt: 'asc' } }),
    today: (_: unknown, __: unknown, ctx: Context) => todaySky(requireUser(ctx).id),
    myReadings: async (_: unknown, { type }: { type?: ReadingType }, ctx: Context) => {
      const list = await prisma.reading.findMany({ where: { userId: requireUser(ctx).id, ...(type ? { type } : {}) }, orderBy: { createdAt: 'desc' } });
      return list.map(withoutPhoto);
    },
    reading: (_: unknown, { id }: { id: string }, ctx: Context) => prisma.reading.findFirst({ where: { id, userId: requireUser(ctx).id } }),
    myConversations: (_: unknown, __: unknown, ctx: Context) => conversationList(requireUser(ctx).id),
    conversation: (_: unknown, { id }: { id: string }, ctx: Context) =>
      prisma.conversation.findFirst({ where: { id, userId: requireUser(ctx).id } }),
    searchPlaces: (_: unknown, { query }: { query: string }, ctx: Context) => {
      requireUser(ctx);
      return searchPlaces(query);
    },
    aiReady: async () => Boolean(await getApiKey()),
    buyCreditsInfo: async (_: unknown, __: unknown, ctx: Context) => {
      requireUser(ctx);
      const p = await getPaymentSettings();
      return { available: Boolean(p.upiId && p.packs.length), upiId: p.upiId || null, payeeName: p.payeeName, qrCode: p.qrCode, packs: p.packs };
    },
    creditQuote: async (_: unknown, ask: { credits?: number; rupees?: number }, ctx: Context) => {
      requireUser(ctx);
      return quote((await getPaymentSettings()).packs, ask);
    },
    myPayments: (_: unknown, __: unknown, ctx: Context) =>
      prisma.paymentRequest.findMany({ where: { userId: requireUser(ctx).id }, orderBy: { createdAt: 'desc' }, take: 50 }),

    adminStats: async (_: unknown, __: unknown, ctx: Context) => {
      requireAdmin(ctx);
      const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      const [users, newUsersThisWeek, conversations, messages, readingCount, byType, aiCalls, aiErrors, cost, byModel, recent] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.conversation.count(),
        prisma.message.count({ where: { role: 'user' } }),
        prisma.reading.count(),
        prisma.reading.groupBy({ by: ['type'], _count: true, _avg: { generationMs: true } }),
        prisma.aiUsage.count(),
        prisma.aiUsage.count({ where: { error: { not: null } } }),
        prisma.aiUsage.aggregate({ _sum: { cost: true } }),
        prisma.aiUsage.groupBy({ by: ['model'], _count: true, _sum: { promptTokens: true, completionTokens: true, cost: true } }),
        prisma.aiUsage.findMany({ orderBy: { createdAt: 'desc' }, take: 25, include: { user: { select: { name: true } } } }),
      ]);
      return {
        users,
        newUsersThisWeek,
        conversations,
        messages,
        readings: readingCount,
        readingsByType: byType.map((r) => ({
          key: r.type,
          count: r._count,
          avgGenerationMs: r._avg.generationMs == null ? null : Math.round(r._avg.generationMs),
        })),
        aiCalls,
        aiErrors,
        aiCost: cost._sum.cost ?? 0,
        usageByModel: byModel
          .map((m) => ({ model: m.model, calls: m._count, promptTokens: m._sum.promptTokens ?? 0, completionTokens: m._sum.completionTokens ?? 0, cost: m._sum.cost ?? 0 }))
          .sort((a, b) => b.calls - a.calls),
        recentUsage: recent.map((r) => ({ ...r, userName: r.user?.name ?? null })),
      };
    },
    adminUsers: async (_: unknown, { search, skip, take }: { search?: string; skip?: number; take?: number }, ctx: Context) => {
      requireAdmin(ctx);
      const where: Prisma.UserWhereInput = search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] }
        : {};
      const [total, items] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: skip ?? 0, take: Math.min(take ?? 25, 100) }),
      ]);
      return { total, items };
    },
    adminUser: (_: unknown, { id }: { id: string }, ctx: Context) => {
      requireAdmin(ctx);
      return prisma.user.findUnique({ where: { id } });
    },
    adminUserReadings: async (_: unknown, { userId }: { userId: string }, ctx: Context) => {
      requireAdmin(ctx);
      return (await prisma.reading.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })).map(withoutPhoto);
    },
    adminUserConversations: (_: unknown, { userId }: { userId: string }, ctx: Context) => {
      requireAdmin(ctx);
      return conversationList(userId);
    },
    adminConversation: (_: unknown, { id }: { id: string }, ctx: Context) => {
      requireAdmin(ctx);
      return prisma.conversation.findUnique({ where: { id } });
    },
    adminReading: (_: unknown, { id }: { id: string }, ctx: Context) => {
      requireAdmin(ctx);
      return prisma.reading.findUnique({ where: { id } });
    },
    adminPayments: async (_: unknown, { status, skip, take }: { status?: string; skip?: number; take?: number }, ctx: Context) => {
      requireAdmin(ctx);
      const where = status && status !== 'all' ? { status } : {};
      const [total, items] = await Promise.all([
        prisma.paymentRequest.count({ where }),
        prisma.paymentRequest.findMany({ where, orderBy: { createdAt: status === 'pending' ? 'asc' : 'desc' }, skip: skip ?? 0, take: Math.min(take ?? 20, 50) }),
      ]);
      return { total, items };
    },
    adminPendingPayments: (_: unknown, __: unknown, ctx: Context) => {
      requireAdmin(ctx);
      return prisma.paymentRequest.count({ where: { status: 'pending' } });
    },
    adminUserPayments: (_: unknown, { userId }: { userId: string }, ctx: Context) => {
      requireAdmin(ctx);
      return prisma.paymentRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    },
    adminUserGrants: (_: unknown, { userId }: { userId: string }, ctx: Context) => {
      requireAdmin(ctx);
      return prisma.creditGrant.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
    },
    adminEmailLog: (_: unknown, { kind, take }: { kind?: string; take?: number }, ctx: Context) => {
      requireAdmin(ctx);
      return prisma.emailLog.findMany({ where: kind ? { kind } : {}, orderBy: { createdAt: 'desc' }, take: Math.min(take ?? 50, 200) });
    },
    adminSettings: (_: unknown, __: unknown, ctx: Context) => {
      requireAdmin(ctx);
      return adminSettings();
    },
    openRouterModels: (_: unknown, __: unknown, ctx: Context) => {
      requireAdmin(ctx);
      return listOpenRouterModels();
    },
  },

  Subscription: {
    chat: {
      subscribe: (_: unknown, args: { conversationId: string; content: string; imageDataUrl?: string }, ctx: Context) =>
        streamMessage(requireUser(ctx).id, args.conversationId, args.content, args.imageDataUrl, ctx.lang),
      resolve: (event: ChatEvent) => event,
    },
  },

  Mutation: {
    requestSignInCode: (_: unknown, { email }: { email: string }) => requestCode(email),
    verifySignInCode: async (_: unknown, { email, code, language }: { email: string; code: string; language?: string }, ctx: Context) => {
      const address = await checkCode(email, code);
      const now = new Date();
      // First sign-in creates the account; the name is asked for next.
      const user = await prisma.user.upsert({
        where: { email: address },
        create: { email: address, name: '', language: toLang(language ?? ctx.lang), emailVerifiedAt: now, lastSeenAt: now },
        update: { lastSeenAt: now },
      });
      if (user.disabled) throw userError('This account has been blocked. If you think this is a mistake, please contact us.');
      if (!user.emailVerifiedAt) await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
      return { token: signToken(user.id), user, isNew: !user.name };
    },
    login: async (_: unknown, { email, password }: { email: string; password: string }) => {
      const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (!user?.passwordHash || user.role !== 'ADMIN' || !(await bcrypt.compare(password, user.passwordHash))) {
        throw userError('That email and password do not match. Please try again.');
      }
      if (user.disabled) throw userError('This account has been blocked. If you think this is a mistake, please contact us.');
      await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
      return { token: signToken(user.id), user, isNew: false };
    },
    updateMe: (_: unknown, { name, language }: { name?: string; language?: string }, ctx: Context) => {
      // Language can be changed even before the email is confirmed, so the
      // confirmation screen itself can switch language; a name change can't.
      const user = name?.trim() || !ctx.user ? requireUser(ctx) : ctx.user;
      return prisma.user.update({
        where: { id: user.id },
        data: { ...(name?.trim() ? { name: name.trim() } : {}), ...(isLang(language) ? { language } : {}) },
      });
    },
    changePassword: async (_: unknown, { current, next }: { current: string; next: string }, ctx: Context) => {
      const user = requireUser(ctx);
      if (!user.passwordHash || !(await bcrypt.compare(current, user.passwordHash))) throw userError('Your current password is not correct.');
      if (next.length < 8) throw userError('Please choose a password with at least 8 characters.');
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
      return true;
    },
    saveProfile: (_: unknown, { input }: { input: ProfileInput }, ctx: Context) => saveProfile(requireUser(ctx).id, input),
    deleteProfile: async (_: unknown, { id }: { id: string }, ctx: Context) => {
      const { count } = await prisma.birthProfile.deleteMany({ where: { id, userId: requireUser(ctx).id } });
      return count > 0;
    },
    createReading: async (_: unknown, { input }: { input: any }, ctx: Context) => {
      const user = requireUser(ctx);
      await assertCanInteract(user);
      return createReadingFor({ userId: user.id }, input);
    },
    deleteReading: async (_: unknown, { id }: { id: string }, ctx: Context) => {
      const { count } = await prisma.reading.deleteMany({ where: { id, userId: requireUser(ctx).id } });
      return count > 0;
    },
    startConversation: async (_: unknown, { topic, readingId }: { topic?: string; readingId?: string }, ctx: Context) => {
      const user = requireUser(ctx);
      const reading = readingId ? await prisma.reading.findFirst({ where: { id: readingId, userId: user.id } }) : null;
      const conversation = await prisma.conversation.create({
        data: {
          userId: user.id,
          topic: topic ?? 'general',
          focusReadingId: reading?.id ?? null,
          title: reading ? `About: ${reading.title}`.slice(0, 60) : 'New consultation',
        },
      });
      await prisma.message.create({ data: { conversationId: conversation.id, role: 'assistant', content: await greeting(user.id, reading?.title) } });
      return conversation;
    },
    sendMessage: (_: unknown, args: { conversationId: string; content: string; imageDataUrl?: string }, ctx: Context) =>
      sendMessage(requireUser(ctx).id, args.conversationId, args.content, args.imageDataUrl),
    renameConversation: async (_: unknown, { id, title }: { id: string; title: string }, ctx: Context) => {
      const user = requireUser(ctx);
      const found = await prisma.conversation.findFirst({ where: { id, userId: user.id } });
      if (!found) throw userError('Conversation not found.');
      return prisma.conversation.update({ where: { id }, data: { title: title.trim().slice(0, 60) || found.title } });
    },
    submitPayment: (_: unknown, args: { credits: number; rupees: number; screenshot: string }, ctx: Context) => submitPayment(requireUser(ctx).id, args),
    deleteConversation: async (_: unknown, { id }: { id: string }, ctx: Context) => {
      const { count } = await prisma.conversation.deleteMany({ where: { id, userId: requireUser(ctx).id } });
      return count > 0;
    },

    updateSettings: async (_: unknown, { input }: { input: any }, ctx: Context) => {
      requireAdmin(ctx);
      if (input.clearApiKey) await setApiKey(null);
      else if (input.apiKey?.trim()) await setApiKey(input.apiKey.trim());
      if (typeof input.temperature === 'number') await setTemperature(input.temperature);
      if (input.limits) await setLimitSettings(input.limits);
      if (input.payment) await setPaymentSettings(input.payment);
      if (input.mail) await setMailSettings(input.mail);
      if (input.signIn) await setSignInSettings(input.signIn);
      if (input.models?.length) {
        const valid = input.models.filter((m: { task: string; model: string }) => m.task in AI_TASKS && m.model.trim());
        await setModels(Object.fromEntries(valid.map((m: { task: string; model: string }) => [m.task, m.model.trim()])));
      }
      return adminSettings();
    },
    testOpenRouter: async (_: unknown, { model }: { model?: string }, ctx: Context) => {
      const admin = requireAdmin(ctx);
      try {
        const reply = await complete({
          task: 'title',
          model: model ?? undefined,
          userId: admin.id,
          maxTokens: 20,
          messages: [{ role: 'user', content: 'Reply with exactly: Connection works.' }],
        });
        return { ok: true, message: `${reply.model} replied: ${reply.content.trim()}` };
      } catch (e) {
        return { ok: false, message: e instanceof AiError ? e.detail : (e as Error).message };
      }
    },
    setUserRole: async (_: unknown, { userId, role }: { userId: string; role: Role }, ctx: Context) => {
      const admin = requireAdmin(ctx);
      if (admin.id === userId && role !== 'ADMIN') throw userError('You cannot remove your own admin access.');
      return prisma.user.update({ where: { id: userId }, data: { role } });
    },
    setUserDisabled: async (_: unknown, { userId, disabled }: { userId: string; disabled: boolean }, ctx: Context) => {
      const admin = requireAdmin(ctx);
      if (admin.id === userId) throw userError('You cannot block your own account.');
      return prisma.user.update({ where: { id: userId }, data: { disabled } });
    },
    reviewPayment: (_: unknown, args: { id: string; approve: boolean; credits?: number; note?: string }, ctx: Context) =>
      reviewPayment(args.id, requireAdmin(ctx).id, args.approve, args.credits, args.note),
    grantCredits: (_: unknown, args: { userId: string; credits: number; note?: string }, ctx: Context) =>
      grantCredits(args.userId, args.credits, requireAdmin(ctx).id, args.note),
    sendTestEmail: async (_: unknown, { to }: { to: string }, ctx: Context) => {
      requireAdmin(ctx);
      try {
        await sendTestMail(to.trim());
      } catch (e) {
        // Turn SMTP errors into something an admin can act on.
        const message = (e as Error).message;
        if (/Connection timeout|ETIMEDOUT|ECONNREFUSED/i.test(message)) {
          throw userError('Could not reach the email server. Your hosting provider may block email ports; switch to "Gmail (API)" above, which works over HTTPS.');
        }
        if (/Invalid login|Username and Password not accepted|535/i.test(message)) {
          throw userError('The email server rejected the username or password. For Gmail, use an App Password, not your normal password.');
        }
        throw userError(`Could not send the test email: ${message}`);
      }
      return true;
    },
    gmailConnectUrl: async (_: unknown, { redirectUri }: { redirectUri: string }, ctx: Context) => {
      const admin = requireAdmin(ctx);
      const s = await getMailSettings();
      if (!s.gmailClientId || !s.gmailClientSecret) throw userError('Please save the Client ID and Client secret first.');
      return authUrl(s.gmailClientId, redirectUri, makeState(admin.id));
    },
    connectGmail: async (_: unknown, args: { code: string; state: string; redirectUri: string }, ctx: Context) => {
      const admin = requireAdmin(ctx);
      if (!checkState(args.state, admin.id)) throw userError('This Google approval has expired or did not start here. Please click "Connect Gmail" again.');
      const s = await getMailSettings();
      try {
        const { refreshToken, address } = await exchangeCode(s, args.code, args.redirectUri);
        await saveGmailConnection(refreshToken, address);
      } catch (e) {
        throw userError(`Could not connect Gmail: ${(e as Error).message}`);
      }
      return mailView(await getMailSettings());
    },
    disconnectGmail: async (_: unknown, __: unknown, ctx: Context) => {
      requireAdmin(ctx);
      await disconnectGmail();
      return mailView(await getMailSettings());
    },
    sendEmailToUsers: async (_: unknown, args: { userIds?: string[]; everyone?: boolean; subject: string; body: string }, ctx: Context) => {
      requireAdmin(ctx);
      if (!args.subject.trim() || !args.body.trim()) throw userError('Please write a subject and a message.');
      if (!isConfigured(await getMailSettings())) throw userError('Email is not set up yet. Add your SMTP details in AI settings first.');
      const users = await prisma.user.findMany({
        where: { disabled: false, ...(args.everyone ? {} : { id: { in: args.userIds ?? [] } }) },
        select: { id: true, name: true, email: true },
      });
      if (!users.length) throw userError('Please choose at least one person.');
      // Send one at a time in the background; mail providers limit bursts.
      void (async () => {
        for (const u of users) {
          await campaignEmail(u, args.subject.trim(), args.body);
          await new Promise((r) => setTimeout(r, 1000));
        }
      })();
      return users.length;
    },
    setUserLimit: async (_: unknown, { userId, mode, limit }: { userId: string; mode: string; limit?: number | null }, ctx: Context) => {
      requireAdmin(ctx);
      if (mode === 'unlimited') return prisma.user.update({ where: { id: userId }, data: { unlimitedCredits: true, creditLimit: null } });
      if (mode === 'custom') {
        if (limit == null || limit < 0) throw userError('Please enter a limit of 0 or more.');
        return prisma.user.update({ where: { id: userId }, data: { unlimitedCredits: false, creditLimit: Math.floor(limit) } });
      }
      return prisma.user.update({ where: { id: userId }, data: { unlimitedCredits: false, creditLimit: null } });
    },
  },
};
