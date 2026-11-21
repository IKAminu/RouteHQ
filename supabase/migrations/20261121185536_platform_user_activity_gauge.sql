create or replace function public.get_platform_user_activity()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2'
     or not (select app_private.is_platform_admin()) then
    raise exception 'Platform administrator with verified MFA required'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'users_total', (select count(*) from auth.users),
    'users_active', (select count(distinct user_id) from public.agency_memberships where status='active'),
    'memberships_active', (select count(*) from public.agency_memberships where status='active')
  );
end;
$$;

revoke all on function public.get_platform_user_activity() from public, anon;
grant execute on function public.get_platform_user_activity() to authenticated;

comment on function public.get_platform_user_activity() is
  'MFA-gated platform user activity metrics. Active users are distinct accounts with at least one active agency membership.';
