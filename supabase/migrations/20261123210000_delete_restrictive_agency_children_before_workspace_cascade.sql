
create or replace function public.finalize_agency_deletion(_request_id uuid,_confirmation_name text)
returns void language plpgsql security definer set search_path=''
as $$
declare
 v_request public.agency_deletion_requests%rowtype;
 v_retained_subscriptions integer;
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

 select count(*) into v_retained_subscriptions from public.subscriptions where agency_id=v_request.agency_id;

 -- Remove restrictive child records in dependency order before the agency cascade.
 delete from public.agency_invitations where agency_id=v_request.agency_id;
 delete from public.payment_reversals where agency_id=v_request.agency_id;
 delete from public.supplier_payments where agency_id=v_request.agency_id;
 delete from public.payments where agency_id=v_request.agency_id;
 delete from public.bookings where agency_id=v_request.agency_id;
 delete from public.agency_memberships where agency_id=v_request.agency_id;
 delete from public.roles where agency_id=v_request.agency_id;

 update public.agency_deletion_requests set status='completed',agency_id=null,completed_at=now(),
  processing_error=null,updated_at=now() where id=_request_id;
 update public.subscriptions set agency_name_snapshot=coalesce(agency_name_snapshot,v_request.agency_name_snapshot),
  status='cancelled',cancel_at_period_end=false,updated_at=now() where agency_id=v_request.agency_id;

 insert into public.platform_audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values((select auth.uid()),'agency.workspace.deleted','agency',v_request.agency_id,
  jsonb_build_object('request_id',_request_id,'agency_name',v_request.agency_name_snapshot,
   'agency_slug',v_request.agency_slug_snapshot,'requested_by_email',v_request.requester_email_snapshot,
   'retained_subscription_records',v_retained_subscriptions));
 delete from public.agencies where id=v_request.agency_id;
end; $$;
