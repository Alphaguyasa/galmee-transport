# Galmee Transport

Know every evening how much each seller and each bus should have handed in.

Part of **Galmee**, business systems for Ethiopian businesses, by Alpha. Mobile-first PWA in Amharic, Afaan Oromo and English. Live at https://galmee-transport.vercel.app.

## What it does

- Departure board for any day, with seats sold and status from scheduled to arrived
- Ticket sale: choose a seat, take cash or mobile money, optional passenger phone. A seat cannot be sold twice; a voided ticket frees its seat
- Parcels: register, load on a bus, mark arrived and collected
- Cash handover: per seller and per bus, what should have been handed in against what was, with shortfalls in red and the word "short"
- Route report for the day: departures, seats sold, ticket and parcel money
- An SMS is queued when a ticket with a phone number is sold and when a parcel arrives

## Stack

Next.js (App Router), TypeScript, Tailwind, next-intl, Supabase (Postgres with row-level security per business), deployed on Vercel.

## Local setup

```sh
cp .env.example .env.local   # public Supabase URL and publishable key
npm install
npm run dev
```

## Environment variables

| Name | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | app | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | app | Publishable key only; the service-role key is never used here |

SMS and Telegram credentials live only in Supabase Edge Function secrets.

## Checks

```sh
npm run lint
npm test
npm run build
npm run screenshots   # with `npx next start -p 3123` running
```

Database changes live in `supabase/migrations/`. `supabase/tests/tr_rls_test.sql` is the cross-tenant test; it rolls itself back and reports through its final message.

## Deploy

The GitHub repository is linked to Vercel: every push to `main` deploys to production.

See `ROADMAP.md` for progress.
