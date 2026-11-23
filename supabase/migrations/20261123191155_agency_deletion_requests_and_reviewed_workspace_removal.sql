-- Reviewed agency workspace deletion. Requests are owner-submitted and platform-admin approved.
create table public.agency_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete set null,
  agency_name_snapshot text not null,
  agency_slug_snapshot text not null,
  requested_by uuid references auth.users(id) on delete set null,
  requester_email_snapshot text,
  reason text not null default '',
  status text not null default 'pending' check(status in ('pending','approved','rejected','processing','completed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  processing_error text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index agency_deletion_requests_status_requested_idx on public.agency_deletion_requests(status,requested_at desc);
create index agency_deletion_requests_agency_idx on public.agency_deletion_requests(agency_id);
alter table public.agency_deletion_requests enable row level security;
create policy "requester and platform admins can view deletion requests"
 on public.agency_deletion_requests for select to authenticated
 using(requested_by=(select auth.uid()) or (select app_private.is_platform_admin()));
revoke all on public.agency_deletion_requests from anon,authenticated;
grant select on public.agency_deletion_requests to authenticated;

alter table public.subscriptions add column if not exists agency_name_snapshot text;
update public.subscriptions s set agency_name_snapshot=a.name
from public.agencies a where a.id=s.agency_id and s.agency_name_snapshot is null;
alter table public.subscriptions alter column agency_id drop not null;
alter table public.subscriptions drop constraint if exists subscriptions_agency_id_fkey;
alter table public.subscriptions add constraint subscriptions_agency_id_fkey
 foreign key(agency_id) references public.agencies(id) on delete set null;

create or replace function public.request_agency_deletion(_reason text default '')
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_agency public.agencies%rowtype; v_request_id uuid;
begin
 if (select auth.uid()) is null or coalesce((select auth.jwt()->>'aal'),'')<>'aal2' then
  raise exception 'A signed-in account with verified two-step authentication is required' using errcode='42501';
 end if;
 select a.* into v_agency from public.agencies a
 join public.agency_memberships m on m.agency_id=a.id
 where m.user_id=(select auth.uid()) and m.status='active' and m.is_owner=true and a.status='active'
 for update of a;
 if not found then raise exception 'Only the active agency owner can request workspace deletion' using errcode='42501'; end if;
 if exists(select 1 from public.agency_deletion_requests r where r.agency_id=v_agency.id and r.status in ('pending','approved','processing')) then
  raise exception 'A deletion request is already awaiting review or processing';
 end if;
 insert into public.agency_deletion_requests(agency_id,agency_name_snapshot,agency_slug_snapshot,requested_by,requester_email_snapshot,reason)
 values(v_agency.id,v_agency.name,v_agency.slug,(select auth.uid()),
  (select email from auth.users where id=(select auth.uid())),left(coalesce(trim(_reason),''),2000))
 returning id into v_request_id;
 insert into public.platform_audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values((select auth.uid()),'agency.deletion.requested','agency',v_agency.id,
  jsonb_build_object('request_id',v_request_id,'agency_name',v_agency.name));
 return v_request_id;
end; $$;

create or replace function public.review_agency_deletion_request(_request_id uuid,_decision text,_review_notes text default '')
returns void language plpgsql security definer set search_path=''
as $$
declare v_request public.agency_deletion_requests%rowtype;
begin
 if (select auth.uid()) is null or coalesce((select auth.jwt()->>'aal'),'')<>'aal2'
  or not (select app_private.is_platform_admin()) then
  raise exception 'Platform administrator with verified MFA required' using errcode='42501';
 end if;
 if _decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
 select * into v_request from public.agency_deletion_requests where id=_request_id for update;
 if not found or v_request.status<>'pending' then raise exception 'Only pending deletion requests can be reviewed'; end if;
 update public.agency_deletion_requests set status=_decision,reviewed_by=(select auth.uid()),
  reviewed_at=now(),review_notes=left(coalesce(trim(_review_notes),''),2000),
  processing_error=null,updated_at=now() where id=_request_id;
 insert into public.platform_audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values((select auth.uid()),'agency.deletion.'||_decision,'agency',v_request.agency_id,
  jsonb_build_object('request_id',_request_id,'agency_name',v_request.agency_name_snapshot,
   'review_notes',left(coalesce(trim(_review_notes),''),2000)));
end; $$;

create or replace function public.begin_agency_deletion(_request_id uuid,_confirmation_name text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_request public.agency_deletion_requests%rowtype;
begin
 if (select auth.uid()) is null or coalesce((select auth.jwt()->>'aal'),'')<>'aal2'
  or not (select app_private.is_platform_admin()) then
  raise exception 'Platform administrator with verified MFA required' using errcode='42501';
 end if;
 select * into v_request from public.agency_deletion_requests where id=_request_id for update;
 if not found or v_request.status<>'approved' or v_request.agency_id is null then
  raise exception 'This deletion request is not approved or its agency no longer exists';
 end if;
 if coalesce(trim(_confirmation_name),'')<>v_request.agency_name_snapshot then
  raise exception 'The agency name does not match. Deletion has not started.';
 end if;
 update public.agency_deletion_requests set status='processing',processing_error=null,updated_at=now() where id=_request_id;
 return jsonb_build_object('agency_id',v_request.agency_id,'agency_name',v_request.agency_name_snapshot);
end; $$;

create or replace function public.release_agency_deletion(_request_id uuid,_error text)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if (select auth.uid()) is null or coalesce((select auth.jwt()->>'aal'),'')<>'aal2'
  or not (select app_private.is_platform_admin()) then
  raise exception 'Platform administrator with verified MFA required' using errcode='42501';
 end if;
 update public.agency_deletion_requests set status='approved',
  processing_error=left(coalesce(_error,'Storage cleanup failed'),2000),updated_at=now()
 where id=_request_id and status='processing';
 if not found then raise exception 'Deletion request is not processing'; end if;
end; $$;

create or replace function public.finalize_agency_deletion(_request_id uuid,_confirmation_name text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_request public.agency_deletion_requests%rowtype;
begin
 if (select auth.uid()) is null or coalesce((select auth.jwt()->>'aal'),'')<>'aal2'
  or not (select app_private.is_platform_admin()) then
  raise exception 'Platform administrator with verified MFA required' using errcode='42501';
 end if;
 select * into v_request from public.agency_deletion_requests where id=_request_id for update;
 if not found or v_request.status<>'processing' or v_request.agency_id is null then
  raise exception 'Deletion request is not ready to be completed';
 end if;
 if coalesce(trim(_confirmation_name),'')<>v_request.agency_name_snapshot then
  raise exception 'The agency name does not match. Deletion has not been completed.';
 end if;
 if exists(select 1 from storage.objects where bucket_id='routehq-documents' and name like v_request.agency_id::text||'/%') then
  raise exception 'Private documents remain in storage. Workspace deletion was stopped.';
 end if;
 update public.agency_deletion_requests set status='completed',agency_id=null,completed_at=now(),
  processing_error=null,updated_at=now() where id=_request_id;
 update public.subscriptions set agency_name_snapshot=coalesce(agency_name_snapshot,v_request.agency_name_snapshot)
  where agency_id=v_request.agency_id;
 insert into public.platform_audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values((select auth.uid()),'agency.workspace.deleted','agency',v_request.agency_id,
  jsonb_build_object('request_id',_request_id,'agency_name',v_request.agency_name_snapshot,
   'agency_slug',v_request.agency_slug_snapshot,'requested_by_email',v_request.requester_email_snapshot,
   'retained_subscription_records',(select count(*) from public.subscriptions where agency_id=v_request.agency_id)));
 delete from public.agencies where id=v_request.agency_id;
end; $$;

revoke all on function public.request_agency_deletion(text) from public,anon;
revoke all on function public.review_agency_deletion_request(uuid,text,text) from public,anon;
revoke all on function public.begin_agency_deletion(uuid,text) from public,anon;
revoke all on function public.release_agency_deletion(uuid,text) from public,anon;
revoke all on function public.finalize_agency_deletion(uuid,text) from public,anon;
grant execute on function public.request_agency_deletion(text) to authenticated;
grant execute on function public.review_agency_deletion_request(uuid,text,text) to authenticated;
grant execute on function public.begin_agency_deletion(uuid,text) to authenticated;
grant execute on function public.release_agency_deletion(uuid,text) to authenticated;
grant execute on function public.finalize_agency_deletion(uuid,text) to authenticated;
