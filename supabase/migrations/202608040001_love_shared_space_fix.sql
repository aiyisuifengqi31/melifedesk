alter table public.diary_entries
  add column if not exists category text not null default '日常记录',
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

create index if not exists diary_entries_couple_date_idx
  on public.diary_entries (couple_id, entry_date desc, created_at desc)
  where deleted_at is null and couple_id is not null;

update public.diary_entries
set visibility = 'couple_edit',
    category = coalesce(nullif(category, ''), '日常记录')
where couple_id is not null
  and deleted_at is null
  and visibility in ('couple_read', 'couple_edit');

create or replace function public.can_edit_love_record(p_owner_user_id uuid, p_couple_id uuid, p_visibility text, p_deleted_at timestamptz, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_deleted_at is null and (
    p_owner_user_id = p_user_id
    or (
      p_visibility in ('couple_read', 'couple_edit')
      and p_couple_id is not null
      and public.is_active_couple_member(p_couple_id, p_user_id)
    )
  );
$$;

drop policy if exists diary_entries_insert_own on public.diary_entries;
create policy diary_entries_insert_own on public.diary_entries for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and deleted_at is null
  and couple_id = public.current_active_couple_id(auth.uid())
  and visibility = 'couple_edit'
);

drop policy if exists diary_entries_update_editable on public.diary_entries;
create policy diary_entries_update_editable on public.diary_entries for update to authenticated
using (public.can_edit_diary_entry(id, auth.uid()))
with check (
  couple_id = public.current_active_couple_id(auth.uid())
  and visibility = 'couple_edit'
);

create or replace function public.soft_delete_diary_entry(p_diary_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.can_edit_diary_entry(p_diary_id, auth.uid()) then raise exception 'not_allowed'; end if;
  update public.diary_entries
  set deleted_at = now(),
      deleted_by = auth.uid(),
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_diary_id
    and couple_id = public.current_active_couple_id(auth.uid())
    and deleted_at is null;
  update public.diary_images set deleted_at = now(), deleted_by = auth.uid() where diary_entry_id = p_diary_id and deleted_at is null;
  return p_diary_id;
end;
$$;

grant execute on function public.soft_delete_diary_entry(uuid) to authenticated;
