-- Website-to-agency intake and private document uploads.
-- All website connection secrets are stored as SHA-256 hashes and only returned once.

alter table public.documents
  add column if not exists payment_id uuid,
  add column if not exists ocr_status text not null default 'not_configured',
  add column if not exists ocr_result jsonb not null default '{}'::jsonb;

alter table public.documents
  drop constraint if exists documents_agency_id_payment_id_fkey;
alter table public.documents
  add constraint documents_agency_id_payment_id_fkey
  foreign key (agency_id, payment_id)
  references public.payments (agency_id, id)
  on delete set null (payment_id);

alter table public.documents
  drop constraint if exists documents_ocr_status_check;
alter table public.documents
  add constraint documents_ocr_status_check
  check (ocr_status in ('not_configured','queued','processing','complete','failed'));

create index if not exists documents_agency_payment_idx
  on public.documents (agency_id, payment_id)
  where payment_id is not null;
create index if not exists documents_agency_traveller_idx
  on public.documents (agency_id, traveller_id)
  where traveller_id is not null;

comment on column public.documents.ocr_status is
  'OCR pipeline placeholder. No OCR provider is connected yet; uploaded files remain available for later processing.';
comment on column public.documents.ocr_result is
  'Structured OCR output placeholder. Keep empty until a reviewed OCR provider is connected.';

create table if not exists public.agency_website_connections (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null unique references public.agencies(id) on delete cascade,
  website_url text not null,
  allowed_origin text not null,
  token_hash text not null,
  token_last_four text not null,
  status text not null default 'active'
    check (status in ('active','disabled','error')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_rotated_at timestamptz not null default now(),
  constraint agency_website_connections_https_url
    check (website_url ~* '^https://[^[:space:]]+$'),
  constraint agency_website_connections_https_origin
    check (allowed_origin ~* '^https://[^/[:space:]]+$')
);

create table if not exists public.website_intake_submissions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  connection_id uuid not null references public.agency_website_connections(id) on delete cascade,
  external_submission_id text not null,
  lead_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received'
    check (status in ('processing','received','failed')),
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (agency_id, external_submission_id),
  constraint website_intake_submissions_agency_lead_fkey
    foreign key (agency_id, lead_id)
    references public.leads (agency_id, id)
    on delete set null (lead_id)
);

create index if not exists website_intake_submissions_agency_created_idx
  on public.website_intake_submissions (agency_id, created_at desc);

alter table public.agency_website_connections enable row level security;
alter table public.website_intake_submissions enable row level security;
revoke all on public.agency_website_connections from public, anon, authenticated;
revoke all on public.website_intake_submissions from public, anon, authenticated;
grant select, insert, update, delete on public.agency_website_connections to service_role;
grant select, insert, update, delete on public.website_intake_submissions to service_role;

create or replace function public.get_platform_website_connections()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null
     or coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2'
     or not (select app_private.is_platform_admin()) then
    raise exception 'Platform administrator with verified MFA required'
      using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'agency_id', a.id,
    'agency_name', a.name,
    'agency_status', a.status,
    'website_url', a.website_url,
    'connection_id', c.id,
    'connection_status', coalesce(c.status, 'disconnected'),
    'allowed_origin', c.allowed_origin,
    'token_last_four', c.token_last_four,
    'last_rotated_at', c.last_rotated_at,
    'submission_count', coalesce(s.submission_count, 0),
    'last_submission_at', s.last_submission_at
  ) order by a.name), '[]'::jsonb)
  into v_result
  from public.agencies a
  left join public.agency_website_connections c on c.agency_id = a.id
  left join lateral (
    select count(*)::integer as submission_count, max(created_at) as last_submission_at
    from public.website_intake_submissions x
    where x.agency_id = a.id
  ) s on true;

  return v_result;
end;
$$;

revoke all on function public.get_platform_website_connections() from public, anon;
grant execute on function public.get_platform_website_connections() to authenticated;

create or replace function public.platform_configure_website_connection(
  _agency_id uuid,
  _website_url text,
  _allowed_origin text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_connection public.agency_website_connections%rowtype;
  v_agency_name text;
begin
  if (select auth.uid()) is null
     or coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2'
     or not (select app_private.is_platform_admin()) then
    raise exception 'Platform administrator with verified MFA required'
      using errcode = '42501';
  end if;

  if _website_url is null or _website_url !~* '^https://[^[:space:]]+$' then
    raise exception 'Enter the full HTTPS website URL.';
  end if;
  if _allowed_origin is null or _allowed_origin !~* '^https://[^/[:space:]]+$' then
    raise exception 'Enter the website origin, for example https://agency.example.';
  end if;

  select name into v_agency_name from public.agencies where id = _agency_id;
  if not found then raise exception 'Agency not found'; end if;

  -- The raw key is returned once. Only its digest is retained in the database.
  v_token := 'rh_live_' ||
    encode(extensions.gen_random_bytes(32), 'hex');

  update public.agencies
    set website_url = _website_url, updated_at = now()
    where id = _agency_id;

  insert into public.agency_website_connections (
    agency_id, website_url, allowed_origin, token_hash, token_last_four,
    status, created_by, last_rotated_at, updated_at
  ) values (
    _agency_id, _website_url, _allowed_origin,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    right(v_token, 4), 'active', auth.uid(), now(), now()
  )
  on conflict (agency_id) do update set
    website_url = excluded.website_url,
    allowed_origin = excluded.allowed_origin,
    token_hash = excluded.token_hash,
    token_last_four = excluded.token_last_four,
    status = 'active',
    created_by = excluded.created_by,
    last_rotated_at = now(),
    updated_at = now()
  returning * into v_connection;

  insert into public.platform_audit_logs(actor_user_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'agency.website_intake.configured', 'agency', _agency_id,
    jsonb_build_object('website_url', _website_url, 'allowed_origin', _allowed_origin,
      'connection_id', v_connection.id, 'token_last_four', v_connection.token_last_four));

  return jsonb_build_object(
    'agency_name', v_agency_name,
    'website_url', _website_url,
    'allowed_origin', _allowed_origin,
    'api_key', v_token,
    'endpoint', 'https://viohesitrhrtkulcdnqk.supabase.co/functions/v1/website-intake'
  );
end;
$$;

revoke all on function public.platform_configure_website_connection(uuid,text,text) from public, anon;
grant execute on function public.platform_configure_website_connection(uuid,text,text) to authenticated;

create or replace function public.platform_disable_website_connection(_agency_id uuid)
returns void
language plpgsql
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

  update public.agency_website_connections
    set status = 'disabled', updated_at = now()
    where agency_id = _agency_id;

  insert into public.platform_audit_logs(actor_user_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'agency.website_intake.disabled', 'agency', _agency_id, '{}'::jsonb);
end;
$$;

revoke all on function public.platform_disable_website_connection(uuid) from public, anon;
grant execute on function public.platform_disable_website_connection(uuid) to authenticated;

comment on table public.agency_website_connections is
  'Server-to-server website intake credentials. Raw API keys are never stored; only SHA-256 digests are retained.';
comment on table public.website_intake_submissions is
  'Idempotent log of agency website submissions routed into agency leads. OCR and document extraction are separate future processing stages.';
