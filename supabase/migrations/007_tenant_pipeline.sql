-- Occupancy & tenant pipeline pivot (Redesign Spec v2, Session K).
--
-- Adds the tenant pipeline (pipeline_tenants), vacate notices, an
-- append-only occupancy_history log, and extends rooms with a trigger-
-- maintained next_vacate_date plus a 'notice_given' status. The old
-- property_prospects table is left in place (unlinked from the app).
--
-- Auto-vacancy (Spec §6 / §6.1, option 2): apply_passed_vacate_notices()
-- flips rooms whose vacate date has passed to 'vacant' with vacant_since =
-- the vacate date (not the run time), so historical occupancy stays accurate
-- however late the job runs. It is scheduled daily via pg_cron (00:05 Perth)
-- and also invoked idempotently by the app when the vacate pipeline loads.

-- ---------------------------------------------------------------------------
-- rooms: rename vacated_at -> vacant_since (spec name), add next_vacate_date.
-- status gains 'notice_given' (occupied / notice_given / vacant / maintenance).
-- ---------------------------------------------------------------------------
alter table rooms rename column vacated_at to vacant_since;
alter table rooms add column next_vacate_date date;

comment on column rooms.vacant_since is
  'When the room became vacant (set by auto-vacancy / move-out); null while occupied.';
comment on column rooms.next_vacate_date is
  'Earliest active vacate notice for the room; maintained by trigger on vacate_notices.';

-- ---------------------------------------------------------------------------
-- pipeline_tenants — every prospective / departing lodger.
-- status: lead / viewing_booked / viewed / active / notice_given / vacated
-- ---------------------------------------------------------------------------
create table pipeline_tenants (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  email              text not null,
  phone              text,
  source             text,                       -- flatmates / referral / walk-in / other
  property_interest  uuid references properties(id) on delete set null,
  room_interest      uuid references rooms(id) on delete set null,
  viewing_date       date,
  status             text not null default 'lead',
  notes              text,
  linked_lodger_id   uuid references lodgers(id) on delete set null,  -- set on move-in
  converted_at       timestamptz,                                    -- when moved to active
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- vacate_notices — the Vacate Pipeline.
-- replacement_status: unassigned / lead_assigned / confirmed
-- status: active / completed (auto-vacancy ran or replacement moved in) / cancelled
-- ---------------------------------------------------------------------------
create table vacate_notices (
  id                              uuid primary key default gen_random_uuid(),
  property_id                     uuid not null references properties(id) on delete cascade,
  room_id                         uuid not null references rooms(id) on delete cascade,
  lodger_id                       uuid references lodgers(id) on delete set null,
  vacate_date                     date not null,
  logged_by                       uuid references auth.users(id) on delete set null,
  logged_at                       timestamptz not null default now(),
  replacement_status              text not null default 'unassigned',
  replacement_pipeline_tenant_id  uuid references pipeline_tenants(id) on delete set null,
  status                          text not null default 'active',
  completed_at                    timestamptz,
  notes                           text
);

alter table pipeline_tenants
  add column linked_vacancy_id uuid references vacate_notices(id) on delete set null;

-- ---------------------------------------------------------------------------
-- occupancy_history — every room status transition, for retrospective
-- occupancy-rate reporting. source: auto / manual / backfill.
-- ---------------------------------------------------------------------------
create table occupancy_history (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references rooms(id) on delete cascade,
  property_id      uuid not null references properties(id) on delete cascade,
  status           text not null,
  previous_status  text,
  changed_at       timestamptz not null default now(),
  source           text not null default 'manual'
);

create index idx_pipeline_tenants_status    on pipeline_tenants(status);
create index idx_pipeline_tenants_vacancy   on pipeline_tenants(linked_vacancy_id);
create index idx_vacate_notices_room        on vacate_notices(room_id);
create index idx_vacate_notices_active      on vacate_notices(vacate_date) where status = 'active';
create index idx_occupancy_history_room     on occupancy_history(room_id, changed_at);

do $$
declare
  t text;
begin
  foreach t in array array['pipeline_tenants', 'vacate_notices', 'occupancy_history']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true);',
      t || '_authenticated_all', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- "Today" in Perth. Supabase sessions run in UTC, so current_date would lag
-- the business day by up to 8 hours.
-- ---------------------------------------------------------------------------
create or replace function casae_today() returns date
language sql stable as $$
  select (now() at time zone 'Australia/Perth')::date
$$;

-- ---------------------------------------------------------------------------
-- occupancy_history: log every rooms.status transition. The auto-vacancy job
-- sets casae.occupancy_source / casae.occupancy_changed_at for the
-- transaction so history records the real vacate date and 'auto' source.
-- ---------------------------------------------------------------------------
create or replace function log_room_status_change() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then
    insert into occupancy_history (room_id, property_id, status, previous_status, changed_at, source)
    values (
      new.id,
      new.property_id,
      new.status,
      old.status,
      coalesce(nullif(current_setting('casae.occupancy_changed_at', true), '')::timestamptz, now()),
      coalesce(nullif(current_setting('casae.occupancy_source', true), ''), 'manual')
    );
  end if;
  return new;
end $$;

create trigger rooms_log_status_change
  after update of status on rooms
  for each row execute function log_room_status_change();

-- Opening snapshot so history can be reconstructed from day one.
insert into occupancy_history (room_id, property_id, status, previous_status, changed_at, source)
select id, property_id, status, null, coalesce(vacant_since, now()), 'backfill' from rooms;

-- ---------------------------------------------------------------------------
-- rooms.next_vacate_date + 'notice_given' status follow the active notices.
-- ---------------------------------------------------------------------------
create or replace function refresh_room_vacancy(p_room_id uuid) returns void
language plpgsql as $$
declare
  nxt date;
begin
  select min(vacate_date) into nxt
  from vacate_notices
  where room_id = p_room_id and status = 'active';

  update rooms
  set next_vacate_date = nxt,
      status = case
        when nxt is not null and status in ('occupied', 'notice_given') then 'notice_given'
        when nxt is null and status = 'notice_given' then 'occupied'
        else status
      end
  where id = p_room_id;
end $$;

create or replace function vacate_notices_refresh_room() returns trigger
language plpgsql as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform refresh_room_vacancy(new.room_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') and (tg_op = 'DELETE' or old.room_id <> new.room_id) then
    perform refresh_room_vacancy(old.room_id);
  end if;
  return null;
end $$;

create trigger vacate_notices_refresh_room
  after insert or update or delete on vacate_notices
  for each row execute function vacate_notices_refresh_room();

-- ---------------------------------------------------------------------------
-- log_vacate_notice: the "Log Vacate Notice" button.
-- Lodger -> notice_given, room enters the vacate pipeline (via trigger), and
-- a linked pipeline tenant (if this lodger came through the pipeline) moves
-- to notice_given too.
-- ---------------------------------------------------------------------------
create or replace function log_vacate_notice(
  p_property_id uuid,
  p_room_id     uuid,
  p_lodger_id   uuid,
  p_vacate_date date,
  p_notes       text default null
) returns uuid
language plpgsql as $$
declare
  v_id uuid;
begin
  if exists (
    select 1 from vacate_notices
    where room_id = p_room_id and lodger_id is not distinct from p_lodger_id and status = 'active'
  ) then
    raise exception 'A vacate notice is already active for this lodger and room';
  end if;

  insert into vacate_notices (property_id, room_id, lodger_id, vacate_date, logged_by, notes)
  values (p_property_id, p_room_id, p_lodger_id, p_vacate_date, auth.uid(), p_notes)
  returning id into v_id;

  update lodgers
  set status = 'notice_given', expected_move_out = p_vacate_date
  where id = p_lodger_id;

  update pipeline_tenants
  set status = 'notice_given'
  where linked_lodger_id = p_lodger_id and status = 'active';

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- cancel_vacate_notice: lodger is staying after all.
-- ---------------------------------------------------------------------------
create or replace function cancel_vacate_notice(p_notice_id uuid) returns void
language plpgsql as $$
declare
  n vacate_notices%rowtype;
begin
  select * into n from vacate_notices where id = p_notice_id for update;
  if not found or n.status <> 'active' then
    raise exception 'Only active vacate notices can be cancelled';
  end if;

  update vacate_notices
  set status = 'cancelled', completed_at = now(),
      replacement_status = 'unassigned', replacement_pipeline_tenant_id = null
  where id = p_notice_id;

  update pipeline_tenants set linked_vacancy_id = null where linked_vacancy_id = p_notice_id;

  update lodgers set status = 'current', expected_move_out = null
  where id = n.lodger_id and status = 'notice_given';

  update pipeline_tenants set status = 'active'
  where linked_lodger_id = n.lodger_id and status = 'notice_given';
end $$;

-- ---------------------------------------------------------------------------
-- match_lead_to_vacancy / unmatch_lead: link a pipeline tenant to a notice.
-- A vacancy holds at most one lead and a lead at most one vacancy; matching
-- displaces any previous link on either side.
-- ---------------------------------------------------------------------------
create or replace function match_lead_to_vacancy(p_tenant_id uuid, p_notice_id uuid) returns void
language plpgsql as $$
begin
  if not exists (select 1 from vacate_notices where id = p_notice_id and status = 'active') then
    raise exception 'Vacate notice is not active';
  end if;
  if not exists (
    select 1 from pipeline_tenants
    where id = p_tenant_id and status in ('lead', 'viewing_booked', 'viewed')
  ) then
    raise exception 'Only open leads can be matched to a vacancy';
  end if;

  -- Release whatever each side was previously linked to.
  update pipeline_tenants set linked_vacancy_id = null
  where linked_vacancy_id = p_notice_id and id <> p_tenant_id;
  update vacate_notices
  set replacement_pipeline_tenant_id = null, replacement_status = 'unassigned'
  where replacement_pipeline_tenant_id = p_tenant_id and id <> p_notice_id and status = 'active';

  update vacate_notices
  set replacement_pipeline_tenant_id = p_tenant_id,
      replacement_status = case when replacement_status = 'confirmed' then 'confirmed' else 'lead_assigned' end
  where id = p_notice_id;

  update pipeline_tenants set linked_vacancy_id = p_notice_id where id = p_tenant_id;
end $$;

create or replace function unmatch_lead(p_notice_id uuid) returns void
language plpgsql as $$
begin
  update pipeline_tenants set linked_vacancy_id = null where linked_vacancy_id = p_notice_id;
  update vacate_notices
  set replacement_pipeline_tenant_id = null, replacement_status = 'unassigned'
  where id = p_notice_id;
end $$;

-- ---------------------------------------------------------------------------
-- complete_vacate_notice: the outgoing lodger has left. Room becomes vacant
-- (vacant_since = vacate date) unless another lodger already holds it.
-- ---------------------------------------------------------------------------
create or replace function complete_vacate_notice(p_notice_id uuid, p_source text default 'auto') returns void
language plpgsql as $$
declare
  n vacate_notices%rowtype;
  v_replaced boolean;
  v_vacated_at timestamptz;
begin
  select * into n from vacate_notices where id = p_notice_id and status = 'active' for update;
  if not found then
    return;
  end if;

  perform set_config('casae.occupancy_source', p_source, true);
  v_vacated_at := least((n.vacate_date::timestamp at time zone 'Australia/Perth'), now());
  perform set_config('casae.occupancy_changed_at', v_vacated_at::text, true);

  update lodgers
  set status = 'former', expected_move_out = coalesce(expected_move_out, n.vacate_date)
  where id = n.lodger_id and status <> 'former';

  update pipeline_tenants set status = 'vacated'
  where linked_lodger_id = n.lodger_id and status in ('active', 'notice_given');

  select exists (
    select 1 from lodgers
    where room_id = n.room_id and status in ('current', 'pending') and id is distinct from n.lodger_id
  ) into v_replaced;

  -- Room first, then the notice: completing the notice re-runs
  -- refresh_room_vacancy, which would otherwise log a notice_given -> occupied
  -- blip before the vacant transition.
  if v_replaced then
    update rooms set status = 'occupied', vacant_since = null where id = n.room_id;
  else
    update rooms set status = 'vacant', vacant_since = v_vacated_at
    where id = n.room_id and status <> 'vacant';
  end if;

  update vacate_notices set status = 'completed', completed_at = now() where id = n.id;

  perform set_config('casae.occupancy_source', '', true);
  perform set_config('casae.occupancy_changed_at', '', true);
end $$;

-- ---------------------------------------------------------------------------
-- convert_pipeline_tenant: place a lead in a room as a lodger.
-- Creates the lodgers row (current if the move-in date has arrived, else
-- pending), links it back to the pipeline record (lead history stays), marks
-- any active notice on the room as confirmed, and — when the move-in date has
-- arrived — closes that notice out: outgoing lodger former, room occupied.
-- ---------------------------------------------------------------------------
create or replace function convert_pipeline_tenant(
  p_tenant_id     uuid,
  p_room_id       uuid,
  p_move_in_date  date,
  p_bond_amount   numeric default null
) returns uuid
language plpgsql as $$
declare
  t         pipeline_tenants%rowtype;
  v_lodger  uuid;
  v_first   text;
  v_last    text;
  v_status  text;
  n         vacate_notices%rowtype;
begin
  select * into t from pipeline_tenants where id = p_tenant_id for update;
  if not found then
    raise exception 'Pipeline tenant not found';
  end if;
  if t.status not in ('lead', 'viewing_booked', 'viewed') then
    raise exception 'Only open leads can be converted';
  end if;

  v_first := split_part(btrim(t.name), ' ', 1);
  v_last  := nullif(btrim(substr(btrim(t.name), length(v_first) + 1)), '');
  v_status := case when p_move_in_date <= casae_today() then 'current' else 'pending' end;

  insert into lodgers (first_name, last_name, email, phone, room_id, move_in_date, bond_amount, status, notes)
  values (
    v_first, v_last, t.email, t.phone, p_room_id, p_move_in_date, p_bond_amount, v_status,
    format('[%s] Placed from tenant pipeline (source: %s, viewed: %s)',
      to_char(now() at time zone 'Australia/Perth', 'DD Mon YYYY'),
      coalesce(t.source, 'unknown'),
      coalesce(to_char(t.viewing_date, 'DD Mon YYYY'), 'no viewing'))
  )
  returning id into v_lodger;

  update pipeline_tenants
  set status = 'active', linked_lodger_id = v_lodger, converted_at = now(),
      room_interest = coalesce(room_interest, p_room_id)
  where id = p_tenant_id;

  -- The notice this lead was matched to, else the room's soonest active notice.
  select * into n from vacate_notices
  where id = t.linked_vacancy_id and status = 'active' and room_id = p_room_id;
  if not found then
    select * into n from vacate_notices
    where room_id = p_room_id and status = 'active'
    order by vacate_date limit 1;
  end if;

  if found then
    update vacate_notices
    set replacement_status = 'confirmed', replacement_pipeline_tenant_id = p_tenant_id
    where id = n.id;
    update pipeline_tenants set linked_vacancy_id = n.id where id = p_tenant_id;

    if v_status = 'current' then
      perform complete_vacate_notice(n.id, 'manual');
    end if;
  end if;

  -- A lodger placed in a vacant room (no notice) occupies it from move-in.
  if v_status = 'current' then
    update rooms set status = 'occupied', vacant_since = null
    where id = p_room_id and status = 'vacant';
  end if;

  return v_lodger;
end $$;

-- ---------------------------------------------------------------------------
-- apply_passed_vacate_notices: the scheduled auto-vacancy job. Idempotent —
-- safe to run from cron and from the app on every load.
-- ---------------------------------------------------------------------------
create or replace function apply_passed_vacate_notices() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select id from vacate_notices
    where status = 'active' and vacate_date <= casae_today()
    order by vacate_date
  loop
    perform complete_vacate_notice(v_id, 'auto');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Daily at 00:05 Perth (16:05 UTC). Guarded so the migration still applies
-- on a project where pg_cron isn't enabled; the app's on-load call covers it.
do $outer$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'casae-auto-vacancy',
    '5 16 * * *',
    $job$ select apply_passed_vacate_notices() $job$
  );
exception when others then
  raise notice 'pg_cron not available (%): auto-vacancy relies on the app-side call', sqlerrm;
end $outer$;
