# RouteHQ

RouteHQ is a multi-tenant travel-agency operations application. Agency workspaces, platform administration, authentication and operational records are served through the dedicated RouteHQ Supabase project.

**Current operating model:** live Supabase authentication and tenant-scoped data. The former bundled mock-data mode has been removed from the application. Synthetic starter records are stored in Supabase under the Horizon Travel agency so they exercise the same database, RLS and application paths as normal records. Newly approved agencies start with empty operational tables.

## Technology

- React 19, TypeScript, Vite 8 and Tailwind CSS 4
- React Router 7
- Supabase Auth with TOTP MFA
- Supabase PostgreSQL, Row Level Security and private Storage
- GitHub Actions and GitHub Pages hosting

## Run locally

1. Install Node.js 22 and pnpm 10.
2. Run `pnpm install --frozen-lockfile`.
3. Copy `.env.example` to `.env.local`.
4. Run `pnpm dev`.

Checks: `pnpm typecheck` and `pnpm build`.

## Authentication and routing

One login screen serves both account types. After password and TOTP verification, the application checks the authenticated user's active platform-admin record and agency membership:

- Platform administrators open the RouteHQ platform control centre.
- Active agency members open their own agency workspace.
- Users without an active membership see their application status or the agency application form.

The platform console and agency workspace are separate surfaces. Agency-owned records are read and written through the signed-in user's Supabase session and database-enforced tenant policies. The frontend never chooses an agency ID supplied by a form or URL.

## Data ownership

- Supabase is the source of truth for all operational records.
- Every agency-owned row carries an `agency_id` and is protected by Row Level Security.
- The starter dataset belongs only to Horizon Travel.
- New agencies are not pre-populated with Horizon records.
- Payment confirmation, reversal and supplier-payment voiding use audited database functions.
- Document references may point to private Storage objects or external URLs; actual sensitive files must use private storage and controlled access.
- Do not place service-role keys, payment secrets, Meta tokens or other privileged credentials in browser code or `VITE_*` variables. The Supabase publishable key is intended for browser use and relies on RLS for protection.

## Deployment

The GitHub Pages workflow builds the live application with the RouteHQ Supabase URL and publishable key. Supabase Auth must allow the deployed application URL in its redirect URL configuration. The Pages deployment is a static host for the authenticated application, not a source of operational data.

Preview: https://ikaminu.github.io/RouteHQ/

## Platform and agency separation

The platform control centre manages agency applications, agencies, subscriptions, system health and platform audit activity. Agency users never receive platform-wide data access. Future custom domains or subdomains can be added without changing the current single-login role routing.

## Operational readiness

The live tenant schema and RLS policies are in place. The operational adapter maps the UI's travel-agency model to the normalized database schema. The Horizon starter records are present in Supabase. Remaining production work includes automated end-to-end tenant-isolation tests, real payment-provider webhook integration, billing lifecycle, backup/restore rehearsal, management API observability and secure document-upload/download verification.
