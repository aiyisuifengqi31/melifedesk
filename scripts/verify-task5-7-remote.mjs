import pg from "pg";

const { Client } = pg;
const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error("Missing SUPABASE_DB_URL for remote Task 5/7 verification.");
  process.exit(1);
}

const tables = ["finance_accounts", "finance_categories", "finance_transactions", "finance_budgets", "saving_goals", "gift_contacts", "gift_records"];
const functions = [
  "can_read_finance_transaction",
  "can_edit_finance_transaction",
  "can_read_gift_record",
  "can_edit_gift_record",
  "soft_delete_finance_category",
  "soft_delete_finance_transaction",
  "create_gift_finance_transaction",
  "soft_delete_gift_record"
];

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function expectRows(label, sql, params, predicate) {
  const result = await client.query(sql, params);
  if (!predicate(result.rows)) {
    throw new Error(`${label} failed: ${JSON.stringify(result.rows)}`);
  }
  return result.rows;
}

try {
  await client.connect();

  await expectRows(
    "tables",
    "select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1::text[])",
    [tables],
    (rows) => rows.length === tables.length
  );

  await expectRows(
    "forced rls",
    "select relname, relrowsecurity, relforcerowsecurity from pg_class where oid = any($1::regclass[])",
    [tables.map((table) => `public.${table}`)],
    (rows) => rows.length === tables.length && rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)
  );

  await expectRows(
    "delete revoked",
    "select table_name, has_table_privilege('authenticated', 'public.' || table_name, 'DELETE') as can_delete from unnest($1::text[]) table_name",
    [tables],
    (rows) => rows.every((row) => row.can_delete === false)
  );

  await expectRows(
    "functions",
    "select proname from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace where nspname = 'public' and proname = any($1::text[])",
    [functions],
    (rows) => rows.length === functions.length
  );

  await expectRows(
    "system categories",
    "select transaction_type, count(*)::int as count from public.finance_categories where is_system = true and owner_user_id is null and deleted_at is null group by transaction_type",
    [],
    (rows) => rows.some((row) => row.transaction_type === "expense" && row.count >= 12) && rows.some((row) => row.transaction_type === "income" && row.count >= 7)
  );

  await expectRows(
    "gift unique link",
    "select indexname from pg_indexes where schemaname = 'public' and tablename = 'finance_transactions' and indexname = 'finance_transactions_gift_record_unique'",
    [],
    (rows) => rows.length === 1
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        verified: {
          deleteRevoked: true,
          functions: true,
          giftUniqueLink: true,
          rlsForced: true,
          systemCategories: true,
          tables: true
        }
      },
      null,
      2
    )
  );
} finally {
  await client.end();
}
