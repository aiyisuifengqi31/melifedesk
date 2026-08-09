import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserSettingsInput } from "./userSettings";
import { buildUserSettingsPatch } from "./userSettings";

export type AuthCredentials = {
  displayName?: string;
  email: string;
  password: string;
};

export async function signUpWithEmail(client: SupabaseClient, credentials: AuthCredentials) {
  return client.auth.signUp({
    email: credentials.email.trim(),
    password: credentials.password,
    options: {
      data: {
        display_name: credentials.displayName?.trim() || null
      }
    }
  });
}

export async function signInWithEmail(client: SupabaseClient, credentials: Omit<AuthCredentials, "displayName">) {
  return client.auth.signInWithPassword({
    email: credentials.email.trim(),
    password: credentials.password
  });
}

export async function signOut(client: SupabaseClient) {
  return client.auth.signOut();
}

export async function saveUserSettings(client: SupabaseClient, userId: string, input: UserSettingsInput) {
  const patch = buildUserSettingsPatch(input);

  return client.from("user_settings").upsert(
    {
      owner_user_id: userId,
      ...patch,
      updated_at: new Date().toISOString()
    },
    { onConflict: "owner_user_id" }
  );
}

export async function createCoupleInvite(client: SupabaseClient) {
  return client.rpc("create_couple_invite");
}

export async function getOrCreateMyInviteCode(client: SupabaseClient): Promise<{ code: string | null; error: { message: string } | null }> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    return { code: null, error: { message: userError?.message ?? "未登录" } };
  }

  const { data: existing, error: findError } = await client
    .from("couple_invites")
    .select("invite_code")
    .eq("inviter_user_id", userData.user.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing?.invite_code) {
    return { code: existing.invite_code as string, error: null };
  }
  if (findError && (findError as { code?: string }).code !== "PGRST116") {
    return { code: null, error: { message: findError.message } };
  }

  const created = await createCoupleInvite(client);
  if (created.error) {
    return { code: null, error: { message: created.error.message } };
  }
  const rows = Array.isArray(created.data) ? created.data : [created.data];
  const code = rows[0]?.invite_code as string | undefined;
  if (!code) {
    return { code: null, error: { message: "未返回绑定码" } };
  }
  return { code, error: null };
}

export async function acceptCoupleInvite(client: SupabaseClient, inviteCode: string) {
  return client.rpc("accept_couple_invite", { p_invite_code: inviteCode.trim().toUpperCase() });
}

export async function leaveActiveCouple(client: SupabaseClient) {
  return client.rpc("leave_active_couple");
}
