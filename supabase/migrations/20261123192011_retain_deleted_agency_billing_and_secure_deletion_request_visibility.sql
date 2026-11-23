drop policy if exists "requester and platform admins can view deletion requests" on public.agency_deletion_requests;
create policy "requester and MFA verified platform admins can view deletion requests"
 on public.agency_deletion_requests for select to authenticated
 using(requested_by=(select auth.uid()) or (
  (select app_private.is_platform_admin()) and coalesce((select auth.jwt()->>'aal'),'')='aal2'
 ));
create index if not exists agency_deletion_requests_requested_by_idx on public.agency_deletion_requests(requested_by);
create index if not exists agency_deletion_requests_reviewed_by_idx on public.agency_deletion_requests(reviewed_by);
