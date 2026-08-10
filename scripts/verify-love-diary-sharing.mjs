import { createClient } from "@supabase/supabase-js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function env(name) {
  const value = process.env[name];
  assert(value, `Missing env var ${name}`);
  return value;
}

function client(url, anonKey) {
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });
}

async function signUpAndSignIn(url, anonKey, label, runId) {
  const email = `codex.love.${label}.${runId}@example.com`;
  const password = `Love-${runId}-${label}-Passw0rd!`;
  const created = client(url, anonKey);
  const signUp = await created.auth.signUp({
    email,
    password,
    options: { data: { display_name: `Love Test ${label}` } }
  });
  assert(!signUp.error, `${label} signUp failed: ${signUp.error?.message}`);

  const signedIn = client(url, anonKey);
  const signIn = await signedIn.auth.signInWithPassword({ email, password });
  assert(!signIn.error, `${label} signIn failed: ${signIn.error?.message}`);
  assert(signIn.data.user, `${label} has no user`);
  return { client: signedIn, email, password, userId: signIn.data.user.id };
}

function rpcRow(data) {
  return Array.isArray(data) ? data[0] : data;
}

async function activeCoupleId(user) {
  const result = await user.client.rpc("current_active_couple_id", { p_user_id: user.userId });
  assert(!result.error, `${user.email} current_active_couple_id failed: ${result.error?.message}`);
  return result.data ?? null;
}

async function main() {
  const url = env("EXPO_PUBLIC_SUPABASE_URL");
  const anonKey = env("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  const runId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const userA = await signUpAndSignIn(url, anonKey, "a", runId);
  const userB = await signUpAndSignIn(url, anonKey, "b", runId);

  const invite = await userA.client.rpc("create_couple_invite");
  assert(!invite.error, `create invite failed: ${invite.error?.message}`);
  const inviteCode = rpcRow(invite.data)?.invite_code;
  assert(inviteCode, `create invite returned no code: ${JSON.stringify(invite.data)}`);

  const accepted = await userB.client.rpc("accept_couple_invite", { p_invite_code: inviteCode });
  assert(!accepted.error, `accept invite failed: ${accepted.error?.message}`);

  const coupleA = await activeCoupleId(userA);
  const coupleB = await activeCoupleId(userB);
  assert(coupleA && coupleB && coupleA === coupleB, `active couple mismatch: A=${coupleA} B=${coupleB}`);

  const entryDate = new Date().toISOString().slice(0, 10);
  const body = `Codex sharing verification ${runId}`;
  const fullRow = {
    body,
    category: "daily",
    couple_id: coupleA,
    entry_date: entryDate,
    owner_user_id: userA.userId,
    title: `Love sharing ${runId}`,
    updated_by: userA.userId,
    visibility: "couple_edit"
  };
  let insert = await userA.client
    .from("diary_entries")
    .insert(fullRow)
    .select("id, owner_user_id, couple_id, title, body, visibility")
    .single();

  if (/Could not find .*'(category|updated_by)' column|column .* (category|updated_by).* does not exist/i.test(insert.error?.message ?? "")) {
    const { category: _category, updated_by: _updatedBy, ...fallbackRow } = fullRow;
    insert = await userA.client
      .from("diary_entries")
      .insert(fallbackRow)
      .select("id, owner_user_id, couple_id, title, body, visibility")
      .single();
  }
  assert(!insert.error, `A insert diary failed: ${insert.error?.message}`);

  const readByB = await userB.client
    .from("diary_entries")
    .select("id, owner_user_id, couple_id, title, body, visibility")
    .eq("id", insert.data.id)
    .maybeSingle();
  assert(!readByB.error, `B read A diary failed: ${readByB.error?.message}`);
  assert(readByB.data?.body === body, `B cannot see A diary: ${JSON.stringify(readByB.data)}`);

  const readListByB = await userB.client
    .from("diary_entries")
    .select("id, owner_user_id, couple_id, title, body, visibility, entry_date, created_at")
    .is("deleted_at", null)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  assert(!readListByB.error, `B list diary failed: ${readListByB.error?.message}`);
  assert(readListByB.data.some((entry) => entry.id === insert.data.id), "B diary list does not include A entry");

  await Promise.allSettled([userA.client.auth.signOut(), userB.client.auth.signOut()]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        coupleId: coupleA,
        diaryId: insert.data.id,
        inviteCode,
        userA: userA.email,
        userB: userB.email
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
