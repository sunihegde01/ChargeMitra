# ChargeMitra Design System

This document describes the visual system for the existing ChargeMitra React application. Treat the current routes and components as the source of truth; extend them rather than creating duplicate pages or replacing working flows.

## Brand

- Product name in user-facing UI: **ChargeMitra**.
- The identity should feel trustworthy, accessible, community-led, and focused on electric mobility.
- Keep existing backend identifiers, repository names, and environment variable names unchanged when they are not user-facing.
- Preserve the established green-and-neutral direction. The palette below is the preferred token set; existing pages may still contain legacy Emerald utility classes and should be migrated only when those pages are otherwise being changed.

## Color palette

| Token | Hex | Use |
| --- | --- | --- |
| Deep Forest | `#173B32` | Primary actions, key headings, focus accents |
| Electric Lime | `#C7F36B` | Small highlights and selected accents |
| Warm Ivory | `#F5F3EB` | Page backgrounds and quiet surfaces |
| White | `#FFFFFF` | Form and content surfaces |
| Graphite | `#202923` | Main text |
| Sage Grey | `#DCE4DA` | Borders and secondary surfaces |

Use semantic status colors sparingly: green for success, amber for caution or pending states, red for errors, and blue only for distinct informational states. Do not rely on color alone to communicate status.

## Typography

- Headings: Space Grotesk, with a sans-serif fallback.
- Body, labels, and controls: DM Sans, with a sans-serif fallback.
- Keep heading hierarchy concise and readable; body copy should favor comfortable line height.
- Fonts are loaded as progressive enhancement; fallback fonts must remain usable if the font service is unavailable.

## Spacing and layout

- Use Tailwind's 4px-based spacing scale consistently.
- Center content in a readable max-width container. Wide data/map screens may use a wider container than forms.
- Use responsive grids only when the content benefits from side-by-side comparison; stack form fields on small screens.
- Prefer whitespace and alignment over nested cards. Use rounded surfaces for distinct tasks, not as a wrapper around every paragraph.
- Keep mobile layouts free of horizontal overflow; buttons and map controls should be comfortably touchable.

## Components

### Buttons and links

- Reuse `plugshare/src/components/Button.tsx` (`Button` and `LinkButton`).
- Primary buttons use Deep Forest and high-contrast text. Secondary buttons use a white surface and Sage Grey border.
- Keep visible hover, focus, active, and disabled states. Links that navigate should remain links; actions should remain buttons.
- Aim for a 44px minimum interactive height.

### Forms

- Use a visible label for every input; placeholders are supplementary, not labels.
- Use `.cm-field` for standard form controls. Keep validation messages adjacent to the relevant form and use `role="alert"` for actionable errors.
- Preserve native input types, autocomplete, required constraints, and existing Zod/database validation.

### Surfaces, tables, dialogs, and statuses

- Use a small set of surface treatments: page background, plain content, bordered panel, and emphasized summary.
- Tables should retain readable headers and have a narrow-screen strategy (scroll container or stacked rows).
- Dialogs must keep keyboard focus usable and fit within the viewport.
- Status indicators need clear text and accessible contrast.

### Navigation

- Keep the current React Router routes and make active context obvious.
- Public navigation should remain compact and responsive. Authenticated pages should provide a clear return path to the relevant dashboard.
- Do not add a second navigation system when an existing route or component already provides the needed path.

## Motion

- Prefer the shared 280ms page entrance and short interaction transitions already defined in `plugshare/src/index.css`.
- Respect `prefers-reduced-motion`; do not add continuous or decorative movement.
- Never fake charger progress, vehicle telemetry, booking results, billing, or payment status.
- Reuse an existing animation dependency if one is introduced intentionally; do not install one for simple transitions.

## Responsive breakpoints

Use the existing Tailwind breakpoints:

- Base: small phones, from 320px.
- `sm`: 640px.
- `md`: 768px.
- `lg`: 1024px.
- `xl`: 1280px.

Check navigation, form actions, maps, error messages, cards, and data-heavy sections at mobile, tablet, and desktop widths.

## Accessibility

- Use semantic headings, landmarks, labels, fieldsets, and buttons.
- Preserve keyboard operation and a visible focus ring.
- Give non-decorative images and map controls meaningful accessible names.
- Use status/live regions for asynchronous results and loading feedback.
- Maintain sufficient text contrast and do not communicate state by color alone.
- Honor reduced-motion preferences.

## Loading, empty, and error states

- Keep loading states near the content that is loading and prevent duplicate submissions where appropriate.
- Empty states should explain what is missing and offer a real next action when one exists.
- Errors must identify the failed action and preserve user-entered data where possible.
- Do not show success-shaped fallbacks when a Supabase, map, payment, or geocoding operation fails.

## Existing page patterns

The current frontend routes are:

- Public: `/`, `/login`, `/register`.
- Account selection: `/account-type`.
- Owner: `/owner/dashboard`, `/owner/find`.
- Provider: `/provider/dashboard`, `/provider/chargers/new`, `/host/onboarding`.
- Shared session: `/session/:id`.

Use the existing page's purpose when choosing its layout:

- Landing: editorial hero, short explainer, host call-to-action.
- Login/register: focused, centered form surface.
- Dashboards: clear summary and task sections with responsive stacking.
- Charger discovery: map-first workspace with synchronized selection and search/filter controls.
- Onboarding: one readable form flow with validation and clear progress/results.
- Session: prominent status and billing/action summaries, with secondary event history.

Do not create pages for planned features until their functionality and route are part of the current application.

## Engineering boundaries

- Preserve Supabase queries, authentication, RLS assumptions, map behavior, booking/session/payment logic, and existing error handling while making visual changes.
- Do not expose secrets or place them in `VITE_` variables.
- Treat private-home exact addresses and entry instructions as sensitive; never render them in public discovery results.
- Test `npm run build` and `npm run lint` after UI changes. Test protected flows only with authorized test accounts; do not claim external integrations were verified without credentials.
