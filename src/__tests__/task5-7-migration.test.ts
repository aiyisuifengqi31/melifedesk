import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(process.cwd(), "supabase", "migrations", "202607300004_task5_7_finance_gifts.sql");
const financeTables = ["finance_accounts", "finance_categories", "finance_transactions", "finance_budgets", "saving_goals"];
const giftTables = ["gift_contacts", "gift_records"];
const allTables = [...financeTables, ...giftTables];

function readMigration() {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, "utf8");
}

describe("Task 5 and Task 7 migration", () => {
  it("creates all finance and gift tables through migration SQL", () => {
    const sql = readMigration();

    for (const table of allTables) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }
  });

  it("enables and forces RLS on every client-accessible table", () => {
    const sql = readMigration();

    for (const table of allTables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`alter table public.${table} force row level security`);
      expect(sql).toContain(`revoke delete on public.${table} from authenticated`);
    }
  });

  it("uses numeric money fields and avoids floating point storage", () => {
    const sql = readMigration();

    expect(sql).toContain("amount numeric(14,2)");
    expect(sql).toContain("budget_amount numeric(14,2)");
    expect(sql).toContain("target_amount numeric(14,2)");
    expect(sql).not.toContain("amount real");
    expect(sql).not.toContain("amount double precision");
  });

  it("implements the system finance category exception", () => {
    const sql = readMigration();

    expect(sql).toContain("owner_user_id uuid references auth.users(id)");
    expect(sql).toContain("is_system boolean not null default false");
    expect(sql).toContain("finance_categories_select_system_or_own");
    expect(sql).toContain("finance_categories_update_user_only");
    expect(sql).toContain("soft_delete_finance_category");
    expect(sql).toContain("is_system = true and owner_user_id is null");
    for (const category of ["餐饮", "买菜", "交通", "加油", "购物", "学习", "娱乐", "恋爱", "医疗", "房租", "份子", "其他", "生活费", "工资", "奖学金", "兼职", "红包", "退款"]) {
      expect(sql).toContain(category);
    }
  });

  it("defines gift to finance linking and soft delete RPCs", () => {
    const sql = readMigration();

    expect(sql).toContain("gift_record_id uuid references public.gift_records(id)");
    expect(sql).toContain("finance_transactions_gift_record_unique");
    expect(sql).toContain("create or replace function public.create_gift_finance_transaction");
    expect(sql).toContain("create or replace function public.soft_delete_gift_record");
    expect(sql).toContain("p_delete_linked_finance boolean");
    expect(sql).toContain("deleted_at = v_deleted_at");
    expect(sql).toContain("deleted_by = v_deleted_by");
  });

  it("defines private, couple_read, and couple_edit access helpers", () => {
    const sql = readMigration();

    for (const visibility of ["private", "couple_read", "couple_edit"]) {
      expect(sql).toContain(`'${visibility}'`);
    }
    for (const helper of ["can_read_finance_transaction", "can_edit_finance_transaction", "can_read_gift_record", "can_edit_gift_record"]) {
      expect(sql).toContain(`public.${helper}`);
    }
  });
});
