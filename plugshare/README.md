# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Sarvam AI

All Sarvam requests run in the authenticated `sarvam-assistant` Supabase Edge Function. Keep `SARVAM_API_KEY` in Supabase Function secrets; never add it to a `VITE_` variable or frontend code. From this `plugshare` directory, run:

```sh
supabase login
supabase link --project-ref <your-project-ref>
supabase secrets set SARVAM_API_KEY=<your-sarvam-api-key>
supabase functions deploy sarvam-assistant --no-verify-jwt
```

The function disables gateway JWT verification so the browser can establish its live-transcription WebSocket. The function itself validates the signed-in user's access token for both WebSocket and HTTP requests. Do not remove that in-function authentication. The existing frontend also requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in its local environment. Voice features require browser microphone permission and localhost or HTTPS.

### Test the implemented features

1. **Voice/text charger search:** Deploy the updated function, sign in, and open **Find a charger**. Speak in English, Kannada, or Hindi and confirm the transcript appears while speaking; stop to parse it. Type a request as an alternative. Inspect/edit the detected filters and confirm connector, minimum power, location, and maximum price narrow the list. A detected date/time pre-fills the booking time; the database checks the actual slot conflict when a booking is sent. The current project has no separate Quick Search page.
2. **Bill explanation and audio:** Open a completed charging session as its owner. Select English, Kannada, or Hindi, choose **Explain this bill**, then **Listen**. The project does not currently store a platform fee, so the explanation says it is not provided rather than assuming an amount.
3. **Dispute summary:** Skipped by request. There is no dispute page/table or admin-role model in this project.
4. **Help chatbot:** Sign in and choose **Help & support** from the home page. Ask about booking, billing, or payment in English, Kannada, or Hindi; out-of-scope topics should be redirected to ChargeMitra support.

Sarvam API availability and a configured secret are required for AI actions. If those actions fail, ordinary page navigation, charger booking, bill details, and the static help answers remain available.
