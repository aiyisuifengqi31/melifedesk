alter table public.diary_entries
  add column if not exists author_id uuid references auth.users(id) on delete set null;

update public.diary_entries
set author_id = owner_user_id
where author_id is null;

create index if not exists diary_entries_author_idx
  on public.diary_entries (author_id, entry_date desc)
  where deleted_at is null;

create table if not exists public.diary_comments (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diary_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists diary_comments_diary_idx
  on public.diary_comments (diary_id, created_at asc)
  where deleted_at is null;

create index if not exists diary_comments_user_idx
  on public.diary_comments (user_id, created_at desc)
  where deleted_at is null;

alter table public.diary_comments enable row level security;
alter table public.diary_comments force row level security;

grant select, insert, update on public.diary_comments to authenticated;
revoke delete on public.diary_comments from authenticated;

drop policy if exists diary_comments_select_parent on public.diary_comments;
create policy diary_comments_select_parent on public.diary_comments for select to authenticated
using (deleted_at is null and public.can_read_diary_entry(diary_id, auth.uid()));

drop policy if exists diary_comments_insert_parent on public.diary_comments;
create policy diary_comments_insert_parent on public.diary_comments for insert to authenticated
with check (user_id = auth.uid() and deleted_at is null and public.can_read_diary_entry(diary_id, auth.uid()));

drop policy if exists diary_comments_update_own on public.diary_comments;
create policy diary_comments_update_own on public.diary_comments for update to authenticated
using (user_id = auth.uid() and public.can_read_diary_entry(diary_id, auth.uid()))
with check (user_id = auth.uid());
