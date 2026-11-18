import type { PaymentRequest, User } from '@prisma/client';
import { prisma } from '../lib/db';
import { button, escapeHtml, layout, markdownToHtml, notifyAdmins, sendMail, siteUrl } from './mail';
import { readingPdf } from './pdf';
import { toLang, tr } from '../i18n';

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

// Customer emails go out in the language the person chose; admin emails stay
// in English.
const strong = (text: string) => `<strong>${escapeHtml(text)}</strong>`;
const para = (text: string) => `<p>${text}</p>`;

export function emailReading(readingId: string) {
  background(async () => {
    const reading = await prisma.reading.findUnique({ where: { id: readingId }, include: { user: true, profile: true } });
    if (!reading) return;
    const lang = toLang(reading.user.language);
    const t = (text: string, vars?: Record<string, string | number>) => tr(text, vars, lang);
    const noun = t(READING_NOUN[reading.type] ?? 'reading');
    const pdf = await readingPdf(reading, reading.profile?.name ?? reading.user.name, lang);
    // Letters from any script are fine in file names; only drop punctuation.
    const file = `${reading.title.replace(/[^\p{L}\p{M}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'reading'}.pdf`;
    await sendMail({
      to: reading.user.email,
      userId: reading.userId,
      kind: 'reading',
      subject: t('Your {noun} is ready: {title}', { noun, title: reading.title }),
      attachments: [{ filename: file, content: pdf, contentType: 'application/pdf' }],
      html: layout(
        t('Your {noun} is ready', { noun }),
        para(t('Namaste {name},', { name: first(reading.user.name) })) +
          para(t('Your {noun} {title} has been prepared. The full reading is attached as a PDF so you can keep it, print it or share it with family.', { noun, title: strong(reading.title) })) +
          para(t("It's also saved in your account, where you can ask Jotaish any questions about it.")) +
          button(t('Open my reading'), siteUrl(`/readings/${reading.id}`)),
        lang,
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
    const lang = toLang(user.language);
    const t = (text: string, vars?: Record<string, string | number>) => tr(text, vars, lang);
    await sendMail({
      to: user.email,
      userId: user.id,
      kind: 'payment',
      subject: t('We received your payment details'),
      html: layout(
        t('Thank you, we have your payment details'),
        para(t('Namaste {name},', { name: first(user.name) })) +
          para(
            t("We've received your screenshot for {amount} ({credits} credits). We'll check the payment and add the credits to your account, usually within a few hours. We'll email you as soon as it's done.", {
              amount: strong(inr(payment.rupees)),
              credits: credits(payment.credits),
            }),
          ) +
          button(t('See my payments'), siteUrl('/credits')),
        lang,
      ),
    });
  });
}

export function emailPaymentReviewed(payment: PaymentRequest) {
  background(async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: payment.userId } });
    const lang = toLang(user.language);
    const t = (text: string, vars?: Record<string, string | number>) => tr(text, vars, lang);
    const added = credits(payment.creditsAdded ?? payment.credits);
    const approved = payment.status === 'approved';
    await sendMail({
      to: user.email,
      userId: user.id,
      kind: 'payment',
      subject: approved ? t('{credits} credits added to your account', { credits: added }) : t('About your payment'),
      html: approved
        ? layout(
            t('Your credits have been added'),
            para(t('Namaste {name},', { name: first(user.name) })) +
              para(t("Thank you for your payment of {amount}. We've added {credits} to your account, ready to use right away.", {
                amount: strong(inr(payment.rupees)),
                credits: strong(t('{credits} credits', { credits: added })),
              })) +
              (payment.note ? para(escapeHtml(payment.note)) : '') +
              button(t('Ask Jotaish'), siteUrl('/chat?new=1')),
            lang,
          )
        : layout(
            t("We couldn't confirm your payment"),
            para(t('Namaste {name},', { name: first(user.name) })) +
              para(t("We couldn't confirm your payment of {amount}, so no credits were added this time.", { amount: strong(inr(payment.rupees)) })) +
              para(`${strong(t('Reason:'))} ${escapeHtml(payment.note ?? '')}`) +
              para(t('If you think this is a mistake, please send the payment details again from the Credits page with a clear screenshot showing the amount and transaction ID.')) +
              button(t('Go to Credits'), siteUrl('/credits')),
            lang,
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

export function signInCodeEmail(to: { email: string; userId?: string; name: string; language: string }, code: string, minutes: number) {
  const lang = toLang(to.language);
  const t = (text: string, vars?: Record<string, string | number>) => tr(text, vars, lang);
  return sendMail({
    to: to.email,
    userId: to.userId,
    kind: 'sign_in_code',
    subject: t('{code} is your Jotaish sign-in code', { code }),
    html: layout(
      t('Your sign-in code'),
      para(to.name ? t('Namaste {name},', { name: first(to.name) }) : t('Namaste,')) +
        para(t('Enter this code in Jotaish to sign in:')) +
        `<p style="font-size:34px;letter-spacing:10px;font-weight:bold;color:#0c0a1c;margin:24px 0">${code}</p>` +
        para(t("The code works for {minutes} minutes. If you didn't ask to sign in, you can ignore this email; nobody can get in without the code.", { minutes })),
      lang,
    ),
  });
}

export function campaignEmail(user: Pick<User, 'id' | 'name' | 'email'>, subject: string, body: string) {
  // {name} in the message becomes the person's first name.
  const personal = body.replace(/\{name\}/g, user.name.split(' ')[0]);
  return sendMail({ to: user.email, userId: user.id, kind: 'campaign', subject, html: layout(subject, markdownToHtml(personal)) });
}
