-- Document storage (Session C).
-- Private `documents` bucket; files stored at {property_id}/{type}/{timestamp}-{filename}.
-- Inspection photos (Session D) also live here under inspections/{inspection_id}/.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  20971520, -- 20MB
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do nothing;

create policy "documents_authenticated_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents');

create policy "documents_authenticated_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents');

create policy "documents_authenticated_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'documents');

create policy "documents_authenticated_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents');

-- ---------------------------------------------------------------------------
-- documents metadata table
-- ---------------------------------------------------------------------------
create table documents (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references properties(id) on delete cascade,
  lodger_id     uuid references lodgers(id) on delete set null,
  type          text not null default 'Other',
  -- Head Lease / Lodging Agreement / Condition Report / Bond Lodgement /
  -- Insurance / BAS / Other
  filename      text not null,
  storage_path  text not null,
  notes         text,
  uploaded_by   uuid references auth.users(id) on delete set null,
  uploaded_at   timestamptz not null default now()
);

create index idx_documents_property on documents(property_id);
create index idx_documents_lodger   on documents(lodger_id);

alter table documents enable row level security;

create policy documents_authenticated_all
  on documents for all to authenticated using (true) with check (true);
