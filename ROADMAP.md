# ROADMAP: Galmee Transport

## M0: Foundation (shared pattern for all Galmee products)

- [x] Next.js App Router + TS + Tailwind + shadcn/ui scaffold; `npm run build` passes
- [x] PWA manifest, icons, offline shell; installs from Android Chrome
- [x] Supabase client (`@supabase/ssr`) with `.env.example` values; middleware session refresh
- [x] Auth: sign up, log in, log out; after first signup call `create_tenant` (vertical `transport`)
- [x] next-intl with `am`, `om`, `en`; language switcher; Ethiopic-friendly font (Noto Sans Ethiopic)
- [x] Ethiopian calendar date display helper + tests
- [ ] App shell: bottom navigation on mobile, sidebar on desktop, tenant name and logo
- [ ] Staff management (owner only): invite staff, set role
- [ ] Generated Supabase TypeScript types committed

## M1: Core screens

- [ ] Customers: list, search by name/phone, detail with balance
- [ ] Items and stock (if this product uses stock): list, add, receive stock
- [ ] Payments and credit: record payment, credit statement
- [ ] Reports: today / this week / this Ethiopian month; export CSV
- [ ] Offline queue for the main money action with sync status indicator

## M2: Galmee Transport features

- [x] Ticket sale (route, departure, seat, passenger phone)
- [x] Departure board
- [x] Cash handover per seller and per vehicle
- [x] Parcel (cargo) register
- [x] Daily route report
- [x] Migration: tr_routes
- [x] Migration: tr_vehicles
- [x] Migration: tr_drivers
- [x] Migration: tr_departures
- [x] Migration: tr_tickets
- [x] Migration: tr_parcels
- [x] Migration: tr_cash_handovers
- [x] Unique (departure, seat) so a seat cannot be sold twice
- [x] End-of-day reconciliation: tickets sold vs cash handed over

## M3: Notifications

- [ ] SMS ticket to passenger
- [ ] SMS to parcel receiver on arrival
- [ ] Edge Function reads `notifications` queue and sends (needs AfroMessage/Telegram keys: ask in the decision log)

## M4: Demo ready

- [ ] Demo tenant "Galmee Transport Demo" with data: Routes from Shashamane to Hawassa, Addis Ababa, Arsi Negele, Dodola; 8 buses; a week of tickets
- [ ] Demo login documented in the decision log for Alpha (password set by Alpha, never committed)
- [ ] 5-minute demo path works on a phone in airplane mode for the main action
- [ ] Amharic and Afaan Oromo text reviewed list in the decision log for Alpha (native speaker)

## M5: Client ready

- [ ] Receipt printing (58/80 mm thermal) and Telegram receipt
- [ ] Data import from Excel/CSV
- [ ] Export all tenant data to Excel
- [ ] Error monitoring hook (Sentry, DSN via env)
- [x] README: setup, env vars, deploy steps

## Q: Quality and security baseline (do these inside M0 and M1, not after)

- [x] `docs/DESIGN.md` written per the frontend guidelines (palette, type with Ethiopic support, layout wireframes, reviewed against generic defaults)
- [x] Tailwind theme tokens and `next/font` fonts from DESIGN.md
- [x] `server-only` Data Access Layer in `src/server/dal/`; every Server Action validates with zod and re-checks auth + role
- [x] Security headers and CSP with nonce (the security guidelines section 5)
- [x] Cross-tenant RLS test extended to this product's tables and passing
- [x] Playwright screenshot script for 360 px and 1280 px
- [ ] `npm audit` clean, Dependabot active
- [ ] Self-audit (the security guidelines section 9) recorded in the dev log
