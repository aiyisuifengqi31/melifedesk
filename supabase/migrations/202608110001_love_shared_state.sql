create table if not exists public.love_shared_state (
  couple_id uuid not null references public.couples(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (couple_id, key),
  constraint love_shared_state_key_length check (char_length(key) between 1 and 120)
);

create index if not exists love_shared_state_updated_idx
  on public.love_shared_state (couple_id, updated_at desc);

alter table public.love_shared_state enable row level security;
alter table public.love_shared_state force row level security;

drop trigger if exists love_shared_state_set_updated_at on public.love_shared_state;
create trigger love_shared_state_set_updated_at
before update on public.love_shared_state
for each row execute function public.set_updated_at();

drop policy if exists love_shared_state_select_couple_members on public.love_shared_state;
create policy love_shared_state_select_couple_members on public.love_shared_state
for select to authenticated
using (public.is_active_couple_member(couple_id, auth.uid()));

drop policy if exists love_shared_state_insert_couple_members on public.love_shared_state;
create policy love_shared_state_insert_couple_members on public.love_shared_state
for insert to authenticated
with check (
  couple_id = public.current_active_couple_id(auth.uid())
  and public.is_active_couple_member(couple_id, auth.uid())
);

drop policy if exists love_shared_state_update_couple_members on public.love_shared_state;
create policy love_shared_state_update_couple_members on public.love_shared_state
for update to authenticated
using (public.is_active_couple_member(couple_id, auth.uid()))
with check (
  couple_id = public.current_active_couple_id(auth.uid())
  and public.is_active_couple_member(couple_id, auth.uid())
);

revoke delete on public.love_shared_state from authenticated;
grant select, insert, update on public.love_shared_state to authenticated;
