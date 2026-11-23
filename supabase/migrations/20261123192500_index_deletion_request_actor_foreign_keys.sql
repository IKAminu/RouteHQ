create index if not exists agency_deletion_requests_requested_by_idx on public.agency_deletion_requests(requested_by);
create index if not exists agency_deletion_requests_reviewed_by_idx on public.agency_deletion_requests(reviewed_by);
