-- V1 Coach/Nageur pour AquaPace
-- A executer dans Supabase SQL Editor

create table if not exists public.aquapace_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'swimmer' check (role in ('coach', 'swimmer')),
  updated_at timestamptz not null default now()
);

create table if not exists public.aquapace_shared_plans (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  swimmer_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  type text not null check (type in ('technique', 'endurance', 'sprint', 'mixte')),
  stroke text not null check (stroke in ('crawl', 'dos', 'brasse', 'papillon', 'mixte')),
  target_distance integer not null check (target_distance >= 50),
  target_duration integer not null check (target_duration > 0),
  objective text,
  status text not null default 'todo' check (status in ('todo', 'done', 'missed')),
  linked_workout_id text,
  created_at timestamptz not null default now()
);

create index if not exists aquapace_shared_plans_swimmer_idx on public.aquapace_shared_plans(swimmer_id, date desc);
create index if not exists aquapace_shared_plans_coach_idx on public.aquapace_shared_plans(coach_id, date desc);

alter table public.aquapace_profiles enable row level security;
alter table public.aquapace_shared_plans enable row level security;

drop policy if exists "profiles_select_authenticated" on public.aquapace_profiles;
create policy "profiles_select_authenticated"
  on public.aquapace_profiles
  for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_self" on public.aquapace_profiles;
create policy "profiles_insert_self"
  on public.aquapace_profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.aquapace_profiles;
create policy "profiles_update_self"
  on public.aquapace_profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "shared_plans_insert_coach" on public.aquapace_shared_plans;
create policy "shared_plans_insert_coach"
  on public.aquapace_shared_plans
  for insert
  to authenticated
  with check (auth.uid() = coach_id);

drop policy if exists "shared_plans_select_coach_or_swimmer" on public.aquapace_shared_plans;
create policy "shared_plans_select_coach_or_swimmer"
  on public.aquapace_shared_plans
  for select
  to authenticated
  using (auth.uid() = coach_id or auth.uid() = swimmer_id);

drop policy if exists "shared_plans_update_coach_or_swimmer" on public.aquapace_shared_plans;
create policy "shared_plans_update_coach_or_swimmer"
  on public.aquapace_shared_plans
  for update
  to authenticated
  using (auth.uid() = coach_id or auth.uid() = swimmer_id)
  with check (auth.uid() = coach_id or auth.uid() = swimmer_id);

drop policy if exists "shared_plans_delete_coach" on public.aquapace_shared_plans;
create policy "shared_plans_delete_coach"
  on public.aquapace_shared_plans
  for delete
  to authenticated
  using (auth.uid() = coach_id);
