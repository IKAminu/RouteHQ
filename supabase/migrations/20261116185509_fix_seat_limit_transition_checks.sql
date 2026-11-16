create or replace function app_private.enforce_agency_seat_limit()
returns trigger language plpgsql security definer set search_path=''
as $$
declare current_count integer; max_count integer; should_count boolean;
begin
 if tg_table_name='agency_memberships' then
  should_count := (tg_op='INSERT' and new.status in ('active','invited') and not new.is_owner)
    or (tg_op='UPDATE' and new.status in ('active','invited') and not new.is_owner
        and (old.status not in ('active','invited') or old.is_owner or old.agency_id<>new.agency_id));
  if not should_count then return new; end if;
  max_count:=app_private.agency_additional_seat_limit(new.agency_id);
  select count(*) into current_count from public.agency_memberships m
   where m.agency_id=new.agency_id and m.is_owner=false and m.status in ('active','invited')
   and (tg_op='INSERT' or m.id<>new.id);
  if current_count>=max_count then
   raise exception 'This agency plan allows % additional team accounts.',max_count using errcode='23514';
  end if;
 elsif tg_table_name='agency_invitations' then
  should_count := (tg_op='INSERT' and new.status='pending')
    or (tg_op='UPDATE' and new.status='pending' and old.status<>'pending');
  if not should_count then return new; end if;
  max_count:=app_private.agency_additional_seat_limit(new.agency_id);
  select count(*) into current_count from public.agency_memberships m
   where m.agency_id=new.agency_id and m.is_owner=false and m.status in ('active','invited');
  select current_count+count(*) into current_count from public.agency_invitations i
   where i.agency_id=new.agency_id and i.status='pending' and i.expires_at>now()
   and (tg_op='INSERT' or i.id<>new.id);
  if current_count>=max_count then
   raise exception 'This agency plan allows % additional team accounts.',max_count using errcode='23514';
  end if;
 end if;
 return new;
end $$;
