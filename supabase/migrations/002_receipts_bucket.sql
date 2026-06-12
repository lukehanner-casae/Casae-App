-- Receipts storage (Session 6).
-- Private bucket; files stored at {property_id}/{YYYY-MM}/{timestamp}-{filename}.
-- Any authenticated Casae user can read/write (single permission level at launch).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760, -- 10MB per spec
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do nothing;

create policy "receipts_authenticated_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts');

create policy "receipts_authenticated_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts');

create policy "receipts_authenticated_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'receipts');

create policy "receipts_authenticated_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'receipts');
