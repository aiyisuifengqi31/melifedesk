-- ============================================================================
-- Partner-scoped access model (rebind-safe)
-- ----------------------------------------------------------------------------
-- Principle: a record ALWAYS belongs to its creator (owner_user_id). Binding,
-- unbinding and rebinding only change ACCESS, never ownership, and never delete
-- data. Access to a shared record is decided by the CURRENT active partnership
-- between the viewer and the record OWNER -- NOT by the stored couple_id.
--
-- Why: previously shared rows were gated by is_active_couple_member(couple_id,
-- viewer) on the couple the row was created in. After A-B ends and A-C begins,
-- A's AB-era diaries kept couple_id=AB (ended) and became invisible to C.
-- With this migration C (A's new active partner) can see/edit A's history, while
-- B (the old partner) loses all access. The couple_id column is retained purely
-- as a HISTORICAL marker (created_during_binding_id); it no longer gates access.
-- ============================================================================

-- True iff p_viewer is currently the active partner of p_owner.
create or replace function public.is_active_partner_of(p_owner uuid, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
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

-- The current active partner of p_user_id (or auth.uid() when omitted).
create or replace function public.current_active_partner_id(p_user_id uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path = public
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

-- ---------------------------------------------------------------------------
-- Love records: owner full access; active partner can READ couple_read/couple_edit
-- and EDIT couple_edit. Other users (incl. historical partners) get nothing.
-- couple_id parameter is dropped: access depends only on owner + current partner.
-- ---------------------------------------------------------------------------
drop function if exists public.can_read_love_record(uuid, uuid, text, timestamptz, uuid);
create or replace function public.can_read_love_record(p_owner_user_id uuid, p_visibility text, p_deleted_at timestamptz, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_deleted_at is null and (
    p_owner_user_id = p_user_id
    or (
      p_visibility in ('couple_read', 'couple_edit')
      and public.is_active_partner_of(p_owner_user_id, p_user_id)
    )
  );
$$;

drop function if exists public.can_edit_love_record(uuid, uuid, text, timestamptz, uuid);
create or replace function public.can_edit_love_record(p_owner_user_id uuid, p_visibility text, p_deleted_at timestamptz, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_deleted_at is null and (
    p_owner_user_id = p_user_id
    or (
      p_visibility = 'couple_edit'
      and public.is_active_partner_of(p_owner_user_id, p_user_id)
    )
  );
$$;

-- Diary wrappers (signature changed: couple_id removed).
drop function if exists public.can_read_diary_entry(uuid, uuid);
create or replace function public.can_read_diary_entry(p_diary_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.diary_entries d
    where d.id = p_diary_id
      and public.can_read_love_record(d.owner_user_id, d.visibility, d.deleted_at, p_user_id)
  );
$$;

drop function if exists public.can_edit_diary_entry(uuid, uuid);
create or replace function public.can_edit_diary_entry(p_diary_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.diary_entries d
    where d.id = p_diary_id
      and public.can_edit_love_record(d.owner_user_id, d.visibility, d.deleted_at, p_user_id)
  );
$$;

-- Diary deletion: OWNER ONLY. A partner may co-edit but may never delete the
-- owner's content. Unbinding never cascades a delete -- this just sets deleted_at.
create or replace function public.soft_delete_diary_entry(p_diary_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select owner_user_id into v_owner
  from public.diary_entries
  where id = p_diary_id and deleted_at is null;

  if v_owner is null then
    raise exception 'not_found';
  end if;

  if v_owner <> auth.uid() then
    raise exception 'not_allowed';
  end if;

  update public.diary_entries
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_diary_id and deleted_at is null;

  update public.diary_images
  set deleted_at = now(), deleted_by = auth.uid()
  where diary_entry_id = p_diary_id and deleted_at is null;

  return p_diary_id;
end;
$$;

-- Menstrual read: active-partner-of-owner (replaces couple_id check).
drop function if exists public.can_read_menstrual_cycle(uuid, uuid);
create or replace function public.can_read_menstrual_cycle(p_cycle_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
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

-- ---------------------------------------------------------------------------
-- Workout sessions: owner full CRUD; ACTIVE PARTNER READ-ONLY (SELECT only).
-- This is enforced at the DB layer: can_edit_workout_session is owner-only.
-- ---------------------------------------------------------------------------
drop function if exists public.can_read_workout_session(uuid, uuid);
create or replace function public.can_read_workout_session(p_session_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
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

drop function if exists public.can_edit_workout_session(uuid, uuid);
create or replace function public.can_edit_workout_session(p_session_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workout_sessions w
    where w.id = p_session_id
      and w.deleted_at is null
      and w.owner_user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Re-create policies that referenced the old can_* signatures (couple_id arg).
-- Insert policies still require couple_id = current_active_couple_id(...) so a
-- shared record is tagged with the creator's CURRENT active couple (historical).
-- ---------------------------------------------------------------------------
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

-- Ensure the love-images storage policies still use the (now partner-scoped) entry checks.
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

grant execute on function public.is_active_partner_of(uuid, uuid) to authenticated;
grant execute on function public.current_active_partner_id(uuid) to authenticated;
