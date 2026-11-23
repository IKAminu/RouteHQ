
create or replace function public.reverse_agency_payment(_payment_id uuid,_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_payment public.payments%rowtype;
begin
 if (select auth.uid()) is null or coalesce((select auth.jwt()->>'aal'),'')<>'aal2' or coalesce(trim(_reason),'')='' then
  raise exception 'A verified two-step session and reversal reason are required' using errcode='42501';
 end if;
 select * into v_payment from public.payments
 where id=_payment_id and app_private.has_agency_permission(agency_id,'payments.reverse')
 for update;
 if not found then raise exception 'Payment not found or reversal permission denied' using errcode='42501'; end if;
 if v_payment.status='reversed' then return; end if;
 if v_payment.status<>'confirmed' then raise exception 'Only confirmed payments can be reversed' using errcode='22023'; end if;
 insert into public.payment_reversals(agency_id,payment_id,amount_minor,reason,reversed_by)
 values(v_payment.agency_id,v_payment.id,v_payment.amount_minor,trim(_reason),(select auth.uid()));
 update public.payments set status='reversed' where id=v_payment.id;
end; $$;

create or replace function public.transition_agency_payment(_payment_id uuid,_status text,_reason text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare v_payment public.payments%rowtype; v_next text:=lower(trim(coalesce(_status,'')));
begin
 if (select auth.uid()) is null or coalesce((select auth.jwt()->>'aal'),'')<>'aal2' then
  raise exception 'A verified two-step session is required' using errcode='42501';
 end if;
 if v_next not in ('pending','confirmed','failed','reversed') then raise exception 'Unsupported payment status' using errcode='22023'; end if;
 if v_next='reversed' then
  perform public.reverse_agency_payment(_payment_id,coalesce(nullif(trim(_reason),''),'Reversed by agency operator'));
  return;
 end if;
 select * into v_payment from public.payments
 where id=_payment_id and app_private.has_agency_permission(agency_id,'payments.record')
 for update;
 if not found then raise exception 'Payment not found or permission denied' using errcode='42501'; end if;
 if v_payment.status=v_next then return; end if;
 if v_payment.status<>'pending' or v_next not in ('confirmed','failed') then
  raise exception 'Only pending payments can be confirmed or marked failed' using errcode='22023';
 end if;
 update public.payments set status=v_next where id=v_payment.id;
end; $$;

create or replace function public.void_agency_supplier_payment(_supplier_payment_id uuid,_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare
 v_payment public.supplier_payments%rowtype; v_paid bigint; v_amount bigint; v_due date; v_status text;
begin
 if (select auth.uid()) is null or coalesce((select auth.jwt()->>'aal'),'')<>'aal2' or coalesce(trim(_reason),'')='' then
  raise exception 'A verified two-step session and void reason are required' using errcode='42501';
 end if;
 select * into v_payment from public.supplier_payments
 where id=_supplier_payment_id and app_private.has_agency_permission(agency_id,'supplier_payments.manage')
 for update;
 if not found then raise exception 'Supplier payment not found or permission denied' using errcode='42501'; end if;
 if v_payment.status='void' then return; end if;
 update public.supplier_payments set status='void',
  notes=concat_ws(E'\\n',nullif(notes,''),'Voided: '||trim(_reason))
 where id=v_payment.id;
 select coalesce(sum(amount_minor),0) into v_paid from public.supplier_payments
 where agency_id=v_payment.agency_id and supplier_cost_id=v_payment.supplier_cost_id and status='confirmed';
 select amount_minor,due_date into v_amount,v_due from public.supplier_costs
 where id=v_payment.supplier_cost_id and agency_id=v_payment.agency_id for update;
 v_status:=case when v_paid>=v_amount then 'paid' when v_paid>0 then 'part_paid' else 'unpaid' end;
 update public.supplier_costs set status=v_status where id=v_payment.supplier_cost_id;
end; $$;
