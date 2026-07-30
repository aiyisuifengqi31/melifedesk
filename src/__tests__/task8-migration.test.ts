import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(process.cwd(), "supabase", "migrations", "202607300006_task8_9_10_exam_common_release.sql");

function readMigration() {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, "utf8");
}

describe("Task 8 exam migration", () => {
  it("creates normalized question source, attribution, version, and daily assignment tables", () => {
    const sql = readMigration();

    for (const table of [
      "question_sources",
      "questions",
      "question_versions",
      "question_attributions",
      "daily_assignments",
      "daily_assignment_items",
      "question_attempts",
      "question_favorites",
      "question_mastery",
      "question_reports",
      "essay_prompts",
      "essay_attempts"
    ]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`alter table public.${table} force row level security`);
      expect(sql).toContain(`revoke delete on public.${table} from authenticated`);
    }
  });

  it("uses daily_assignment_items instead of a uuid array on daily_assignments", () => {
    const sql = readMigration();

    expect(sql).toContain("create table if not exists public.daily_assignment_items");
    expect(sql).toContain("question_version_id uuid not null references public.question_versions(id)");
    expect(sql).toContain("unique(assignment_id, position)");
    expect(sql).toContain("unique(assignment_id, question_version_id)");
    expect(sql).toContain("daily_assignment_item_id uuid references public.daily_assignment_items(id)");
    expect(sql).not.toContain("question_version_ids uuid[]");
  });

  it("uses non-null region_code and concurrent-safe daily generation", () => {
    const sql = readMigration();

    expect(sql).toContain("region_code text not null default 'NATIONAL'");
    expect(sql).toContain("unique(owner_user_id, assigned_date, exam_scope, region_code)");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("on conflict (owner_user_id, assigned_date, exam_scope, region_code)");
  });

  it("keeps multiple attributions and marks answer conflicts for review", () => {
    const sql = readMigration();

    expect(sql).toContain("content_hash text not null");
    expect(sql).toContain("create table if not exists public.question_attributions");
    expect(sql).toContain("source_item_id text");
    expect(sql).toContain("license_snapshot jsonb not null");
    expect(sql).toContain("first_seen_at timestamptz not null");
    expect(sql).toContain("last_seen_at timestamptz not null");
    expect(sql).toContain("mark_question_needs_review_on_conflict");
    expect(sql).toContain("review_status = 'needs_review'");
    expect(sql).toContain("answer_or_explanation_conflict");
  });

  it("prevents ordinary clients from reading full source backend fields", () => {
    const sql = readMigration();

    expect(sql).toContain("authorization_notes text");
    expect(sql).toContain("internal_notes text");
    expect(sql).toContain("sync_config jsonb");
    expect(sql).toContain("revoke all on public.question_sources from authenticated");
    expect(sql).toContain("create or replace function public.get_approved_questions");
    expect(sql).toContain("'name', qs.public_name");
  });
});
