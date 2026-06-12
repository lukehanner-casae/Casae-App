-- Casae Living — Initial schema (Session 1)
-- Co-living / head-lease operations model.
-- All tables use uuid PKs (gen_random_uuid) and are RLS-protected:
-- any authenticated Casae user has full access (single permission level at launch;
-- schema is role-expansion ready). See Planning Spec §3.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- contacts (landlords / agents / contractors / other) — referenced by others,
-- so created first.
-- ---------------------------------------------------------------------------
create table contacts (
  id                 uuid primary key default gen_random_uuid(),
  type               text not null default 'other',   -- landlord / agent / contractor / other
  first_name         text,
  last_name          text,
  company_name       text,
  email              text,
  phone              text,
  address            text,
  trade_type         text,                             -- contractors: plumber / electrician / etc.
  last_contact_date  date,
  notes              text,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------
create table properties (
  id                    uuid primary key default gen_random_uuid(),
  display_name          text not null,
  address               text,
  suburb                text,
  weekly_head_lease     numeric,
  landlord_contact_id   uuid references contacts(id) on delete set null,
  agent_contact_id      uuid references contacts(id) on delete set null,
  head_lease_start      date,
  head_lease_end        date,
  is_fixed_rent         boolean not null default false,
  smart_lock_installed  boolean not null default false,
  fitout_cost_total     numeric not null default 0,
  status                text not null default 'active', -- active / prospect / archived
  notes                 text,
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------------
create table rooms (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references properties(id) on delete cascade,
  room_name       text not null,
  weekly_rent     numeric,
  is_ensuite      boolean not null default false,
  is_couple_room  boolean not null default false,
  size_category   text default 'standard',  -- standard / large / small
  status          text not null default 'vacant', -- occupied / vacant / maintenance
  notes           text
);

-- ---------------------------------------------------------------------------
-- lodgers
-- ---------------------------------------------------------------------------
create table lodgers (
  id                       uuid primary key default gen_random_uuid(),
  first_name               text,
  last_name                text,
  email                    text,
  phone                    text,
  room_id                  uuid references rooms(id) on delete set null,
  move_in_date             date,
  expected_move_out        date,
  bond_amount              numeric,
  bond_received_date       date,
  bond_returned_date       date,            -- null = bond still held
  lodging_agreement_signed boolean not null default false,
  lodging_agreement_date   date,
  is_couple                boolean not null default false,
  partner_name             text,
  emergency_contact_name   text,
  emergency_contact_phone  text,
  status                   text not null default 'current', -- current / former / pending
  notes                    text
);

-- ---------------------------------------------------------------------------
-- maintenance_jobs
-- ---------------------------------------------------------------------------
create table maintenance_jobs (
  id                     uuid primary key default gen_random_uuid(),
  property_id            uuid not null references properties(id) on delete cascade,
  room_id                uuid references rooms(id) on delete set null,
  title                  text not null,
  description            text,
  contractor_contact_id  uuid references contacts(id) on delete set null,
  status                 text not null default 'open',   -- open / in-progress / completed / cancelled
  priority               text not null default 'medium', -- low / medium / high / urgent
  estimated_cost         numeric,
  actual_cost            numeric,
  reported_by_user_id    uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  completed_at           timestamptz,
  notes                  text
);

-- ---------------------------------------------------------------------------
-- cleans
-- ---------------------------------------------------------------------------
create table cleans (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references properties(id) on delete cascade,
  scheduled_date  date,
  clean_type      text default 'routine',   -- routine / end-of-tenancy / pre-move-in
  assigned_to     text,
  status          text not null default 'scheduled', -- scheduled / completed / skipped
  completed_at    timestamptz,
  notes           text,
  recurrence      text not null default 'none' -- none / weekly / fortnightly
);

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
create table expenses (
  id                    uuid primary key default gen_random_uuid(),
  property_id           uuid references properties(id) on delete set null,
  amount                numeric,
  expense_date          date,
  category              text,            -- mirrors Xero tracking category names
  description           text,
  receipt_url           text,            -- Supabase Storage path
  submitted_to_xero     boolean not null default false,
  xero_expense_id       text,
  hubdoc_forwarded      boolean not null default false,
  hubdoc_forwarded_at   timestamptz,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- fitout_items
-- ---------------------------------------------------------------------------
create table fitout_items (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references properties(id) on delete cascade,
  description    text,
  cost           numeric,
  purchase_date  date,
  category       text,   -- furniture / appliances / bedding / smart-lock / misc
  receipt_url    text,
  notes          text
);

-- ---------------------------------------------------------------------------
-- property_prospects (acquisition pipeline)
-- ---------------------------------------------------------------------------
create table property_prospects (
  id                       uuid primary key default gen_random_uuid(),
  address                  text,
  suburb                   text,
  est_rooms                int,
  est_weekly_head_lease    numeric,
  est_weekly_room_income   numeric,
  projected_weekly_margin  numeric,
  source                   text,   -- kaylin-outreach / agent / private / referral
  agent_contact_id         uuid references contacts(id) on delete set null,
  stage                    text not null default 'prospect',
  -- prospect / viewing-booked / viewed / proposal-sent / negotiating / secured / dead
  first_contact_date       date,
  viewing_date             date,
  assigned_to_user_id      uuid references auth.users(id) on delete set null,
  notes                    text,
  created_at               timestamptz not null default now()
);

-- Helpful indexes for the common lookups (by property).
create index idx_rooms_property            on rooms(property_id);
create index idx_lodgers_room              on lodgers(room_id);
create index idx_maintenance_property      on maintenance_jobs(property_id);
create index idx_cleans_property           on cleans(property_id);
create index idx_expenses_property         on expenses(property_id);
create index idx_fitout_property           on fitout_items(property_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Single permission level at launch: any authenticated user has full access.
-- Policies are per-table so role-based tightening can be layered on later
-- without a structural migration.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'contacts', 'properties', 'rooms', 'lodgers', 'maintenance_jobs',
    'cleans', 'expenses', 'fitout_items', 'property_prospects'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true);',
      t || '_authenticated_all', t
    );
  end loop;
end $$;
