import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(process.cwd(), "supabase", "migrations", "202607300001_task2_auth_couples.sql");

function readMigration() {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, "utf8");
}

describe("Task 2 Supabase migration", () => {
  it("creates all Task 2 tables through migration SQL", () => {
    const sql = readMigration();

    for (const table of ["profiles", "user_settings", "couples", "couple_members", "couple_invites"]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }
  });

  it("enables RLS on every client-accessible Task 2 table", () => {
    const sql = readMigration();

    for (const table of ["profiles", "user_settings", "couples", "couple_members", "couple_invites"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`alter table public.${table} force row level security`);
    }
  });

  it("enforces one active couple per user with a partial unique index", () => {
    const sql = readMigration();

    expect(sql).toContain("create unique index if not exists couple_members_one_active_couple_per_user");
    expect(sql).toContain("on public.couple_members (user_id)");
    expect(sql).toContain("where left_at is null");
  });

  it("uses security definer RPCs for accepting invites and leaving couples", () => {
    const sql = readMigration();

    expect(sql).toContain("create or replace function public.accept_couple_invite");
    expect(sql).toContain("create or replace function public.leave_active_couple");
    expect(sql).toContain("security definer");
    expect(sql).toContain("pg_advisory_xact_lock");
  });

  it("does not reintroduce app_name_override", () => {
    expect(readMigration()).not.toContain("app_name_override");
  });
});
