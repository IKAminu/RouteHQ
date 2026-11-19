create or replace function public.transition_agency_payment(_payment_id uuid, _status text, _reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_next text := lower(trim(coalesce(_status,'')));
begin
  if auth.uid() is null then
    raise exception 'Sign in is required' using errcode = '42501';
  end if;
  if v_next not in ('pending','confirmed','failed','reversed') then
    raise exception 'Unsupported payment status' using errcode = '22023';
  end if;
  if v_next = 'reversed' then
    perform public.reverse_agency_payment(_payment_id, coalesce(nullif(trim(_reason),''),'Reversed by agency operator'));
    return;
  end if;
  select * into v_payment
  from public.payments
  where id = _payment_id
    and app_private.has_agency_permission(agency_id, 'payments.record')
  for update;
  if not found then
    raise exception 'Payment not found or permission denied' using errcode = '42501';
  end if;
  if v_payment.status = v_next then return; end if;
  if v_payment.status <> 'pending' or v_next not in ('confirmed','failed') then
    raise exception 'Only pending payments can be confirmed or marked failed' using errcode = '22023';
  end if;
  update public.payments set status = v_next where id = v_payment.id;
end;
$$;
revoke all on function public.transition_agency_payment(uuid,text,text) from public, anon;
grant execute on function public.transition_agency_payment(uuid,text,text) to authenticated;
