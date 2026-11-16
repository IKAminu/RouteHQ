# RouteHQ product readiness plan

## Current verified position

- The public RouteHQ repository is a rebranded preview of the former AgencyManagerDan frontend.
- The Pages workflow builds with `VITE_USE_MOCK_DATA=true`. This is demonstration mode, not a customer data environment.
- The existing connected Supabase project is `DandurguAgencyManager` (`gzzublnzgyizqflmaxay`). It is the original Dandurgu system and must remain isolated from RouteHQ commercial tenants.
- Its operational tables include leads, customers, packages, bookings, travellers, payments, suppliers, supplier costs, supplier payments, documents, lead activities and agency notes. RLS is enabled on these tables.
- Those operational tables do not currently have an `agency_id` / `tenant_id` column. Current live access is tied to two Dandurgu-authorised email addresses and AAL2 MFA.
- The Supabase security advisor reports leaked-password protection disabled on the existing Dandurgu project. This must be addressed in that project's Auth settings, separately from RouteHQ.
- The existing custom domain `dashboard.dandurgu.l.cd` was removed from this product preview. RouteHQ must use its own domain when one is selected.

## Product boundary

RouteHQ should have three distinct surfaces:

1. **Marketing website:** product explanation, features, plans, demo request, FAQs, support and legal pages. This belongs on the Web4 public website or a dedicated RouteHQ marketing domain.
2. **Application:** authenticated agency workspaces. The current GitHub Pages build is a demo preview only.
3. **Platform operations:** internal administration for tenant onboarding, subscriptions, support, usage, security events and billing reconciliation. This is not the same as an agency user's workspace.

## Target tenant and membership model

Create a new, dedicated RouteHQ Supabase project. Do not add RouteHQ tenants to the Dandurgu production database.

Core platform tables to design:

- `agencies`: tenant identity, display name, legal/business details, slug, timezone, default currency, logo and lifecycle status.
- `agency_memberships`: user-to-agency relationship, role, invitation state and membership lifecycle. A user may belong to more than one agency in future.
- `agency_invitations`: single-use, expiring invitations and intended role.
- `plans`: Starter, Growth and Pro product definitions.
- `subscriptions`: agency subscription state, billing interval, plan, trial/grace periods and renewal dates.
- `subscription_events` / `payment_events`: verified provider webhook events and idempotency keys.
- `agency_entitlements`: server-enforced feature limits and plan capabilities.
- `agency_integrations`: connection status and non-secret configuration. Provider secrets must be stored server-side, never in browser-readable rows.
- `platform_audit_logs`: privileged platform actions and security-relevant changes.

Every agency-owned operational table must receive a non-null `agency_id`, with tenant-aware foreign keys and indexes. This includes leads, lead activities, customers, packages, bookings, travellers, payments, suppliers, supplier costs, supplier payments, documents and notes.

## Authorization rules

- Authenticate users with Supabase Auth.
- Authorize through explicit `agency_memberships`, not a hardcoded email allowlist.
- Every agency-owned table must have RLS policies for SELECT, INSERT, UPDATE and DELETE that verify the caller's membership in that row's agency.
- UPDATE policies must include both `USING` and `WITH CHECK`, so a user cannot move a row into another agency.
- Validate parent-child relationships within the same agency. A booking from Agency A must not reference a customer or package from Agency B.
- Enforce role permissions for owner, admin, operations, finance and agent actions.
- Never use user-editable JWT `user_metadata` as an authorization source.
- Test cross-tenant access explicitly with two separate test agencies and multiple roles before onboarding real customers.
- Do not use a frontend filter as the security boundary. PostgreSQL RLS must enforce isolation.

## Signup and onboarding

1. Visitor chooses a plan or requests a demo.
2. Account is created and email verified.
3. Server-side onboarding creates the agency and owner membership in one transaction.
4. Owner completes agency profile, currency, timezone and branding.
5. Owner invites team members with defined roles.
6. Agency starts a trial or completes its first payment.
7. Server computes entitlements from the subscription and gates features.
8. Workspace opens with a guided setup checklist and optional sample data.

Agency creation and invitation acceptance must be idempotent. Do not let a browser directly assign itself an owner/admin role.

## Billing and commercial model

Pricing discussed so far is a working draft, not a published price list:

- Starter: ₦100,000 setup + ₦50,000/month.
- Growth: ₦200,000 setup; website build/redesign, website-to-RouteHQ capture integration and one-time ₦50,000 Meta ads credit. The recurring monthly price previously discussed needs confirmation.
- Pro: ₦300,000 setup + ₦150,000/month was proposed but not confirmed.

Before launch, choose a Nigerian payment provider and implement server-side payment initiation, signed webhook verification, idempotent event processing, subscription state transitions, receipts, failed-payment handling, cancellation and grace periods. Never grant paid features based solely on a browser redirect.

## Integrations and automation

- Website enquiries: tenant-scoped public endpoint with signed agency token, CAPTCHA/rate limiting, validation, spam controls and idempotency.
- Meta leads and Conversions API: server-side credentials and event forwarding; never expose tokens in Vite environment variables.
- Email/WhatsApp follow-up: consent-aware messaging, templates, delivery logs and opt-out handling.
- Supplier and flight integrations: adapter layer, credentials stored server-side, retries, timeouts and audit logs.
- Documents: private storage, short-lived signed access and strict tenant policies. Do not put passport scans in a public bucket.
- Automation: event-driven jobs with retry/dead-letter handling and a visible activity log.

## Production operations checklist

- Separate RouteHQ Supabase project and environments (development/staging/production).
- Versioned migrations and reproducible seed data.
- RLS review and automated cross-tenant tests.
- Auth email deliverability, password policy, leaked-password protection, MFA policy and recovery process.
- Verified backup schedule and tested restore procedure.
- Error monitoring, structured logs, uptime checks and incident response.
- Rate limits, CAPTCHA and abuse monitoring for public endpoints.
- Data export, account deletion, retention policy and privacy/terms documents.
- Payment reconciliation and audit trail.
- Accessibility, mobile/browser testing and load testing.
- Custom RouteHQ domain, TLS, DNS, security headers and deployment rollback procedure.

## Delivery sequence

### Phase 1: Product identity and preview
- [x] RouteHQ application name, browser title and PWA metadata.
- [x] Interim RouteHQ monogram and navy/orange brand palette.
- [x] Light and Night mode in Settings, saved per browser.
- [x] Remove Dandurgu custom domain from RouteHQ preview.
- [ ] Final approved logo and design system.
- [ ] Replace remaining legacy Dandurgu-specific UI references and sample labels.

### Phase 2: Isolated backend foundation
- [ ] Create a dedicated RouteHQ Supabase project after confirming organization, region and cost.
- [ ] Design and migrate agency, membership, invitations and tenant ownership.
- [ ] Migrate operational schema into the new project without copying real Dandurgu customer data.
- [ ] Implement membership-based RLS and cross-tenant tests.
- [ ] Implement secure signup, onboarding and team invitations.

### Phase 3: Commercial controls
- [ ] Confirm published plan prices and included limits.
- [ ] Integrate payment provider and verified webhooks.
- [ ] Implement subscriptions, entitlements, receipts, renewals and grace periods.
- [ ] Build internal platform admin and support tooling.

### Phase 4: Integrations and launch
- [ ] Tenant-aware website capture.
- [ ] Meta lead and Conversions API integrations.
- [ ] Email/WhatsApp workflows and automation.
- [ ] Private document storage and integrations.
- [ ] Marketing site, terms, privacy, support and launch checks.
