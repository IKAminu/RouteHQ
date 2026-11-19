# RouteHQ product readiness plan

## Current verified position (19 November 2026)

- RouteHQ uses a dedicated Supabase project: `viohesitrhrtkulcdnqk`. The Dandurgu Supabase project remains separate and is not used by RouteHQ.
- The RouteHQ database has a multi-tenant agency model, agency memberships, roles and permissions, plans, subscriptions, onboarding applications, platform administrators and audit records.
- Agency operational tables have an `agency_id` and Row Level Security is enabled.
- One login flow authenticates with Supabase Auth and TOTP MFA, then routes active platform administrators to the platform console and agency members to their agency workspace.
- The operational store is connected to the normalized RouteHQ schema. Reads and writes resolve the signed-in user's active agency through `get_my_agency_context`; the browser does not choose the tenant ID.
- The former bundled `mockData.ts` file and demo login path have been removed. Supabase is the operational source of truth.
- Synthetic starter records are assigned to the existing `Horizon Travel` agency only: 6 leads, 5 customers, 4 packages, 5 bookings, 7 travellers, 7 payments, 3 suppliers, 4 supplier costs and 2 supplier payments. No fake document files were imported. New agencies are not pre-populated.
- Agency notes are connected to tenant-scoped Supabase records, including note type, priority, due date and completion.
- GitHub Actions typecheck and build passed for the live application. GitHub Pages deployment uses the RouteHQ Supabase URL and publishable key.
- The active platform administrator and Horizon agency-owner memberships have been verified in the database.

## Product surfaces

1. **Marketing website:** product explanation, features, plans, demo requests, FAQs, support and legal pages.
2. **Application:** authenticated agency workspaces, with data isolated by agency.
3. **Platform operations:** internal administration for tenant onboarding, subscriptions, support, usage, security events and billing reconciliation.

The current application uses one login screen with role-based routing. Separate admin and agency domains/subdomains can be introduced later without changing the underlying authorization model.

## Tenant and authorization rules

- Every agency-owned record must carry an `agency_id` and be protected by database-enforced RLS.
- Every parent-child relationship must remain within the same agency. A booking for Agency A must not reference a customer or package from Agency B.
- Agency context is derived from the authenticated membership, never from a user-editable form, URL or browser storage.
- Platform-wide reads and actions require an active platform-admin record and verified AAL2/TOTP.
- Never use user-editable JWT `user_metadata` as an authorization source.
- Test cross-tenant access explicitly with two separate test agencies and multiple roles before onboarding external customers.
- Frontend filtering is not a security boundary.

## Completed backend foundation

- [x] Dedicated RouteHQ Supabase project, separate from Dandurgu.
- [x] Agency, membership, role, permission, plan and subscription schema.
- [x] Agency onboarding applications and platform approval workflow.
- [x] Platform administrator authorization and audit-aware platform actions.
- [x] Agency-scoped operational schema and RLS policies.
- [x] Live operational data adapter for leads, customers, packages, bookings, travellers, payments, supplier costs, supplier payments and documents.
- [x] Payment status transition and reversal functions; supplier-payment void function.
- [x] Tenant-scoped agency notes.
- [x] Horizon-only synthetic starter dataset in Supabase.
- [x] New agencies remain empty at approval.
- [x] Role-based login routing to platform console or agency workspace.
- [x] GitHub Pages live build and CI typecheck/build.

## Remaining production work

### 1. Tenant and application verification
- [ ] Create a second controlled test agency and test user.
- [ ] Verify the second agency starts empty.
- [ ] Run automated cross-tenant read, insert, update, delete and relationship tests.
- [ ] Test owner, admin, operations, finance and agent permission combinations.
- [ ] Exercise every module against Supabase, including notes, documents, payments and supplier costs.
- [ ] Test browser refresh, deep links, sign-out, session expiry, MFA recovery and password reset on the deployed host.

### 2. Billing and subscriptions
- [ ] Confirm final commercial plans, prices, limits and billing intervals.
- [ ] Integrate a Nigerian payment provider.
- [ ] Verify signed webhooks server-side and process events idempotently.
- [ ] Implement subscription activation, renewals, failed payments, grace periods, cancellation, refunds and receipts.
- [ ] Never activate paid access based solely on a browser redirect.

### 3. Platform observability
- [ ] Connect Supabase Management API/Observability through a secured server-side Edge Function.
- [ ] Add bandwidth, CPU, memory, disk, Auth MAU, Realtime, Edge Function and backup metrics where supported.
- [ ] Show unavailable metrics as unavailable, never as zero.
- [ ] Add alerting and an operational incident history.

### 4. Security and recovery
- [ ] Establish off-site database and Storage backup procedures.
- [ ] Perform and document a restore rehearsal.
- [ ] Review leaked-password protection and other Auth controls against the current Supabase plan.
- [ ] Review document upload/download authorization and short-lived signed access.
- [ ] Add rate limits, abuse monitoring and CAPTCHA to public endpoints.

### 5. Launch and infrastructure
- [ ] Configure the RouteHQ Auth site URL and allowed redirect URLs for the deployed host.
- [ ] Select and configure a RouteHQ custom domain.
- [ ] Add staging and production environments and deployment rollback.
- [ ] Complete marketing website, terms, privacy, support and data-retention documentation.
- [ ] Reconcile all remotely applied SQL migration sources into the repository.

## Billing and commercial model

Pricing previously discussed is a working draft, not a published price list:

- Starter: ₦100,000 setup + ₦50,000/month.
- Growth: ₦200,000 setup; website build/redesign, website-to-RouteHQ capture integration and one-time ₦50,000 Meta ads credit. Recurring monthly price requires confirmation.
- Pro: ₦300,000 setup + ₦150,000/month was proposed but not confirmed.

## Operational rule

Do not describe RouteHQ as commercially ready for external customer data until tenant isolation, permissions, financial operations, recovery, document security, support and relevant end-to-end tests have been verified.
