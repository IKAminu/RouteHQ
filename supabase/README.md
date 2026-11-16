# RouteHQ database

Project: `viohesitrhrtkulcdnqk` (Supabase project named RouteHQ, EU Central / Frankfurt).

This is the commercial RouteHQ database. It is separate from the legacy Dandurgu project. Never point RouteHQ commercial tenants at Dandurgu's project or copy Dandurgu production records into this repository.

## Current remote migration history

The following migrations have been applied to the RouteHQ Supabase project:

- `20261116183749_lock_down_rls_auto_enable_function`
- `20261116185021_routehq_multitenant_platform_and_operations`
- `20261116185120_tighten_tenant_policies_and_indexes`
- `20261116185224_secure_private_document_storage_and_fk_deletes`
- `202611161854xx_enforce_permission_delegation_and_team_seats` (exact version is recorded in Supabase migration history)
- `2026111618xxxx_fix_seat_limit_transition_checks` (exact version is recorded in Supabase migration history)

The initial schema and follow-up SQL were applied through the connected Supabase management tools. The SQL source files have not yet been exported into this repository. **Do not treat this README as a reproducible migration bundle.** Before the next database change, export and commit the exact applied SQL migrations here, then use versioned migrations for all subsequent changes.

## Schema overview

Platform:
- `agencies`, `agency_applications`, `platform_admins`
- `agency_memberships`, `agency_invitations`
- `roles`, `permissions`, `role_permissions`, `member_permissions`
- `plans`, `subscriptions`, `agency_entitlements`
- `platform_audit_logs`

Agency operations:
- `leads`, `lead_activities`, `customers`, `packages`, `bookings`
- `travellers`, `payments`, `payment_reversals`
- `suppliers`, `supplier_costs`, `supplier_payments`
- `documents`, `agency_notes`, `tasks`, `activity_logs`
- `agency_integrations`, `integration_events`, `webhook_events`

## Security model

- All 31 public application tables have RLS enabled.
- Agency-owned records carry an `agency_id` tenant key.
- Authorization is checked against active agency membership and permission grants.
- Permission delegation is limited to permissions the delegating user already holds.
- Team-seat limits are checked in PostgreSQL against the active/trialing subscription plan.
- A private Storage bucket named `routehq-documents` is configured for agency-scoped document paths.
- Platform administrator records are provisioned separately and are not self-service.

## Current plan entitlements

- Basic: one owner account, no additional team seats.
- Growth: up to five additional team seats.
- Pro: up to five additional team seats.

These are initial feature entitlements, not published price configuration.

## Not yet production-ready

The schema is a foundation, not a finished SaaS backend. Registration approval and workspace provisioning RPCs, invitation acceptance, billing provider webhooks, secure payment/reversal transactions, document encryption/access review, application integration, and automated tenant-isolation tests still need implementation. Do not onboard real agencies or customer records yet.
