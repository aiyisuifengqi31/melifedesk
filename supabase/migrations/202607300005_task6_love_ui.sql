create table if not exists public.mood_entries (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete set null,
  visibility text not null default 'private',
  mood_date date not null default current_date,
  score int not null check (score between 1 and 10),
  mood_text text,
  tags text[] not null default '{}',
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mood_entries_visibility_check check (visibility in ('private', 'couple_read', 'couple_edit')),
  constraint mood_entries_visibility_couple_check check ((visibility = 'private' and couple_id is null) or (visibility in ('couple_read', 'couple_edit') and couple_id is not null))
);

create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete set null,
  visibility text not null default 'private',
  entry_date date not null default current_date,
  title text,
  body text not null default '',
  tags text[] not null default '{}',
  is_joint_edit_enabled boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diary_entries_visibility_check check (visibility in ('private', 'couple_read', 'couple_edit')),
  constraint diary_entries_visibility_couple_check check ((visibility = 'private' and couple_id is null) or (visibility in ('couple_read', 'couple_edit') and couple_id is not null))
);

create table if not exists public.diary_images (
  id uuid primary key default gen_random_uuid(),
  diary_entry_id uuid not null references public.diary_entries(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null default 'love-images',
  storage_path text not null,
  position integer not null default 0,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diary_images_bucket_check check (bucket_id = 'love-images'),
  constraint diary_images_path_unique unique (storage_path)
);

create table if not exists public.countdowns (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete set null,
  visibility text not null default 'private',
  title text not null,
  target_date date not null,
  countdown_type text not null default 'custom',
  note text,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint countdowns_visibility_check check (visibility in ('private', 'couple_read', 'couple_edit')),
  constraint countdowns_type_check check (countdown_type in ('love_start', 'birthday', 'anniversary', 'custom')),
  constraint countdowns_visibility_couple_check check ((visibility = 'private' and couple_id is null) or (visibility in ('couple_read', 'couple_edit') and couple_id is not null))
);

create table if not exists public.menstrual_settings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  default_cycle_length int not null default 28 check (default_cycle_length between 15 and 60),
  default_period_length int not null default 5 check (default_period_length between 1 and 15),
  share_with_partner boolean not null default false,
  disclaimer text not null default '仅供日程参考，不构成医疗建议。',
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menstrual_settings_owner_unique unique (owner_user_id)
);

create table if not exists public.menstrual_cycles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date,
  period_length int,
  cycle_length int,
  symptoms text[] not null default '{}',
  mood text,
  note text,
  predicted_start_date date,
  predicted_end_date date,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menstrual_cycles_length_check check ((period_length is null or period_length between 1 and 15) and (cycle_length is null or cycle_length between 15 and 60))
);

create index if not exists mood_entries_owner_date_idx on public.mood_entries (owner_user_id, mood_date desc) where deleted_at is null;
create index if not exists diary_entries_owner_date_idx on public.diary_entries (owner_user_id, entry_date desc) where deleted_at is null;
create index if not exists diary_images_entry_idx on public.diary_images (diary_entry_id, position) where deleted_at is null;
create index if not exists countdowns_owner_date_idx on public.countdowns (owner_user_id, target_date) where deleted_at is null;
create index if not exists menstrual_cycles_owner_start_idx on public.menstrual_cycles (owner_user_id, start_date desc) where deleted_at is null;

create or replace function public.can_read_love_record(p_owner_user_id uuid, p_couple_id uuid, p_visibility text, p_deleted_at timestamptz, p_user_id uuid)
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

create or replace function public.can_edit_love_record(p_owner_user_id uuid, p_couple_id uuid, p_visibility text, p_deleted_at timestamptz, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_deleted_at is null and (
    p_owner_user_id = p_user_id
    or (
      p_visibility = 'couple_edit'
      and p_couple_id is not null
      and public.is_active_couple_member(p_couple_id, p_user_id)
    )
  );
$$;

create or replace function public.can_read_diary_entry(p_diary_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.diary_entries d where d.id = p_diary_id and public.can_read_love_record(d.owner_user_id, d.couple_id, d.visibility, d.deleted_at, p_user_id));
$$;

create or replace function public.can_edit_diary_entry(p_diary_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.diary_entries d where d.id = p_diary_id and public.can_edit_love_record(d.owner_user_id, d.couple_id, d.visibility, d.deleted_at, p_user_id));
$$;

create or replace function public.can_read_menstrual_cycle(p_cycle_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
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
          and public.current_active_couple_id(c.owner_user_id) is not null
          and public.is_active_couple_member(public.current_active_couple_id(c.owner_user_id), p_user_id)
        )
      )
  );
$$;

create or replace function public.can_edit_menstrual_cycle(p_cycle_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.menstrual_cycles c where c.id = p_cycle_id and c.deleted_at is null and c.owner_user_id = p_user_id);
$$;

create or replace function public.can_read_love_image_object(p_name text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.diary_images i
    where i.storage_path = p_name and i.deleted_at is null and public.can_read_diary_entry(i.diary_entry_id, p_user_id)
  );
$$;

create or replace function public.can_edit_love_image_object(p_name text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.diary_images i
    where i.storage_path = p_name and i.deleted_at is null and public.can_edit_diary_entry(i.diary_entry_id, p_user_id)
  );
$$;

create or replace function public.soft_delete_diary_entry(p_diary_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.can_edit_diary_entry(p_diary_id, auth.uid()) then raise exception 'not_allowed'; end if;
  update public.diary_entries set deleted_at = now(), deleted_by = auth.uid() where id = p_diary_id and deleted_at is null;
  update public.diary_images set deleted_at = now(), deleted_by = auth.uid() where diary_entry_id = p_diary_id and deleted_at is null;
  return p_diary_id;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['mood_entries','diary_entries','diary_images','countdowns','menstrual_settings','menstrual_cycles']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke delete on public.%I from authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end $$;

alter table public.mood_entries enable row level security;
alter table public.mood_entries force row level security;
alter table public.diary_entries enable row level security;
alter table public.diary_entries force row level security;
alter table public.diary_images enable row level security;
alter table public.diary_images force row level security;
alter table public.countdowns enable row level security;
alter table public.countdowns force row level security;
alter table public.menstrual_settings enable row level security;
alter table public.menstrual_settings force row level security;
alter table public.menstrual_cycles enable row level security;
alter table public.menstrual_cycles force row level security;

revoke delete on public.mood_entries from authenticated;
revoke delete on public.diary_entries from authenticated;
revoke delete on public.diary_images from authenticated;
revoke delete on public.countdowns from authenticated;
revoke delete on public.menstrual_settings from authenticated;
revoke delete on public.menstrual_cycles from authenticated;

drop policy if exists mood_entries_select_visible on public.mood_entries;
create policy mood_entries_select_visible on public.mood_entries for select to authenticated
using (public.can_read_love_record(owner_user_id, couple_id, visibility, deleted_at, auth.uid()));
drop policy if exists mood_entries_insert_own on public.mood_entries;
create policy mood_entries_insert_own on public.mood_entries for insert to authenticated
with check (owner_user_id = auth.uid() and deleted_at is null and ((visibility = 'private' and couple_id is null) or (visibility in ('couple_read','couple_edit') and couple_id = public.current_active_couple_id(auth.uid()))));
drop policy if exists mood_entries_update_editable on public.mood_entries;
create policy mood_entries_update_editable on public.mood_entries for update to authenticated
using (public.can_edit_love_record(owner_user_id, couple_id, visibility, deleted_at, auth.uid()))
with check (owner_user_id = (select owner_user_id from public.mood_entries existing where existing.id = mood_entries.id));

drop policy if exists diary_entries_select_visible on public.diary_entries;
create policy diary_entries_select_visible on public.diary_entries for select to authenticated
using (public.can_read_diary_entry(id, auth.uid()));
drop policy if exists diary_entries_insert_own on public.diary_entries;
create policy diary_entries_insert_own on public.diary_entries for insert to authenticated
with check (owner_user_id = auth.uid() and deleted_at is null and ((visibility = 'private' and couple_id is null) or (visibility in ('couple_read','couple_edit') and couple_id = public.current_active_couple_id(auth.uid()))));
drop policy if exists diary_entries_update_editable on public.diary_entries;
create policy diary_entries_update_editable on public.diary_entries for update to authenticated
using (public.can_edit_diary_entry(id, auth.uid()))
with check (owner_user_id = (select owner_user_id from public.diary_entries existing where existing.id = diary_entries.id));

drop policy if exists diary_images_select_parent on public.diary_images;
create policy diary_images_select_parent on public.diary_images for select to authenticated
using (deleted_at is null and public.can_read_diary_entry(diary_entry_id, auth.uid()));
drop policy if exists diary_images_insert_parent on public.diary_images;
create policy diary_images_insert_parent on public.diary_images for insert to authenticated
with check (owner_user_id = auth.uid() and bucket_id = 'love-images' and storage_path like auth.uid()::text || '/%' and deleted_at is null and public.can_edit_diary_entry(diary_entry_id, auth.uid()));
drop policy if exists diary_images_update_parent on public.diary_images;
create policy diary_images_update_parent on public.diary_images for update to authenticated
using (public.can_edit_diary_entry(diary_entry_id, auth.uid()))
with check (owner_user_id = (select owner_user_id from public.diary_images existing where existing.id = diary_images.id));

drop policy if exists countdowns_select_visible on public.countdowns;
create policy countdowns_select_visible on public.countdowns for select to authenticated
using (public.can_read_love_record(owner_user_id, couple_id, visibility, deleted_at, auth.uid()));
drop policy if exists countdowns_insert_own on public.countdowns;
create policy countdowns_insert_own on public.countdowns for insert to authenticated
with check (owner_user_id = auth.uid() and deleted_at is null and ((visibility = 'private' and couple_id is null) or (visibility in ('couple_read','couple_edit') and couple_id = public.current_active_couple_id(auth.uid()))));
drop policy if exists countdowns_update_editable on public.countdowns;
create policy countdowns_update_editable on public.countdowns for update to authenticated
using (public.can_edit_love_record(owner_user_id, couple_id, visibility, deleted_at, auth.uid()))
with check (owner_user_id = (select owner_user_id from public.countdowns existing where existing.id = countdowns.id));

drop policy if exists menstrual_settings_select_owner_or_shared_partner on public.menstrual_settings;
create policy menstrual_settings_select_owner_or_shared_partner on public.menstrual_settings for select to authenticated
using (deleted_at is null and (owner_user_id = auth.uid() or (share_with_partner = true and public.current_active_couple_id(owner_user_id) is not null and public.is_active_couple_member(public.current_active_couple_id(owner_user_id), auth.uid()))));
drop policy if exists menstrual_settings_insert_owner_only on public.menstrual_settings;
create policy menstrual_settings_insert_owner_only on public.menstrual_settings for insert to authenticated
with check (owner_user_id = auth.uid() and deleted_at is null);
drop policy if exists menstrual_settings_update_owner_only on public.menstrual_settings;
create policy menstrual_settings_update_owner_only on public.menstrual_settings for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists menstrual_cycles_select_owner_or_shared_partner on public.menstrual_cycles;
create policy menstrual_cycles_select_owner_or_shared_partner on public.menstrual_cycles for select to authenticated
using (public.can_read_menstrual_cycle(id, auth.uid()));
drop policy if exists menstrual_cycles_insert_owner_only on public.menstrual_cycles;
create policy menstrual_cycles_insert_owner_only on public.menstrual_cycles for insert to authenticated
with check (owner_user_id = auth.uid() and deleted_at is null);
drop policy if exists menstrual_cycles_update_owner_only on public.menstrual_cycles;
create policy menstrual_cycles_update_owner_only on public.menstrual_cycles for update to authenticated
using (public.can_edit_menstrual_cycle(id, auth.uid()))
with check (owner_user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('love-images', 'love-images', false)
on conflict (id) do update set public = false;

drop policy if exists love_images_objects_select on storage.objects;
create policy love_images_objects_select on storage.objects for select to authenticated
using (bucket_id = 'love-images' and public.can_read_love_image_object(name, auth.uid()));

drop policy if exists love_images_objects_insert on storage.objects;
create policy love_images_objects_insert on storage.objects for insert to authenticated
with check (bucket_id = 'love-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists love_images_objects_update on storage.objects;
create policy love_images_objects_update on storage.objects for update to authenticated
using (bucket_id = 'love-images' and public.can_edit_love_image_object(name, auth.uid()))
with check (bucket_id = 'love-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists love_images_objects_delete on storage.objects;
create policy love_images_objects_delete on storage.objects for delete to authenticated
using (bucket_id = 'love-images' and public.can_edit_love_image_object(name, auth.uid()));

grant execute on function public.soft_delete_diary_entry(uuid) to authenticated;
