import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(process.cwd(), "supabase", "migrations", "202608110001_love_shared_state.sql");

describe("love shared state migration", () => {
  it("creates a couple-scoped shared state table for all love tabs", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("create table if not exists public.love_shared_state");
    expect(sql).toContain("primary key (couple_id, key)");
    expect(sql).toContain("value jsonb not null");
    expect(sql).toContain("alter table public.love_shared_state enable row level security");
    expect(sql).toContain("public.is_active_couple_member(couple_id, auth.uid())");
    expect(sql).toContain("grant select, insert, update on public.love_shared_state to authenticated");
  });
});
