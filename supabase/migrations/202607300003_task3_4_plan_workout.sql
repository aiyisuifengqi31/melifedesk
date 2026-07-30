create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete set null,
  visibility text not null default 'private',
  title text not null,
  notes text,
  status text not null default 'todo',
  task_date date not null default current_date,
  due_at timestamptz,
  remind_at timestamptz,
  postponed_from date,
  completed_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_visibility_check check (visibility in ('private', 'couple_read', 'couple_edit')),
  constraint tasks_status_check check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  constraint tasks_title_length check (char_length(title) between 1 and 180),
  constraint tasks_visibility_couple_check check (
    (visibility = 'private' and couple_id is null)
    or (visibility in ('couple_read', 'couple_edit') and couple_id is not null)
  )
);

create table if not exists public.task_subitems (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  status text not null default 'todo',
  position integer not null default 0,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_subitems_status_check check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  constraint task_subitems_title_length check (char_length(title) between 1 and 180),
  constraint task_subitems_position_unique unique (task_id, position)
);

create table if not exists public.task_recurrences (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  frequency text not null,
  interval_count integer not null default 1,
  weekdays integer[],
  monthday integer,
  until_date date,
  timezone text not null default 'Asia/Shanghai',
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_recurrences_task_unique unique (task_id),
  constraint task_recurrences_frequency_check check (frequency in ('daily', 'weekly', 'monthly')),
  constraint task_recurrences_interval_check check (interval_count between 1 and 365),
  constraint task_recurrences_monthday_check check (monthday is null or monthday between 1 and 31)
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete set null,
  visibility text not null default 'private',
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  source text not null default 'manual',
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_visibility_check check (visibility in ('private', 'couple_read', 'couple_edit')),
  constraint calendar_events_time_check check (ends_at is null or ends_at >= starts_at),
  constraint calendar_events_visibility_couple_check check (
    (visibility = 'private' and couple_id is null)
    or (visibility in ('couple_read', 'couple_edit') and couple_id is not null)
  )
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete set null,
  visibility text not null default 'private',
  session_date date not null default current_date,
  title text not null,
  duration_minutes integer,
  kcal numeric(8, 1),
  kcal_source text not null default 'manual',
  intensity text,
  feeling text,
  notes text,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_sessions_visibility_check check (visibility in ('private', 'couple_read', 'couple_edit')),
  constraint workout_sessions_duration_check check (duration_minutes is null or duration_minutes >= 0),
  constraint workout_sessions_kcal_check check (kcal is null or kcal >= 0),
  constraint workout_sessions_kcal_source_check check (kcal_source in ('manual', 'estimated')),
  constraint workout_sessions_intensity_check check (intensity is null or intensity in ('easy', 'moderate', 'hard')),
  constraint workout_sessions_visibility_couple_check check (
    (visibility = 'private' and couple_id is null)
    or (visibility in ('couple_read', 'couple_edit') and couple_id is not null)
  )
);

create table if not exists public.workout_parts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  part text not null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_parts_part_check check (part in ('chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'glutes', 'cardio', 'full_body', 'stretch', 'rest')),
  constraint workout_parts_session_part_unique unique (session_id, part)
);

create table if not exists public.workout_photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null default 'workout-photos',
  storage_path text not null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_photos_bucket_check check (bucket_id = 'workout-photos'),
  constraint workout_photos_path_unique unique (storage_path)
);

create index if not exists tasks_owner_date_idx on public.tasks (owner_user_id, task_date) where deleted_at is null;
create index if not exists tasks_couple_date_idx on public.tasks (couple_id, task_date) where deleted_at is null;
create index if not exists tasks_status_idx on public.tasks (status) where deleted_at is null;
create index if not exists task_subitems_task_position_idx on public.task_subitems (task_id, position) where deleted_at is null;
create index if not exists task_recurrences_task_idx on public.task_recurrences (task_id) where deleted_at is null;
create index if not exists calendar_events_owner_starts_idx on public.calendar_events (owner_user_id, starts_at) where deleted_at is null;
create index if not exists calendar_events_couple_starts_idx on public.calendar_events (couple_id, starts_at) where deleted_at is null;
create index if not exists workout_sessions_owner_date_idx on public.workout_sessions (owner_user_id, session_date) where deleted_at is null;
create index if not exists workout_sessions_couple_date_idx on public.workout_sessions (couple_id, session_date) where deleted_at is null;
create index if not exists workout_parts_session_idx on public.workout_parts (session_id) where deleted_at is null;
create index if not exists workout_photos_session_idx on public.workout_photos (session_id) where deleted_at is null;
create index if not exists workout_photos_owner_path_idx on public.workout_photos (owner_user_id, storage_path) where deleted_at is null;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();
drop trigger if exists task_subitems_set_updated_at on public.task_subitems;
create trigger task_subitems_set_updated_at before update on public.task_subitems for each row execute function public.set_updated_at();
drop trigger if exists task_recurrences_set_updated_at on public.task_recurrences;
create trigger task_recurrences_set_updated_at before update on public.task_recurrences for each row execute function public.set_updated_at();
drop trigger if exists calendar_events_set_updated_at on public.calendar_events;
create trigger calendar_events_set_updated_at before update on public.calendar_events for each row execute function public.set_updated_at();
drop trigger if exists workout_sessions_set_updated_at on public.workout_sessions;
create trigger workout_sessions_set_updated_at before update on public.workout_sessions for each row execute function public.set_updated_at();
drop trigger if exists workout_parts_set_updated_at on public.workout_parts;
create trigger workout_parts_set_updated_at before update on public.workout_parts for each row execute function public.set_updated_at();
drop trigger if exists workout_photos_set_updated_at on public.workout_photos;
create trigger workout_photos_set_updated_at before update on public.workout_photos for each row execute function public.set_updated_at();

create or replace function public.can_read_task(p_task_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and t.deleted_at is null
      and (
        t.owner_user_id = p_user_id
        or (
          t.visibility in ('couple_read', 'couple_edit')
          and t.couple_id is not null
          and public.is_active_couple_member(t.couple_id, p_user_id)
        )
      )
  );
$$;

create or replace function public.can_edit_task(p_task_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and t.deleted_at is null
      and (
        t.owner_user_id = p_user_id
        or (
          t.visibility = 'couple_edit'
          and t.couple_id is not null
          and public.is_active_couple_member(t.couple_id, p_user_id)
        )
      )
  );
$$;

create or replace function public.can_read_calendar_event(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.calendar_events e
    where e.id = p_event_id
      and e.deleted_at is null
      and (
        e.owner_user_id = p_user_id
        or (
          e.visibility in ('couple_read', 'couple_edit')
          and e.couple_id is not null
          and public.is_active_couple_member(e.couple_id, p_user_id)
        )
      )
  );
$$;

create or replace function public.can_edit_calendar_event(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.calendar_events e
    where e.id = p_event_id
      and e.deleted_at is null
      and (
        e.owner_user_id = p_user_id
        or (
          e.visibility = 'couple_edit'
          and e.couple_id is not null
          and public.is_active_couple_member(e.couple_id, p_user_id)
        )
      )
  );
$$;

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
          and w.couple_id is not null
          and public.is_active_couple_member(w.couple_id, p_user_id)
        )
      )
  );
$$;

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
      and (
        w.owner_user_id = p_user_id
        or (
          w.visibility = 'couple_edit'
          and w.couple_id is not null
          and public.is_active_couple_member(w.couple_id, p_user_id)
        )
      )
  );
$$;

create or replace function public.can_read_workout_photo_object(p_name text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workout_photos wp
    where wp.storage_path = p_name
      and wp.deleted_at is null
      and public.can_read_workout_session(wp.session_id, p_user_id)
  );
$$;

create or replace function public.can_edit_workout_photo_object(p_name text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workout_photos wp
    where wp.storage_path = p_name
      and wp.deleted_at is null
      and public.can_edit_workout_session(wp.session_id, p_user_id)
  );
$$;

create or replace function public.soft_delete_task(p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.can_edit_task(p_task_id, auth.uid()) then
    raise exception 'not_allowed';
  end if;

  update public.tasks
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_task_id and deleted_at is null;

  update public.task_subitems
  set deleted_at = now(), deleted_by = auth.uid()
  where task_id = p_task_id and deleted_at is null;

  update public.task_recurrences
  set deleted_at = now(), deleted_by = auth.uid()
  where task_id = p_task_id and deleted_at is null;

  return p_task_id;
end;
$$;

create or replace function public.soft_delete_workout_session(p_session_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.can_edit_workout_session(p_session_id, auth.uid()) then
    raise exception 'not_allowed';
  end if;

  update public.workout_sessions
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_session_id and deleted_at is null;

  update public.workout_parts
  set deleted_at = now(), deleted_by = auth.uid()
  where session_id = p_session_id and deleted_at is null;

  update public.workout_photos
  set deleted_at = now(), deleted_by = auth.uid()
  where session_id = p_session_id and deleted_at is null;

  return p_session_id;
end;
$$;

alter table public.tasks enable row level security;
alter table public.tasks force row level security;
alter table public.task_subitems enable row level security;
alter table public.task_subitems force row level security;
alter table public.task_recurrences enable row level security;
alter table public.task_recurrences force row level security;
alter table public.calendar_events enable row level security;
alter table public.calendar_events force row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sessions force row level security;
alter table public.workout_parts enable row level security;
alter table public.workout_parts force row level security;
alter table public.workout_photos enable row level security;
alter table public.workout_photos force row level security;

drop policy if exists tasks_select_visible on public.tasks;
create policy tasks_select_visible on public.tasks
for select to authenticated
using (public.can_read_task(id, auth.uid()));

drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own on public.tasks
for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and deleted_at is null
  and (
    (visibility = 'private' and couple_id is null)
    or (visibility in ('couple_read', 'couple_edit') and couple_id = public.current_active_couple_id(auth.uid()))
  )
);

drop policy if exists tasks_update_editable on public.tasks;
create policy tasks_update_editable on public.tasks
for update to authenticated
using (public.can_edit_task(id, auth.uid()))
with check (
  public.can_edit_task(id, auth.uid())
  and owner_user_id = (select owner_user_id from public.tasks existing where existing.id = tasks.id)
  and (
    (visibility = 'private' and couple_id is null)
    or (visibility in ('couple_read', 'couple_edit') and couple_id = public.current_active_couple_id(auth.uid()))
  )
);

drop policy if exists task_subitems_select_parent on public.task_subitems;
create policy task_subitems_select_parent on public.task_subitems
for select to authenticated
using (deleted_at is null and public.can_read_task(task_id, auth.uid()));

drop policy if exists task_subitems_insert_parent on public.task_subitems;
create policy task_subitems_insert_parent on public.task_subitems
for insert to authenticated
with check (deleted_at is null and public.can_edit_task(task_id, auth.uid()));

drop policy if exists task_subitems_update_parent on public.task_subitems;
create policy task_subitems_update_parent on public.task_subitems
for update to authenticated
using (public.can_edit_task(task_id, auth.uid()))
with check (public.can_edit_task(task_id, auth.uid()));

drop policy if exists task_recurrences_select_parent on public.task_recurrences;
create policy task_recurrences_select_parent on public.task_recurrences
for select to authenticated
using (deleted_at is null and public.can_read_task(task_id, auth.uid()));

drop policy if exists task_recurrences_insert_parent on public.task_recurrences;
create policy task_recurrences_insert_parent on public.task_recurrences
for insert to authenticated
with check (deleted_at is null and public.can_edit_task(task_id, auth.uid()));

drop policy if exists task_recurrences_update_parent on public.task_recurrences;
create policy task_recurrences_update_parent on public.task_recurrences
for update to authenticated
using (public.can_edit_task(task_id, auth.uid()))
with check (public.can_edit_task(task_id, auth.uid()));

drop policy if exists calendar_events_select_visible on public.calendar_events;
create policy calendar_events_select_visible on public.calendar_events
for select to authenticated
using (public.can_read_calendar_event(id, auth.uid()));

drop policy if exists calendar_events_insert_own on public.calendar_events;
create policy calendar_events_insert_own on public.calendar_events
for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and deleted_at is null
  and (
    (visibility = 'private' and couple_id is null)
    or (visibility in ('couple_read', 'couple_edit') and couple_id = public.current_active_couple_id(auth.uid()))
  )
);

drop policy if exists calendar_events_update_editable on public.calendar_events;
create policy calendar_events_update_editable on public.calendar_events
for update to authenticated
using (public.can_edit_calendar_event(id, auth.uid()))
with check (
  public.can_edit_calendar_event(id, auth.uid())
  and owner_user_id = (select owner_user_id from public.calendar_events existing where existing.id = calendar_events.id)
);

drop policy if exists workout_sessions_select_visible on public.workout_sessions;
create policy workout_sessions_select_visible on public.workout_sessions
for select to authenticated
using (public.can_read_workout_session(id, auth.uid()));

drop policy if exists workout_sessions_insert_own on public.workout_sessions;
create policy workout_sessions_insert_own on public.workout_sessions
for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and deleted_at is null
  and (
    (visibility = 'private' and couple_id is null)
    or (visibility in ('couple_read', 'couple_edit') and couple_id = public.current_active_couple_id(auth.uid()))
  )
);

drop policy if exists workout_sessions_update_editable on public.workout_sessions;
create policy workout_sessions_update_editable on public.workout_sessions
for update to authenticated
using (public.can_edit_workout_session(id, auth.uid()))
with check (
  public.can_edit_workout_session(id, auth.uid())
  and owner_user_id = (select owner_user_id from public.workout_sessions existing where existing.id = workout_sessions.id)
);

drop policy if exists workout_parts_select_parent on public.workout_parts;
create policy workout_parts_select_parent on public.workout_parts
for select to authenticated
using (deleted_at is null and public.can_read_workout_session(session_id, auth.uid()));

drop policy if exists workout_parts_insert_parent on public.workout_parts;
create policy workout_parts_insert_parent on public.workout_parts
for insert to authenticated
with check (deleted_at is null and public.can_edit_workout_session(session_id, auth.uid()));

drop policy if exists workout_parts_update_parent on public.workout_parts;
create policy workout_parts_update_parent on public.workout_parts
for update to authenticated
using (public.can_edit_workout_session(session_id, auth.uid()))
with check (public.can_edit_workout_session(session_id, auth.uid()));

drop policy if exists workout_photos_select_parent on public.workout_photos;
create policy workout_photos_select_parent on public.workout_photos
for select to authenticated
using (deleted_at is null and public.can_read_workout_session(session_id, auth.uid()));

drop policy if exists workout_photos_insert_parent on public.workout_photos;
create policy workout_photos_insert_parent on public.workout_photos
for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and bucket_id = 'workout-photos'
  and storage_path like auth.uid()::text || '/%'
  and deleted_at is null
  and public.can_edit_workout_session(session_id, auth.uid())
);

drop policy if exists workout_photos_update_parent on public.workout_photos;
create policy workout_photos_update_parent on public.workout_photos
for update to authenticated
using (public.can_edit_workout_session(session_id, auth.uid()))
with check (
  owner_user_id = (select owner_user_id from public.workout_photos existing where existing.id = workout_photos.id)
  and bucket_id = 'workout-photos'
  and public.can_edit_workout_session(session_id, auth.uid())
);

insert into storage.buckets (id, name, public)
values ('workout-photos', 'workout-photos', false)
on conflict (id) do update set public = false;

drop policy if exists workout_photos_objects_select on storage.objects;
create policy workout_photos_objects_select on storage.objects for select to authenticated
using (
  bucket_id = 'workout-photos'
  and public.can_read_workout_photo_object(name, auth.uid())
);

drop policy if exists workout_photos_objects_insert on storage.objects;
create policy workout_photos_objects_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'workout-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists workout_photos_objects_update on storage.objects;
create policy workout_photos_objects_update on storage.objects for update to authenticated
using (
  bucket_id = 'workout-photos'
  and public.can_edit_workout_photo_object(name, auth.uid())
)
with check (
  bucket_id = 'workout-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists workout_photos_objects_delete on storage.objects;
create policy workout_photos_objects_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'workout-photos'
  and public.can_edit_workout_photo_object(name, auth.uid())
);

revoke delete on public.tasks from authenticated;
revoke delete on public.task_subitems from authenticated;
revoke delete on public.task_recurrences from authenticated;
revoke delete on public.calendar_events from authenticated;
revoke delete on public.workout_sessions from authenticated;
revoke delete on public.workout_parts from authenticated;
revoke delete on public.workout_photos from authenticated;

grant select, insert, update on public.tasks to authenticated;
grant select, insert, update on public.task_subitems to authenticated;
grant select, insert, update on public.task_recurrences to authenticated;
grant select, insert, update on public.calendar_events to authenticated;
grant select, insert, update on public.workout_sessions to authenticated;
grant select, insert, update on public.workout_parts to authenticated;
grant select, insert, update on public.workout_photos to authenticated;
grant execute on function public.soft_delete_task(uuid) to authenticated;
grant execute on function public.soft_delete_workout_session(uuid) to authenticated;
