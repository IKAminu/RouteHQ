alter table public.agency_notes
  add column if not exists due_date date,
  add column if not exists priority text not null default 'Normal'
    check (priority in ('Low','Normal','High')),
  add column if not exists completed boolean not null default false;

create index if not exists agency_notes_due_date_idx
  on public.agency_notes(agency_id,due_date)
  where completed = false;
