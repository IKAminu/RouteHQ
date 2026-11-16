# RouteHQ engineering guide

RouteHQ is a commercial travel-agency SaaS in product development. The public GitHub Pages deployment is a demonstration preview only. It must not be connected to customer production data.

## Canonical project structure

- `src/main.tsx` — browser entrypoint and stylesheet import.
- `src/app/` — application composition and route definitions.
- `src/auth/` — current preview authentication gate. The email allowlist is temporary and must not become the SaaS tenant authorisation model.
- `src/components/` — reusable interface components.
- `src/config/` — application configuration.
- `src/data/mockData.ts` — synthetic demonstration records only.
- `src/hooks/useAppStore.tsx` — current application state and workflow layer.
- `src/layouts/` — shared application shell.
- `src/lib/` — business calculations and current Supabase adapter.
- `src/pages/` — dashboard and operational modules.
- `src/services/` — service boundary.
- `src/theme/` — appearance preferences.
- `src/types/` — shared domain types.
- `supabase/migrations/` — versioned SQL migrations and migration notes.
- `.github/workflows/` — validation and preview deployment.

## Current stack

- Node.js 22, pnpm 10
- React 19, TypeScript, Vite 8
- Tailwind CSS 4, React Router 7
- Supabase JS client; PostgreSQL is the intended commercial database
- GitHub Actions; GitHub Pages is currently preview hosting

Useful commands:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm format
```

## Product and architecture boundaries

- Build a travel-agency operations product, not a generic CRM.
- Preserve useful workflows unless a documented product or technical reason requires changing them.
- The current demo mode uses synthetic in-memory records. Never add real customer, lead, traveller, passport, payment or supplier data to this public repository.
- The existing Supabase project is Dandurgu's system. Do not point RouteHQ commercial tenants at it, weaken its policies, or migrate its production data as part of routine development.
- RouteHQ commercial data requires a separate Supabase project and a reviewed multi-tenant schema.
- Every agency-owned record must be scoped to an agency and protected by database-enforced Row Level Security. Frontend filtering is never a security boundary.
- Never expose service-role keys, payment secrets, Meta tokens or other private credentials in browser code or `VITE_*` variables.
- Sensitive documents must use private storage and controlled, short-lived access. A URL stored in a row is not a security control.
- Financial changes must preserve an auditable transaction history. Prefer server-side database transactions for multi-record operations.
- Do not implement self-service signup, billing entitlements or cross-agency access until the backend authorization model is ready.

## Approved design direction

- Premium charcoal, graphite and obsidian surfaces.
- Restrained orange brand accent and restrained blue secondary accent.
- Strong readable text contrast in both light and night modes.
- Subtle surface depth and gradients; avoid excessive borders, glow, radius or decorative effects.
- Compact, deliberate corner radii and consistent spacing.
- Use Inter/Geist-style typography, tabular numerals for financial values, and Lucide icons.
- Preserve the same design system across all modules and responsive breakpoints.
- Prioritise clear workflows, accessible controls, useful empty/loading/error states and keyboard focus.

## Development protocol

1. Inspect the existing implementation and dependencies before editing.
2. State the problem, intended outcome and acceptance criteria for significant changes.
3. Keep changes scoped and avoid unnecessary rewrites or dependencies.
4. Do not silently change product direction, data contracts or database architecture.
5. Add or update versioned migrations for schema changes; never make undocumented production edits.
6. Test tenant isolation, permissions and financial invariants when those systems are introduced.
7. Run `pnpm typecheck` and `pnpm build` for application changes.
8. Review the actual workflow result before claiming a change is deployed.
9. Keep secrets and real customer data out of Git history.
10. Document important decisions and known limitations.

## Productisation rule

A working demo is not a production SaaS. Do not describe a feature as commercially ready until its persistence, tenant isolation, authorization, error handling, operational support and relevant tests have been verified.
