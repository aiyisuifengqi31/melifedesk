create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete set null,
  visibility text not null default 'private',
  name text not null,
  account_type text not null default 'cash',
  currency text not null default 'CNY',
  is_default boolean not null default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_accounts_visibility_check check (visibility in ('private', 'couple_read', 'couple_edit')),
  constraint finance_accounts_visibility_couple_check check ((visibility = 'private' and couple_id is null) or (visibility in ('couple_read', 'couple_edit') and couple_id is not null))
);

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  icon_key text not null default 'circle',
  color text not null default '#8b8f76',
  transaction_type text not null,
  is_system boolean not null default false,
  is_pinned boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_categories_type_check check (transaction_type in ('expense', 'income')),
  constraint finance_categories_system_owner_check check ((is_system = true and owner_user_id is null) or (is_system = false and owner_user_id is not null)),
  constraint finance_categories_system_delete_check check (is_system = false or (deleted_at is null and deleted_by is null))
);

create table if not exists public.gift_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete set null,
  visibility text not null default 'private',
  name text not null,
  relationship text,
  phone text,
  alias text,
  note text,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gift_contacts_visibility_check check (visibility in ('private', 'couple_read', 'couple_edit')),
  constraint gift_contacts_visibility_couple_check check ((visibility = 'private' and couple_id is null) or (visibility in ('couple_read', 'couple_edit') and couple_id is not null))
);

create table if not exists public.gift_records (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete set null,
  visibility text not null default 'private',
  contact_id uuid not null references public.gift_contacts(id) on delete restrict,
  direction text not null,
  amount numeric(14,2) not null,
  event_date date not null,
  event_type text not null,
  place text,
  note text,
  need_return boolean not null default false,
  return_reminder_date date,
  sync_finance boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gift_records_visibility_check check (visibility in ('private', 'couple_read', 'couple_edit')),
  constraint gift_records_direction_check check (direction in ('sent', 'received')),
  constraint gift_records_amount_check check (amount >= 0),
  constraint gift_records_event_type_check check (event_type in ('婚礼', '订婚', '生日', '满月', '乔迁', '升学', '丧事', '节日', '其他')),
  constraint gift_records_visibility_couple_check check ((visibility = 'private' and couple_id is null) or (visibility in ('couple_read', 'couple_edit') and couple_id is not null))
);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete set null,
  visibility text not null default 'private',
  transaction_type text not null,
  amount numeric(14,2) not null,
  category_id uuid not null references public.finance_categories(id) on delete restrict,
  account_id uuid references public.finance_accounts(id) on delete set null,
  occurred_at timestamptz not null default now(),
  local_date date not null default current_date,
  merchant text,
  note text,
  tags text[] not null default '{}',
  repeat_rule jsonb,
  gift_record_id uuid references public.gift_records(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_transactions_visibility_check check (visibility in ('private', 'couple_read', 'couple_edit')),
  constraint finance_transactions_type_check check (transaction_type in ('expense', 'income')),
  constraint finance_transactions_amount_check check (amount >= 0),
  constraint finance_transactions_visibility_couple_check check ((visibility = 'private' and couple_id is null) or (visibility in ('couple_read', 'couple_edit') and couple_id is not null))
);

create table if not exists public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete set null,
  visibility text not null default 'private',
  month date not null,
  category_id uuid references public.finance_categories(id) on delete restrict,
  budget_amount numeric(14,2) not null,
  alert_threshold numeric(5,2) not null default 0.8,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_budgets_visibility_check check (visibility in ('private', 'couple_read', 'couple_edit')),
  constraint finance_budgets_amount_check check (budget_amount >= 0),
  constraint finance_budgets_visibility_couple_check check ((visibility = 'private' and couple_id is null) or (visibility in ('couple_read', 'couple_edit') and couple_id is not null))
);

create table if not exists public.saving_goals (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete set null,
  visibility text not null default 'private',
  name text not null,
  target_amount numeric(14,2) not null,
  saved_amount numeric(14,2) not null default 0,
  target_date date,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saving_goals_visibility_check check (visibility in ('private', 'couple_read', 'couple_edit')),
  constraint saving_goals_amount_check check (target_amount >= 0 and saved_amount >= 0),
  constraint saving_goals_visibility_couple_check check ((visibility = 'private' and couple_id is null) or (visibility in ('couple_read', 'couple_edit') and couple_id is not null))
);

create unique index if not exists finance_transactions_gift_record_unique on public.finance_transactions (gift_record_id) where gift_record_id is not null;
create unique index if not exists finance_categories_system_unique on public.finance_categories (transaction_type, name) where is_system = true and owner_user_id is null;
create index if not exists finance_accounts_owner_idx on public.finance_accounts (owner_user_id, deleted_at);
create index if not exists finance_categories_owner_type_idx on public.finance_categories (owner_user_id, transaction_type, deleted_at);
create index if not exists finance_transactions_owner_date_idx on public.finance_transactions (owner_user_id, local_date desc) where deleted_at is null;
create index if not exists finance_transactions_category_date_idx on public.finance_transactions (category_id, local_date desc) where deleted_at is null;
create index if not exists finance_budgets_owner_month_idx on public.finance_budgets (owner_user_id, month) where deleted_at is null;
create index if not exists saving_goals_owner_idx on public.saving_goals (owner_user_id, deleted_at);
create index if not exists gift_contacts_owner_name_idx on public.gift_contacts (owner_user_id, name) where deleted_at is null;
create index if not exists gift_records_owner_date_idx on public.gift_records (owner_user_id, event_date desc) where deleted_at is null;
create index if not exists gift_records_contact_date_idx on public.gift_records (contact_id, event_date desc) where deleted_at is null;

insert into public.finance_categories (name, icon_key, color, transaction_type, is_system, is_pinned)
values
  ('餐饮', 'food', '#df7f59', 'expense', true, true),
  ('买菜', 'vegetable', '#7aa95c', 'expense', true, false),
  ('交通', 'bus', '#5c8fd9', 'expense', true, false),
  ('加油', 'fuel', '#d9a441', 'expense', true, false),
  ('购物', 'bag', '#c76da7', 'expense', true, false),
  ('学习', 'book', '#7b75d1', 'expense', true, false),
  ('娱乐', 'game', '#e09b44', 'expense', true, false),
  ('恋爱', 'heart', '#e0677d', 'expense', true, false),
  ('医疗', 'medical', '#4eaaa0', 'expense', true, false),
  ('房租', 'home', '#92735a', 'expense', true, false),
  ('份子', 'gift', '#c84f4f', 'expense', true, true),
  ('其他', 'more', '#8b8f76', 'expense', true, false),
  ('生活费', 'wallet', '#6e9f5d', 'income', true, true),
  ('工资', 'briefcase', '#3f8f78', 'income', true, true),
  ('奖学金', 'medal', '#b59a34', 'income', true, false),
  ('兼职', 'clock', '#5a8bc4', 'income', true, false),
  ('红包', 'redpacket', '#d84c40', 'income', true, false),
  ('退款', 'refund', '#6d9d8e', 'income', true, false),
  ('其他', 'more', '#8b8f76', 'income', true, false)
on conflict do nothing;

create or replace function public.can_read_owned_shared(p_owner_user_id uuid, p_couple_id uuid, p_visibility text, p_deleted_at timestamptz, p_user_id uuid)
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
      and p_couple_id is not null
      and public.is_active_couple_member(p_couple_id, p_user_id)
    )
  );
$$;

create or replace function public.can_edit_owned_shared(p_owner_user_id uuid, p_couple_id uuid, p_visibility text, p_deleted_at timestamptz, p_user_id uuid)
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
      and p_couple_id is not null
      and public.is_active_couple_member(p_couple_id, p_user_id)
    )
  );
$$;

create or replace function public.can_read_finance_transaction(p_transaction_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.finance_transactions t where t.id = p_transaction_id and public.can_read_owned_shared(t.owner_user_id, t.couple_id, t.visibility, t.deleted_at, p_user_id));
$$;

create or replace function public.can_edit_finance_transaction(p_transaction_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.finance_transactions t where t.id = p_transaction_id and public.can_edit_owned_shared(t.owner_user_id, t.couple_id, t.visibility, t.deleted_at, p_user_id));
$$;

create or replace function public.can_read_gift_contact(p_contact_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.gift_contacts c where c.id = p_contact_id and public.can_read_owned_shared(c.owner_user_id, c.couple_id, c.visibility, c.deleted_at, p_user_id));
$$;

create or replace function public.can_edit_gift_contact(p_contact_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.gift_contacts c where c.id = p_contact_id and public.can_edit_owned_shared(c.owner_user_id, c.couple_id, c.visibility, c.deleted_at, p_user_id));
$$;

create or replace function public.can_read_gift_record(p_record_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.gift_records r where r.id = p_record_id and public.can_read_owned_shared(r.owner_user_id, r.couple_id, r.visibility, r.deleted_at, p_user_id));
$$;

create or replace function public.can_edit_gift_record(p_record_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.gift_records r where r.id = p_record_id and public.can_edit_owned_shared(r.owner_user_id, r.couple_id, r.visibility, r.deleted_at, p_user_id));
$$;

create or replace function public.soft_delete_finance_category(p_category_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.finance_categories
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_category_id and owner_user_id = auth.uid() and is_system = false and deleted_at is null;
  if not found then raise exception 'not_allowed'; end if;
  return p_category_id;
end;
$$;

create or replace function public.soft_delete_finance_transaction(p_transaction_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.can_edit_finance_transaction(p_transaction_id, auth.uid()) then raise exception 'not_allowed'; end if;
  update public.finance_transactions set deleted_at = now(), deleted_by = auth.uid() where id = p_transaction_id and deleted_at is null;
  return p_transaction_id;
end;
$$;

create or replace function public.create_gift_finance_transaction(p_gift_record_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_gift public.gift_records%rowtype;
  v_category_id uuid;
  v_transaction_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into v_gift from public.gift_records where id = p_gift_record_id for update;
  if not found then raise exception 'gift_not_found'; end if;
  if v_gift.direction <> 'sent' or v_gift.sync_finance is not true then raise exception 'gift_not_syncable'; end if;
  if not public.can_edit_gift_record(p_gift_record_id, auth.uid()) then raise exception 'not_allowed'; end if;

  select id into v_category_id from public.finance_categories where is_system = true and owner_user_id is null and transaction_type = 'expense' and name = '份子' limit 1;
  if v_category_id is null then raise exception 'gift_category_missing'; end if;

  insert into public.finance_transactions (owner_user_id, couple_id, visibility, transaction_type, amount, category_id, local_date, note, gift_record_id)
  values (v_gift.owner_user_id, v_gift.couple_id, v_gift.visibility, 'expense', v_gift.amount, v_category_id, v_gift.event_date, v_gift.note, v_gift.id)
  on conflict (gift_record_id) where gift_record_id is not null do update
    set updated_at = public.finance_transactions.updated_at
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

create or replace function public.soft_delete_gift_record(p_gift_record_id uuid, p_delete_linked_finance boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_deleted_at timestamptz := now();
  v_deleted_by uuid := auth.uid();
begin
  if v_deleted_by is null then raise exception 'not_authenticated'; end if;
  if not public.can_edit_gift_record(p_gift_record_id, v_deleted_by) then raise exception 'not_allowed'; end if;

  update public.gift_records
  set deleted_at = v_deleted_at, deleted_by = v_deleted_by
  where id = p_gift_record_id and deleted_at is null;

  if p_delete_linked_finance then
    update public.finance_transactions
    set deleted_at = v_deleted_at, deleted_by = v_deleted_by
    where gift_record_id = p_gift_record_id and deleted_at is null;
  end if;

  return p_gift_record_id;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['finance_accounts','finance_categories','finance_transactions','finance_budgets','saving_goals','gift_contacts','gift_records']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke delete on public.%I from authenticated', table_name);
    execute format('grant select, insert, update on public.%I to authenticated', table_name);
  end loop;
end $$;

alter table public.finance_accounts enable row level security;
alter table public.finance_accounts force row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_categories force row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_transactions force row level security;
alter table public.finance_budgets enable row level security;
alter table public.finance_budgets force row level security;
alter table public.saving_goals enable row level security;
alter table public.saving_goals force row level security;
alter table public.gift_contacts enable row level security;
alter table public.gift_contacts force row level security;
alter table public.gift_records enable row level security;
alter table public.gift_records force row level security;

revoke delete on public.finance_accounts from authenticated;
revoke delete on public.finance_categories from authenticated;
revoke delete on public.finance_transactions from authenticated;
revoke delete on public.finance_budgets from authenticated;
revoke delete on public.saving_goals from authenticated;
revoke delete on public.gift_contacts from authenticated;
revoke delete on public.gift_records from authenticated;

drop policy if exists finance_categories_select_system_or_own on public.finance_categories;
create policy finance_categories_select_system_or_own on public.finance_categories for select to authenticated
using ((is_system = true and owner_user_id is null and deleted_at is null) or (is_system = false and owner_user_id = auth.uid() and deleted_at is null));
drop policy if exists finance_categories_insert_user_only on public.finance_categories;
create policy finance_categories_insert_user_only on public.finance_categories for insert to authenticated
with check (is_system = false and owner_user_id = auth.uid() and deleted_at is null);
drop policy if exists finance_categories_update_user_only on public.finance_categories;
create policy finance_categories_update_user_only on public.finance_categories for update to authenticated
using (is_system = false and owner_user_id = auth.uid())
with check (is_system = false and owner_user_id = auth.uid());

drop policy if exists finance_accounts_select_visible on public.finance_accounts;
create policy finance_accounts_select_visible on public.finance_accounts for select to authenticated
using (public.can_read_owned_shared(owner_user_id, couple_id, visibility, deleted_at, auth.uid()));
drop policy if exists finance_accounts_insert_own on public.finance_accounts;
create policy finance_accounts_insert_own on public.finance_accounts for insert to authenticated
with check (owner_user_id = auth.uid() and deleted_at is null and ((visibility = 'private' and couple_id is null) or (visibility in ('couple_read', 'couple_edit') and couple_id = public.current_active_couple_id(auth.uid()))));
drop policy if exists finance_accounts_update_editable on public.finance_accounts;
create policy finance_accounts_update_editable on public.finance_accounts for update to authenticated
using (public.can_edit_owned_shared(owner_user_id, couple_id, visibility, deleted_at, auth.uid()))
with check (owner_user_id = (select owner_user_id from public.finance_accounts existing where existing.id = finance_accounts.id));

drop policy if exists finance_transactions_select_visible on public.finance_transactions;
create policy finance_transactions_select_visible on public.finance_transactions for select to authenticated
using (public.can_read_finance_transaction(id, auth.uid()));
drop policy if exists finance_transactions_insert_own on public.finance_transactions;
create policy finance_transactions_insert_own on public.finance_transactions for insert to authenticated
with check (owner_user_id = auth.uid() and deleted_at is null and ((visibility = 'private' and couple_id is null) or (visibility in ('couple_read', 'couple_edit') and couple_id = public.current_active_couple_id(auth.uid()))));
drop policy if exists finance_transactions_update_editable on public.finance_transactions;
create policy finance_transactions_update_editable on public.finance_transactions for update to authenticated
using (public.can_edit_finance_transaction(id, auth.uid()))
with check (owner_user_id = (select owner_user_id from public.finance_transactions existing where existing.id = finance_transactions.id));

drop policy if exists finance_budgets_select_visible on public.finance_budgets;
create policy finance_budgets_select_visible on public.finance_budgets for select to authenticated
using (public.can_read_owned_shared(owner_user_id, couple_id, visibility, deleted_at, auth.uid()));
drop policy if exists finance_budgets_insert_own on public.finance_budgets;
create policy finance_budgets_insert_own on public.finance_budgets for insert to authenticated
with check (owner_user_id = auth.uid() and deleted_at is null and ((visibility = 'private' and couple_id is null) or (visibility in ('couple_read', 'couple_edit') and couple_id = public.current_active_couple_id(auth.uid()))));
drop policy if exists finance_budgets_update_editable on public.finance_budgets;
create policy finance_budgets_update_editable on public.finance_budgets for update to authenticated
using (public.can_edit_owned_shared(owner_user_id, couple_id, visibility, deleted_at, auth.uid()))
with check (owner_user_id = (select owner_user_id from public.finance_budgets existing where existing.id = finance_budgets.id));

drop policy if exists saving_goals_select_visible on public.saving_goals;
create policy saving_goals_select_visible on public.saving_goals for select to authenticated
using (public.can_read_owned_shared(owner_user_id, couple_id, visibility, deleted_at, auth.uid()));
drop policy if exists saving_goals_insert_own on public.saving_goals;
create policy saving_goals_insert_own on public.saving_goals for insert to authenticated
with check (owner_user_id = auth.uid() and deleted_at is null and ((visibility = 'private' and couple_id is null) or (visibility in ('couple_read', 'couple_edit') and couple_id = public.current_active_couple_id(auth.uid()))));
drop policy if exists saving_goals_update_editable on public.saving_goals;
create policy saving_goals_update_editable on public.saving_goals for update to authenticated
using (public.can_edit_owned_shared(owner_user_id, couple_id, visibility, deleted_at, auth.uid()))
with check (owner_user_id = (select owner_user_id from public.saving_goals existing where existing.id = saving_goals.id));

drop policy if exists gift_contacts_select_visible on public.gift_contacts;
create policy gift_contacts_select_visible on public.gift_contacts for select to authenticated
using (public.can_read_gift_contact(id, auth.uid()));
drop policy if exists gift_contacts_insert_own on public.gift_contacts;
create policy gift_contacts_insert_own on public.gift_contacts for insert to authenticated
with check (owner_user_id = auth.uid() and deleted_at is null and ((visibility = 'private' and couple_id is null) or (visibility in ('couple_read', 'couple_edit') and couple_id = public.current_active_couple_id(auth.uid()))));
drop policy if exists gift_contacts_update_editable on public.gift_contacts;
create policy gift_contacts_update_editable on public.gift_contacts for update to authenticated
using (public.can_edit_gift_contact(id, auth.uid()))
with check (owner_user_id = (select owner_user_id from public.gift_contacts existing where existing.id = gift_contacts.id));

drop policy if exists gift_records_select_visible on public.gift_records;
create policy gift_records_select_visible on public.gift_records for select to authenticated
using (public.can_read_gift_record(id, auth.uid()));
drop policy if exists gift_records_insert_own on public.gift_records;
create policy gift_records_insert_own on public.gift_records for insert to authenticated
with check (owner_user_id = auth.uid() and deleted_at is null and public.can_edit_gift_contact(contact_id, auth.uid()) and ((visibility = 'private' and couple_id is null) or (visibility in ('couple_read', 'couple_edit') and couple_id = public.current_active_couple_id(auth.uid()))));
drop policy if exists gift_records_update_editable on public.gift_records;
create policy gift_records_update_editable on public.gift_records for update to authenticated
using (public.can_edit_gift_record(id, auth.uid()))
with check (owner_user_id = (select owner_user_id from public.gift_records existing where existing.id = gift_records.id));

grant execute on function public.soft_delete_finance_category(uuid) to authenticated;
grant execute on function public.soft_delete_finance_transaction(uuid) to authenticated;
grant execute on function public.create_gift_finance_transaction(uuid) to authenticated;
grant execute on function public.soft_delete_gift_record(uuid, boolean) to authenticated;
