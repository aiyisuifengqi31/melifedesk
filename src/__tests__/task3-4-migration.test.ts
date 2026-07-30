import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(process.cwd(), "supabase", "migrations", "202607300003_task3_4_plan_workout.sql");

function readMigration() {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, "utf8");
}

describe("Task 3 and Task 4 migration", () => {
  it("creates all plan and workout tables through migration SQL", () => {
    const sql = readMigration();

    for (const table of ["tasks", "task_subitems", "task_recurrences", "calendar_events", "workout_sessions", "workout_parts", "workout_photos"]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }
  });

  it("enables and forces RLS on every client-accessible table", () => {
    const sql = readMigration();

    for (const table of ["tasks", "task_subitems", "task_recurrences", "calendar_events", "workout_sessions", "workout_parts", "workout_photos"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`alter table public.${table} force row level security`);
    }
  });

  it("supports required task statuses and soft delete fields", () => {
    const sql = readMigration();

    expect(sql).toContain("status text not null default 'todo'");
    for (const status of ["todo", "in_progress", "done", "cancelled"]) {
      expect(sql).toContain(`'${status}'`);
    }
    expect(sql).toContain("deleted_at timestamptz");
    expect(sql).toContain("deleted_by uuid");
    expect(sql).toContain("revoke delete on public.tasks from authenticated");
    expect(sql).toContain("create or replace function public.soft_delete_task");
  });

  it("defines private, couple_read, and couple_edit access policies", () => {
    const sql = readMigration();

    for (const visibility of ["private", "couple_read", "couple_edit"]) {
      expect(sql).toContain(`'${visibility}'`);
    }
    expect(sql).toContain("public.can_read_task");
    expect(sql).toContain("public.can_edit_task");
    expect(sql).toContain("public.can_read_workout_session");
    expect(sql).toContain("public.can_edit_workout_session");
  });

  it("creates private storage bucket and storage.objects policies for workout photos", () => {
    const sql = readMigration();

    expect(sql).toContain("insert into storage.buckets");
    expect(sql).toContain("'workout-photos'");
    expect(sql).toContain("public.can_read_workout_photo_object");
    for (const operation of ["select", "insert", "update", "delete"]) {
      expect(sql).toContain(`on storage.objects for ${operation}`);
    }
  });
});
