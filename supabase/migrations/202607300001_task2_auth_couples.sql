create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 80)
);

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  theme_id text not null default 'default',
  color_mode text not null default 'light',
  workspace_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_settings_owner_unique unique (owner_user_id),
  constraint user_settings_theme_check check (theme_id in ('default', 'cat', 'dog')),
  constraint user_settings_color_mode_check check (color_mode in ('light', 'dark')),
  constraint user_settings_workspace_title_length check (workspace_title is null or char_length(workspace_title) <= 80)
);

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active',
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by_user_id uuid references auth.users(id) on delete set null,
  constraint couples_status_check check (status in ('active', 'ended')),
  constraint couples_end_state_check check ((status = 'active' and ended_at is null) or (status = 'ended' and ended_at is not null))
);

create table if not exists public.couple_members (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  constraint couple_members_unique_user_per_couple unique (couple_id, user_id)
);

create table if not exists public.couple_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  invite_code text not null,
  expires_at timestamptz not null default now() + interval '3 days',
  accepted_at timestamptz,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint couple_invites_invite_code_unique unique (invite_code),
  constraint couple_invites_code_format check (invite_code ~ '^[A-Z0-9]{10}$')
);

create index if not exists profiles_updated_at_idx on public.profiles (updated_at desc);
create index if not exists user_settings_owner_user_id_idx on public.user_settings (owner_user_id);
create index if not exists couples_status_idx on public.couples (status);
create index if not exists couple_members_couple_id_idx on public.couple_members (couple_id);
create index if not exists couple_members_user_id_idx on public.couple_members (user_id);
create unique index if not exists couple_members_one_active_couple_per_user
  on public.couple_members (user_id)
  where left_at is null;
create index if not exists couple_invites_inviter_user_id_idx on public.couple_invites (inviter_user_id);
create index if not exists couple_invites_available_code_idx
  on public.couple_invites (invite_code)
  where accepted_at is null and revoked_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;

  insert into public.user_settings (owner_user_id)
  values (new.id)
  on conflict (owner_user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_task2 on auth.users;
create trigger on_auth_user_created_task2
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_active_couple_member(p_couple_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_members cm
    join public.couples c on c.id = cm.couple_id
    where cm.couple_id = p_couple_id
      and cm.user_id = p_user_id
      and cm.left_at is null
      and c.status = 'active'
      and c.ended_at is null
  );
$$;

create or replace function public.current_active_couple_id(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cm.couple_id
  from public.couple_members cm
  join public.couples c on c.id = cm.couple_id
  where cm.user_id = p_user_id
    and cm.left_at is null
    and c.status = 'active'
    and c.ended_at is null
  limit 1;
$$;

create or replace function public.create_couple_invite()
returns table(invite_id uuid, invite_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_invite_id uuid;
  v_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  if public.current_active_couple_id(v_user_id) is not null then
    raise exception 'already_has_active_couple';
  end if;

  update public.couple_invites
  set revoked_at = now()
  where inviter_user_id = v_user_id
    and accepted_at is null
    and revoked_at is null;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    begin
      insert into public.couple_invites (inviter_user_id, invite_code)
      values (v_user_id, v_code)
      returning id, expires_at into v_invite_id, v_expires_at;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  return query select v_invite_id, v_code, v_expires_at;
end;
$$;

create or replace function public.accept_couple_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acceptor_id uuid := auth.uid();
  v_invite public.couple_invites%rowtype;
  v_couple_id uuid;
begin
  if v_acceptor_id is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into v_invite
  from public.couple_invites
  where invite_code = upper(trim(p_invite_code))
  for update;

  if not found or v_invite.accepted_at is not null or v_invite.revoked_at is not null or v_invite.expires_at <= now() then
    raise exception 'invite_not_available';
  end if;

  if v_invite.inviter_user_id = v_acceptor_id then
    raise exception 'cannot_accept_own_invite';
  end if;

  perform pg_advisory_xact_lock(hashtext(least(v_invite.inviter_user_id::text, v_acceptor_id::text)));
  perform pg_advisory_xact_lock(hashtext(greatest(v_invite.inviter_user_id::text, v_acceptor_id::text)));

  if public.current_active_couple_id(v_invite.inviter_user_id) is not null
     or public.current_active_couple_id(v_acceptor_id) is not null then
    raise exception 'already_has_active_couple';
  end if;

  insert into public.couples (created_by_user_id)
  values (v_invite.inviter_user_id)
  returning id into v_couple_id;

  insert into public.couple_members (couple_id, user_id)
  values
    (v_couple_id, v_invite.inviter_user_id),
    (v_couple_id, v_acceptor_id);

  update public.couple_invites
  set accepted_at = now(),
      accepted_by_user_id = v_acceptor_id
  where id = v_invite.id;

  update public.couple_invites
  set revoked_at = now()
  where accepted_at is null
    and revoked_at is null
    and (
      inviter_user_id in (v_invite.inviter_user_id, v_acceptor_id)
      or accepted_by_user_id in (v_invite.inviter_user_id, v_acceptor_id)
    );

  return v_couple_id;
end;
$$;

create or replace function public.leave_active_couple()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid;
  v_left_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  select public.current_active_couple_id(v_user_id) into v_couple_id;

  if v_couple_id is null then
    raise exception 'no_active_couple';
  end if;

  update public.couple_members
  set left_at = v_left_at
  where couple_id = v_couple_id
    and left_at is null;

  update public.couples
  set status = 'ended',
      ended_at = v_left_at,
      ended_by_user_id = v_user_id
  where id = v_couple_id
    and ended_at is null;

  update public.couple_invites
  set revoked_at = v_left_at
  where revoked_at is null
    and accepted_at is null
    and inviter_user_id = v_user_id;

  return v_couple_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.user_settings enable row level security;
alter table public.user_settings force row level security;
alter table public.couples enable row level security;
alter table public.couples force row level security;
alter table public.couple_members enable row level security;
alter table public.couple_members force row level security;
alter table public.couple_invites enable row level security;
alter table public.couple_invites force row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated
using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists user_settings_select_own on public.user_settings;
create policy user_settings_select_own on public.user_settings
for select to authenticated
using (owner_user_id = auth.uid());

drop policy if exists user_settings_insert_own on public.user_settings;
create policy user_settings_insert_own on public.user_settings
for insert to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists user_settings_update_own on public.user_settings;
create policy user_settings_update_own on public.user_settings
for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists couples_select_active_members on public.couples;
create policy couples_select_active_members on public.couples
for select to authenticated
using (public.is_active_couple_member(id, auth.uid()));

drop policy if exists couple_members_select_active_members on public.couple_members;
create policy couple_members_select_active_members on public.couple_members
for select to authenticated
using (public.is_active_couple_member(couple_id, auth.uid()));

drop policy if exists couple_invites_select_own on public.couple_invites;
create policy couple_invites_select_own on public.couple_invites
for select to authenticated
using (inviter_user_id = auth.uid() or accepted_by_user_id = auth.uid());

drop policy if exists couple_invites_insert_own on public.couple_invites;
create policy couple_invites_insert_own on public.couple_invites
for insert to authenticated
with check (inviter_user_id = auth.uid());

drop policy if exists couple_invites_update_own_unaccepted on public.couple_invites;
create policy couple_invites_update_own_unaccepted on public.couple_invites
for update to authenticated
using (inviter_user_id = auth.uid() and accepted_at is null)
with check (inviter_user_id = auth.uid());

revoke delete on public.profiles from authenticated;
revoke delete on public.user_settings from authenticated;
revoke delete on public.couples from authenticated;
revoke delete on public.couple_members from authenticated;
revoke delete on public.couple_invites from authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.user_settings to authenticated;
grant select on public.couples to authenticated;
grant select on public.couple_members to authenticated;
grant select, insert, update on public.couple_invites to authenticated;
grant execute on function public.create_couple_invite() to authenticated;
grant execute on function public.accept_couple_invite(text) to authenticated;
grant execute on function public.leave_active_couple() to authenticated;
