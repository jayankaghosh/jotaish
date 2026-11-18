# Jotaish

A personal astrology service: Vedic Kundli, horoscopes, compatibility, tarot, numerology, palm reading and dream interpretation, with a conversational astrologer ("Jotaish") who guides people step by step. Every reading is saved to the person's profile, and admins can see all users, conversations and readings.

## Stack

| Part | Tech |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS 4 |
| Backend | Node.js, GraphQL Yoga, Prisma |
| Database | PostgreSQL 17 (Docker) |
| Language models | OpenRouter, one model per task, chosen in the admin console under Settings |
| Astronomy | `astronomy-engine` for planetary positions, our own copy of GeoNames for birthplaces |

```
apps/
  api/   GraphQL server (port 4000)
    src/astro/      ephemeris, Vedic chart, tarot deck, numerology, geocoding
    src/ai/         OpenRouter client, prompts, model settings, astrologer agent
    src/services/   reading and profile logic shared by forms and the agent
    src/graphql/    schema and resolvers
  web/   Next.js app (port 3000)
```

## How readings work

1. The numbers are computed, not generated. Planet positions come from the ephemeris (sidereal, Lahiri ayanamsa, whole sign houses), with Vimshottari dashas, Manglik, Gajakesari, Kaal Sarp, Budhaditya and Sade Sati checks. Tarot cards are drawn with a cryptographic shuffle. Numerology uses Pythagorean, Chaldean and Indian Mulank/Bhagyank methods.
2. The computed data goes to the model configured for that task, which writes the report.
3. The reading is stored with its input, computed data, text and the model that wrote it.

The astrologer chat uses tool calling: Jotaish can save birth details, prepare a Kundli, horoscope, matching, tarot, numerology, palm or dream reading, and open past readings. Each tool result is saved as a reading and appears in the chat as a card.

Replies stream word by word through the `chat` GraphQL subscription (server-sent events). While a tool runs, the stream sends a status line such as "Preparing your Kundli…". The reply keeps running and is saved even if the person closes the page mid-answer. The `sendMessage` mutation still exists for clients that don't stream.

## Languages

The customer site works in English (default), Hindi, Malayalam, Kannada and Bengali. People choose a language from the header (also before signing up) or their profile, and it is saved to their account. In that language they get the whole site including astrology terms (signs, planets, nakshatras, yogas, tarot cards), Jotaish's replies, every reading, emails and the attached PDFs (with fonts for each script). The admin console, the privacy policy and the terms stay in English.

- Website text: `apps/web/lib/locales/en.ts` (and `terms-en.ts` for astrology terms) with one file per language next to it.
- Server text (errors, emails, PDF labels, reading titles): written in English in the code and translated through `apps/api/src/i18n/<lang>.json`, keyed by the English sentence.
- After changing or adding text, run `node scripts/extract-server-strings.mjs` to refresh the server list, then `node scripts/check-translations.mjs` to see anything missing or with broken `{placeholders}`. Missing translations fall back to English.

## Tarot card images

`apps/web/public/tarot` holds the 78 cards of the original 1909 Rider-Waite-Smith deck illustrated by Pamela Colman Smith, which is in the public domain (scans from Wikimedia Commons). Later recoloured editions are still under copyright, so only replace them with other 1909 scans.

## Charts by region

Kundli charts can be drawn in the North Indian (diamond), South Indian (fixed signs, Pisces at top left) or East Indian (fixed signs, Aries at top centre, anticlockwise) style. The Kundli and horoscope forms ask which tradition the person follows, guessing first from their language; the calculation is the same, but the report uses that region's terms, customs and remedies, and the chart style can be switched on any Kundli page.

## Android app

`android/` wraps the site as a Google Play app (a Trusted Web Activity). See [android/README.md](android/README.md) for building, signing and the `ANDROID_CERT_FINGERPRINTS` setting the site needs.

## Logo and icons

Colours, type, shapes and voice come from the logo and are written up in [docs/brand.md](docs/brand.md). The logo mark lives in `apps/web/public/brand/mark.svg`. Favicons, home-screen icons and the PNG used in emails and PDFs are made from it; after changing the mark, run `node scripts/brand-icons.mjs`.

## Run it locally

Requirements: Node 20+, Docker.

```bash
npm install
npm run db:up
cp apps/api/.env.example apps/api/.env      # then set APP_SECRET and ADMIN_PASSWORD
cp apps/web/.env.example apps/web/.env.local
npm run db:migrate
npm run db:seed
npm run places:import -w apps/api
```

`places:import` loads the birthplace list (every town and village in India, and towns of 1,000+ people elsewhere) from [GeoNames](https://www.geonames.org) into the database. It takes about a minute and can be run again at any time to refresh the list. The data is CC BY 4.0, so the site footer credits GeoNames.

Start both servers in separate terminals:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Open the admin console at http://localhost:3000/admin/login, sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `apps/api/.env`, go to **Settings** and paste an OpenRouter API key. Readings work once the key is saved. The customer site is at http://localhost:3000.

## Updating the server

On the server, from the project folder:

```bash
npm run deploy
```

It pulls `main`, installs packages, applies database migrations (`prisma migrate deploy`, never `migrate dev`, which is for development only), builds the website and restarts the PM2 apps that run from this folder. Add `-- --places` to reload the birthplace list too, which is only needed when `apps/api/prisma/places.ts` changes.

## Admin console

The console lives at `/admin` with its own sign-in page and header. Nothing in the customer site links to it, and customers never see model names, provider errors or admin wording; technical failure details are recorded for the console only.


- **Overview**: users, readings by type, AI calls, token use and cost per model, recent calls with errors.
- **Users**: search, open a user to see their birth details, every reading and every conversation (including which tools the astrologer called and which models answered). Promote to admin or disable an account.
- **Users > a user**: block or unblock the account (blocked users are signed out and can't sign in), and set their AI allowance: the default, a custom number of credits, or unlimited. **Where credits went** lists every AI call made for them over the last day to 90 days, grouped into what they did (each reading, each stretch of chat) with its language, models, tokens and credits, plus totals by kind of work and by language.
- **AI allowance**: every user gets a default number of credits per day, month or in total (set in Settings). Credits follow the real OpenRouter cost of each call made for that user (1 credit = $0.001), so heavier models and long reports use more. When a cost isn't reported it is estimated from the model's catalogue price. Customers only see the percentage of their allowance left; admins are never limited.
- **Selling credits**: in Settings, set a UPI ID, upload the QR code and fill the price table (₹ to credits). Customers buy on the Credits page in three steps: choose an amount (only whole multiples of a row, with the nearest valid amounts suggested), pay by UPI, then upload a screenshot. Bought credits are used after the free allowance and never expire.
- **Payments**: every screenshot waits in the Payments tab (with a count in the header). Approve to add the credits (the requested number or a different one), or reject with a reason. Customers see each screenshot they sent with its outcome: credits added, or the rejection reason. Each user's page also lets you give or remove credits by hand, with every change kept in a history.
- **Email**: in Settings, either connect a Gmail account through the Gmail API (sign in with Google; works over HTTPS, so it also works on hosts like DigitalOcean that block email ports) or enter SMTP details for any mail service, then send a test. Once set up, customers get every new reading as a PDF attachment and updates on their payments; admins get an alert for each new payment and when a customer's bought credits run out. The Emails page sends your own message to chosen users or everyone (`{name}` becomes their first name) and keeps a log of every email.
- **Sign-in codes**: customers have no password. They enter their email, get a 6-digit code, and enter it; a new address gets an account at that moment and is asked for a name. By default a code works for 5 minutes, a new one can be sent after 30 seconds, an address can ask for 5 codes an hour, and a code allows 5 wrong tries; all of these are in Settings. Email has to be set up for customers to sign in (in local development without email, the code is printed in the API log). Admins sign in to the console with their password.
- **Settings**: OpenRouter key (encrypted with AES-256-GCM using `APP_SECRET`), a model per task with live pricing from the OpenRouter catalogue (any task can use a different model for Hindi, Malayalam, Kannada and Bengali, since Claude models need about four times more tokens for Indian scripts than Gemini models), and a temperature control.

## Not built yet

- Paywall and payments (the app is free to use for now).
- Ashtakoota guna milan score for matching (matching compares the two charts directly).
