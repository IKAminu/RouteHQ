# RouteHQ Platform Operations Console

The internal platform console is rendered only for active records in `public.platform_admins`. The live authentication gate requires Supabase Auth TOTP MFA before mounting the console.

## Sections

- **Overview**: agency, application, user, membership and subscription counts; monthly recurring revenue from active monthly subscription records; review queue; subscription watchlist.
- **Agencies**: application review, agency registry, and audited suspend/reactivate actions.
- **Subscriptions**: plan, status, currency amount, billing interval, current billing-period start/end, cancellation-at-period-end, and remaining time.
- **System health**: Postgres database size, private Storage object count/bytes, bucket privacy, webhook/integration error counts, project configuration, plan allowances, and recovery readiness.
- **Audit activity**: latest platform audit events with actor identity and timestamp.

## Database functions

- `public.get_platform_admin_overview()` returns aggregate platform metrics and operational snapshots.
- `public.set_platform_agency_status(uuid,text)` performs an agency suspend/reactivate transition and writes an audit event.
- Both functions require an authenticated AAL2 session and an active platform-admin record. They are SECURITY DEFINER by design because the console needs cross-tenant read access; authorization is checked inside each function before platform data is returned or changed.

## Usage and quota notes

The current Supabase organization tier is Free. The console displays the Free-plan database size quota (500 MB), Storage quota (1 GB), and monthly bandwidth allowance (10 GB; 5 GB cached + 5 GB uncached). Database size and Storage object totals are queried from the project database. Storage object totals are scoped to the private `routehq-documents` bucket.

Database size is not the same as provisioned disk size. Supabase reports disk metrics separately, and the console does not claim that a SQL database-size query measures WAL/system disk consumption.

The following Management API / Observability metrics are not yet connected: bandwidth consumed, CPU, memory, IOPS, provisioned disk, Auth MAU, Realtime usage, Edge Function invocations, billing overages, backup state and detailed request/error rates. These require a server-side integration using a scoped Supabase Management API token. Do not place that token in browser code or a `VITE_*` variable.

## Subscription lifecycle

Agency approval currently creates a **pending** subscription record. It does not start a paid billing period. Until a payment provider or an explicit manual activation process sets `amount_minor`, `current_period_start`, and `current_period_end`, the console correctly displays the amount and dates as not configured. Do not invent a start or expiry date.

## Production readiness

The normalized operational adapter is now connected to the live agency workspace. Horizon Travel has the synthetic starter dataset in Supabase; newly approved agencies start empty. The remaining work before inviting external agencies into production is:

1. The current Free plan has no automatic daily backups. Implement and test an off-site backup/restore process, or upgrade to Pro+ for managed daily backups.
2. Supabase leaked-password protection is a Pro+ feature. Upgrade before enabling it; on Free, record the limitation and enforce strong passwords plus TOTP MFA.
3. Connect the Management API through a server-side Edge Function and scoped secret. Unsupported metrics must remain unavailable, not display as zero.
4. Add subscription activation, renewal, failed-payment, grace-period and cancellation workflows backed by verified payment webhooks or auditable manual billing operations.
5. Add automated cross-tenant, role-permission and platform-admin access tests.
6. Verify private document uploads/downloads, password recovery redirects, session expiry and restore procedures on the deployed host.
