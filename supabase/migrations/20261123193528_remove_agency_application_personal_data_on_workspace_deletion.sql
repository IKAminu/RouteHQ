
do $$
declare v_definition text;
begin
 select pg_get_functiondef('public.finalize_agency_deletion(uuid,text)'::regprocedure) into v_definition;
 v_definition := replace(
   v_definition,
   'delete from public.agency_invitations where agency_id=v_request.agency_id;',
   'delete from public.agency_applications where agency_id=v_request.agency_id;' || E'\n ' ||
   'delete from public.agency_invitations where agency_id=v_request.agency_id;'
 );
 if v_definition not like '%delete from public.agency_applications where agency_id=v_request.agency_id;%' then
  raise exception 'Could not update agency deletion sequence';
 end if;
 execute v_definition;
end;
$$;
