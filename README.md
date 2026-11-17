# Jotaish

A personal astrology service: Vedic Kundli, horoscopes, compatibility, tarot, numerology, palm reading and dream interpretation, with a conversational astrologer ("Jyotaish") who guides people step by step. Every reading is saved to the person's profile, and admins can see all users, conversations and readings.

## Stack

| Part | Tech |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS 4 |
| Backend | Node.js, GraphQL Yoga, Prisma |
| Database | PostgreSQL 17 (Docker) |
| Language models | OpenRouter, one model per task, chosen in Admin > AI settings |
| Astronomy | `astronomy-engine` for planetary positions, Open-Meteo for place lookup |

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

The astrologer chat uses tool calling: Jyotaish can save birth details, prepare a Kundli, horoscope, matching, tarot, numerology, palm or dream reading, and open past readings. Each tool result is saved as a reading and appears in the chat as a card.

Replies stream word by word through the `chat` GraphQL subscription (server-sent events). While a tool runs, the stream sends a status line such as "Preparing your Kundli…". The reply keeps running and is saved even if the person closes the page mid-answer. The `sendMessage` mutation still exists for clients that don't stream.

## Run it locally

Requirements: Node 20+, Docker.

```bash
npm install
npm run db:up
cp apps/api/.env.example apps/api/.env      # then set APP_SECRET and ADMIN_PASSWORD
cp apps/web/.env.example apps/web/.env.local
npm run db:migrate
npm run db:seed
```

Start both servers in separate terminals:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Open the admin console at http://localhost:3000/admin/login, sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `apps/api/.env`, go to **AI settings** and paste an OpenRouter API key. Readings work once the key is saved. The customer site is at http://localhost:3000.

## Admin console

The console lives at `/admin` with its own sign-in page and header. Nothing in the customer site links to it, and customers never see model names, provider errors or admin wording; technical failure details are recorded for the console only.


- **Overview**: users, readings by type, AI calls, token use and cost per model, recent calls with errors.
- **Users**: search, open a user to see their birth details, every reading and every conversation (including which tools the astrologer called and which models answered). Promote to admin or disable an account.
- **AI settings**: OpenRouter key (encrypted with AES-256-GCM using `APP_SECRET`), a model per task with live pricing from the OpenRouter catalogue, and a temperature control.

## Not built yet

- Paywall and payments (the app is free to use for now).
- Ashtakoota guna milan score for matching (matching compares the two charts directly).
- Password reset by email.
