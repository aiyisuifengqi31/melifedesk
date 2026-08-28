create table if not exists public.diary_likes (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diary_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (diary_id, user_id)
);

create index if not exists diary_likes_diary_idx
  on public.diary_likes (diary_id, created_at asc);

create index if not exists diary_likes_user_idx
  on public.diary_likes (user_id, created_at desc);

alter table public.diary_likes enable row level security;
alter table public.diary_likes force row level security;

grant select, insert, delete on public.diary_likes to authenticated;

drop policy if exists diary_likes_select_parent on public.diary_likes;
create policy diary_likes_select_parent on public.diary_likes for select to authenticated
using (public.can_read_diary_entry(diary_id, auth.uid()));

drop policy if exists diary_likes_insert_parent on public.diary_likes;
create policy diary_likes_insert_parent on public.diary_likes for insert to authenticated
with check (user_id = auth.uid() and public.can_read_diary_entry(diary_id, auth.uid()));

drop policy if exists diary_likes_delete_own on public.diary_likes;
create policy diary_likes_delete_own on public.diary_likes for delete to authenticated
using (user_id = auth.uid() and public.can_read_diary_entry(diary_id, auth.uid()));
