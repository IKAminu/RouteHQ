# RouteHQ migrations

This directory contains only migrations recorded in the commercial RouteHQ Supabase project `viohesitrhrtkulcdnqk`.

The remote migration history was checked on 18 November 2026. The applied versions are:

- `20261116183749_lock_down_rls_auto_enable_function.sql`
- `20261116185021_routehq_multitenant_platform_and_operations.sql`
- `20261116185120_tighten_tenant_policies_and_indexes.sql`
- `20261116185224_secure_private_document_storage_and_fk_deletes.sql`
- `20261116185430_enforce_permission_delegation_and_team_seats.sql`
- `20261116185509_fix_seat_limit_transition_checks.sql`
- `20261116191517_agency_onboarding_and_platform_review.sql`
- `20261116191543_expose_authenticated_onboarding_rpcs.sql`
- `20261116191748_index_agency_notes_by_tenant_and_date.sql`

Do not move historical Dandurgu migrations back into this directory or run them against RouteHQ. They target an older, incompatible schema and are preserved separately in `supabase/legacy-dandurgu-migrations/` for reference only.

For future schema changes, create a new migration using the Supabase CLI, test it against a staging database, apply it to the RouteHQ project, and verify the remote migration history before merging.
