drop policy if exists "requester and platform admins can view deletion requests" on public.agency_deletion_requests;
create policy "requester and MFA verified platform admins can view deletion requests"
 on public.agency_deletion_requests for select to authenticated
 using(requested_by=(select auth.uid()) or (
  (select app_private.is_platform_admin()) and coalesce((select auth.jwt()->>'aal'),'')='aal2'
 ));
create index if not exists agency_deletion_requests_requested_by_idx on public.agency_deletion_requests(requested_by);
create index if not exists agency_deletion_requests_reviewed_by_idx on public.agency_deletion_requests(reviewed_by);


-- Keep subscription history visible after an agency workspace has been deleted.
create or replace function public.get_platform_admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if (select auth.uid()) is null
     or coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2'
     or not (select app_private.is_platform_admin()) then
    raise exception 'Platform administrator with verified MFA required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'generated_at', now(),
    'metrics', jsonb_build_object(
      'agencies_total', (select count(*) from public.agencies),
      'agencies_active', (select count(*) from public.agencies where status = 'active'),
      'agencies_suspended', (select count(*) from public.agencies where status = 'suspended'),
      'applications_pending', (select count(*) from public.agency_applications where status in ('pending','under_review')),
      'users_total', (select count(*) from auth.users),
      'memberships_active', (select count(*) from public.agency_memberships where status = 'active'),
      'subscriptions_active', (select count(*) from public.subscriptions where status = 'active'),
      'subscriptions_pending', (select count(*) from public.subscriptions where status = 'pending'),
      'subscriptions_ending_30d', (select count(*) from public.subscriptions where status = 'active' and current_period_end >= now() and current_period_end < now() + interval '30 days'),
      'mrr_minor', (select coalesce(sum(amount_minor),0) from public.subscriptions where status = 'active' and billing_interval = 'month'),
      'arr_minor', (select coalesce(sum(amount_minor) * 12,0) from public.subscriptions where status = 'active' and billing_interval = 'month')
    ),
    'subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'agency_id', s.agency_id,
        'agency_name', coalesce(a.name, s.agency_name_snapshot, 'Deleted agency'),
        'agency_status', coalesce(a.status, 'deleted'),
        'plan_code', p.code, 'plan_name', p.name, 'status', s.status,
        'currency_code', s.currency_code, 'amount_minor', s.amount_minor,
        'billing_interval', s.billing_interval, 'started_at', s.current_period_start,
        'ends_at', s.current_period_end, 'cancel_at_period_end', s.cancel_at_period_end,
        'created_at', s.created_at
      ) order by s.current_period_end asc nulls last, s.created_at desc)
      from public.subscriptions s
      left join public.agencies a on a.id = s.agency_id
      left join public.plans p on p.id = s.plan_id
    ), '[]'::jsonb),
    'storage', jsonb_build_object(
      'files', (select count(*) from storage.objects where bucket_id = 'routehq-documents'),
      'bytes', (select coalesce(sum((metadata ->> 'size')::bigint),0) from storage.objects where bucket_id = 'routehq-documents'),
      'bucket_id', 'routehq-documents',
      'private', (select not public from storage.buckets where id = 'routehq-documents')
    ),
    'database', jsonb_build_object(
      'bytes', pg_catalog.pg_database_size(current_database()),
      'pretty', pg_catalog.pg_size_pretty(pg_catalog.pg_database_size(current_database())),
      'version', pg_catalog.version()
    ),
    'operations', jsonb_build_object(
      'webhook_failures', (select count(*) from public.webhook_events where processing_error is not null),
      'integration_errors', (select count(*) from public.integration_events where status = 'error'),
      'pending_applications', (select count(*) from public.agency_applications where status in ('pending','under_review'))
    ),
    'recent_activity', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'action', l.action, 'entity_type', l.entity_type,
        'entity_id', l.entity_id, 'details', l.details, 'created_at', l.created_at,
        'actor_email', u.email
      ) order by l.created_at desc)
      from (select * from public.platform_audit_logs order by created_at desc limit 12) l
      left join auth.users u on u.id = l.actor_user_id
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.get_platform_admin_overview() from public, anon;
grant execute on function public.get_platform_admin_overview() to authenticated;
