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
      returning public.couple_invites.id, public.couple_invites.expires_at
      into v_invite_id, v_expires_at;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  return query select v_invite_id, v_code, v_expires_at;
end;
$$;

grant execute on function public.create_couple_invite() to authenticated;
