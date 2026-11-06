# ROADMAP: Galmee Transport

## M0: Foundation (shared pattern for all Galmee products)

- [ ] Next.js App Router + TS + Tailwind + shadcn/ui scaffold; `npm run build` passes
- [ ] PWA manifest, icons, offline shell; installs from Android Chrome
- [ ] Supabase client (`@supabase/ssr`) with `.env.example` values; middleware session refresh
- [ ] Auth: sign up, log in, log out; after first signup call `create_tenant` (vertical `transport`)
- [ ] next-intl with `am`, `om`, `en`; language switcher; Ethiopic-friendly font (Noto Sans Ethiopic)
- [ ] Ethiopian calendar date display helper + tests
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

- [ ] Ticket sale (route, departure, seat, passenger phone)
- [ ] Departure board
- [ ] Cash handover per seller and per vehicle
- [ ] Parcel (cargo) register
- [ ] Daily route report
- [ ] Migration: tr_routes
- [ ] Migration: tr_vehicles
- [ ] Migration: tr_drivers
- [ ] Migration: tr_departures
- [ ] Migration: tr_tickets
- [ ] Migration: tr_parcels
- [ ] Migration: tr_cash_handovers
- [ ] Unique (departure, seat) so a seat cannot be sold twice
- [ ] End-of-day reconciliation: tickets sold vs cash handed over

## M3: Notifications

- [ ] SMS ticket to passenger
- [ ] SMS to parcel receiver on arrival
- [ ] Edge Function reads `notifications` queue and sends (needs AfroMessage/Telegram keys: ask in NEEDS_APPROVAL.md)

## M4: Demo ready

- [ ] Demo tenant "Galmee Transport Demo" with data: Routes from Shashamane to Hawassa, Addis Ababa, Arsi Negele, Dodola; 8 buses; a week of tickets
- [ ] Demo login documented in NEEDS_APPROVAL.md for Alpha (password set by Alpha, never committed)
- [ ] 5-minute demo path works on a phone in airplane mode for the main action
- [ ] Amharic and Afaan Oromo text reviewed list in NEEDS_APPROVAL.md for Alpha (native speaker)

## M5: Client ready

- [ ] Receipt printing (58/80 mm thermal) and Telegram receipt
- [ ] Data import from Excel/CSV
- [ ] Export all tenant data to Excel
- [ ] Error monitoring hook (Sentry, DSN via env)
- [ ] README: setup, env vars, deploy steps
