-- Task 8A/8B/8C, Task 9A/9B/9C and Task 10 foundation.
-- This migration intentionally avoids production deployment changes.

create extension if not exists pgcrypto;

do $$
begin
  create type public.question_review_status as enum ('draft', 'approved', 'needs_review', 'rejected');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.exam_subject as enum ('xingce', 'shenlun', 'common');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.source_kind as enum ('official', 'recall', 'mock', 'book', 'website', 'other');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.assignment_status as enum ('generated', 'started', 'completed', 'expired');
exception
  when duplicate_object then null;
end $$;

create or replace function public.is_active_partner(p_owner_user_id uuid, p_viewer_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_members owner_member
    join public.couple_members viewer_member
      on viewer_member.couple_id = owner_member.couple_id
    where owner_member.user_id = p_owner_user_id
      and viewer_member.user_id = p_viewer_user_id
      and owner_member.left_at is null
      and viewer_member.left_at is null
  );
$$;

create or replace function public.can_read_shared_record(p_owner_user_id uuid, p_visibility text, p_viewer_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_owner_user_id = p_viewer_user_id
    or (p_visibility in ('couple_read', 'couple_edit') and public.is_active_partner(p_owner_user_id, p_viewer_user_id));
$$;

create or replace function public.can_edit_shared_record(p_owner_user_id uuid, p_visibility text, p_viewer_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_owner_user_id = p_viewer_user_id
    or (p_visibility = 'couple_edit' and public.is_active_partner(p_owner_user_id, p_viewer_user_id));
$$;

create table if not exists public.question_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  public_name text not null,
  public_url text,
  source_kind public.source_kind not null,
  license_snapshot jsonb not null default '{}'::jsonb,
  authorization_notes text,
  reviewed_by uuid references auth.users(id),
  internal_notes text,
  sync_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  subject public.exam_subject not null,
  exam_scope text not null default 'civil_service',
  region_code text not null default 'NATIONAL',
  exam_year integer,
  question_type text not null,
  knowledge_points text[] not null default '{}'::text[],
  stem_normalized text not null,
  content_hash text not null,
  review_status public.question_review_status not null default 'draft',
  is_official boolean not null default false,
  is_recalled boolean not null default false,
  is_simulated boolean not null default false,
  needs_review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  version_no integer not null,
  prompt jsonb not null,
  choices jsonb not null default '[]'::jsonb,
  answer jsonb,
  explanation text,
  analysis_points text[] not null default '{}'::text[],
  review_status public.question_review_status not null default 'draft',
  answer_hash text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(question_id, version_no)
);

create table if not exists public.question_attributions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  source_id uuid not null references public.question_sources(id),
  source_item_id text,
  source_url text,
  license_snapshot jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(question_id, source_id, source_item_id)
);

create table if not exists public.daily_assignments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  assigned_date date not null,
  exam_scope text not null default 'civil_service',
  region_code text not null default 'NATIONAL',
  status public.assignment_status not null default 'generated',
  generated_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, assigned_date, exam_scope, region_code)
);

create table if not exists public.daily_assignment_items (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.daily_assignments(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id),
  position integer not null check (position > 0),
  subject public.exam_subject not null,
  selection_reason text not null default 'daily_rotation',
  created_at timestamptz not null default now(),
  unique(assignment_id, position),
  unique(assignment_id, question_version_id)
);

create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  daily_assignment_item_id uuid references public.daily_assignment_items(id),
  question_version_id uuid not null references public.question_versions(id),
  selected_answer jsonb,
  answer_text text,
  is_correct boolean,
  elapsed_seconds integer check (elapsed_seconds is null or elapsed_seconds >= 0),
  attempted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.question_favorites (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  question_id uuid not null references public.questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(owner_user_id, question_id)
);

create table if not exists public.question_mastery (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  question_id uuid not null references public.questions(id) on delete cascade,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  last_attempted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(owner_user_id, question_id)
);

create table if not exists public.question_reports (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  question_id uuid not null references public.questions(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.essay_prompts (
  id uuid primary key default gen_random_uuid(),
  subject public.exam_subject not null default 'shenlun',
  exam_scope text not null default 'civil_service',
  region_code text not null default 'NATIONAL',
  prompt_title text not null,
  materials jsonb not null default '[]'::jsonb,
  reference_points text[] not null default '{}'::text[],
  review_status public.question_review_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.essay_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  essay_prompt_id uuid not null references public.essay_prompts(id),
  draft_text text not null default '',
  submitted_at timestamptz,
  manual_score numeric(5,2),
  reviewer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nightly_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  review_date date not null,
  module_summary jsonb not null default '{}'::jsonb,
  reflection_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, review_date)
);

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  week_start date not null,
  week_end date not null,
  aggregate_summary jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  unique(owner_user_id, week_start)
);

create table if not exists public.notification_preferences (
  owner_user_id uuid primary key references auth.users(id),
  evening_review_enabled boolean not null default true,
  weekly_report_enabled boolean not null default true,
  quiet_hours jsonb not null default '{"start":"22:30","end":"08:00"}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.search_index (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  module_key text not null,
  record_id uuid not null,
  title text not null,
  snippet text,
  search_text tsvector not null,
  visibility text not null default 'private' check (visibility in ('private', 'couple_read', 'couple_edit')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(module_key, record_id)
);

create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  export_format text not null check (export_format in ('csv', 'json', 'pdf')),
  module_keys text[] not null,
  status text not null default 'queued',
  file_path text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  module_key text not null,
  record_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('dev', 'staging', 'production')),
  backup_kind text not null check (backup_kind in ('schema', 'data', 'storage_manifest')),
  status text not null default 'planned',
  started_at timestamptz,
  finished_at timestamptz,
  storage_path text,
  notes text
);

create table if not exists public.release_versions (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('dev', 'staging', 'production')),
  platform text not null check (platform in ('web', 'android', 'ios')),
  app_version text not null,
  build_number text not null,
  minimum_supported_version text,
  release_channel text not null default 'preview',
  is_active boolean not null default false,
  release_notes text,
  created_at timestamptz not null default now()
);

create index if not exists questions_content_hash_idx on public.questions(content_hash);
create index if not exists questions_review_region_idx on public.questions(review_status, exam_scope, region_code, subject);
create index if not exists question_versions_question_review_idx on public.question_versions(question_id, review_status);
create index if not exists question_attributions_question_idx on public.question_attributions(question_id);
create index if not exists daily_assignments_owner_date_idx on public.daily_assignments(owner_user_id, assigned_date);
create index if not exists daily_assignment_items_assignment_idx on public.daily_assignment_items(assignment_id, position);
create index if not exists question_attempts_owner_item_idx on public.question_attempts(owner_user_id, daily_assignment_item_id);
create index if not exists question_mastery_owner_updated_idx on public.question_mastery(owner_user_id, updated_at desc);
create index if not exists essay_attempts_owner_prompt_idx on public.essay_attempts(owner_user_id, essay_prompt_id);
create index if not exists nightly_reviews_owner_date_idx on public.nightly_reviews(owner_user_id, review_date desc);
create index if not exists weekly_reports_owner_week_idx on public.weekly_reports(owner_user_id, week_start desc);
create index if not exists search_index_text_idx on public.search_index using gin(search_text);
create index if not exists search_index_owner_module_idx on public.search_index(owner_user_id, module_key);
create index if not exists export_jobs_owner_status_idx on public.export_jobs(owner_user_id, status);
create index if not exists release_versions_env_platform_idx on public.release_versions(environment, platform, is_active);

alter table public.question_sources enable row level security;
alter table public.question_sources force row level security;
alter table public.questions enable row level security;
alter table public.questions force row level security;
alter table public.question_versions enable row level security;
alter table public.question_versions force row level security;
alter table public.question_attributions enable row level security;
alter table public.question_attributions force row level security;
alter table public.daily_assignments enable row level security;
alter table public.daily_assignments force row level security;
alter table public.daily_assignment_items enable row level security;
alter table public.daily_assignment_items force row level security;
alter table public.question_attempts enable row level security;
alter table public.question_attempts force row level security;
alter table public.question_favorites enable row level security;
alter table public.question_favorites force row level security;
alter table public.question_mastery enable row level security;
alter table public.question_mastery force row level security;
alter table public.question_reports enable row level security;
alter table public.question_reports force row level security;
alter table public.essay_prompts enable row level security;
alter table public.essay_prompts force row level security;
alter table public.essay_attempts enable row level security;
alter table public.essay_attempts force row level security;
alter table public.nightly_reviews enable row level security;
alter table public.nightly_reviews force row level security;
alter table public.weekly_reports enable row level security;
alter table public.weekly_reports force row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_preferences force row level security;
alter table public.search_index enable row level security;
alter table public.search_index force row level security;
alter table public.export_jobs enable row level security;
alter table public.export_jobs force row level security;
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;
alter table public.backup_runs enable row level security;
alter table public.backup_runs force row level security;
alter table public.release_versions enable row level security;
alter table public.release_versions force row level security;

revoke all on public.question_sources from authenticated;
revoke delete on public.question_sources from authenticated;
revoke delete on public.questions from authenticated;
revoke delete on public.question_versions from authenticated;
revoke delete on public.question_attributions from authenticated;
revoke delete on public.daily_assignments from authenticated;
revoke delete on public.daily_assignment_items from authenticated;
revoke delete on public.question_attempts from authenticated;
revoke delete on public.question_favorites from authenticated;
revoke delete on public.question_mastery from authenticated;
revoke delete on public.question_reports from authenticated;
revoke delete on public.essay_prompts from authenticated;
revoke delete on public.essay_attempts from authenticated;
revoke delete on public.nightly_reviews from authenticated;
revoke delete on public.weekly_reports from authenticated;
revoke delete on public.notification_preferences from authenticated;
revoke delete on public.search_index from authenticated;
revoke delete on public.export_jobs from authenticated;
revoke delete on public.audit_events from authenticated;
revoke delete on public.backup_runs from authenticated;
revoke delete on public.release_versions from authenticated;

create policy questions_select_approved on public.questions
  for select to authenticated
  using (review_status = 'approved');

create policy question_versions_select_approved on public.question_versions
  for select to authenticated
  using (
    review_status = 'approved'
    and exists (
      select 1 from public.questions q
      where q.id = question_versions.question_id
        and q.review_status = 'approved'
    )
  );

create policy question_attributions_select_public on public.question_attributions
  for select to authenticated
  using (
    exists (
      select 1 from public.questions q
      where q.id = question_attributions.question_id
        and q.review_status = 'approved'
    )
  );

create policy daily_assignments_owner_select on public.daily_assignments
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy daily_assignments_owner_insert on public.daily_assignments
  for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy daily_assignments_owner_update on public.daily_assignments
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy daily_assignment_items_owner_select on public.daily_assignment_items
  for select to authenticated
  using (
    exists (
      select 1 from public.daily_assignments da
      where da.id = daily_assignment_items.assignment_id
        and da.owner_user_id = auth.uid()
    )
  );

create policy question_attempts_owner_select on public.question_attempts
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy question_attempts_owner_insert on public.question_attempts
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and (
      daily_assignment_item_id is null
      or exists (
        select 1
        from public.daily_assignment_items dai
        join public.daily_assignments da on da.id = dai.assignment_id
        where dai.id = question_attempts.daily_assignment_item_id
          and da.owner_user_id = auth.uid()
      )
    )
  );

create policy question_favorites_owner_all on public.question_favorites
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy question_mastery_owner_all on public.question_mastery
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy question_reports_owner_insert_select on public.question_reports
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy essay_prompts_select_approved on public.essay_prompts
  for select to authenticated
  using (review_status = 'approved');

create policy essay_attempts_owner_all on public.essay_attempts
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy nightly_reviews_owner_all on public.nightly_reviews
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy weekly_reports_owner_select on public.weekly_reports
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy notification_preferences_owner_all on public.notification_preferences
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy search_index_read_shared on public.search_index
  for select to authenticated
  using (deleted_at is null and public.can_read_shared_record(owner_user_id, visibility, auth.uid()));

create policy export_jobs_owner_all on public.export_jobs
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy audit_events_owner_select on public.audit_events
  for select to authenticated
  using (actor_user_id = auth.uid());

create policy release_versions_preview_read on public.release_versions
  for select to authenticated
  using (environment in ('dev', 'staging') and is_active = true);

create or replace function public.mark_question_needs_review_on_conflict()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_hash text;
begin
  select answer_hash into existing_hash
  from public.question_versions
  where question_id = new.question_id
    and answer_hash is not null
    and new.answer_hash is not null
    and answer_hash <> new.answer_hash
  limit 1;

  if existing_hash is not null then
    update public.questions
      set review_status = 'needs_review',
          needs_review_reason = 'answer_or_explanation_conflict',
          updated_at = now()
      where id = new.question_id;
  end if;

  return new;
end;
$$;

drop trigger if exists question_versions_conflict_review on public.question_versions;
create trigger question_versions_conflict_review
after insert or update of answer_hash on public.question_versions
for each row execute function public.mark_question_needs_review_on_conflict();

create or replace function public.get_approved_questions(p_region_code text default 'NATIONAL', p_limit integer default 50)
returns table (
  question_id uuid,
  question_version_id uuid,
  subject public.exam_subject,
  exam_scope text,
  region_code text,
  exam_year integer,
  question_type text,
  knowledge_points text[],
  prompt jsonb,
  choices jsonb,
  answer jsonb,
  explanation text,
  public_sources jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id,
    qv.id,
    q.subject,
    q.exam_scope,
    q.region_code,
    q.exam_year,
    q.question_type,
    q.knowledge_points,
    qv.prompt,
    qv.choices,
    qv.answer,
    qv.explanation,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'name', qs.public_name,
          'url', coalesce(qa.source_url, qs.public_url),
          'year', q.exam_year,
          'region_code', q.region_code,
          'kind', qs.source_kind
        )
      ) filter (where qs.id is not null),
      '[]'::jsonb
    ) as public_sources
  from public.questions q
  join public.question_versions qv on qv.question_id = q.id and qv.review_status = 'approved'
  left join public.question_attributions qa on qa.question_id = q.id
  left join public.question_sources qs on qs.id = qa.source_id
  where q.review_status = 'approved'
    and q.region_code in ('NATIONAL', p_region_code)
  group by q.id, qv.id
  order by q.exam_year desc nulls last, q.created_at desc
  limit greatest(1, least(p_limit, 100));
$$;

create or replace function public.generate_daily_assignment(
  p_assigned_date date default current_date,
  p_exam_scope text default 'civil_service',
  p_region_code text default 'NATIONAL',
  p_question_count integer default 10
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text || ':' || p_assigned_date::text || ':' || p_exam_scope || ':' || p_region_code));

  insert into public.daily_assignments(owner_user_id, assigned_date, exam_scope, region_code)
  values (auth.uid(), p_assigned_date, p_exam_scope, p_region_code)
  on conflict (owner_user_id, assigned_date, exam_scope, region_code)
  do update set updated_at = public.daily_assignments.updated_at
  returning id into v_assignment_id;

  insert into public.daily_assignment_items(assignment_id, question_version_id, position, subject, selection_reason)
  select v_assignment_id, picked.question_version_id, picked.position, picked.subject, 'approved_rotation'
  from (
    select qv.id as question_version_id,
           q.subject,
           row_number() over (order by qm.wrong_count desc nulls last, q.created_at desc) as position
    from public.questions q
    join public.question_versions qv on qv.question_id = q.id and qv.review_status = 'approved'
    left join public.question_mastery qm on qm.question_id = q.id and qm.owner_user_id = auth.uid()
    where q.review_status = 'approved'
      and q.exam_scope = p_exam_scope
      and q.region_code in ('NATIONAL', p_region_code)
    limit greatest(1, least(p_question_count, 50))
  ) picked
  on conflict do nothing;

  return v_assignment_id;
end;
$$;

create or replace function public.get_recycle_bin_items()
returns table (
  module_key text,
  record_id uuid,
  title text,
  deleted_at timestamptz,
  deleted_by uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select 'tasks', id, title, deleted_at, deleted_by
  from public.tasks
  where deleted_at is not null and public.can_edit_shared_record(owner_user_id, visibility, auth.uid())
  union all
  select 'workout_sessions', id, coalesce(title, 'Workout'), deleted_at, deleted_by
  from public.workout_sessions
  where deleted_at is not null and public.can_edit_shared_record(owner_user_id, visibility, auth.uid())
  union all
  select 'finance_transactions', id, coalesce(note, transaction_type), deleted_at, deleted_by
  from public.finance_transactions
  where deleted_at is not null and public.can_edit_shared_record(owner_user_id, visibility, auth.uid())
  union all
  select 'gift_records', id, coalesce(event_type, direction), deleted_at, deleted_by
  from public.gift_records
  where deleted_at is not null and public.can_edit_shared_record(owner_user_id, visibility, auth.uid())
  union all
  select 'love_diary_entries', id, title, deleted_at, deleted_by
  from public.love_diary_entries
  where deleted_at is not null and public.can_edit_shared_record(owner_user_id, visibility, auth.uid());
$$;

create or replace function public.restore_recycle_item(p_module_key text, p_record_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restored boolean := false;
  v_row_count integer := 0;
begin
  if p_module_key = 'tasks' then
    update public.tasks set deleted_at = null, deleted_by = null, updated_at = now()
    where id = p_record_id and deleted_at is not null and public.can_edit_shared_record(owner_user_id, visibility, auth.uid());
    get diagnostics v_row_count = row_count;
  elsif p_module_key = 'workout_sessions' then
    update public.workout_sessions set deleted_at = null, deleted_by = null, updated_at = now()
    where id = p_record_id and deleted_at is not null and public.can_edit_shared_record(owner_user_id, visibility, auth.uid());
    get diagnostics v_row_count = row_count;
  elsif p_module_key = 'finance_transactions' then
    update public.finance_transactions set deleted_at = null, deleted_by = null, updated_at = now()
    where id = p_record_id and deleted_at is not null and public.can_edit_shared_record(owner_user_id, visibility, auth.uid());
    get diagnostics v_row_count = row_count;
  elsif p_module_key = 'gift_records' then
    update public.gift_records set deleted_at = null, deleted_by = null, updated_at = now()
    where id = p_record_id and deleted_at is not null and public.can_edit_shared_record(owner_user_id, visibility, auth.uid());
    get diagnostics v_row_count = row_count;
  elsif p_module_key = 'love_diary_entries' then
    update public.love_diary_entries set deleted_at = null, deleted_by = null, updated_at = now()
    where id = p_record_id and deleted_at is not null and public.can_edit_shared_record(owner_user_id, visibility, auth.uid());
    get diagnostics v_row_count = row_count;
  end if;

  v_restored := v_row_count > 0;

  if v_restored then
    insert into public.audit_events(actor_user_id, module_key, record_id, action)
    values (auth.uid(), p_module_key, p_record_id, 'restore');
  end if;

  return v_restored;
end;
$$;

create or replace function public.search_records(p_query text, p_limit integer default 30)
returns table(module_key text, record_id uuid, title text, snippet text)
language sql
stable
security definer
set search_path = public
as $$
  select module_key, record_id, title, snippet
  from public.search_index
  where deleted_at is null
    and public.can_read_shared_record(owner_user_id, visibility, auth.uid())
    and search_text @@ plainto_tsquery('simple', p_query)
  order by ts_rank(search_text, plainto_tsquery('simple', p_query)) desc
  limit greatest(1, least(p_limit, 100));
$$;

create or replace function public.purge_deleted_records(p_older_than interval default interval '30 days')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_events(module_key, action, metadata)
  values ('system', 'purge_deleted_records', jsonb_build_object('older_than', p_older_than::text));
  -- The actual purge job must run on the server with service credentials and Storage API cleanup.
end;
$$;

create or replace function public.plan_backup_run(p_environment text, p_backup_kind text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_environment = 'production' then
    raise exception 'Production backup planning requires explicit release operator confirmation';
  end if;

  insert into public.backup_runs(environment, backup_kind, status)
  values (p_environment, p_backup_kind, 'planned')
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.get_approved_questions(text, integer) to authenticated;
grant execute on function public.generate_daily_assignment(date, text, text, integer) to authenticated;
grant execute on function public.get_recycle_bin_items() to authenticated;
grant execute on function public.restore_recycle_item(text, uuid) to authenticated;
grant execute on function public.search_records(text, integer) to authenticated;
grant execute on function public.plan_backup_run(text, text) to authenticated;

revoke execute on function public.purge_deleted_records(interval) from authenticated;
