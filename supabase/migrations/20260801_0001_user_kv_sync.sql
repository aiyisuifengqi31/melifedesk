-- Client-side app state cloud sync: one key-value table per user.
-- All local stores (profile / notes / alarms / todos / exam / meal) sync here
-- behind a single generic wrapper, so we don't need one table per feature.

create table if not exists public.user_kv (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create index if not exists user_kv_user_idx on public.user_kv (user_id);

alter table public.user_kv enable row level security;

drop policy if exists "user_kv_owner_select" on public.user_kv;
create policy "user_kv_owner_select" on public.user_kv
  for select using (auth.uid() = user_id);

drop policy if exists "user_kv_owner_insert" on public.user_kv;
create policy "user_kv_owner_insert" on public.user_kv
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_kv_owner_update" on public.user_kv;
create policy "user_kv_owner_update" on public.user_kv
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_kv_owner_delete" on public.user_kv;
create policy "user_kv_owner_delete" on public.user_kv
  for delete using (auth.uid() = user_id);
