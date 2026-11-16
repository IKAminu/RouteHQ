-- Run only after the intended platform administrator has created and confirmed
-- their RouteHQ Auth account. Replace the placeholder email before execution.
-- This is intentionally a manual, privileged bootstrap. Never expose this as a
-- browser-facing RPC or allow users to promote themselves.

do $$
declare
  target_email text := lower('REPLACE_WITH_CONFIRMED_ADMIN_EMAIL');
  target_user_id uuid;
  matching_users integer;
begin
  if target_email = 'replace_with_confirmed_admin_email' or position('@' in target_email) < 2 then
    raise exception 'Replace the placeholder with the confirmed platform administrator email.';
  end if;

  select count(*) into matching_users
  from auth.users
  where lower(email) = target_email
    and email_confirmed_at is not null;

  if matching_users <> 1 then
    raise exception 'Expected exactly one confirmed Auth user for %, found %.', target_email, matching_users;
  end if;

  select id into target_user_id
  from auth.users
  where lower(email) = target_email
    and email_confirmed_at is not null;

  insert into public.platform_admins(user_id,is_active)
  values(target_user_id,true)
  on conflict(user_id) do update set is_active=true;

  insert into public.platform_audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(target_user_id,'platform.admin.bootstrapped','auth_user',target_user_id,
    jsonb_build_object('method','manual SQL bootstrap'));
end $$;
