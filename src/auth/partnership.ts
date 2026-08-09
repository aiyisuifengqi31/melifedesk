import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseClient } from "@/auth/supabaseClient";

/**
 * Resolves the CURRENT active partner of the given user from the cloud.
 *
 * This is the source of truth for "who can I see / co-edit with right now".
 * It is derived from the active partnership row, never from localStorage.
 * A user with no active partner (or not signed in) yields null.
 *
 * @param client   Supabase client (defaults to the app client).
 * @param userId   User whose partner to look up (defaults to the signed-in user).
 */
export async function getCurrentPartnerId(
  client: SupabaseClient | null = getSupabaseClient(),
  userId?: string
): Promise<string | null> {
  if (!client) return null;

  const targetUserId =
    userId ?? (await client.auth.getUser()).data.user?.id ?? null;
  if (!targetUserId) return null;

  const { data, error } = await client.rpc("current_active_partner_id", {
    p_user_id: targetUserId
  });
  if (error || !data) return null;
  return data as string;
}

/**
 * Resolves the id of the CURRENT active couple the user belongs to (or null).
 * Used to tag a newly created shared record with the creator's current active
 * couple as a HISTORICAL marker (created_during_binding_id). It never gates
 * future access.
 */
export async function getCurrentCoupleId(
  client: SupabaseClient | null = getSupabaseClient(),
  userId?: string
): Promise<string | null> {
  if (!client) return null;

  const targetUserId =
    userId ?? (await client.auth.getUser()).data.user?.id ?? null;
  if (!targetUserId) return null;

  const { data, error } = await client.rpc("current_active_couple_id", {
    p_user_id: targetUserId
  });
  if (error || !data) return null;
  return data as string;
}
