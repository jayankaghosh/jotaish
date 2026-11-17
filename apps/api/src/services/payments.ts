import { GraphQLError } from 'graphql';
import { prisma } from '../lib/db';
import { userError } from '../lib/auth';

export interface CreditPack {
  rupees: number;
  credits: number;
}

export interface PaymentSettings {
  upiId: string;
  payeeName: string;
  qrCode: string | null;
  packs: CreditPack[];
}

const SETTING = 'payment';
const DEFAULTS: PaymentSettings = { upiId: '', payeeName: 'Jotaish', qrCode: null, packs: [] };
const MAX_IMAGE = 3_000_000;

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING } });
  return row ? { ...DEFAULTS, ...JSON.parse(row.value) } : DEFAULTS;
}

export async function setPaymentSettings(input: { upiId?: string | null; payeeName?: string | null; qrCode?: string | null; clearQrCode?: boolean | null; packs?: CreditPack[] | null }) {
  const current = await getPaymentSettings();
  const next = { ...current };
  if (input.upiId != null) {
    const upi = input.upiId.trim();
    if (upi && !/^[\w.\-]+@[\w.\-]+$/.test(upi)) throw userError('That does not look like a UPI ID. It should look like name@bank.');
    next.upiId = upi;
  }
  if (input.payeeName != null) next.payeeName = input.payeeName.trim() || 'Jotaish';
  if (input.clearQrCode) next.qrCode = null;
  else if (input.qrCode) {
    if (!input.qrCode.startsWith('data:image/') || input.qrCode.length > MAX_IMAGE) throw userError('Please upload the QR code as a PNG or JPG under 2 MB.');
    next.qrCode = input.qrCode;
  }
  if (input.packs) {
    const packs = input.packs.map((p) => ({ rupees: Math.round(p.rupees), credits: Math.round(p.credits) }));
    if (packs.some((p) => p.rupees < 1 || p.credits < 1)) throw userError('Every row needs at least ₹1 and 1 credit.');
    if (new Set(packs.map((p) => p.rupees)).size !== packs.length) throw userError('Two rows have the same price. Each price can appear only once.');
    next.packs = packs.sort((a, b) => a.rupees - b.rupees);
  }
  const value = JSON.stringify(next);
  await prisma.setting.upsert({ where: { key: SETTING }, create: { key: SETTING, value }, update: { value } });
  return next;
}

export interface Quote {
  ok: boolean;
  rupees: number | null;
  credits: number | null;
  message: string | null;
  // Valid amounts close to what was asked for, to suggest instead.
  suggestions: CreditPack[];
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// Works out the price of a request. Amounts must be whole multiples of one
// row of the price table; among the rows that fit, the best rate wins.
export function quote(packs: CreditPack[], ask: { credits?: number | null; rupees?: number | null }): Quote {
  if (!packs.length) return { ok: false, rupees: null, credits: null, message: 'Buying credits is not available yet.', suggestions: [] };
  const byRupees = ask.rupees != null;
  const amount = byRupees ? ask.rupees! : ask.credits ?? 0;
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, rupees: null, credits: null, message: byRupees ? 'Please enter a whole number of rupees.' : 'Please enter a whole number of credits.', suggestions: [] };
  }

  const fits = packs.filter((p) => amount % (byRupees ? p.rupees : p.credits) === 0);
  if (fits.length) {
    // Most credits per rupee is the best deal for the buyer.
    const best = fits.reduce((a, b) => (b.credits / b.rupees > a.credits / a.rupees ? b : a));
    const times = amount / (byRupees ? best.rupees : best.credits);
    return { ok: true, rupees: best.rupees * times, credits: best.credits * times, message: null, suggestions: [] };
  }

  // Suggest the nearest valid amounts below and above, from every row.
  const options = new Map<number, CreditPack>();
  for (const p of packs) {
    const unit = byRupees ? p.rupees : p.credits;
    for (const times of [Math.floor(amount / unit), Math.ceil(amount / unit)]) {
      if (times >= 1) options.set(times * unit, { rupees: p.rupees * times, credits: p.credits * times });
    }
  }
  const suggestions = [...options.entries()]
    .sort((a, b) => Math.abs(a[0] - amount) - Math.abs(b[0] - amount))
    .slice(0, 3)
    .map(([, v]) => v)
    .sort((a, b) => a.rupees - b.rupees);
  const steps = packs.map((p) => (byRupees ? inr(p.rupees) : `${p.credits} credits`)).join(', ');
  return {
    ok: false,
    rupees: null,
    credits: null,
    message: `Amounts go in multiples of ${steps}. Here are the closest options.`,
    suggestions,
  };
}

export async function submitPayment(userId: string, input: { credits: number; rupees: number; screenshot: string }) {
  const settings = await getPaymentSettings();
  const q = quote(settings.packs, { credits: input.credits });
  if (!q.ok || q.rupees !== input.rupees) throw userError('That amount no longer matches the price table. Please choose the amount again.');
  if (!input.screenshot?.startsWith('data:image/')) throw userError('Please attach a screenshot of your payment.');
  if (input.screenshot.length > MAX_IMAGE) throw userError('That screenshot is too large. Please use one under 2 MB.');
  const pending = await prisma.paymentRequest.count({ where: { userId, status: 'pending' } });
  if (pending >= 5) throw userError('You already have several payments waiting to be checked. Please wait until they are verified.');
  return prisma.paymentRequest.create({ data: { userId, credits: q.credits!, rupees: q.rupees!, screenshot: input.screenshot } });
}

export async function grantCredits(userId: string, credits: number, adminId: string, note?: string | null, paymentId?: string | null) {
  if (!Number.isFinite(credits) || credits === 0) throw userError('Please enter a number of credits other than 0.');
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw userError('User not found.');
    if (user.creditBalance + credits < 0) throw userError(`This user only has ${Math.floor(user.creditBalance)} credits, so you can remove at most that many.`);
    await tx.creditGrant.create({ data: { userId, credits, note: note?.trim() || null, paymentId: paymentId ?? null, grantedById: adminId } });
    return tx.user.update({ where: { id: userId }, data: { creditBalance: { increment: credits } } });
  });
}

export async function reviewPayment(id: string, adminId: string, approve: boolean, credits?: number | null, note?: string | null) {
  const payment = await prisma.paymentRequest.findUnique({ where: { id } });
  if (!payment) throw userError('Payment not found.');
  const amount = credits ?? payment.credits;
  const reason = note?.trim() || null;
  if (approve && amount <= 0) throw userError('Please enter how many credits to add.');
  // The customer sees this reason, so a rejection always needs one.
  if (!approve && !reason) throw userError('Please give a reason for rejecting this payment. The customer will see it.');

  // Claim the request first so a double click can't add credits twice.
  const { count } = await prisma.paymentRequest.updateMany({
    where: { id, status: 'pending' },
    data: {
      status: approve ? 'approved' : 'rejected',
      creditsAdded: approve ? amount : null,
      note: reason,
      reviewedById: adminId,
      reviewedAt: new Date(),
    },
  });
  if (!count) throw new GraphQLError('This payment has already been reviewed.', { extensions: { code: 'BAD_USER_INPUT' } });

  if (approve) {
    try {
      await grantCredits(payment.userId, amount, adminId, reason || `Payment of ₹${payment.rupees}`, payment.id);
    } catch (e) {
      await prisma.paymentRequest.update({ where: { id }, data: { status: 'pending', creditsAdded: null, note: null, reviewedById: null, reviewedAt: null } });
      throw e;
    }
  }
  return prisma.paymentRequest.findUniqueOrThrow({ where: { id } });
}
