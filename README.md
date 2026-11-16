# RouteHQ

RouteHQ is a travel-agency operations platform in product development. It brings enquiries, customer records, travel packages, bookings, travellers, payments, supplier obligations and document references into one workspace.

**Current release status: preview/demo only.** The public GitHub Pages deployment runs with bundled demonstration data. It is not an open-registration SaaS service and must not be used to store third-party agencies' customer information.

## Technology

- React 19 and TypeScript
- Vite 8 and Tailwind CSS 4
- React Router 7
- Supabase JS client (the existing live connection belongs to the original Dandurgu deployment)
- GitHub Actions and GitHub Pages for preview deployment

## Run locally

1. Install Node.js 22 and pnpm 10.
2. Run `pnpm install`.
3. Copy `.env.example` to `.env.local`.
4. Set `VITE_USE_MOCK_DATA=true` for the safe demo.
5. Run `pnpm dev`.

Checks: `pnpm typecheck` and `pnpm build`.

## Demo and live data

- `VITE_USE_MOCK_DATA=true` loads bundled demonstration records. Changes exist only in browser memory and reset when the session reloads.
- `VITE_USE_MOCK_DATA=false` activates the legacy Dandurgu Supabase access path. Do not use that path for RouteHQ customer tenants.
- Never put a Supabase secret/service-role key, payment secret, Meta token, or Google credential in a `VITE_*` variable. Browser variables are public.

## Preview deployment

The `.github/workflows/deploy-pages.yml` workflow deploys automatically when the application branch or the deployment workflow on `main` changes. The project preview is:

https://ikaminu.github.io/RouteHQ/

The workflow runs TypeScript checks and a production build before publishing. A failed build does not replace the last successful deployment.

## Themes

Light mode and Night mode are available in Settings. The selected appearance is stored locally in the browser and is not an agency-wide setting.

## Productisation boundary

This repository is the product preview, not yet the complete commercial SaaS platform. The existing Supabase project is named `DandurguAgencyManager`, contains Dandurgu's operational tables, and has Dandurgu-specific authorised-account policies. Those tables do not yet have agency/tenant ownership columns.

Before external agencies can register or store real records, RouteHQ needs a separate production backend and a reviewed tenant model. See [PRODUCT_READINESS.md](./PRODUCT_READINESS.md).

## Security

- Do not add real customer, lead, payment, passport, or supplier data to this public repository.
- Do not enable public signup against the legacy Dandurgu database.
- Do not relax existing Dandurgu Row Level Security policies to make the preview work.
- Keep document storage private. A URL in a record is not proof that its permissions are safe.
