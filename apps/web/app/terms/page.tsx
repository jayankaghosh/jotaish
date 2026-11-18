import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of service - Jotaish',
  description: 'The terms for using Jotaish.',
};

const BODY = `
Welcome to Jotaish. These terms are an agreement between you and Jotaish ("we", "us") about your use of **jotaish.online** and its services. By creating an account or using Jotaish, you agree to them. If you do not agree, please do not use Jotaish.

## 1. What Jotaish offers

Jotaish provides astrology and related readings, including Vedic birth charts (Kundli), horoscopes, compatibility, tarot, numerology, palm reading and dream interpretation, and a conversational astrologer, Jotaish, who is an automated assistant. Charts and calculations are produced by our software, and interpretations are written by language models.

## 2. Guidance, not professional advice

Astrology and divination are traditions of reflection and interpretation, not science. Readings are offered **for guidance, reflection and entertainment** and may be inaccurate or incomplete. They are **not** medical, psychological, legal, financial or other professional advice. Do not make important decisions, or delay seeking professional help, based on a reading. If you are in crisis or thinking about harming yourself, please contact a qualified professional or your local emergency services immediately.

## 3. Your account

- You must be at least 18 years old to use Jotaish.
- Give accurate information, keep your email account and sign-in codes private, and tell us if you think someone else has used your account.
- You may need to confirm your email address before you can sign in.
- You are responsible for what happens under your account.

## 4. Information about other people

You may add birth details for other people, such as a partner or family member, for charts and matching. Only do so with their knowledge and permission, and use their readings respectfully.

## 5. Acceptable use

Please do not:

- use Jotaish for anything unlawful, harmful, harassing or deceptive;
- upload content you do not have the right to share, or that is offensive or harmful;
- try to break, overload, copy or get around the limits or security of the service;
- use automated tools to access Jotaish, or resell its readings, without our written permission.

We may suspend or close accounts that break these terms.

## 6. Free allowance and credits

- Each account receives a free allowance of usage, which may refresh daily or monthly as shown in the app. We may change the size of the free allowance.
- You can buy additional credits by UPI at the prices shown on the Credits page. After paying, you upload a screenshot of the payment; we check it and add the credits to your account, usually within a few hours. We may reject a payment we cannot confirm, and will tell you why.
- Credits are used after your free allowance. Longer or more detailed readings use more credits than short replies.
- Credits have no cash value, cannot be transferred to another account, and do not expire while your account remains open.
- **Refunds:** because credits are used to prepare readings straight away, payments for credits are not refundable once the credits have been added, except where required by law. If you paid but your credits were not added, or you paid the wrong amount, contact us at **jotaish.astrologer@gmail.com** with your payment details and we will help.

## 7. Your content and readings

You keep ownership of what you write and upload. You give us permission to store and process it to provide the service to you, as described in our [Privacy policy](/privacy). You may keep, print and share your own readings for personal use. The Jotaish name, design and software belong to us.

## 8. Availability and changes

We work to keep Jotaish running smoothly, but we do not promise it will always be available, error-free or uninterrupted. We may change, add or remove features, and we may update these terms. When we make important changes to these terms, we will update the date above and, where appropriate, let you know.

## 9. Limitation of liability

To the fullest extent allowed by law, Jotaish is provided "as is", and we are not responsible for any decisions you make or actions you take based on a reading, or for indirect or consequential losses. Where we are liable, our total liability to you is limited to the amount you paid us in the three months before the claim. Nothing in these terms limits any rights you have that cannot be limited by law.

## 10. Ending your account

You can stop using Jotaish at any time and ask us to delete your account by writing to **jotaish.astrologer@gmail.com**. We may suspend or close an account that breaks these terms. Unused credits are not refundable when an account is closed for breaking these terms.

## 11. Governing law

These terms are governed by the laws of India. Any disputes will be subject to the jurisdiction of the courts of India.

## 12. Contact

Jotaish
Email: **jotaish.astrologer@gmail.com**
Website: https://www.jotaish.online
`;

export default function TermsPage() {
  return <LegalPage title="Terms of service" updated="18 November 2026" body={BODY} />;
}
