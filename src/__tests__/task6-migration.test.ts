import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(process.cwd(), "supabase", "migrations", "202607300005_task6_love_ui.sql");
const tables = ["mood_entries", "diary_entries", "diary_images", "countdowns", "menstrual_settings", "menstrual_cycles"];

function readMigration() {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, "utf8");
}

describe("Task 6 migration", () => {
  it("creates love diary tables", () => {
    const sql = readMigration();
    for (const table of tables) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`alter table public.${table} force row level security`);
      expect(sql).toContain(`revoke delete on public.${table} from authenticated`);
    }
  });

  it("defines love sharing helpers and soft delete RPCs", () => {
    const sql = readMigration();
    for (const helper of ["can_read_diary_entry", "can_edit_diary_entry", "can_read_menstrual_cycle", "can_edit_menstrual_cycle", "soft_delete_diary_entry"]) {
      expect(sql).toContain(`public.${helper}`);
    }
    for (const visibility of ["private", "couple_read", "couple_edit"]) {
      expect(sql).toContain(`'${visibility}'`);
    }
  });

  it("keeps menstrual cycles sensitive and read-only for partner sharing", () => {
    const sql = readMigration();
    expect(sql).toContain("share_with_partner boolean not null default false");
    expect(sql).toContain("menstrual_cycles_select_owner_or_shared_partner");
    expect(sql).toContain("menstrual_cycles_update_owner_only");
    expect(sql).toContain("仅供日程参考，不构成医疗建议");
  });

  it("creates private love image storage policies", () => {
    const sql = readMigration();
    expect(sql).toContain("'love-images'");
    expect(sql).toContain("public.can_read_love_image_object");
    for (const operation of ["select", "insert", "update", "delete"]) {
      expect(sql).toContain(`on storage.objects for ${operation}`);
    }
  });
});
