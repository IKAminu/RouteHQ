# RouteHQ Supabase setup

RouteHQ now has a separate commercial Supabase project. It is not the Dandurgu Agency Manager project.

- Project name: RouteHQ
- Project ref: `viohesitrhrtkulcdnqk`
- Region: EU Central (Frankfurt)
- Database migrations: `supabase/migrations/`

## Safe local demo

1. Install Node.js 22 and pnpm 10.
2. Run `pnpm install --frozen-lockfile`.
3. Copy `.env.example` to `.env.local`.
4. Keep `VITE_USE_MOCK_DATA=true`.
5. Run `pnpm dev`.

The demo uses synthetic browser data. It does not connect to a customer database.

## Local authenticated development

Only use the RouteHQ project settings, never Dandurgu's project settings.

Set these values in your untracked `.env.local`:

- `VITE_USE_MOCK_DATA=false`
- `VITE_SUPABASE_URL=https://viohesitrhrtkulcdnqk.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<RouteHQ publishable key>`

The publishable key is intended for browser use. Never use a Supabase secret key or service-role key in a `VITE_*` variable, committed file, or frontend bundle.

## Supabase Authentication settings

In the RouteHQ Supabase dashboard:

1. Open Authentication → URL Configuration.
2. Set the Site URL to the exact application origin used for testing, initially `http://localhost:8443/`.
3. Add the local development callback URL (for Vite, `http://localhost:8443` (RouteHQ's configured Vite port)) to Redirect URLs.
4. When staging/production hosting is established, add those exact HTTPS callback URLs too.
5. Keep email confirmation enabled for new accounts.
6. Keep TOTP MFA enabled. RouteHQ currently requires AAL2 before entering authenticated platform flows.
7. Enable leaked-password protection in Authentication → Settings → Password Security.

The current public GitHub Pages deployment is intentionally built with `VITE_USE_MOCK_DATA=true`. It remains a demo preview and does not expose the commercial signup or admin console. Do not change the public preview to live mode until a dedicated staging/production host and its redirect URLs are configured.

## Current database model

Platform tables:
- `agencies`, `agency_applications`, `platform_admins`
- `agency_memberships`, `agency_invitations`
- `roles`, `permissions`, `role_permissions`, `member_permissions`
- `plans`, `subscriptions`, `agency_entitlements`
- `platform_audit_logs`

Agency operational tables:
- `leads`, `lead_activities`, `customers`, `packages`, `bookings`
- `travellers`, `payments`, `payment_reversals`
- `suppliers`, `supplier_costs`, `supplier_payments`
- `documents`, `agency_notes`, `tasks`, `activity_logs`
- `agency_integrations`, `integration_events`, `webhook_events`

All public application tables have RLS enabled. Agency-owned rows are tenant-scoped by `agency_id`. The app must never use frontend filtering as a substitute for RLS.

## Onboarding workflow currently implemented

- Account creation with email/password.
- TOTP MFA enrollment and challenge.
- Agency application submission.
- Applicant can see their own application status.
- Platform administrators can review applications.
- Approval transaction creates the agency, owner membership, requested plan subscription (pending) and plan entitlements.
- Rejection is audited.
- Platform admin dashboard reads applications only after the account has been provisioned in `platform_admins`.

The first platform administrator must be provisioned by a trusted database administrator after the user has created and confirmed their Auth account. Run `supabase/operations/bootstrap-platform-admin.sql` in the RouteHQ SQL Editor after replacing its email placeholder with the exact confirmed account email. Verify the inserted row before signing in to the platform console. Never add a self-service "make me admin" button or bootstrap RPC.

## Important current limitations

- The operational modules are not yet mapped to the new RouteHQ schema. The old live-store adapter expects the legacy Dandurgu column names and must not be enabled against this project.
- Approved agencies are deliberately shown a safe holding screen until the operational data adapter is migrated and tenant-isolation tests pass.
- Team invitation creation/acceptance and settings permission editor are not yet wired into the app.
- Subscription status is set to `pending` on approval. Billing and subscription activation are not yet implemented.
- Passport values must be encrypted before storing in `travellers.passport_number_encrypted`. Plaintext passport numbers must never be written.
- Private files belong in the private `routehq-documents` bucket with an agency UUID as the first object path segment.
- Financial operations need server-side transactions before real use.

## Migration discipline

The SQL files in `supabase/migrations/` preserve the migrations applied to the RouteHQ database. Apply future schema changes through new, versioned migrations and commit the exact SQL. Do not edit old migrations after they have been applied.

## Never do these things

- Do not connect RouteHQ to the Dandurgu Supabase project.
- Do not copy Dandurgu or customer records into this public repository.
- Do not expose service-role keys or secrets to the browser.
- Do not disable RLS to make the UI work.
- Do not approve agencies by direct browser-side table writes.
- Do not let the frontend choose an arbitrary `agency_id` and trust it.
- Do not onboard real agencies until cross-tenant isolation, roles, invitations, financial transactions, backups and restore have been tested.
