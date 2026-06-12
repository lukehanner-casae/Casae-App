-- Profiles + app settings (Sessions A & B).
-- profiles mirrors auth.users so the client can list team members (the auth
-- admin API is server-only). Kept in sync by a trigger on auth.users insert.

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  email         text,
  role          text not null default 'staff',
  created_at    timestamptz not null default now()
);

alter table profiles enable row level security;

create policy profiles_authenticated_select
  on profiles for select to authenticated using (true);

-- Users can only edit their own profile (display name etc.).
create policy profiles_self_update
  on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing users.
insert into public.profiles (id, email, display_name)
select id, email, coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- app_settings: simple key/value store (e.g. hubdoc_email).
-- ---------------------------------------------------------------------------
create table app_settings (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now()
);

alter table app_settings enable row level security;

create policy app_settings_authenticated_all
  on app_settings for all to authenticated using (true) with check (true);
