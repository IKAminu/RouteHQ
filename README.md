# RouteHQ

RouteHQ is a travel-agency operations platform in product development. It brings enquiries, customer records, travel packages, bookings, travellers, payments, supplier obligations and document references into one workspace.

**Current release status: preview/demo only.** The public GitHub Pages deployment runs with bundled demonstration data. It is not an open-registration SaaS service and must not be used to store third-party agencies' customer information.

## Technology

- React 19 and TypeScript
- Vite 8 and Tailwind CSS 4
- React Router 7
- Supabase JS client and a separate RouteHQ multi-tenant PostgreSQL project
- GitHub Actions and GitHub Pages for preview deployment

## Run locally

1. Install Node.js 22 and pnpm 10.
2. Run `pnpm install --frozen-lockfile`.
3. Copy `.env.example` to `.env.local`.
4. Keep `VITE_USE_MOCK_DATA=true` for the safe demo.
5. Run `pnpm dev`.

Checks: `pnpm typecheck` and `pnpm build`.

## Demo and live data

- `VITE_USE_MOCK_DATA=true` loads bundled synthetic demonstration records. Changes exist only in browser memory and reset when the session reloads.
- `VITE_USE_MOCK_DATA=false` activates the RouteHQ authentication and onboarding gate. The new agency operational schema is not yet connected to the existing module store, so approved workspaces remain safely gated.
- Never put a Supabase secret/service-role key, payment secret, Meta token, or Google credential in a `VITE_*` variable. Browser variables are public.

## Preview deployment

The GitHub Pages workflow deploys the `main` branch when it is updated, or when the workflow is manually run. It always builds with `VITE_USE_MOCK_DATA=true`.

Preview: https://ikaminu.github.io/RouteHQ/

The preview is not a production tenant environment. A successful preview build does not certify the application for customer data.

## Productisation boundary

RouteHQ needs three distinct surfaces:

1. Marketing website: product explanation, features, plans, demo request, FAQs, support and legal pages.
2. Application: authenticated agency workspaces.
3. Platform operations: internal administration for tenant onboarding, subscriptions, support, usage, security events and billing reconciliation.

The existing Supabase project named `DandurguAgencyManager` is the original Dandurgu system. Its operational tables and authorised-account policies are Dandurgu-specific. They do not yet provide commercial multi-tenant isolation.

Before external agencies can store real records, RouteHQ needs a dedicated production host, completed operational adapter, team invitations, permission UI, transactional financial operations, private document access review, backups and cross-tenant tests. See [PRODUCT_READINESS.md](./PRODUCT_READINESS.md).

## Security

- Do not add real customer, lead, payment, passport, or supplier data to this public repository.
- Do not enable public signup against the legacy Dandurgu database.
- Do not relax existing Dandurgu Row Level Security policies to make the preview work.
- Keep document storage private. A URL in a record is not proof that its permissions are safe.
