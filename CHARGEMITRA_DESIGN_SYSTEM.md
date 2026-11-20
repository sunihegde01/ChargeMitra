# ChargeMitra Design System

This document records the visual conventions used by the current ChargeMitra frontend. The existing React routes and components are the source of truth; extend them rather than rebuilding the app around a predetermined page list.

## Brand

- Product name: **ChargeMitra**. Use this spelling in visible UI, page titles, and new documentation.
- Brand character: dependable, welcoming, accessible, community-led electric mobility.
- Keep existing project, package, database, and backend identifiers unchanged unless a separate task specifically requires otherwise.
- Preserve the current light, nature-inspired ChargeMitra treatment. Do not introduce the alternate palette as an uncoordinated second theme.

## Color palette

The ChargeMitra palette is defined centrally in the Tailwind v4 `@theme` block in `plugshare/src/index.css`. Use these semantic tokens rather than adding page-specific colors.

| Purpose | Value |
| --- | --- |
| `--color-brand` | `#173B32` — deep forest |
| `--color-brand-hover` | `#1F4D41` |
| `--color-accent` | `#C7F36B` — electric lime, for selected states and key highlights |
| `--color-accent-hover` | `#B8E55A` |
| `--color-bg` | `#F5F3EB` — warm ivory |
| `--color-surface` | `#FFFFFF` |
| `--color-surface-muted` | `#DCE4DA` — sage grey |
| `--color-text` | `#202923` |
| `--color-text-muted` | `#5A6B5F` |
| `--color-border` | `#E4E7DF` |
| `--color-focus` | `#173B32` |
| `--color-success` | `#4F7A5C` |
| `--color-warning` | `#B8832E` |
| `--color-error` | `#A8473C` |
| `--color-disabled-bg` | `#EDEEE8` |
| `--color-disabled-text` | `#9AA69B` |
| `--radius-card` / `--radius-btn` / `--radius-input` | `16px` / `10px` / `10px` |

Use semantic status colors (success, warning, error) only to communicate status. Maintain readable contrast and do not use color as the only status cue.

## Typography

- Display headings use `--font-display`: `"Space Grotesk", ui-sans-serif, system-ui, sans-serif` (weights 500, 600, and 700).
- Body and interface text use `--font-body`: `"DM Sans", ui-sans-serif, system-ui, sans-serif` (weights 400, 500, 600, and 700).
- Both families are loaded from Google Fonts using preconnect and stylesheet links in `plugshare/index.html`, with `display=swap`.
- Preserve the existing Tailwind type scale and page-specific hierarchy. Use concise headings, comfortable body line lengths, and readable supporting text.
- Keep the listed system font fallbacks so text remains readable if Google Fonts cannot be reached.

## Spacing and layout

- Use Tailwind's 4px spacing scale and existing utility conventions.
- Use a centered, purpose-appropriate content width (`max-w-*`), consistent page gutters, and clear separation between page header, primary content, and supporting content.
- Common page gutters are `px-6` on larger viewports and smaller gutters on narrow mobile screens.
- Prefer whitespace and subtle borders over repeated heavy shadows or identical card grids.
- Use cards when content is a distinct item or workflow surface, not as a wrapper for every section.

## Components

- **Buttons:** Primary actions use the brand token with clear hover/focus states and a rounded shape. Use the accent token selectively for highlights or selected states. Secondary actions use a light surface with a visible border token. Disabled controls must remain visibly disabled.
- **Forms:** Keep visible labels, associate controls with their labels, use full-width rounded inputs with a subtle border and clear focus state, and preserve native validation and autocomplete where present.
- **Navigation:** Preserve the existing route structure and link destinations. Keep ChargeMitra branding visible and navigation usable by keyboard and touch.
- **Cards and panels:** Use white surfaces, slate-200 borders, generous but responsive padding, and restrained shadows. Maintain hierarchy inside the panel rather than nesting panels unnecessarily.
- **Tables and lists:** Keep labels and values scannable; allow layouts to adapt on mobile instead of clipping important content.
- **Dialogs:** Keep content within the viewport, provide an obvious close/escape path, preserve focus visibility, and avoid hiding primary actions below a mobile viewport.
- **Status and feedback:** Use the existing `role="alert"` and `role="status"` patterns for errors and operation feedback. Empty and loading states should explain the state and offer a next step when one exists.

Reuse existing components and established Tailwind patterns before creating a new component style.

## Animation

- Prefer brief, purposeful hover/focus transitions and subtle opacity or transform changes.
- The `motion` package is present in `plugshare/package.json`, but no current frontend source imports it. Prefer CSS transitions for ordinary interaction; use the existing package only when an interaction genuinely benefits from it.
- Do not add a new animation dependency for decorative effects.
- Never imply fake charger availability, booking progress, battery telemetry, or payment status.
- The global stylesheet respects `prefers-reduced-motion`; new motion must remain optional and non-blocking.

## Responsive breakpoints

Use Tailwind's default breakpoints unless an existing component has a documented reason to differ:

| Breakpoint | Minimum width |
| --- | --- |
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `2xl` | 1536px |

Design mobile-first. Keep forms and touch targets usable, avoid horizontal page overflow, and ensure maps, dense lists, and dialogs remain usable at narrow widths.

## Accessibility

- Use semantic headings, landmarks, labels, buttons, and links.
- Maintain visible keyboard focus; do not remove outlines without a replacement.
- Provide accessible names for icon-only controls and appropriate live regions for dynamic feedback.
- Preserve native form validation, keyboard navigation, and reduced-motion preferences.
- Keep text contrast readable and do not encode meaning only through color.

## Page patterns and implementation guardrails

- Follow the actual route and page structure in `plugshare/src/App.tsx`; do not create duplicate routes or pages for features that are not implemented.
- Keep public, authentication, owner, provider, charger discovery, and session/billing flows visually related while letting each page use a layout that suits its task.
- Preserve Supabase authentication and data access, MapLibre interactions, booking/session/payment flows, and authenticated Sarvam AI behavior during visual work.
- Do not substitute sample data, weaken authorization, expose secrets, or change backend business logic as part of a design-only change.
- Loading, empty, success, and error states must reflect real application state.
