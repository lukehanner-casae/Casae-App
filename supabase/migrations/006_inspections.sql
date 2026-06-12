-- Inspection tracker (Session D).
-- Photos live in the `documents` storage bucket under
-- inspections/{inspection_id}/{timestamp}-{filename}; paths are kept in
-- photo_paths so no extra metadata rows are needed.

create table inspections (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid not null references properties(id) on delete cascade,
  scheduled_date      date,
  conducted_date      date,
  conducted_by        text,
  overall_condition   text,            -- good / fair / poor
  notes               text,
  photo_paths         text[] not null default '{}',
  follow_up_required  boolean not null default false,
  follow_up_notes     text,
  created_at          timestamptz not null default now()
);

create index idx_inspections_property on inspections(property_id);

alter table inspections enable row level security;

create policy inspections_authenticated_all
  on inspections for all to authenticated using (true) with check (true);
