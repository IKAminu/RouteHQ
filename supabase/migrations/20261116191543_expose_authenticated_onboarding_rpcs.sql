create or replace function public.approve_agency_application(_application_id uuid,_slug text)
returns uuid language sql security invoker set search_path=''
as $$ select app_private.approve_agency_application(_application_id,_slug); $$;
revoke all on function public.approve_agency_application(uuid,text) from public,anon;
grant execute on function public.approve_agency_application(uuid,text) to authenticated;

create or replace function public.reject_agency_application(_application_id uuid,_review_notes text)
returns void language sql security invoker set search_path=''
as $$ select app_private.reject_agency_application(_application_id,_review_notes); $$;
revoke all on function public.reject_agency_application(uuid,text) from public,anon;
grant execute on function public.reject_agency_application(uuid,text) to authenticated;

create or replace function public.get_my_agency_context()
returns table(
  agency_id uuid,agency_name text,agency_slug text,membership_id uuid,role_id uuid,
  role_code text,is_owner boolean,plan_code text,plan_name text,subscription_status text,
  max_additional_members integer
)
language sql stable security invoker set search_path=''
as $$ select * from app_private.get_my_agency_context(); $$;
revoke all on function public.get_my_agency_context() from public,anon;
grant execute on function public.get_my_agency_context() to authenticated;
