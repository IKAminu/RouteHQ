# RouteHQ migrations

Remote migration history for the dedicated RouteHQ Supabase project `viohesitrhrtkulcdnqk`, checked on 19 November 2026.

Applied remote versions:

- `20261116183749_lock_down_rls_auto_enable_function`
- `20261116185021_routehq_multitenant_platform_and_operations`
- `20261116185120_tighten_tenant_policies_and_indexes`
- `20261116185224_secure_private_document_storage_and_fk_deletes`
- `20261116185430_enforce_permission_delegation_and_team_seats`
- `20261116185509_fix_seat_limit_transition_checks`
- `20261116191517_agency_onboarding_and_platform_review`
- `20261116191543_expose_authenticated_onboarding_rpcs`
- `20261116191748_index_agency_notes_by_tenant_and_date`
- `20261118164206_platform_admin_overview`
- `20261118164538_platform_agency_controls`
- `20261119180143_connect_routehq_workspace_and_seed_horizon`
- `20261119180520_add_agency_payment_status_transition`
- `20261119181414_complete_agency_notes_workflow_fields`

The first nine migration source files are retained in this directory. Some later migrations were applied directly to the dedicated Supabase project during development and still need their complete SQL source reconciled into this repository. Do not assume the local folder is a complete mirror of remote migration history until that reconciliation is finished.

The Horizon starter dataset is synthetic test data stored in Supabase under the `horizon-travel` agency only. It is not bundled in the public frontend repository. Newly approved agencies are not seeded with those records.

Do not move historical Dandurgu migrations into this directory or run them against RouteHQ. They target a different, incompatible database and remain separate.

For future schema changes, create and commit a migration file first, test it against staging, apply it to RouteHQ, and verify the remote migration history. Do not apply undocumented production DDL.
