# ChargeMitra development instructions

Every new page, feature, component or frontend modification in ChargeMitra must follow `CHARGEMITRA_DESIGN_SYSTEM.md`.

Before developing a new feature, inspect the existing reusable components and styling conventions.

Reuse existing components whenever possible.

Do not introduce a new unrelated colour palette, font system, button style, card style or navigation pattern.

New pages must match the current ChargeMitra visual identity.

Preserve existing backend functionality and security.

Additional project rules:

- Treat the actual codebase and routes as the source of truth; do not assume planned pages exist.
- Make small, focused changes and preserve existing in-progress work.
- Do not create fake data or fake booking, charging, billing, or payment behavior to fill a visual gap.
- Keep user-facing branding as ChargeMitra. Do not rename backend identifiers or repository/package names without a separate requirement.
- Never inspect, print, or expose local environment secrets; do not add secrets to frontend code.
- Preserve authentication, Supabase queries, RLS assumptions, maps, and payment verification.
- Use semantic HTML, keyboard-accessible controls, visible focus, and reduced-motion support.
- Run the existing build and lint commands; report failures accurately instead of suppressing them.
