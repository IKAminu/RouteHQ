-- Correct tenant membership lookup and remove overlapping permissive policies.
drop policy if exists "members view own agency" on public.agencies;
drop policy if exists "platform admin agencies" on public.agencies;
drop policy if exists "agency settings update" on public.agencies;
create policy "agency select by member or platform admin" on public.agencies
for select to authenticated
using (
 (select app_private.is_platform_admin())
 or exists(select 1 from public.agency_memberships m where m.agency_id=agencies.id and m.user_id=(select auth.uid()) and m.status='active')
);
create policy "agency update by owner or platform admin" on public.agencies
for update to authenticated
using ((select app_private.is_platform_admin()) or (select app_private.has_agency_permission(agencies.id,'agency_settings.manage')))
with check ((select app_private.is_platform_admin()) or (select app_private.has_agency_permission(agencies.id,'agency_settings.manage')));
create policy "platform admin agency insert" on public.agencies
for insert to authenticated with check ((select app_private.is_platform_admin()));
create policy "platform admin agency delete" on public.agencies
for delete to authenticated using ((select app_private.is_platform_admin()));

drop policy if exists "tenant custom roles management" on public.roles;
create policy "tenant custom role insert" on public.roles for insert to authenticated
with check(agency_id is not null and (select app_private.has_agency_permission(agency_id,'team.manage_permissions')));
create policy "tenant custom role update" on public.roles for update to authenticated
using(agency_id is not null and (select app_private.has_agency_permission(agency_id,'team.manage_permissions')))
with check(agency_id is not null and (select app_private.has_agency_permission(agency_id,'team.manage_permissions')));
create policy "tenant custom role delete" on public.roles for delete to authenticated
using(agency_id is not null and (select app_private.has_agency_permission(agency_id,'team.manage_permissions')));

drop policy if exists "role permission management" on public.role_permissions;
create policy "role permission insert" on public.role_permissions for insert to authenticated
with check(exists(select 1 from public.roles r where r.id=role_id and r.agency_id is not null and (select app_private.has_agency_permission(r.agency_id,'team.manage_permissions'))));
create policy "role permission delete" on public.role_permissions for delete to authenticated
using(exists(select 1 from public.roles r where r.id=role_id and r.agency_id is not null and (select app_private.has_agency_permission(r.agency_id,'team.manage_permissions'))));

drop policy if exists "member permission management" on public.member_permissions;
create policy "member permission insert" on public.member_permissions for insert to authenticated
with check(exists(select 1 from public.agency_memberships m where m.id=membership_id and (select app_private.has_agency_permission(m.agency_id,'team.manage_permissions'))));
create policy "member permission update" on public.member_permissions for update to authenticated
using(exists(select 1 from public.agency_memberships m where m.id=membership_id and (select app_private.has_agency_permission(m.agency_id,'team.manage_permissions'))))
with check(exists(select 1 from public.agency_memberships m where m.id=membership_id and (select app_private.has_agency_permission(m.agency_id,'team.manage_permissions'))));
create policy "member permission delete" on public.member_permissions for delete to authenticated
using(exists(select 1 from public.agency_memberships m where m.id=membership_id and (select app_private.has_agency_permission(m.agency_id,'team.manage_permissions'))));

drop policy if exists "application visibility" on public.agency_applications;
create policy "application visibility" on public.agency_applications for select to authenticated
using(applicant_user_id=(select auth.uid()) or (select app_private.is_platform_admin()));
drop policy if exists "submit own application" on public.agency_applications;
create policy "submit own pending application" on public.agency_applications for insert to authenticated
with check (
 applicant_user_id=(select auth.uid())
 and status='pending'
 and agency_id is null
 and reviewed_by is null
 and reviewed_at is null
);

-- Add indexes for the composite tenant foreign keys and common FK joins.
create index if not exists lead_activities_agency_lead_idx on public.lead_activities(agency_id,lead_id);
create index if not exists bookings_agency_package_idx on public.bookings(agency_id,package_id);
create index if not exists bookings_agency_lead_idx on public.bookings(agency_id,lead_id);
create index if not exists bookings_created_by_idx on public.bookings(created_by);
create index if not exists customers_created_by_idx on public.customers(created_by);
create index if not exists documents_agency_booking_idx on public.documents(agency_id,booking_id);
create index if not exists documents_agency_customer_idx on public.documents(agency_id,customer_id);
create index if not exists documents_agency_traveller_idx on public.documents(agency_id,traveller_id);
create index if not exists documents_uploaded_by_idx on public.documents(uploaded_by);
create index if not exists integration_events_agency_idx on public.integration_events(agency_id);
create index if not exists integration_events_integration_idx on public.integration_events(integration_id);
create index if not exists leads_assigned_to_idx on public.leads(assigned_to);
create index if not exists leads_created_by_idx on public.leads(created_by);
create index if not exists member_permissions_permission_idx on public.member_permissions(permission_code);
create index if not exists member_permissions_updated_by_idx on public.member_permissions(updated_by);
create index if not exists packages_created_by_idx on public.packages(created_by);
create index if not exists payment_reversals_payment_idx on public.payment_reversals(agency_id,payment_id);
create index if not exists payment_reversals_reversed_by_idx on public.payment_reversals(reversed_by);
create index if not exists payments_customer_idx on public.payments(agency_id,customer_id);
create index if not exists payments_recorded_by_idx on public.payments(recorded_by);
create index if not exists platform_audit_actor_idx on public.platform_audit_logs(actor_user_id);
create index if not exists role_permissions_permission_idx on public.role_permissions(permission_code);
create index if not exists subscriptions_plan_idx on public.subscriptions(plan_id);
create index if not exists supplier_costs_booking_idx on public.supplier_costs(agency_id,booking_id);
create index if not exists supplier_costs_supplier_idx on public.supplier_costs(agency_id,supplier_id);
create index if not exists supplier_payments_recorded_by_idx on public.supplier_payments(recorded_by);
create index if not exists tasks_assigned_to_idx on public.tasks(assigned_to);
create index if not exists tasks_created_by_idx on public.tasks(created_by);
create index if not exists travellers_booking_idx on public.travellers(agency_id,booking_id);
create index if not exists travellers_customer_idx on public.travellers(agency_id,customer_id);
