import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(process.cwd(), "supabase", "migrations", "202607300006_task8_9_10_exam_common_release.sql");

function readMigration() {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, "utf8");
}

describe("Task 9 common capability migration", () => {
  it("creates review, report, notification, search, export, and audit tables", () => {
    const sql = readMigration();

    for (const table of ["nightly_reviews", "weekly_reports", "notification_preferences", "search_index", "export_jobs", "audit_events"]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`alter table public.${table} force row level security`);
      expect(sql).toContain(`revoke delete on public.${table} from authenticated`);
    }
  });

  it("uses original business tables for recycle bin instead of copying sensitive content", () => {
    const sql = readMigration();

    expect(sql).toContain("create or replace function public.get_recycle_bin_items");
    expect(sql).toContain("from public.tasks");
    expect(sql).toContain("from public.workout_sessions");
    expect(sql).toContain("from public.finance_transactions");
    expect(sql).toContain("from public.gift_records");
    expect(sql).toContain("from public.love_diary_entries");
    expect(sql).not.toContain("create table if not exists public.recycle_bin");
    expect(sql).toContain("restore_recycle_item");
    expect(sql).toContain("deleted_at = null, deleted_by = null");
    expect(sql).toContain("insert into public.audit_events");
  });

  it("filters normal search results to non-deleted visible records", () => {
    const sql = readMigration();

    expect(sql).toContain("search_text tsvector not null");
    expect(sql).toContain("create or replace function public.search_records");
    expect(sql).toContain("deleted_at is null");
    expect(sql).toContain("public.can_read_shared_record(owner_user_id, visibility, auth.uid())");
  });
});

describe("Task 10 release foundation migration", () => {
  it("creates backup and release configuration tables without enabling production publish", () => {
    const sql = readMigration();

    for (const table of ["backup_runs", "release_versions"]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`alter table public.${table} force row level security`);
    }

    expect(sql).toContain("release_channel text not null default 'preview'");
    expect(sql).toContain("Production backup planning requires explicit release operator confirmation");
    expect(sql).toContain("revoke execute on function public.purge_deleted_records(interval) from authenticated");
  });
});
