import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const { Client } = pg;

const requiredTables = ["profiles", "user_settings", "couples", "couple_members", "couple_invites"];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireEnv(name) {
  const value = process.env[name];
  assert(value, `Missing required env var: ${name}`);
  return value;
}

function createSupabaseClient(url, anonKey) {
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });
}

async function verifySchema(pgClient) {
  const tableResult = await pgClient.query(
    `
      select c.relname, c.relrowsecurity, c.relforcerowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relname = any($1)
    `,
    [requiredTables]
  );

  const tables = new Map(tableResult.rows.map((row) => [row.relname, row]));
  for (const table of requiredTables) {
    const row = tables.get(table);
    assert(row, `Missing table: ${table}`);
    assert(row.relrowsecurity === true, `${table} does not enable RLS`);
    assert(row.relforcerowsecurity === true, `${table} does not force RLS`);
  }

  const functionsResult = await pgClient.query(
    `
      select p.proname, pg_get_function_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = any($1)
    `,
    [["create_couple_invite", "accept_couple_invite", "leave_active_couple"]]
  );
  const functions = new Map(functionsResult.rows.map((row) => [row.proname, row.args]));
  assert(functions.has("create_couple_invite"), "Missing RPC create_couple_invite()");
  assert(functions.has("accept_couple_invite"), "Missing RPC accept_couple_invite(text)");
  assert(functions.get("accept_couple_invite").includes("p_invite_code text"), "accept_couple_invite signature mismatch");
  assert(functions.has("leave_active_couple"), "Missing RPC leave_active_couple()");

  const indexResult = await pgClient.query(
    `
      select indexdef
      from pg_indexes
      where schemaname = 'public'
        and indexname = 'couple_members_one_active_couple_per_user'
    `
  );
  assert(indexResult.rowCount === 1, "Missing partial unique index couple_members_one_active_couple_per_user");
  assert(indexResult.rows[0].indexdef.includes("WHERE (left_at IS NULL)") || indexResult.rows[0].indexdef.includes("WHERE left_at IS NULL"), "Active couple unique index is not partial on left_at");

  const settingsColumnsResult = await pgClient.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_settings'
    `
  );
  const settingsColumns = settingsColumnsResult.rows.map((row) => row.column_name);
  assert(settingsColumns.includes("workspace_title"), "user_settings.workspace_title missing");
  assert(!settingsColumns.includes("app_name_override"), "user_settings.app_name_override must not exist");

  const deleteGrantResult = await pgClient.query(
    `
      select table_name
      from information_schema.role_table_grants
      where table_schema = 'public'
        and grantee = 'authenticated'
        and privilege_type = 'DELETE'
        and table_name = any($1)
    `,
    [requiredTables]
  );
  assert(deleteGrantResult.rowCount === 0, "authenticated has DELETE privileges on Task 2 tables");
}

async function signUpAndSignIn(url, anonKey, label, runId) {
  const email = `codex.task2.${label}.${runId}@gmail.com`;
  const password = `Task2-${runId}-${label}-Passw0rd!`;
  const client = createSupabaseClient(url, anonKey);
  const signUp = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: `Task2 ${label}`
      }
    }
  });

  assert(!signUp.error, `${label} signUp failed: ${signUp.error?.message}`);

  const signedIn = createSupabaseClient(url, anonKey);
  const signIn = await signedIn.auth.signInWithPassword({ email, password });

  if (signIn.error) {
    throw new Error(`${label} signIn failed: ${signIn.error.message}. If this says email is not confirmed, disable email confirmation in the dev project or provide a test-only admin key through a local, untracked environment variable.`);
  }

  assert(signIn.data.user, `${label} signIn returned no user`);
  return {
    client: signedIn,
    email,
    password,
    userId: signIn.data.user.id
  };
}

async function expectRows(client, table, column, value, expectedCount, message) {
  const result = await client.from(table).select("*").eq(column, value);
  assert(!result.error, `${message}: ${result.error?.message}`);
  assert(result.data.length === expectedCount, `${message}: expected ${expectedCount} rows, got ${result.data.length}`);
  return result.data;
}

async function verifyAuthAndRls(url, anonKey) {
  const runId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const userA = await signUpAndSignIn(url, anonKey, "a", runId);
  const userB = await signUpAndSignIn(url, anonKey, "b", runId);
  const userC = await signUpAndSignIn(url, anonKey, "c", runId);

  await expectRows(userA.client, "profiles", "id", userA.userId, 1, "A reads own profile");
  await expectRows(userA.client, "user_settings", "owner_user_id", userA.userId, 1, "A reads own settings");
  await expectRows(userB.client, "profiles", "id", userA.userId, 0, "B cannot read A profile");
  await expectRows(userC.client, "user_settings", "owner_user_id", userA.userId, 0, "C cannot read A settings");

  const updateTheme = await userA.client.from("user_settings").update({ theme_id: "cat", color_mode: "dark", workspace_title: "Task 2 Remote" }).eq("owner_user_id", userA.userId).select("theme_id, color_mode, workspace_title").single();
  assert(!updateTheme.error, `Theme sync failed: ${updateTheme.error?.message}`);
  assert(updateTheme.data.theme_id === "cat", "Theme did not sync to user_settings");

  const deleteAttempt = await userA.client.from("user_settings").delete().eq("owner_user_id", userA.userId);
  assert(deleteAttempt.error, "authenticated physical DELETE unexpectedly succeeded");

  const inviteA = await userA.client.rpc("create_couple_invite");
  assert(!inviteA.error, `A create invite failed: ${inviteA.error?.message}`);
  const inviteCodeA = Array.isArray(inviteA.data) ? inviteA.data[0]?.invite_code : inviteA.data?.invite_code;
  assert(inviteCodeA, "A invite did not return invite_code");

  const acceptByB = await userB.client.rpc("accept_couple_invite", { p_invite_code: inviteCodeA });
  assert(!acceptByB.error, `B accept A invite failed: ${acceptByB.error?.message}`);
  const coupleId = acceptByB.data;
  assert(coupleId, "accept_couple_invite did not return couple id");

  await expectRows(userA.client, "couples", "id", coupleId, 1, "A reads active couple");
  await expectRows(userB.client, "couples", "id", coupleId, 1, "B reads active couple");
  await expectRows(userC.client, "couples", "id", coupleId, 0, "C cannot read A/B couple");

  const leaveByA = await userA.client.rpc("leave_active_couple");
  assert(!leaveByA.error, `A leave couple failed: ${leaveByA.error?.message}`);
  await expectRows(userA.client, "couples", "id", coupleId, 0, "A cannot read ended couple");
  await expectRows(userB.client, "couples", "id", coupleId, 0, "B cannot read ended couple");

  const secondInviteA = await userA.client.rpc("create_couple_invite");
  const inviteFromA = Array.isArray(secondInviteA.data) ? secondInviteA.data[0]?.invite_code : secondInviteA.data?.invite_code;
  assert(!secondInviteA.error && inviteFromA, `A second invite failed: ${secondInviteA.error?.message}`);

  const inviteC = await userC.client.rpc("create_couple_invite");
  const inviteFromC = Array.isArray(inviteC.data) ? inviteC.data[0]?.invite_code : inviteC.data?.invite_code;
  assert(!inviteC.error && inviteFromC, `C invite failed: ${inviteC.error?.message}`);

  const concurrentResults = await Promise.allSettled([
    userB.client.rpc("accept_couple_invite", { p_invite_code: inviteFromA }),
    userB.client.rpc("accept_couple_invite", { p_invite_code: inviteFromC })
  ]);
  const fulfilledRpc = concurrentResults.filter((result) => result.status === "fulfilled" && !result.value.error);
  const failedRpc = concurrentResults.filter((result) => result.status === "rejected" || result.value.error);
  assert(fulfilledRpc.length === 1, `Expected one concurrent accept success, got ${fulfilledRpc.length}`);
  assert(failedRpc.length === 1, `Expected one concurrent accept failure, got ${failedRpc.length}`);

  const activeMemberships = await userB.client.from("couple_members").select("couple_id").eq("user_id", userB.userId).is("left_at", null);
  assert(!activeMemberships.error, `B active membership query failed: ${activeMemberships.error?.message}`);
  assert(activeMemberships.data.length === 1, `B should have one active couple, got ${activeMemberships.data.length}`);

  const finalLeave = await userB.client.rpc("leave_active_couple");
  assert(!finalLeave.error, `B final leave couple failed: ${finalLeave.error?.message}`);

  for (const user of [userA, userB, userC]) {
    const signOut = await user.client.auth.signOut();
    assert(!signOut.error, `${user.email} signOut failed: ${signOut.error?.message}`);
  }

  return {
    runId,
    users: [userA.email, userB.email, userC.email]
  };
}

async function main() {
  const dbUrl = requireEnv("SUPABASE_DB_URL");
  const supabaseUrl = requireEnv("EXPO_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");

  const pgClient = new Client({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  await pgClient.connect();
  try {
    await verifySchema(pgClient);
  } finally {
    await pgClient.end();
  }

  const authResult = await verifyAuthAndRls(supabaseUrl, anonKey);
  console.log(
    JSON.stringify(
      {
        authResult,
        ok: true,
        verified: {
          auth: true,
          coupleRpc: true,
          concurrentCoupleConstraint: true,
          rls: true,
          schema: true
        }
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
