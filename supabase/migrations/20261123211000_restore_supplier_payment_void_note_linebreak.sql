
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
  notes=concat_ws(E'\n',nullif(notes,''),'Voided: '||trim(_reason))
 where id=v_payment.id;
 select coalesce(sum(amount_minor),0) into v_paid from public.supplier_payments
 where agency_id=v_payment.agency_id and supplier_cost_id=v_payment.supplier_cost_id and status='confirmed';
 select amount_minor,due_date into v_amount,v_due from public.supplier_costs
 where id=v_payment.supplier_cost_id and agency_id=v_payment.agency_id for update;
 v_status:=case when v_paid>=v_amount then 'paid' when v_paid>0 then 'part_paid' else 'unpaid' end;
 update public.supplier_costs set status=v_status where id=v_payment.supplier_cost_id;
end; $$;
