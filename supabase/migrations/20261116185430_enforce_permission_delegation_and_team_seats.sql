-- Prevent permission escalation: a manager may only delegate permissions they themselves possess.
create or replace function app_private.can_grant_agency_permission(_agency_id uuid,_permission text)
returns boolean
language sql stable security definer set search_path=''
as $$
 select (select auth.uid()) is not null
 and (select app_private.has_agency_permission(_agency_id,'team.manage_permissions'))
 and (select app_private.has_agency_permission(_agency_id,_permission));
$$;
revoke all on function app_private.can_grant_agency_permission(uuid,text) from public,anon;
grant execute on function app_private.can_grant_agency_permission(uuid,text) to authenticated,service_role;

drop policy if exists "role permission insert" on public.role_permissions;
create policy "role permission insert" on public.role_permissions for insert to authenticated
with check(exists(select 1 from public.roles r where r.id=role_id and r.agency_id is not null and (select app_private.can_grant_agency_permission(r.agency_id,permission_code))));
drop policy if exists "member permission insert" on public.member_permissions;
create policy "member permission insert" on public.member_permissions for insert to authenticated
with check(is_allowed=false or exists(select 1 from public.agency_memberships m where m.id=membership_id and (select app_private.can_grant_agency_permission(m.agency_id,permission_code))));
drop policy if exists "member permission update" on public.member_permissions;
create policy "member permission update" on public.member_permissions for update to authenticated
using(exists(select 1 from public.agency_memberships m where m.id=membership_id and (select app_private.has_agency_permission(m.agency_id,'team.manage_permissions'))))
with check(is_allowed=false or exists(select 1 from public.agency_memberships m where m.id=membership_id and (select app_private.can_grant_agency_permission(m.agency_id,permission_code))));

-- Seat limits are enforced in PostgreSQL as well as in the user interface.
create or replace function app_private.agency_additional_seat_limit(_agency_id uuid)
returns integer language sql stable security definer set search_path=''
as $$
 select coalesce(
  (select p.max_additional_members
   from public.subscriptions s join public.plans p on p.id=s.plan_id
   where s.agency_id=_agency_id and s.status in ('active','trialing')
   order by s.created_at desc limit 1),
  0
 );
$$;
revoke all on function app_private.agency_additional_seat_limit(uuid) from public,anon;
grant execute on function app_private.agency_additional_seat_limit(uuid) to authenticated,service_role;

create or replace function app_private.enforce_agency_seat_limit()
returns trigger language plpgsql security definer set search_path=''
as $$
declare current_count integer; max_count integer;
begin
 if tg_table_name='agency_memberships' then
  if new.is_owner then return new; end if;
  max_count:=app_private.agency_additional_seat_limit(new.agency_id);
  select count(*) into current_count from public.agency_memberships m
   where m.agency_id=new.agency_id and m.is_owner=false and m.status in ('active','invited')
   and (tg_op='INSERT' or m.id<>new.id);
  if current_count>=max_count then
   raise exception 'This agency plan allows % additional team accounts.',max_count using errcode='23514';
  end if;
 elsif tg_table_name='agency_invitations' then
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
revoke all on function app_private.enforce_agency_seat_limit() from public,anon,authenticated;
drop trigger if exists enforce_membership_seat_limit on public.agency_memberships;
create trigger enforce_membership_seat_limit before insert or update of status,is_owner on public.agency_memberships
for each row execute function app_private.enforce_agency_seat_limit();
drop trigger if exists enforce_invitation_seat_limit on public.agency_invitations;
create trigger enforce_invitation_seat_limit before insert or update of status,expires_at on public.agency_invitations
for each row execute function app_private.enforce_agency_seat_limit();

-- Prevent assignment of a role belonging to another agency.
create or replace function app_private.validate_membership_role_tenant()
returns trigger language plpgsql set search_path=''
as $$
declare role_agency uuid; role_system boolean;
begin
 select r.agency_id,r.is_system into role_agency,role_system from public.roles r where r.id=new.role_id;
 if not found then raise exception 'Role does not exist'; end if;
 if role_system is not true and role_agency is distinct from new.agency_id then
  raise exception 'A membership can only use a system role or a role created for the same agency';
 end if;
 return new;
end $$;
revoke all on function app_private.validate_membership_role_tenant() from public,anon,authenticated;
drop trigger if exists validate_membership_role_tenant on public.agency_memberships;
create trigger validate_membership_role_tenant before insert or update of role_id,agency_id on public.agency_memberships
for each row execute function app_private.validate_membership_role_tenant();

-- Ensure tenant-scoped assigned users cannot be from another agency.
create or replace function app_private.validate_assigned_membership()
returns trigger language plpgsql set search_path=''
as $$
declare assigned_agency uuid;
begin
 if new.assigned_to is null then return new; end if;
 select m.agency_id into assigned_agency from public.agency_memberships m where m.id=new.assigned_to;
 if assigned_agency is distinct from new.agency_id then
  raise exception 'Assigned team member must belong to the same agency';
 end if;
 return new;
end $$;
revoke all on function app_private.validate_assigned_membership() from public,anon,authenticated;
drop trigger if exists leads_validate_assigned_membership on public.leads;
create trigger leads_validate_assigned_membership before insert or update of assigned_to,agency_id on public.leads
for each row execute function app_private.validate_assigned_membership();
drop trigger if exists tasks_validate_assigned_membership on public.tasks;
create trigger tasks_validate_assigned_membership before insert or update of assigned_to,agency_id on public.tasks
for each row execute function app_private.validate_assigned_membership();

create index if not exists activity_logs_actor_idx on public.activity_logs(actor_user_id);
create index if not exists agencies_approved_by_idx on public.agencies(approved_by);
create index if not exists agency_applications_agency_idx on public.agency_applications(agency_id);
create index if not exists agency_applications_applicant_idx on public.agency_applications(applicant_user_id);
create index if not exists agency_applications_reviewer_idx on public.agency_applications(reviewed_by);
create index if not exists agency_invitations_accepted_by_idx on public.agency_invitations(accepted_by);
create index if not exists agency_invitations_inviter_idx on public.agency_invitations(invited_by_membership_id);
create index if not exists agency_invitations_role_idx on public.agency_invitations(role_id);
create index if not exists agency_memberships_role_idx on public.agency_memberships(role_id);
create index if not exists agency_notes_created_by_idx on public.agency_notes(created_by);
create index if not exists agency_notes_updated_by_idx on public.agency_notes(updated_by);
create index if not exists lead_activities_created_by_idx on public.lead_activities(created_by);
