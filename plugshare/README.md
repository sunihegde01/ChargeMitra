# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

## Host onboarding database setup

After linking the Supabase project, apply the host onboarding migration from this directory:

```sh
npx supabase db push
```

The migrations add Hotel, Public Parking, and Private Home business types and onboarding tables, charger bay/photo fields, geographic indexes, and row-level security policies. Private-home listings expose only an approximate map point and area; exact address and entry instructions are stored separately and are available only to the host and owners with an accepted booking. Existing host profiles can complete onboarding from account selection to set their business type and details.

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

## Razorpay final-bill payments

The owner can pay a completed session's database-calculated final amount from its bill review. Razorpay orders are created by the `razorpay-payment` Supabase Edge Function; the function verifies the Checkout signature and confirms the captured amount before marking the session paid. Keep the Razorpay key secret and webhook secret in Supabase Function secrets, never in frontend environment variables.

### One-time setup

1. In the Razorpay Dashboard, enable **Test Mode** and create API keys. Keep the Key ID and Key Secret private.
2. In the Supabase Dashboard, open **SQL Editor**, run `supabase/migrations/20261110000000_razorpay_payments.sql`, and confirm it completes successfully.
3. Install the Supabase CLI if needed, then from this `plugshare` directory log in and link the existing Supabase project:

   ```sh
   supabase login
   supabase link --project-ref <your-project-ref>
   ```

4. Save the Razorpay credentials as Edge Function secrets and deploy the function:

   ```sh
   supabase secrets set RAZORPAY_KEY_ID=<test-key-id> RAZORPAY_KEY_SECRET=<test-key-secret>
   supabase functions deploy razorpay-payment
   ```

5. In Razorpay Dashboard **Webhooks**, add this endpoint:

   ```text
   https://<your-project-ref>.supabase.co/functions/v1/razorpay-payment
   ```

   Subscribe to `payment.captured`. Set a strong webhook secret in Razorpay, then save the exact same value in Supabase:

   ```sh
   supabase secrets set RAZORPAY_WEBHOOK_SECRET=<the-webhook-secret>
   ```

6. Confirm the frontend `.env.local` contains the Supabase project URL and publishable/anon key, restart Vite, sign in as the booking owner, and use **Pay securely with Razorpay** on a stopped session with a final amount. Complete a Test Mode payment and confirm the bill shows **Paid with Razorpay**.
7. Before launch, configure live-mode Razorpay API keys and a live webhook separately. Never use a Razorpay Key Secret or Supabase service-role key in a `VITE_` variable or browser code.

The Supabase CLI and Razorpay Dashboard are external account tools; run these setup commands and dashboard steps yourself. Razorpay live payments require the merchant account to be activated by Razorpay.
