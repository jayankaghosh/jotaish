import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy policy - Jotaish',
  description: 'How Jotaish collects, uses and protects your information.',
};

const BODY = `
Jotaish ("we", "us") offers astrology and related readings at **jotaish.online**. This policy explains what information we collect, why, and the choices you have. If you have any questions, write to **jotaish.astrologer@gmail.com**.

## Information we collect

**Information you give us**

- **Account details:** your name and email address. You sign in with a one-time code we email you; we keep only a scrambled (hashed) form of each code, and it stops working after a few minutes.
- **Birth details:** the name, date, time and place of birth you enter for yourself and for anyone else you add, such as a partner or family member. Please add other people's details only with their permission.
- **What you ask for:** your messages to our astrologer, tarot questions, dream descriptions and the photos of your palm you upload.
- **Payments:** the amount and number of credits you request, and the screenshot of your UPI payment that you upload. We do not receive or store your bank account, card or UPI PIN details; the payment itself happens in your own UPI app.

**Information created as you use Jotaish**

- The readings, charts and reports prepared for you.
- Your credit balance and a record of how much of your allowance you have used.
- Basic technical information needed to run the service, such as when you last signed in.

## How we use your information

- To calculate your charts and prepare the readings you ask for.
- To keep your readings and conversations in your account so you can return to them.
- To email you things you would expect: your email confirmation code, a copy of each new reading (as a PDF), and updates about your payments.
- To check payments and add credits to your account.
- To occasionally send you news or offers about Jotaish. You can ask us to stop at any time.
- To keep the service safe, prevent misuse and meet our legal obligations.

We do **not** sell your personal information, and we do not use it for advertising.

## How readings are prepared

Our astrologer, Jotaish, is an automated assistant. Planetary positions, cards and numbers are calculated by our own software. The written interpretation is produced by language models that we access through **OpenRouter**, which passes the request to the model provider we have chosen (for example Anthropic, OpenAI or Google). To prepare a reading, we send them the information that reading needs: for example your birth details and chart, your question, a dream description, or a palm photo. We only send your email address where it is part of what you wrote. These providers process the information to return the reading under their own terms and privacy policies.

## Who can see your information

- **You**, when signed in to your account.
- **The Jotaish team**, through an admin console, to support you, review payments, prevent misuse and improve the service.
- **Service providers** who help us run Jotaish: our hosting provider (DigitalOcean), the AI providers described above, and our email provider (Google Gmail) to deliver our emails. Birthplaces are looked up in our own copy of the GeoNames place list, so the places you type are not sent to anyone else.
- **Authorities**, if we are required to by law.

## Google user data

Jotaish connects to Google only for its own Gmail account (**jotaish.astrologer@gmail.com**), with permission to *send* email. We use this solely to send the emails described above. We do not read, store or use the contents of any Gmail inbox, and we do not ask our customers to connect their Google accounts. Our use of information received from Google APIs follows the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

## How long we keep information

We keep your account, readings and conversations while your account is open, so you can come back to them. Payment records are kept as long as we need them for accounting and legal purposes. When you ask us to delete your account, we delete your personal information within 30 days, except where we must keep some of it by law.

## Your choices and rights

You can:

- see and update your name and birth details in your profile;
- delete individual readings, conversations and birth profiles in the app;
- ask us for a copy of your information, to correct it, or to delete your account, by writing to **jotaish.astrologer@gmail.com**;
- withdraw your consent to optional emails at any time.

If you are in India, you have rights under the Digital Personal Data Protection Act, 2023, including the right to access, correct and erase your data and to raise a grievance with us. If you are not satisfied with our response, you may approach the Data Protection Board of India.

## Security

We use encrypted connections (HTTPS), store sign-in codes only in hashed form and let each one work just once for a few minutes, keep sensitive settings encrypted, and limit admin access to our team. No system is perfectly secure, so please keep access to your email account safe and never share a sign-in code.

## Children

Jotaish is meant for people aged 18 and over. We do not knowingly collect information from children. If you believe a child has created an account, please contact us and we will delete it.

## Changes to this policy

We may update this policy as Jotaish changes. When we make important changes, we will update the date above and, where appropriate, let you know by email or in the app.

## Contact

Jotaish
Email: **jotaish.astrologer@gmail.com**
Website: https://www.jotaish.online
`;

export default function PrivacyPage() {
  return <LegalPage title="Privacy policy" updated="18 November 2026" body={BODY} />;
}
