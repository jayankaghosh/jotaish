import type { PaymentRequest, User } from '@prisma/client';
import { prisma } from '../lib/db';
import { button, escapeHtml, layout, markdownToHtml, notifyAdmins, sendMail, siteUrl } from './mail';
import { readingPdf } from './pdf';

const first = (name: string) => escapeHtml(name.split(' ')[0]);
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const credits = (n: number) => n.toLocaleString('en-IN');

// Everything here runs in the background; a failed email is logged and never
// interrupts what the person was doing.
function background(task: () => Promise<unknown>) {
  task().catch((e) => console.error('Notification failed:', (e as Error).message));
}

const READING_NOUN: Record<string, string> = {
  BIRTH_CHART: 'Kundli',
  HOROSCOPE: 'horoscope',
  COMPATIBILITY: 'compatibility reading',
  TAROT: 'tarot reading',
  NUMEROLOGY: 'numerology report',
  PALM: 'palm reading',
  DREAM: 'dream interpretation',
};

export function emailReading(readingId: string) {
  background(async () => {
    const reading = await prisma.reading.findUnique({ where: { id: readingId }, include: { user: true, profile: true } });
    if (!reading) return;
    const noun = READING_NOUN[reading.type] ?? 'reading';
    const pdf = await readingPdf(reading, reading.profile?.name ?? reading.user.name);
    const file = `${reading.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'reading'}.pdf`;
    await sendMail({
      to: reading.user.email,
      userId: reading.userId,
      kind: 'reading',
      subject: `Your ${noun} is ready: ${reading.title}`,
      attachments: [{ filename: file, content: pdf, contentType: 'application/pdf' }],
      html: layout(
        `Your ${noun} is ready`,
        `<p>Namaste ${first(reading.user.name)},</p>
<p>Your ${noun} <strong>${escapeHtml(reading.title)}</strong> has been prepared. The full reading is attached as a PDF so you can keep it, print it or share it with family.</p>
<p>It's also saved in your account, where you can ask Jyotaish any questions about it.</p>
${button('Open my reading', siteUrl(`/readings/${reading.id}`))}`,
      ),
    });
  });
}

export function emailPaymentSubmitted(payment: PaymentRequest) {
  background(async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: payment.userId } });
    const image = payment.screenshot.match(/^data:(image\/\w+);base64,(.+)$/);
    await notifyAdmins(
      `New payment to check: ${inr(payment.rupees)} from ${user.name}`,
      layout(
        'New payment to check',
        `<p><strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.email)}) says they paid <strong>${inr(payment.rupees)}</strong> for <strong>${credits(payment.credits)} credits</strong>.</p>
<p>Their screenshot is attached. Please check it against your UPI app, then approve or reject it in the console.</p>
${button('Review in Payments', siteUrl('/admin/payments'))}`,
      ),
      image ? [{ filename: `payment-${payment.id}.${image[1].split('/')[1]}`, content: Buffer.from(image[2], 'base64'), contentType: image[1] }] : undefined,
    );
    await sendMail({
      to: user.email,
      userId: user.id,
      kind: 'payment',
      subject: 'We received your payment details',
      html: layout(
        'Thank you, we have your payment details',
        `<p>Namaste ${first(user.name)},</p>
<p>We've received your screenshot for <strong>${inr(payment.rupees)}</strong> (${credits(payment.credits)} credits). We'll check the payment and add the credits to your account, usually within a few hours. We'll email you as soon as it's done.</p>
${button('See my payments', siteUrl('/credits'))}`,
      ),
    });
  });
}

export function emailPaymentReviewed(payment: PaymentRequest) {
  background(async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: payment.userId } });
    const approved = payment.status === 'approved';
    await sendMail({
      to: user.email,
      userId: user.id,
      kind: 'payment',
      subject: approved ? `${credits(payment.creditsAdded ?? payment.credits)} credits added to your account` : 'About your payment',
      html: approved
        ? layout(
            'Your credits have been added',
            `<p>Namaste ${first(user.name)},</p>
<p>Thank you for your payment of <strong>${inr(payment.rupees)}</strong>. We've added <strong>${credits(payment.creditsAdded ?? payment.credits)} credits</strong> to your account, ready to use right away.</p>
${payment.note ? `<p>${escapeHtml(payment.note)}</p>` : ''}
${button('Ask Jyotaish', siteUrl('/chat?new=1'))}`,
          )
        : layout(
            "We couldn't confirm your payment",
            `<p>Namaste ${first(user.name)},</p>
<p>We couldn't confirm your payment of <strong>${inr(payment.rupees)}</strong>, so no credits were added this time.</p>
<p><strong>Reason:</strong> ${escapeHtml(payment.note ?? '')}</p>
<p>If you think this is a mistake, please send the payment details again from the Credits page with a clear screenshot showing the amount and transaction ID.</p>
${button('Go to Credits', siteUrl('/credits'))}`,
          ),
    });
  });
}

export function emailCreditsExhausted(user: User) {
  background(() =>
    notifyAdmins(
      `${user.name} has used all their credits`,
      layout(
        'A customer has run out of credits',
        `<p><strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.email)}) has just used the last of their bought credits. Once their free allowance is also used, they won't be able to get new readings until they buy more.</p>
${button('Open their profile', siteUrl(`/admin/users/${user.id}`))}`,
      ),
    ),
  );
}

export function verificationEmail(user: Pick<User, 'id' | 'name' | 'email'>, code: string) {
  return sendMail({
    to: user.email,
    userId: user.id,
    kind: 'verification',
    subject: `${code} is your Jotaish verification code`,
    html: layout(
      'Confirm your email',
      `<p>Namaste ${first(user.name)},</p>
<p>Please enter this code in Jotaish to confirm your email address:</p>
<p style="font-size:34px;letter-spacing:10px;font-weight:bold;color:#15132b;margin:24px 0">${code}</p>
<p>The code works for 30 minutes. If you didn't create a Jotaish account, you can ignore this email.</p>`,
    ),
  });
}

export function campaignEmail(user: Pick<User, 'id' | 'name' | 'email'>, subject: string, body: string) {
  // {name} in the message becomes the person's first name.
  const personal = body.replace(/\{name\}/g, user.name.split(' ')[0]);
  return sendMail({ to: user.email, userId: user.id, kind: 'campaign', subject, html: layout(subject, markdownToHtml(personal)) });
}
