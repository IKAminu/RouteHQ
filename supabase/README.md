# RouteHQ database

Project: `viohesitrhrtkulcdnqk` (Supabase project named RouteHQ, EU Central / Frankfurt).

This is the commercial RouteHQ database. It is separate from the legacy Dandurgu project. Never point RouteHQ commercial tenants at Dandurgu's project or copy Dandurgu production records into this repository.

## Current remote migration history

The following migrations have been applied to the RouteHQ Supabase project:

- `20261116183749_lock_down_rls_auto_enable_function`
- `20261116185021_routehq_multitenant_platform_and_operations`
- `20261116185120_tighten_tenant_policies_and_indexes`
- `20261116185224_secure_private_document_storage_and_fk_deletes`
- `20261116185430_enforce_permission_delegation_and_team_seats`
- `20261116185509_fix_seat_limit_transition_checks`
- `20261116191517_agency_onboarding_and_platform_review`
- `20261116191543_expose_authenticated_onboarding_rpcs`
- `20261116191748_index_agency_notes_by_tenant_and_date`

The initial schema and follow-up SQL were applied through the connected Supabase management tools. The exact applied SQL source files are preserved under `migrations/`. The Supabase project is the remote source of truth; apply future changes through new versioned migrations and commit the exact SQL before considering the work complete.

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

The schema is a foundation, not a finished SaaS backend. Registration and agency application UI, platform review UI, and approval/rejection RPCs are now in the repository. First platform-admin provisioning is manual via `operations/bootstrap-platform-admin.sql`. Invitation acceptance, billing provider webhooks, secure payment/reversal transactions, document encryption/access review, operational application adapter, and automated tenant-isolation tests still need implementation. Do not onboard real agencies or customer records yet.
