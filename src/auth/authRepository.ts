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

export async function acceptCoupleInvite(client: SupabaseClient, inviteCode: string) {
  return client.rpc("accept_couple_invite", { p_invite_code: inviteCode.trim().toUpperCase() });
}

export async function leaveActiveCouple(client: SupabaseClient) {
  return client.rpc("leave_active_couple");
}
