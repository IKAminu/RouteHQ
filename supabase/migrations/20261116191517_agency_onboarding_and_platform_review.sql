-- RouteHQ onboarding and platform review workflow.
create unique index if not exists agency_applications_one_open_per_user_idx
on public.agency_applications(applicant_user_id)
where status in ('pending','under_review');

create or replace function app_private.approve_agency_application(
  _application_id uuid,
  _slug text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_app public.agency_applications%rowtype;
  v_agency_id uuid;
  v_owner_role uuid;
  v_plan_id uuid;
begin
  if (select auth.uid()) is null or not (select app_private.is_platform_admin()) then
    raise exception 'Platform administrator access required' using errcode='42501';
  end if;

  select * into v_app
  from public.agency_applications
  where id=_application_id
  for update;

  if not found then raise exception 'Application not found'; end if;
  if v_app.status not in ('pending','under_review') then
    raise exception 'Only pending applications can be approved';
  end if;

  if _slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or length(_slug)<3 or length(_slug)>48 then
    raise exception 'Agency slug must be 3-48 lowercase letters, numbers or hyphens';
  end if;

  if exists(select 1 from public.agencies where slug=_slug) then
    raise exception 'That agency URL is already in use';
  end if;

  select id into v_owner_role from public.roles
  where code='agency_owner' and agency_id is null and is_system and is_owner_role;
  if v_owner_role is null then raise exception 'System owner role is missing'; end if;

  select id into v_plan_id from public.plans
  where code=v_app.requested_plan_code and is_active;
  if v_plan_id is null then raise exception 'Requested plan is unavailable'; end if;

  insert into public.agencies(name,slug,legal_name,registration_number,email,phone,country_code,status,approved_at,approved_by)
  values(v_app.agency_name,_slug,v_app.legal_name,v_app.registration_number,v_app.email,v_app.phone,v_app.country_code,'active',now(),auth.uid())
  returning id into v_agency_id;

  insert into public.agency_memberships(agency_id,user_id,role_id,status,is_owner,joined_at)
  values(v_agency_id,v_app.applicant_user_id,v_owner_role,'active',true,now());

  insert into public.subscriptions(agency_id,plan_id,status,currency_code,billing_interval)
  values(v_agency_id,v_plan_id,'pending','NGN','month');

  insert into public.agency_entitlements(agency_id,feature_code,enabled,limit_value,source)
  select v_agency_id, key, value::boolean, null, 'plan'
  from public.plans p, lateral jsonb_each_text(p.features)
  where p.id=v_plan_id
  on conflict(agency_id,feature_code) do update
    set enabled=excluded.enabled,source='plan',updated_at=now();

  update public.agency_applications
  set status='approved',agency_id=v_agency_id,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
  where id=_application_id;

  insert into public.platform_audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'agency.application.approved','agency',v_agency_id,
    jsonb_build_object('application_id',_application_id,'plan_code',v_app.requested_plan_code));

  return v_agency_id;
end;
$$;

revoke all on function app_private.approve_agency_application(uuid,text) from public,anon;
grant execute on function app_private.approve_agency_application(uuid,text) to authenticated;

create or replace function app_private.reject_agency_application(
  _application_id uuid,
  _review_notes text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_app public.agency_applications%rowtype;
begin
  if (select auth.uid()) is null or not (select app_private.is_platform_admin()) then
    raise exception 'Platform administrator access required' using errcode='42501';
  end if;
  select * into v_app from public.agency_applications where id=_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  if v_app.status not in ('pending','under_review') then raise exception 'Only pending applications can be rejected'; end if;
  update public.agency_applications
  set status='rejected',review_notes=left(coalesce(_review_notes,''),4000),
      reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
  where id=_application_id;
  insert into public.platform_audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'agency.application.rejected','agency_application',_application_id,
    jsonb_build_object('review_notes',left(coalesce(_review_notes,''),4000)));
end;
$$;
revoke all on function app_private.reject_agency_application(uuid,text) from public,anon;
grant execute on function app_private.reject_agency_application(uuid,text) to authenticated;

create or replace function app_private.get_my_agency_context()
returns table(
  agency_id uuid,
  agency_name text,
  agency_slug text,
  membership_id uuid,
  role_id uuid,
  role_code text,
  is_owner boolean,
  plan_code text,
  plan_name text,
  subscription_status text,
  max_additional_members integer
)
language sql
stable
security definer
set search_path=''
as $$
  select a.id,a.name,a.slug,m.id,r.id,r.code,m.is_owner,p.code,p.name,s.status,p.max_additional_members
  from public.agency_memberships m
  join public.agencies a on a.id=m.agency_id and a.status='active'
  join public.roles r on r.id=m.role_id
  left join lateral (
    select sub.* from public.subscriptions sub
    where sub.agency_id=a.id
    order by sub.created_at desc limit 1
  ) s on true
  left join public.plans p on p.id=s.plan_id
  where m.user_id=(select auth.uid()) and m.status='active'
  order by m.is_owner desc,a.created_at
  limit 1;
$$;
revoke all on function app_private.get_my_agency_context() from public,anon;
grant execute on function app_private.get_my_agency_context() to authenticated;

comment on function app_private.approve_agency_application(uuid,text) is
'Platform-admin-only transaction: creates an agency workspace, owner membership, pending subscription and plan entitlements, then audits the approval.';
comment on function app_private.reject_agency_application(uuid,text) is
'Platform-admin-only application rejection with an audit record.';
