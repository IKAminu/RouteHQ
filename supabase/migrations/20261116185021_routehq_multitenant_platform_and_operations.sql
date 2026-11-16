create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

create table public.agencies (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
 legal_name text, registration_number text, email text, phone text, website_url text, logo_path text,
 country_code text not null default 'NG', timezone text not null default 'Africa/Lagos',
 currency_code text not null default 'NGN',
 status text not null default 'pending' check(status in ('pending','active','suspended','rejected','closed')),
 approved_at timestamptz, approved_by uuid references auth.users(id) on delete set null,
 suspended_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.platform_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.agency_applications (
 id uuid primary key default gen_random_uuid(), applicant_user_id uuid not null references auth.users(id) on delete restrict,
 agency_id uuid references public.agencies(id) on delete set null, agency_name text not null,
 legal_name text, registration_number text, contact_name text not null, email text not null, phone text not null,
 country_code text not null default 'NG', requested_plan_code text not null default 'basic' check(requested_plan_code in ('basic','growth','pro')),
 status text not null default 'pending' check(status in ('pending','under_review','approved','rejected','withdrawn')),
 review_notes text, reviewed_by uuid references auth.users(id) on delete set null, reviewed_at timestamptz,
 submitted_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.permissions (
 code text primary key, module text not null, action text not null, description text not null,
 unique(module,action)
);
create table public.roles (
 id uuid primary key default gen_random_uuid(), agency_id uuid references public.agencies(id) on delete cascade,
 code text not null, name text not null, description text, is_system boolean not null default false,
 is_owner_role boolean not null default false, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(agency_id,code), check((is_system and agency_id is null) or (not is_system and agency_id is not null))
);
create unique index roles_system_code_idx on public.roles(code) where agency_id is null;
create table public.role_permissions (
 role_id uuid not null references public.roles(id) on delete cascade,
 permission_code text not null references public.permissions(code) on delete cascade,
 primary key(role_id,permission_code)
);
create table public.agency_memberships (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, role_id uuid not null references public.roles(id) on delete restrict,
 status text not null default 'active' check(status in ('invited','active','suspended','removed')),
 is_owner boolean not null default false, joined_at timestamptz, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(agency_id,user_id), unique(agency_id,id)
);
create unique index agency_memberships_one_owner_idx on public.agency_memberships(agency_id) where is_owner;
create index agency_memberships_user_status_idx on public.agency_memberships(user_id,status);
create table public.member_permissions (
 membership_id uuid not null references public.agency_memberships(id) on delete cascade,
 permission_code text not null references public.permissions(code) on delete cascade,
 is_allowed boolean not null, updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(), primary key(membership_id,permission_code)
);
create table public.agency_invitations (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 invited_email text not null, role_id uuid not null references public.roles(id) on delete restrict,
 token_hash text not null unique, status text not null default 'pending' check(status in ('pending','accepted','expired','revoked')),
 invited_by_membership_id uuid not null references public.agency_memberships(id) on delete restrict,
 expires_at timestamptz not null, accepted_by uuid references auth.users(id) on delete set null,
 accepted_at timestamptz, created_at timestamptz not null default now()
);
create index agency_invitations_agency_status_idx on public.agency_invitations(agency_id,status);
create table public.plans (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code in ('basic','growth','pro')),
 name text not null, description text, max_additional_members integer not null default 0 check(max_additional_members>=0),
 features jsonb not null default '{}'::jsonb, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.subscriptions (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 plan_id uuid not null references public.plans(id) on delete restrict,
 status text not null default 'pending' check(status in ('pending','trialing','active','past_due','cancelled','expired','suspended')),
 billing_provider text, provider_customer_id text, provider_subscription_id text,
 currency_code text not null default 'NGN', amount_minor bigint check(amount_minor is null or amount_minor>=0),
 billing_interval text not null default 'month' check(billing_interval in ('month','year','one_time')),
 current_period_start timestamptz, current_period_end timestamptz, cancel_at_period_end boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index subscriptions_agency_status_idx on public.subscriptions(agency_id,status);
create table public.agency_entitlements (
 agency_id uuid not null references public.agencies(id) on delete cascade, feature_code text not null,
 enabled boolean not null default false, limit_value integer, source text not null default 'plan' check(source in ('plan','override')),
 updated_at timestamptz not null default now(), primary key(agency_id,feature_code)
);

-- Agency operational tables. All use UUIDs and an explicit agency_id tenant key.
create table public.leads (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 lead_ref text, full_name text not null, email text, phone text, source text, status text not null default 'new',
 interest text, assigned_to uuid references public.agency_memberships(id) on delete set null, follow_up_at timestamptz,
 notes text, metadata jsonb not null default '{}'::jsonb, created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(agency_id,lead_ref), unique(agency_id,id)
);
create index leads_agency_created_idx on public.leads(agency_id,created_at desc);
create index leads_agency_status_idx on public.leads(agency_id,status);
create table public.lead_activities (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 lead_id uuid not null, activity_type text not null, body text, occurred_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 foreign key(agency_id,lead_id) references public.leads(agency_id,id) on delete cascade
);
create table public.customers (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 customer_ref text, full_name text not null, email text, phone text, date_of_birth date, nationality text, address text,
 notes text, metadata jsonb not null default '{}'::jsonb, created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(agency_id,customer_ref), unique(agency_id,id)
);
create index customers_agency_name_idx on public.customers(agency_id,full_name);
create table public.packages (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 package_ref text, name text not null, package_type text, description text, departure_location text,
 departure_date date, return_date date, duration_days integer, capacity integer check(capacity is null or capacity>=0),
 price_minor bigint not null default 0 check(price_minor>=0), currency_code text not null default 'NGN',
 status text not null default 'draft' check(status in ('draft','published','full','completed','archived')),
 supplier_name text, inclusions jsonb not null default '[]'::jsonb, notes text, metadata jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(agency_id,package_ref), unique(agency_id,id),
 check(return_date is null or departure_date is null or return_date>=departure_date)
);
create index packages_agency_departure_idx on public.packages(agency_id,departure_date);
create table public.bookings (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 booking_ref text, customer_id uuid, package_id uuid, lead_id uuid,
 status text not null default 'enquiry' check(status in ('enquiry','reserved','confirmed','cancelled','completed')),
 booking_date date not null default current_date, departure_date date, return_date date,
 traveller_count integer not null default 1 check(traveller_count>0), total_amount_minor bigint not null default 0 check(total_amount_minor>=0),
 currency_code text not null default 'NGN', notes text, metadata jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(agency_id,booking_ref), unique(agency_id,id),
 foreign key(agency_id,customer_id) references public.customers(agency_id,id) on delete restrict,
 foreign key(agency_id,package_id) references public.packages(agency_id,id) on delete restrict,
 foreign key(agency_id,lead_id) references public.leads(agency_id,id) on delete restrict
);
create index bookings_agency_departure_idx on public.bookings(agency_id,departure_date);
create index bookings_agency_customer_idx on public.bookings(agency_id,customer_id);
create index bookings_agency_status_idx on public.bookings(agency_id,status);
create table public.travellers (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 booking_id uuid, customer_id uuid, full_name text not null, date_of_birth date, gender text, nationality text,
 passport_number_encrypted text, passport_expiry date, visa_status text, room_group text, notes text,
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(agency_id,id),
 foreign key(agency_id,booking_id) references public.bookings(agency_id,id) on delete restrict,
 foreign key(agency_id,customer_id) references public.customers(agency_id,id) on delete restrict
);
create table public.payments (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 booking_id uuid not null, customer_id uuid, payment_ref text, amount_minor bigint not null check(amount_minor>0),
 currency_code text not null default 'NGN', payment_method text, payment_date timestamptz not null default now(),
 status text not null default 'confirmed' check(status in ('pending','confirmed','failed','reversed')),
 external_reference text, notes text, recorded_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), unique(agency_id,id),
 foreign key(agency_id,booking_id) references public.bookings(agency_id,id) on delete restrict,
 foreign key(agency_id,customer_id) references public.customers(agency_id,id) on delete restrict
);
create index payments_agency_booking_idx on public.payments(agency_id,booking_id,payment_date desc);
create table public.payment_reversals (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 payment_id uuid not null, amount_minor bigint not null check(amount_minor>0), reason text not null,
 reversed_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 foreign key(agency_id,payment_id) references public.payments(agency_id,id) on delete restrict
);
create table public.suppliers (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 name text not null, email text, phone text, notes text, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(agency_id,id)
);
create table public.supplier_costs (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 booking_id uuid, supplier_id uuid, description text not null, amount_minor bigint not null check(amount_minor>=0),
 currency_code text not null default 'NGN', due_date date, status text not null default 'unpaid' check(status in ('unpaid','part_paid','paid','void')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(agency_id,id),
 foreign key(agency_id,booking_id) references public.bookings(agency_id,id) on delete restrict,
 foreign key(agency_id,supplier_id) references public.suppliers(agency_id,id) on delete restrict
);
create table public.supplier_payments (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 supplier_cost_id uuid not null, amount_minor bigint not null check(amount_minor>0), currency_code text not null default 'NGN',
 payment_date timestamptz not null default now(), status text not null default 'confirmed' check(status in ('confirmed','void')),
 reference text, notes text, recorded_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 foreign key(agency_id,supplier_cost_id) references public.supplier_costs(agency_id,id) on delete restrict
);
create table public.documents (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 booking_id uuid, traveller_id uuid, customer_id uuid, document_type text not null, file_name text not null,
 storage_path text not null, mime_type text, file_size_bytes bigint check(file_size_bytes is null or file_size_bytes>=0),
 uploaded_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 foreign key(agency_id,booking_id) references public.bookings(agency_id,id) on delete cascade,
 foreign key(agency_id,traveller_id) references public.travellers(agency_id,id) on delete cascade,
 foreign key(agency_id,customer_id) references public.customers(agency_id,id) on delete cascade
);
create table public.agency_notes (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 title text not null, body text not null default '', category text, created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 title text not null, description text, status text not null default 'open' check(status in ('open','in_progress','completed','cancelled')),
 priority text not null default 'normal' check(priority in ('low','normal','high','urgent')), due_at timestamptz,
 assigned_to uuid references public.agency_memberships(id) on delete set null,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.activity_logs (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 actor_user_id uuid references auth.users(id) on delete set null, action text not null, entity_type text, entity_id uuid,
 details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index activity_logs_agency_created_idx on public.activity_logs(agency_id,created_at desc);
create table public.platform_audit_logs (
 id uuid primary key default gen_random_uuid(), actor_user_id uuid references auth.users(id) on delete set null,
 action text not null, entity_type text, entity_id uuid, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table public.agency_integrations (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 provider text not null, status text not null default 'disconnected' check(status in ('disconnected','pending','connected','error')),
 configuration jsonb not null default '{}'::jsonb, secret_reference text, connected_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(agency_id,provider)
);
create table public.integration_events (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
 integration_id uuid references public.agency_integrations(id) on delete set null, event_type text not null,
 status text not null default 'received', payload jsonb not null default '{}'::jsonb, error_message text,
 created_at timestamptz not null default now()
);
create table public.webhook_events (
 id uuid primary key default gen_random_uuid(), provider text not null, provider_event_id text not null,
 event_type text not null, payload jsonb not null default '{}'::jsonb, processed_at timestamptz,
 processing_error text, created_at timestamptz not null default now(), unique(provider,provider_event_id)
);

insert into public.permissions(code,module,action,description) values
 ('dashboard.view','dashboard','view','View dashboard'),
 ('leads.view','leads','view','View leads'),('leads.create','leads','create','Create leads'),('leads.update','leads','update','Edit leads'),('leads.delete','leads','delete','Delete leads'),
 ('customers.view','customers','view','View customers'),('customers.create','customers','create','Create customers'),('customers.update','customers','update','Edit customers'),('customers.delete','customers','delete','Delete customers'),
 ('packages.view','packages','view','View packages'),('packages.create','packages','create','Create packages'),('packages.update','packages','update','Edit packages'),('packages.delete','packages','delete','Delete packages'),
 ('bookings.view','bookings','view','View bookings'),('bookings.create','bookings','create','Create bookings'),('bookings.update','bookings','update','Edit bookings'),('bookings.cancel','bookings','cancel','Cancel bookings'),
 ('travellers.view','travellers','view','View travellers'),('travellers.create','travellers','create','Create travellers'),('travellers.update','travellers','update','Edit travellers'),('travellers.delete','travellers','delete','Delete travellers'),
 ('payments.view','payments','view','View payments'),('payments.record','payments','record','Record payments'),('payments.reverse','payments','reverse','Reverse payments'),
 ('supplier_payments.view','supplier_payments','view','View supplier payments'),('supplier_payments.manage','supplier_payments','manage','Manage supplier payments'),
 ('documents.view','documents','view','View documents'),('documents.upload','documents','upload','Upload documents'),('documents.delete','documents','delete','Delete documents'),
 ('notes.view','notes','view','View notes'),('notes.manage','notes','manage','Manage notes'),
 ('tasks.view','tasks','view','View tasks'),('tasks.manage','tasks','manage','Manage tasks'),
 ('reports.view','reports','view','View reports'),('reports.export','reports','export','Export reports'),
 ('team.view','team','view','View team'),('team.invite','team','invite','Invite team'),('team.manage_permissions','team','manage_permissions','Manage team permissions'),
 ('agency_settings.view','agency_settings','view','View settings'),('agency_settings.manage','agency_settings','manage','Manage settings'),
 ('billing.view','billing','view','View billing'),('billing.manage','billing','manage','Manage billing')
on conflict(code) do nothing;

insert into public.roles(agency_id,code,name,description,is_system,is_owner_role) values
 (null,'agency_owner','Agency Owner','Full agency permissions',true,true),
 (null,'administrator','Administrator','Agency administration',true,false),
 (null,'manager','Manager','Operational supervision',true,false),
 (null,'sales_agent','Sales Agent','Sales and booking work',true,false),
 (null,'finance_officer','Finance Officer','Financial records and reporting',true,false),
 (null,'operations_officer','Operations Officer','Traveller and trip operations',true,false),
 (null,'read_only','Read Only','View-only access',true,false)
on conflict do nothing;

insert into public.role_permissions(role_id,permission_code)
select r.id,p.code from public.roles r cross join public.permissions p where r.code='agency_owner' and r.agency_id is null
on conflict do nothing;
insert into public.role_permissions(role_id,permission_code)
select r.id,p.code from public.roles r cross join public.permissions p where r.code='administrator' and r.agency_id is null and p.code<>'billing.manage'
on conflict do nothing;
insert into public.role_permissions(role_id,permission_code)
select r.id,p.code from public.roles r cross join public.permissions p
where r.code='manager' and r.agency_id is null and p.code not in ('team.invite','team.manage_permissions','agency_settings.manage','billing.manage','payments.reverse','customers.delete','leads.delete','travellers.delete','documents.delete')
on conflict do nothing;
insert into public.role_permissions(role_id,permission_code)
select r.id,p.code from public.roles r cross join public.permissions p
where r.code='sales_agent' and r.agency_id is null and p.module in ('dashboard','leads','customers','packages','bookings','travellers','documents','notes','tasks')
on conflict do nothing;
insert into public.role_permissions(role_id,permission_code)
select r.id,p.code from public.roles r cross join public.permissions p
where r.code='finance_officer' and r.agency_id is null and p.module in ('dashboard','customers','bookings','payments','supplier_payments','reports')
on conflict do nothing;
insert into public.role_permissions(role_id,permission_code)
select r.id,p.code from public.roles r cross join public.permissions p
where r.code='operations_officer' and r.agency_id is null and p.module in ('dashboard','packages','bookings','travellers','documents','tasks')
on conflict do nothing;
insert into public.role_permissions(role_id,permission_code)
select r.id,p.code from public.roles r cross join public.permissions p where r.code='read_only' and r.agency_id is null and p.action='view'
on conflict do nothing;

insert into public.plans(code,name,description,max_additional_members,features) values
 ('basic','Basic','Core agency operations for one owner',0,'{"team_management":false,"custom_permissions":false,"website_integration":false,"automation":false}'),
 ('growth','Growth','Agency operations with five additional team seats',5,'{"team_management":true,"custom_permissions":true,"website_integration":true,"automation":false}'),
 ('pro','Pro','Advanced agency operations and integrations',5,'{"team_management":true,"custom_permissions":true,"website_integration":true,"automation":true}')
on conflict(code) do update set name=excluded.name,description=excluded.description,max_additional_members=excluded.max_additional_members,features=excluded.features,updated_at=now();

create or replace function app_private.is_platform_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.platform_admins p where p.user_id=(select auth.uid()) and p.is_active); $$;
create or replace function app_private.has_agency_permission(_agency_id uuid,_permission text)
returns boolean language sql stable security definer set search_path=''
as $$
 select (select auth.uid()) is not null and exists(
  select 1 from public.agency_memberships m join public.agencies a on a.id=m.agency_id
  left join public.roles r on r.id=m.role_id
  left join public.role_permissions rp on rp.role_id=r.id and rp.permission_code=_permission
  left join public.member_permissions mp on mp.membership_id=m.id and mp.permission_code=_permission
  where m.agency_id=_agency_id and m.user_id=(select auth.uid()) and m.status='active' and a.status='active'
  and (m.is_owner or coalesce(mp.is_allowed,rp.permission_code is not null,false))
 );
$$;
revoke all on function app_private.is_platform_admin() from public,anon;
revoke all on function app_private.has_agency_permission(uuid,text) from public,anon;
grant execute on function app_private.is_platform_admin() to authenticated,service_role;
grant execute on function app_private.has_agency_permission(uuid,text) to authenticated,service_role;

grant select,insert,update,delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- Enforce RLS on every public table in this migration, including internal platform tables.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public'
 loop execute format('alter table public.%I enable row level security',t.tablename); end loop;
end $$;

create policy "platform admin agencies" on public.agencies for all to authenticated using((select app_private.is_platform_admin())) with check((select app_private.is_platform_admin()));
create policy "members view own agency" on public.agencies for select to authenticated using(exists(select 1 from public.agency_memberships m where m.agency_id=id and m.user_id=(select auth.uid()) and m.status='active'));
create policy "agency settings update" on public.agencies for update to authenticated using((select app_private.has_agency_permission(id,'agency_settings.manage'))) with check((select app_private.has_agency_permission(id,'agency_settings.manage')));
create policy "application visibility" on public.agency_applications for select to authenticated using(applicant_user_id=(select auth.uid()) or (select app_private.is_platform_admin()));
create policy "submit own application" on public.agency_applications for insert to authenticated with check(applicant_user_id=(select auth.uid()));
create policy "platform review applications" on public.agency_applications for update to authenticated using((select app_private.is_platform_admin())) with check((select app_private.is_platform_admin()));

create policy "membership visibility" on public.agency_memberships for select to authenticated using(user_id=(select auth.uid()) or (select app_private.has_agency_permission(agency_id,'team.view')) or (select app_private.is_platform_admin()));
create policy "system and tenant roles visibility" on public.roles for select to authenticated using(is_system or (agency_id is not null and (select app_private.has_agency_permission(agency_id,'team.view'))));
create policy "tenant custom roles management" on public.roles for all to authenticated using(agency_id is not null and (select app_private.has_agency_permission(agency_id,'team.manage_permissions'))) with check(agency_id is not null and (select app_private.has_agency_permission(agency_id,'team.manage_permissions')));
create policy "permission catalogue" on public.permissions for select to authenticated using(true);
create policy "role permission visibility" on public.role_permissions for select to authenticated using(exists(select 1 from public.roles r where r.id=role_id and (r.is_system or (select app_private.has_agency_permission(r.agency_id,'team.view')))));
create policy "role permission management" on public.role_permissions for all to authenticated using(exists(select 1 from public.roles r where r.id=role_id and r.agency_id is not null and (select app_private.has_agency_permission(r.agency_id,'team.manage_permissions')))) with check(exists(select 1 from public.roles r where r.id=role_id and r.agency_id is not null and (select app_private.has_agency_permission(r.agency_id,'team.manage_permissions'))));
create policy "member permission visibility" on public.member_permissions for select to authenticated using(exists(select 1 from public.agency_memberships m where m.id=membership_id and (m.user_id=(select auth.uid()) or (select app_private.has_agency_permission(m.agency_id,'team.view')))));
create policy "member permission management" on public.member_permissions for all to authenticated using(exists(select 1 from public.agency_memberships m where m.id=membership_id and (select app_private.has_agency_permission(m.agency_id,'team.manage_permissions')))) with check(exists(select 1 from public.agency_memberships m where m.id=membership_id and (select app_private.has_agency_permission(m.agency_id,'team.manage_permissions'))));
create policy "invitation visibility" on public.agency_invitations for select to authenticated using((select app_private.has_agency_permission(agency_id,'team.view')));
create policy "invitation creation" on public.agency_invitations for insert to authenticated with check((select app_private.has_agency_permission(agency_id,'team.invite')) and invited_by_membership_id in(select id from public.agency_memberships where agency_id=agency_invitations.agency_id and user_id=(select auth.uid()) and status='active'));
create policy "invitation update" on public.agency_invitations for update to authenticated using((select app_private.has_agency_permission(agency_id,'team.invite'))) with check((select app_private.has_agency_permission(agency_id,'team.invite')));
create policy "active plan catalogue" on public.plans for select to authenticated using(is_active);
create policy "subscription visibility" on public.subscriptions for select to authenticated using((select app_private.has_agency_permission(agency_id,'billing.view')));
create policy "entitlement visibility" on public.agency_entitlements for select to authenticated using(exists(select 1 from public.agency_memberships m where m.agency_id=agency_entitlements.agency_id and m.user_id=(select auth.uid()) and m.status='active'));

-- Generic module policies. Permission checks are evaluated inside PostgreSQL, not in the browser.
do $$
declare item record; module_name text;
begin
 for item in select * from (values
  ('leads','leads'),('lead_activities','leads'),('customers','customers'),('packages','packages'),
  ('bookings','bookings'),('travellers','travellers'),('payments','payments'),('payment_reversals','payments'),
  ('suppliers','supplier_payments'),('supplier_costs','supplier_payments'),('supplier_payments','supplier_payments'),
  ('documents','documents'),('agency_notes','notes'),('tasks','tasks'),('activity_logs','reports'),
  ('agency_integrations','agency_settings'),('integration_events','agency_settings')
 ) as v(table_name,module_name)
 loop
  execute format('create policy %I on public.%I for select to authenticated using((select app_private.has_agency_permission(agency_id,%L)))',item.table_name||'_select',item.table_name,item.module_name||'.view');
  if item.table_name not in ('payments','payment_reversals','supplier_payments','integration_events','activity_logs') then
   execute format('create policy %I on public.%I for insert to authenticated with check((select app_private.has_agency_permission(agency_id,%L)))',item.table_name||'_insert',item.table_name,
    case item.table_name when 'lead_activities' then 'leads.create' when 'suppliers' then 'supplier_payments.manage' when 'supplier_costs' then 'supplier_payments.manage' when 'documents' then 'documents.upload' when 'agency_notes' then 'notes.manage' when 'tasks' then 'tasks.manage' when 'agency_integrations' then 'agency_settings.manage' else item.module_name||'.create' end);
   execute format('create policy %I on public.%I for update to authenticated using((select app_private.has_agency_permission(agency_id,%L))) with check((select app_private.has_agency_permission(agency_id,%L)))',item.table_name||'_update',item.table_name,
    case item.table_name when 'lead_activities' then 'leads.update' when 'suppliers' then 'supplier_payments.manage' when 'supplier_costs' then 'supplier_payments.manage' when 'documents' then 'documents.delete' when 'agency_notes' then 'notes.manage' when 'tasks' then 'tasks.manage' when 'agency_integrations' then 'agency_settings.manage' else item.module_name||'.update' end,
    case item.table_name when 'lead_activities' then 'leads.update' when 'suppliers' then 'supplier_payments.manage' when 'supplier_costs' then 'supplier_payments.manage' when 'documents' then 'documents.delete' when 'agency_notes' then 'notes.manage' when 'tasks' then 'tasks.manage' when 'agency_integrations' then 'agency_settings.manage' else item.module_name||'.update' end);
  end if;
  if item.table_name in ('leads','customers','packages','travellers','documents','agency_notes','tasks') then
   execute format('create policy %I on public.%I for delete to authenticated using((select app_private.has_agency_permission(agency_id,%L)))',item.table_name||'_delete',item.table_name,
    case item.table_name when 'agency_notes' then 'notes.manage' when 'documents' then 'documents.delete' when 'tasks' then 'tasks.manage' else item.module_name||'.delete' end);
  end if;
 end loop;
end $$;
create policy "payment record permission" on public.payments for insert to authenticated with check((select app_private.has_agency_permission(agency_id,'payments.record')));
create policy "payment reversal permission" on public.payment_reversals for insert to authenticated with check((select app_private.has_agency_permission(agency_id,'payments.reverse')));
create policy "supplier payment record permission" on public.supplier_payments for insert to authenticated with check((select app_private.has_agency_permission(agency_id,'supplier_payments.manage')));
create policy "platform audit visibility" on public.platform_audit_logs for select to authenticated using((select app_private.is_platform_admin()));
create policy "webhook events service role" on public.webhook_events for all to service_role using(true) with check(true);

create or replace function app_private.set_updated_at()
returns trigger language plpgsql set search_path=''
as $$ begin new.updated_at=now(); return new; end; $$;
do $$
declare t text;
begin
 foreach t in array array['agencies','agency_applications','roles','agency_memberships','plans','subscriptions','leads','customers','packages','bookings','travellers','suppliers','supplier_costs','agency_notes','tasks','agency_integrations']
 loop execute format('create trigger %I before update on public.%I for each row execute function app_private.set_updated_at()',t||'_updated_at',t); end loop;
end $$;
create index tasks_agency_due_idx on public.tasks(agency_id,due_at) where status in ('open','in_progress');
create index supplier_payments_cost_idx on public.supplier_payments(agency_id,supplier_cost_id,payment_date desc);
