# RouteHQ engineering guide

RouteHQ is a multi-tenant travel-agency operations application. Supabase is the source of truth for all operational records. Do not reintroduce bundled mock records or a browser-only demo mode into the application.

## Canonical project structure

- `src/main.tsx` — browser entrypoint and stylesheet import.
- `src/app/` — application composition and route definitions.
- `src/auth/` — password, TOTP, role and tenant routing.
- `src/components/` — reusable interface components.
- `src/hooks/useAppStore.tsx` — live application state and workflow layer.
- `src/layouts/` — agency workspace shell.
- `src/lib/supabaseStore.ts` — tenant-scoped Supabase adapter.
- `src/pages/` — agency dashboard and operational modules.
- `src/theme/` — appearance preferences.
- `src/types/` — shared domain types.
- `supabase/migrations/` — versioned SQL migrations and migration notes.
- `.github/workflows/` — validation and deployment.

## Current stack

- Node.js 22, pnpm 10
- React 19, TypeScript, Vite 8
- Tailwind CSS 4, React Router 7
- Supabase Auth, PostgreSQL, Row Level Security and Storage
- GitHub Actions and GitHub Pages

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
- All operational data belongs in Supabase. Never add real customer, lead, traveller, passport, payment or supplier data to this public repository.
- Synthetic starter records belong to the Horizon Travel tenant in Supabase. New agency tenants must remain empty unless explicitly seeded through an approved onboarding process.
- The Dandurgu Supabase project is separate. Never point RouteHQ commercial tenants at it or weaken its policies.
- Every agency-owned record must be scoped to an agency and protected by database-enforced Row Level Security. Frontend filtering is never a security boundary.
- Never expose service-role keys, payment secrets, Meta tokens or other private credentials in browser code or `VITE_*` variables.
- Sensitive documents must use private storage and controlled, short-lived access. A URL stored in a row is not a security control.
- Financial changes must preserve an auditable transaction history. Prefer server-side database transactions for multi-record operations.
- Platform administrator authorization must be enforced by the database and verified MFA. Agency users must never receive cross-tenant data access.

## Approved design direction

- Premium charcoal, graphite and obsidian surfaces.
- Restrained orange brand accent and restrained blue secondary accent.
- Strong readable text contrast in both light and night modes.
- Compact, deliberate corner radii and consistent spacing.
- Use Inter/Geist-style typography, tabular numerals for financial values, and Lucide icons.
- Preserve the same design system across all modules and responsive breakpoints.
- Prioritise clear workflows, accessible controls, useful empty/loading/error states and keyboard focus.

## Development protocol

1. Inspect the existing implementation and dependencies before editing.
2. Keep changes scoped and avoid unnecessary rewrites or dependencies.
3. Do not silently change product direction, data contracts or database architecture.
4. Add versioned migrations for schema changes; never make undocumented production edits.
5. Test tenant isolation, permissions and financial invariants.
6. Run `pnpm typecheck` and `pnpm build` for application changes.
7. Review the actual workflow result before claiming a change is deployed.
8. Keep secrets and real customer data out of Git history.

## Productisation rule

Do not describe a feature as commercially ready until its persistence, tenant isolation, authorization, error handling, operational support and relevant tests have been verified.
