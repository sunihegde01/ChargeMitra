# ChargeMitra

ChargeMitra is a community EV-charging marketplace where EV drivers can discover and request bookings at host locations. Current host types are **Hotel**, **Public Parking**, and **Private Home**.

The frontend is in [`plugshare/`](./plugshare/). The current app includes account and host onboarding, charger discovery, booking requests, charging-session tracking, and Razorpay payments. See the project overview for a clear distinction between implemented features and the wider roadmap.

## Run locally

1. Copy `.env.example` to `.env.local` and configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. From the repository root, run `npm run dev`.

Run `npm run build` or `npm run lint` from `plugshare/`. Never put Supabase service-role or payment secrets in frontend environment variables.

## Project documentation

- [Project overview](./PROJECT_OVERVIEW.md) — architecture, routes, data/privacy model, setup, and known gaps.
- [Design system](./CHARGEMITRA_DESIGN_SYSTEM.md) — visual and accessibility conventions.
- [Contributor instructions](./AGENTS.md) — implementation and repository rules.
