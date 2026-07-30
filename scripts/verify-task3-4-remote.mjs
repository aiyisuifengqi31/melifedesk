import pg from "pg";

const { Client } = pg;

const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error("Missing SUPABASE_DB_URL for remote Task 3/4 verification.");
  process.exit(1);
}

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

const tables = ["tasks", "task_subitems", "task_recurrences", "calendar_events", "workout_sessions", "workout_parts", "workout_photos"];

async function queryRows(sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows;
}

async function expectRows(label, sql, params, predicate) {
  const rows = await queryRows(sql, params);
  if (!predicate(rows)) {
    throw new Error(`${label} failed: ${JSON.stringify(rows)}`);
  }
  return rows;
}

try {
  await client.connect();

  const projectRows = await queryRows("select current_database() as database_name, current_user as user_name");

  await expectRows(
    "tables",
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_name = any($1::text[])
    `,
    [tables],
    (rows) => rows.length === tables.length
  );

  await expectRows(
    "rls",
    `
      select relname, relrowsecurity, relforcerowsecurity
      from pg_class
      where oid = any($1::regclass[])
    `,
    [tables.map((table) => `public.${table}`)],
    (rows) => rows.length === tables.length && rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)
  );

  await expectRows(
    "business delete grants",
    `
      select table_name, has_table_privilege('authenticated', 'public.' || table_name, 'DELETE') as can_delete
      from unnest($1::text[]) table_name
    `,
    [tables],
    (rows) => rows.every((row) => row.can_delete === false)
  );

  await expectRows(
    "functions",
    `
      select proname
      from pg_proc
      join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where nspname = 'public'
        and proname = any($1::text[])
    `,
    [
      [
        "can_read_task",
        "can_edit_task",
        "can_read_workout_session",
        "can_edit_workout_session",
        "can_read_workout_photo_object",
        "soft_delete_task",
        "soft_delete_workout_session"
      ]
    ],
    (rows) => rows.length === 7
  );

  await expectRows(
    "workout photo bucket",
    "select id, public from storage.buckets where id = 'workout-photos'",
    [],
    (rows) => rows.length === 1 && rows[0].public === false
  );

  await expectRows(
    "storage policies",
    `
      select policyname, cmd
      from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname like 'workout_photos_objects_%'
    `,
    [],
    (rows) => rows.length === 4 && new Set(rows.map((row) => row.cmd)).size === 4
  );

  await expectRows(
    "active couple sharing dependency",
    `
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'couple_members'
        and indexname = 'couple_members_one_active_couple_per_user'
    `,
    [],
    (rows) => rows.length === 1
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        project: projectRows[0],
        verified: {
          businessDeleteRevoked: true,
          functions: true,
          rlsForced: true,
          storagePolicies: true,
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
