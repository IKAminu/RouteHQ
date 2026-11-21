create or replace function public.ingest_website_lead(
  _token_hash text,
  _origin text,
  _external_submission_id text,
  _payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.agency_website_connections%rowtype;
  v_submission_id uuid;
  v_lead_id uuid;
  v_name text;
  v_email text;
  v_phone text;
  v_interest text;
  v_notes text;
begin
  if _token_hash is null or length(_token_hash) <> 64
     or _external_submission_id is null
     or length(_external_submission_id) < 8
     or length(_external_submission_id) > 160
     or jsonb_typeof(_payload) <> 'object' then
    raise exception 'Invalid website submission.';
  end if;

  select * into v_connection
  from public.agency_website_connections
  where token_hash = _token_hash and status = 'active'
  limit 1;

  if not found then raise exception 'Invalid or disabled website connection.' using errcode='42501'; end if;
  if _origin is null or _origin <> v_connection.allowed_origin then
    raise exception 'Website origin is not allowed.' using errcode='42501';
  end if;

  if not exists (select 1 from public.agencies where id=v_connection.agency_id and status='active') then
    raise exception 'Agency workspace is not active.' using errcode='42501';
  end if;

  v_name := left(trim(coalesce(_payload->>'full_name', _payload->>'name', '')), 180);
  v_email := nullif(left(trim(coalesce(_payload->>'email','')), 254), '');
  v_phone := nullif(left(trim(coalesce(_payload->>'phone','')), 48), '');
  v_interest := nullif(left(trim(coalesce(_payload->>'interest', _payload->>'service','')), 160), '');
  v_notes := nullif(left(trim(coalesce(_payload->>'message', _payload->>'notes','')), 4000), '');

  if v_name = '' then raise exception 'A full name is required.'; end if;
  if v_email is null and v_phone is null then
    raise exception 'Provide an email address or phone number.';
  end if;

  insert into public.website_intake_submissions(
    agency_id, connection_id, external_submission_id, payload, status
  ) values (
    v_connection.agency_id, v_connection.id, _external_submission_id,
    jsonb_build_object('full_name',v_name,'email',v_email,'phone',v_phone,
      'interest',v_interest,'message',v_notes), 'processing'
  )
  on conflict (agency_id, external_submission_id) do nothing
  returning id into v_submission_id;

  if v_submission_id is null then
    select id, lead_id into v_submission_id, v_lead_id
    from public.website_intake_submissions
    where agency_id=v_connection.agency_id and external_submission_id=_external_submission_id;
    return jsonb_build_object('ok',true,'duplicate',true,'submission_id',v_submission_id,'lead_id',v_lead_id);
  end if;

  insert into public.leads(
    agency_id, full_name, email, phone, source, status, interest, notes, metadata
  ) values (
    v_connection.agency_id, v_name, v_email, v_phone, 'Website', 'new', v_interest, v_notes,
    jsonb_build_object('intake_source','agency_website','website_submission_id',v_submission_id)
  )
  returning id into v_lead_id;

  update public.website_intake_submissions
  set lead_id=v_lead_id, status='received', processed_at=now()
  where id=v_submission_id;

  return jsonb_build_object('ok',true,'duplicate',false,'submission_id',v_submission_id,'lead_id',v_lead_id);
end;
$$;

revoke all on function public.ingest_website_lead(text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.ingest_website_lead(text,text,text,jsonb) to service_role;

alter table public.documents
  drop constraint if exists documents_upload_owner_check;
alter table public.documents
  add constraint documents_upload_owner_check
  check (
    num_nonnulls(traveller_id,payment_id)=1
    and customer_id is null
    and booking_id is null
  );

comment on function public.ingest_website_lead(text,text,text,jsonb) is
  'Service-role-only website lead intake. Validates hashed API key and allowed origin, prevents duplicate external submission IDs, and creates a tenant-scoped lead.';
