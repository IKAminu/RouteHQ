-- Correct nullable composite references so deleting a related record never nulls agency_id.
alter table public.bookings drop constraint if exists bookings_agency_id_lead_id_fkey;
alter table public.bookings add constraint bookings_agency_id_lead_id_fkey
 foreign key(agency_id,lead_id) references public.leads(agency_id,id) on delete set null (lead_id);
alter table public.travellers drop constraint if exists travellers_agency_id_booking_id_fkey;
alter table public.travellers add constraint travellers_agency_id_booking_id_fkey
 foreign key(agency_id,booking_id) references public.bookings(agency_id,id) on delete set null (booking_id);
alter table public.travellers drop constraint if exists travellers_agency_id_customer_id_fkey;
alter table public.travellers add constraint travellers_agency_id_customer_id_fkey
 foreign key(agency_id,customer_id) references public.customers(agency_id,id) on delete set null (customer_id);
alter table public.supplier_costs drop constraint if exists supplier_costs_agency_id_booking_id_fkey;
alter table public.supplier_costs add constraint supplier_costs_agency_id_booking_id_fkey
 foreign key(agency_id,booking_id) references public.bookings(agency_id,id) on delete set null (booking_id);
alter table public.supplier_costs drop constraint if exists supplier_costs_agency_id_supplier_id_fkey;
alter table public.supplier_costs add constraint supplier_costs_agency_id_supplier_id_fkey
 foreign key(agency_id,supplier_id) references public.suppliers(agency_id,id) on delete set null (supplier_id);

-- Platform admins may inspect only their own platform-admin row. Writes remain service-role only.
create policy "platform admin self lookup" on public.platform_admins
for select to authenticated using(user_id=(select auth.uid()));

-- Private document bucket. Object paths must start with the agency UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('routehq-documents','routehq-documents',false,26214400,
 array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "agency members read private documents" on storage.objects
for select to authenticated
using(bucket_id='routehq-documents'
 and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
 and (select app_private.has_agency_permission(((storage.foldername(name))[1])::uuid,'documents.view')));
create policy "agency members upload private documents" on storage.objects
for insert to authenticated
with check(bucket_id='routehq-documents'
 and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
 and (select app_private.has_agency_permission(((storage.foldername(name))[1])::uuid,'documents.upload')));
create policy "agency members replace private documents" on storage.objects
for update to authenticated
using(bucket_id='routehq-documents'
 and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
 and (select app_private.has_agency_permission(((storage.foldername(name))[1])::uuid,'documents.upload')))
with check(bucket_id='routehq-documents'
 and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
 and (select app_private.has_agency_permission(((storage.foldername(name))[1])::uuid,'documents.upload')));
create policy "agency members delete private documents" on storage.objects
for delete to authenticated
using(bucket_id='routehq-documents'
 and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
 and (select app_private.has_agency_permission(((storage.foldername(name))[1])::uuid,'documents.delete')));

comment on column public.travellers.passport_number_encrypted is
'Reserved for ciphertext only. Application must encrypt before write; do not store plaintext passport numbers.';
