import pg from "pg";

const { Client } = pg;
const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error("Missing SUPABASE_DB_URL for remote Task 6 verification.");
  process.exit(1);
}

const tables = ["mood_entries", "diary_entries", "diary_images", "countdowns", "menstrual_settings", "menstrual_cycles"];
const functions = ["can_read_diary_entry", "can_edit_diary_entry", "can_read_menstrual_cycle", "can_edit_menstrual_cycle", "can_read_love_image_object", "soft_delete_diary_entry"];
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function expectRows(label, sql, params, predicate) {
  const result = await client.query(sql, params);
  if (!predicate(result.rows)) throw new Error(`${label} failed: ${JSON.stringify(result.rows)}`);
  return result.rows;
}

try {
  await client.connect();

  await expectRows("tables", "select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1::text[])", [tables], (rows) => rows.length === tables.length);
  await expectRows("rls", "select relname, relrowsecurity, relforcerowsecurity from pg_class where oid = any($1::regclass[])", [tables.map((table) => `public.${table}`)], (rows) => rows.length === tables.length && rows.every((row) => row.relrowsecurity && row.relforcerowsecurity));
  await expectRows("delete revoked", "select table_name, has_table_privilege('authenticated', 'public.' || table_name, 'DELETE') as can_delete from unnest($1::text[]) table_name", [tables], (rows) => rows.every((row) => row.can_delete === false));
  await expectRows("functions", "select proname from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace where nspname = 'public' and proname = any($1::text[])", [functions], (rows) => rows.length === functions.length);
  await expectRows("bucket", "select id, public from storage.buckets where id = 'love-images'", [], (rows) => rows.length === 1 && rows[0].public === false);
  await expectRows("storage policies", "select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'love_images_objects_%'", [], (rows) => rows.length === 4);

  console.log(JSON.stringify({ ok: true, verified: { bucket: true, deleteRevoked: true, functions: true, rlsForced: true, storagePolicies: true, tables: true } }, null, 2));
} finally {
  await client.end();
}
