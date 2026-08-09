-- ============================================================================
-- 手动应用「伴侣作用域访问」RLS（在 Supabase 后台 SQL Editor 一次性执行）
-- ----------------------------------------------------------------------------
-- 适用场景：deploy.yml 只构建前端、不执行迁移，因此真库的 RLS/函数可能停留在
-- 旧版本，导致「A 写了恋爱日记，B 看不到」。本脚本把真库刷到正确版本。
--
-- 用法：
--   1. 打开 Supabase 控制台 → 你的项目 → SQL Editor → New query
--   2. 粘贴本文件全部内容，点 RUN
--   3. 看到 "DONE: partner-scoped RLS applied" 即成功
--   4. 回到 App，双方都强制刷新（或重开 PWA），A 重新保存一条日记，B 点「刷新」
--
-- 幂等：先用 DO 块按「函数名」删除所有旧版本（不管签名），再重建，再重建策略。
-- ============================================================================

-- 1) 按名删除所有相关旧函数（cascade 会连带删掉依赖它们的旧策略）
do $$
declare
  r record;
begin
  for r in
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_arguments(p.oid)) as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'is_active_partner_of',
        'current_active_partner_id',
        'can_read_love_record',
        'can_edit_love_record',
        'can_read_diary_entry',
        'can_edit_diary_entry',
        'can_read_menstrual_cycle',
        'can_read_workout_session',
        'can_edit_workout_session'
      )
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;

-- 2) 重建函数（正确版本：访问只取决于 owner + 当前 active partner，不看存储的 couple_id）
create or replace function public.is_active_partner_of(p_owner uuid, p_viewer uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.couple_members cm_owner
    join public.couples c on c.id = cm_owner.couple_id
    join public.couple_members cm_viewer on cm_viewer.couple_id = c.id
    where cm_owner.user_id = p_owner
      and cm_viewer.user_id = p_viewer
      and cm_owner.left_at is null
      and cm_viewer.left_at is null
      and c.status = 'active'
      and c.ended_at is null
  );
$$;

create or replace function public.current_active_partner_id(p_user_id uuid default auth.uid())
returns uuid
language sql stable security definer set search_path = public
as $$
  select cm_viewer.user_id
  from public.couple_members cm_owner
  join public.couples c on c.id = cm_owner.couple_id
  join public.couple_members cm_viewer on cm_viewer.couple_id = c.id
  where cm_owner.user_id = p_user_id
    and cm_owner.left_at is null
    and cm_viewer.left_at is null
    and cm_viewer.user_id <> p_user_id
    and c.status = 'active'
    and c.ended_at is null
  limit 1;
$$;

create or replace function public.can_read_love_record(p_owner_user_id uuid, p_visibility text, p_deleted_at timestamptz, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_deleted_at is null and (
    p_owner_user_id = p_user_id
    or (
      p_visibility in ('couple_read', 'couple_edit')
      and public.is_active_partner_of(p_owner_user_id, p_user_id)
    )
  );
$$;

create or replace function public.can_edit_love_record(p_owner_user_id uuid, p_visibility text, p_deleted_at timestamptz, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_deleted_at is null and (
    p_owner_user_id = p_user_id
    or (
      p_visibility = 'couple_edit'
      and public.is_active_partner_of(p_owner_user_id, p_user_id)
    )
  );
$$;

create or replace function public.can_read_diary_entry(p_diary_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.diary_entries d
    where d.id = p_diary_id
      and public.can_read_love_record(d.owner_user_id, d.visibility, d.deleted_at, p_user_id)
  );
$$;

create or replace function public.can_edit_diary_entry(p_diary_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.diary_entries d
    where d.id = p_diary_id
      and public.can_edit_love_record(d.owner_user_id, d.visibility, d.deleted_at, p_user_id)
  );
$$;

create or replace function public.soft_delete_diary_entry(p_diary_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select owner_user_id into v_owner
  from public.diary_entries where id = p_diary_id and deleted_at is null;
  if v_owner is null then raise exception 'not_found'; end if;
  if v_owner <> auth.uid() then raise exception 'not_allowed'; end if;
  update public.diary_entries set deleted_at = now(), deleted_by = auth.uid()
  where id = p_diary_id and deleted_at is null;
  update public.diary_images set deleted_at = now(), deleted_by = auth.uid()
  where diary_entry_id = p_diary_id and deleted_at is null;
  return p_diary_id;
end;
$$;

create or replace function public.can_read_menstrual_cycle(p_cycle_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.menstrual_cycles c
    left join public.menstrual_settings s on s.owner_user_id = c.owner_user_id and s.deleted_at is null
    where c.id = p_cycle_id
      and c.deleted_at is null
      and (
        c.owner_user_id = p_user_id
        or (
          coalesce(s.share_with_partner, false) = true
          and public.is_active_partner_of(c.owner_user_id, p_user_id)
        )
      )
  );
$$;

create or replace function public.can_read_workout_session(p_session_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workout_sessions w
    where w.id = p_session_id
      and w.deleted_at is null
      and (
        w.owner_user_id = p_user_id
        or (
          w.visibility in ('couple_read', 'couple_edit')
          and public.is_active_partner_of(w.owner_user_id, p_user_id)
        )
      )
  );
$$;

create or replace function public.can_edit_workout_session(p_session_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workout_sessions w
    where w.id = p_session_id
      and w.deleted_at is null
      and w.owner_user_id = p_user_id
  );
$$;

-- 3) 重建策略（DO 块已 cascade 删除依赖旧函数的旧策略，这里重建）
drop policy if exists mood_entries_select_visible on public.mood_entries;
create policy mood_entries_select_visible on public.mood_entries for select to authenticated
using (public.can_read_love_record(owner_user_id, visibility, deleted_at, auth.uid()));

drop policy if exists mood_entries_update_editable on public.mood_entries;
create policy mood_entries_update_editable on public.mood_entries for update to authenticated
using (public.can_edit_love_record(owner_user_id, visibility, deleted_at, auth.uid()))
with check (owner_user_id = (select owner_user_id from public.mood_entries existing where existing.id = mood_entries.id));

drop policy if exists diary_entries_select_visible on public.diary_entries;
create policy diary_entries_select_visible on public.diary_entries for select to authenticated
using (public.can_read_diary_entry(id, auth.uid()));

drop policy if exists diary_entries_update_editable on public.diary_entries;
create policy diary_entries_update_editable on public.diary_entries for update to authenticated
using (public.can_edit_diary_entry(id, auth.uid()))
with check (owner_user_id = (select owner_user_id from public.diary_entries existing where existing.id = diary_entries.id));

drop policy if exists countdowns_select_visible on public.countdowns;
create policy countdowns_select_visible on public.countdowns for select to authenticated
using (public.can_read_love_record(owner_user_id, visibility, deleted_at, auth.uid()));

drop policy if exists countdowns_update_editable on public.countdowns;
create policy countdowns_update_editable on public.countdowns for update to authenticated
using (public.can_edit_love_record(owner_user_id, visibility, deleted_at, auth.uid()))
with check (owner_user_id = (select owner_user_id from public.countdowns existing where existing.id = countdowns.id));

drop policy if exists menstrual_settings_select_owner_or_shared_partner on public.menstrual_settings;
create policy menstrual_settings_select_owner_or_shared_partner on public.menstrual_settings for select to authenticated
using (deleted_at is null and (owner_user_id = auth.uid() or (share_with_partner = true and public.is_active_partner_of(owner_user_id, auth.uid()))));

drop policy if exists menstrual_cycles_select_owner_or_shared_partner on public.menstrual_cycles;
create policy menstrual_cycles_select_owner_or_shared_partner on public.menstrual_cycles for select to authenticated
using (public.can_read_menstrual_cycle(id, auth.uid()));

drop policy if exists workout_sessions_select_visible on public.workout_sessions;
create policy workout_sessions_select_visible on public.workout_sessions for select to authenticated
using (public.can_read_workout_session(id, auth.uid()));

drop policy if exists workout_sessions_update_editable on public.workout_sessions;
create policy workout_sessions_update_editable on public.workout_sessions for update to authenticated
using (public.can_edit_workout_session(id, auth.uid()))
with check (
  public.can_edit_workout_session(id, auth.uid())
  and owner_user_id = (select owner_user_id from public.workout_sessions existing where existing.id = workout_sessions.id)
);

drop policy if exists workout_parts_select_parent on public.workout_parts;
create policy workout_parts_select_parent on public.workout_parts for select to authenticated
using (deleted_at is null and public.can_read_workout_session(session_id, auth.uid()));

drop policy if exists workout_parts_update_parent on public.workout_parts;
create policy workout_parts_update_parent on public.workout_parts for update to authenticated
using (public.can_edit_workout_session(session_id, auth.uid()))
with check (public.can_edit_workout_session(session_id, auth.uid()));

drop policy if exists workout_photos_select_parent on public.workout_photos;
create policy workout_photos_select_parent on public.workout_photos for select to authenticated
using (deleted_at is null and public.can_read_workout_session(session_id, auth.uid()));

drop policy if exists workout_photos_update_parent on public.workout_photos;
create policy workout_photos_update_parent on public.workout_photos for update to authenticated
using (public.can_edit_workout_session(session_id, auth.uid()))
with check (
  owner_user_id = (select owner_user_id from public.workout_photos existing where existing.id = workout_photos.id)
  and bucket_id = 'workout-photos'
  and public.can_edit_workout_session(session_id, auth.uid())
);

-- 4) 存储桶策略（依赖 can_read/write_love_image_object / workout_photo_object，假定已存在）
drop policy if exists love_images_objects_select on storage.objects;
create policy love_images_objects_select on storage.objects for select to authenticated
using (bucket_id = 'love-images' and public.can_read_love_image_object(name, auth.uid()));

drop policy if exists love_images_objects_update on storage.objects;
create policy love_images_objects_update on storage.objects for update to authenticated
using (bucket_id = 'love-images' and public.can_edit_love_image_object(name, auth.uid()))
with check (bucket_id = 'love-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists love_images_objects_delete on storage.objects;
create policy love_images_objects_delete on storage.objects for delete to authenticated
using (bucket_id = 'love-images' and public.can_edit_love_image_object(name, auth.uid()));

drop policy if exists workout_photos_objects_select on storage.objects;
create policy workout_photos_objects_select on storage.objects for select to authenticated
using (bucket_id = 'workout-photos' and public.can_read_workout_photo_object(name, auth.uid()));

drop policy if exists workout_photos_objects_update on storage.objects;
create policy workout_photos_objects_update on storage.objects for update to authenticated
using (bucket_id = 'workout-photos' and public.can_edit_workout_photo_object(name, auth.uid()))
with check (bucket_id = 'workout-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists workout_photos_objects_delete on storage.objects;
create policy workout_photos_objects_delete on storage.objects for delete to authenticated
using (bucket_id = 'workout-photos' and public.can_edit_workout_photo_object(name, auth.uid()));

-- 5) 授权
grant execute on function public.is_active_partner_of(uuid, uuid) to authenticated;
grant execute on function public.current_active_partner_id(uuid) to authenticated;
grant execute on function public.can_read_love_record(uuid, text, timestamptz, uuid) to authenticated;
grant execute on function public.can_edit_love_record(uuid, text, timestamptz, uuid) to authenticated;
grant execute on function public.can_read_diary_entry(uuid, uuid) to authenticated;
grant execute on function public.can_edit_diary_entry(uuid, uuid) to authenticated;
grant execute on function public.can_read_menstrual_cycle(uuid, uuid) to authenticated;
grant execute on function public.can_read_workout_session(uuid, uuid) to authenticated;
grant execute on function public.can_edit_workout_session(uuid, uuid) to authenticated;

select 'DONE: partner-scoped RLS applied' as result;
