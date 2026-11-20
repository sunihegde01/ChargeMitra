# ChargeMitra project overview

This document describes the **current implementation** in this repository. It is not a claim that every feature from the wider product plan is built. The workspace was last confirmed on `main` at `75b6bf8b`; verify the live tree before relying on that revision.

## Product

ChargeMitra connects EV drivers with charging hosts. A person can be an EV user, a host, or both. Host listings currently support three business types:

- `HOTEL`
- `PUBLIC_PARKING`
- `PRIVATE_HOME`

The current frontend is a working foundation for onboarding, charger discovery, booking requests, charging sessions, and payments. Admin, social/community, and several of the larger planned workflows are not currently implemented.

## Repository layout

- `plugshare/` — React application, Vite configuration, frontend source, and Supabase project files.
- `plugshare/src/App.tsx` — route definitions and session-only protected-route wrapper.
- `plugshare/src/context/AuthContext.tsx` — Supabase auth session restoration and sign-out.
- `plugshare/src/pages/` — public, owner, provider, and shared session pages.
- `plugshare/src/components/` — maps, search, and shared UI components.
- `plugshare/src/location.ts` and `plugshare/src/mapStyle.ts` — point parsing, address lookup, approximate home locations, and map style.
- `plugshare/supabase/migrations/` — checked-in incremental SQL migrations.
- `plugshare/supabase-fix.sql` — older/manual schema and RPC setup used by the app; it is not a clean-database migration history.
- `plugshare/supabase/functions/` — Edge Function source for payments and Sarvam integrations.
- `CHARGEMITRA_DESIGN_SYSTEM.md` — visual conventions and UI accessibility guidance.
- `AGENTS.md` — repository-specific implementation rules.

The root `supabase/` directory contains local CLI state; do not treat it as application source or inspect its linked-project metadata when documenting or editing the project.

## Stack and development conventions

- React 19, TypeScript, Vite 8, and Tailwind CSS 4.
- React Router 7 for client-side routing.
- Supabase Auth, Postgres, PostGIS, RLS, and Edge Functions for backend services.
- MapLibre GL JS through `react-map-gl` for maps; current tiles use OpenStreetMap raster tiles.
- Lucide React for icons.
- Razorpay Checkout for the current online-payment integration.

The repository has a root `package.json` with `npm run dev` delegated to `plugshare/`. Build and lint scripts are in `plugshare/package.json`. React Hook Form, Zod, date-fns, and Recharts are declared at the repository root, but no current frontend source imports were found during this review. `motion` is declared in the app package but is not currently imported by the app source. Do not assume a declared dependency represents an implemented feature.

## Current routes

| Route | Access | Current page |
| --- | --- | --- |
| `/` | Public | Landing page |
| `/login` | Public | Sign in |
| `/register` | Public | Registration |
| `/account-type` | Authenticated | Choose EV-user or host use; host choice leads to business type |
| `/owner/dashboard` | Authenticated | Vehicles, bookings, and accepted private-home access details |
| `/owner/find` | Authenticated | Charger search, map/list, and booking request |
| `/owner/payments` | Authenticated | Completed-session payment history |
| `/provider/dashboard` | Authenticated | Host profile, chargers, booking requests, and session links |
| `/host/onboarding` | Authenticated | Hotel, Public Parking, or Private Home onboarding |
| `/provider/chargers/new` | Authenticated | Add a charger |
| `/session/:id` | Authenticated | Charging-session controls, bill, and payment |

`ProtectedRoute` checks whether a Supabase session exists; it does not itself enforce an owner/provider/admin role. Data authorization must continue to be enforced by Supabase RLS and backend functions. Unknown routes redirect to `/`.

There are no current Admin routes, provider-details route, notifications/reviews pages, or dedicated Support route.

## Implemented user flows

### Accounts and host onboarding

- Profiles use `EV_OWNER`, `PROVIDER`, and `BOTH` roles.
- An authenticated user can select EV-user use or enter host onboarding.
- Hosts select Hotel, Public Parking Spot, or Private Home.
- Hotel and parking forms collect business/contact/location and type-specific details.
- Private Home onboarding collects home/parking details, society permission where applicable, verification references, availability, and entry instructions.
- Map selection and browser geolocation can populate coordinates; reverse address lookup uses Photon.
- Charger records include charging type, power, connector, price, bay label, cable details, meter capability, and photo URL fields.

### Charger search and booking

- Search displays active chargers on a MapLibre map with a result list and business-type filters.
- It supports user-selected/current locations, connector and minimum-power filtering, date/time and maximum-price filters from the search assistant, vehicle compatibility context, and driving-distance lookup.
- Road-distance requests use the public OSRM table endpoint.
- An owner can request a scheduled booking. The current UI writes a `PENDING` booking with `PAY_AT_STATION`; the host manually accepts or declines it.
- The current search assistant also accepts natural-language and voice queries through Sarvam (see the repository-state note below).

### Host management

- The provider dashboard loads a host's chargers and booking requests.
- Hosts select a charging calculation method when accepting a booking.
- Private Home bookings default the UI's method selection to `TIME_BASED`.
- The host can add chargers and access linked sessions.

### Sessions, bills, and payments

- Sessions support meter-based (`METER_BASED`) and time-based (`TIME_BASED`) calculations.
- Session lifecycle operations use Supabase RPCs for starting, pausing, resuming, and stopping sessions; the timer records a session and does not control physical charging equipment.
- Session pages show the resulting bill and allow the owner to pay a stopped session through Razorpay Checkout.
- `razorpay-payment` creates orders and verifies payment signatures/captured amounts server-side. Payment status and Razorpay identifiers are stored on `charging_sessions`; the current history page reads those session records.
- The current payment integration is Razorpay, not the planned demo UPI/Card/Net Banking simulator.

## Data model and migrations

The app also depends on existing core tables such as `profiles`, `providers`, `chargers`, `vehicles`, `bookings`, and `charging_sessions`. The checked-in migration files are incremental additions to that schema:

1. `20261110000000_razorpay_payments.sql` — Razorpay payment fields and status constraint on charging sessions.
2. `20261120000000_host_onboarding.sql` — Hotel/Public Parking types and detail tables, charger metadata, PostGIS locations/indexes, validation, and RLS.
3. `20261120000001_private_home_business_type.sql` — adds the `PRIVATE_HOME` provider business type.
4. `20261120000002_private_home_details.sql` — private-home detail and restricted access-detail tables, constraints, validation, and RLS.

Hotel and parking records are in `hotel_details` and `parking_details`. Home profile information is in `home_details`; exact address, exact geography, and entry instructions are separated into `home_access_details`. Public home discovery uses an approximate map point. The RLS policy is intended to let the host access those exact details and an owner access them after an accepted booking. Do not expose the exact home location or instructions through public search results.

`supabase-fix.sql` contains legacy core-schema setup and session RPCs, including meter/time start/stop and pause/resume operations. On a new database, confirm the required base schema and migration history before applying incremental migrations; do not blindly repair or rewrite remote migration history.

The production project was previously verified with the four migration versions above applied. Re-check the linked Supabase project before making further production database changes.

## External services and configuration

- The frontend reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Start from `.env.example`; never read, copy, or commit `.env.local` values or service-role credentials.
- Photon (`photon.komoot.io`) performs reverse geocoding.
- OpenStreetMap raster tiles and OSRM are used for mapping and road-distance features.
- Razorpay secrets belong in Supabase Edge Function secrets, not frontend environment variables. Setup instructions are in `plugshare/README.md`.
- Sarvam integration needs its Edge Function sources and associated server-side configuration/secrets to be deployed and available. Do not assume that source presence proves production deployment.

## Known gaps and important caveats

- `host_approval_required` is saved for Private Home profiles, but the current booking path still requires manual host acceptance; that setting does not currently change booking behavior.
- Role-aware route guards and Admin tooling are not implemented.
- Quick Search's atomic “first valid host wins” flow is not implemented.
- The broader plan's booking batches, charger-availability conflict management, notifications, reviews, verification review, bill versions, two-party bill approval/disputes, and analytics are not represented by current routes and flows.
- Optional host verification fields currently collect reference/text values; there is no complete document-upload and verification-review workflow.
- The current booking uses pay-at-station, while stopped-session online payment uses Razorpay. Parking fees are informational in the host data and are not part of the current energy-bill calculation.
- There is no automated test script in the package manifests. The app build performs TypeScript project checks and a Vite production build; Oxlint is the available lint command.

### Sarvam and voice state

Earlier project instructions requested removal of Sarvam AI and voice features. The currently synced repository nevertheless contains `SarvamSearch`, voice search in charger discovery, Sarvam bill explanation/audio in the session page, and the `sarvam-assistant` / `sarvam-transcribe` Edge Function source folders. This overview records the checked-in state; confirm the desired product behavior before removing or restoring these features.

## Local development

1. Copy `.env.example` to `.env.local` at the repository root and set the Supabase URL and anon key.
2. From the repository root, run `npm run dev`.
3. From `plugshare/`, run `npm run build` or `npm run lint`.
4. For database changes, inspect the target project's migration history and review the SQL before running Supabase CLI commands.

The current package manifests do not define a test command.

## Guidance for future AI contributors

- Treat checked-in code, routes, migrations, and the current database as the source of truth; distinguish implemented behavior from requested roadmap.
- Read `AGENTS.md` and `CHARGEMITRA_DESIGN_SYSTEM.md` before UI changes.
- Preserve existing auth, RLS assumptions, location privacy, server-side payment verification, and the separate private-home access data.
- Inspect nearby components before adding UI. The reusable `src/components/ui/` exports are used by several current pages, while Login and Register still use the older `src/components/Button.tsx`.
- Keep changes surgical, validate with the smallest relevant build/lint command, and report any validation limitations.
