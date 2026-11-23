-- Platform administrators can suspend/reactivate an agency with an immutable audit event.
create or replace function public.set_platform_agency_status(_agency_id uuid, _status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agency public.agencies%rowtype;
begin
  if (select auth.uid()) is null
     or coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2'
     or not (select app_private.is_platform_admin()) then
    raise exception 'Platform administrator with verified MFA required'
      using errcode = '42501';
  end if;

  if _status not in ('active','suspended') then
    raise exception 'Only active and suspended status transitions are supported';
  end if;

  select * into v_agency
  from public.agencies
  where id = _agency_id
  for update;

  if not found then
    raise exception 'Agency not found';
  end if;

  if v_agency.status not in ('active','suspended') then
    raise exception 'Only active or suspended agencies can change status';
  end if;

  if v_agency.status = _status then
    return;
  end if;

  update public.agencies
  set status = _status,
      suspended_at = case when _status = 'suspended' then now() else null end,
      updated_at = now()
  where id = _agency_id;

  insert into public.platform_audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),
    case when _status = 'suspended' then 'agency.suspended' else 'agency.reactivated' end,
    'agency',_agency_id,
    jsonb_build_object('previous_status',v_agency.status,'new_status',_status));
end;
$$;

revoke all on function public.set_platform_agency_status(uuid,text) from public, anon;
grant execute on function public.set_platform_agency_status(uuid,text) to authenticated;
comment on function public.set_platform_agency_status(uuid,text) is
'Platform-admin-only agency suspension/reactivation with AAL2 enforcement and audit logging.';
