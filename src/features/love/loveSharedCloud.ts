import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseClient } from "@/auth/supabaseClient";

type LoveClient = SupabaseClient;

type LoveSession = {
  client: LoveClient;
  coupleId: string;
  userId: string;
};

export async function getCurrentLoveUserId(client: LoveClient | null = getSupabaseClient()): Promise<string | null> {
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function getActiveLoveCoupleId(client: LoveClient | null = getSupabaseClient()): Promise<string | null> {
  if (!client) return null;
  const userId = await getCurrentLoveUserId(client);
  if (!userId) return null;
  const { data, error } = await client.rpc("current_active_couple_id", { p_user_id: userId });
  if (error || typeof data !== "string" || !data) return null;
  return data;
}

export async function saveLoveSharedValue(
  key: string,
  value: unknown,
  client: LoveClient | null = getSupabaseClient()
): Promise<void> {
  const session = await getLoveSharedSession(client);
  if (!session) return;

  const { error } = await session.client
    .from("love_shared_state")
    .upsert(
      {
        couple_id: session.coupleId,
        key,
        updated_at: new Date().toISOString(),
        updated_by: session.userId,
        value
      },
      { onConflict: "couple_id,key" }
    );
  if (error) throw error;
}

export async function loadLoveSharedValue<T>(
  key: string,
  fallback: T,
  client: LoveClient | null = getSupabaseClient()
): Promise<T> {
  const session = await getLoveSharedSession(client);
  if (!session) return fallback;

  const { data, error } = await session.client
    .from("love_shared_state")
    .select("value")
    .eq("couple_id", session.coupleId)
    .eq("key", key)
    .maybeSingle();

  if (error || !data || data.value == null) return fallback;
  return data.value as T;
}

export async function hydrateLoveSharedValue<T>(
  key: string,
  localValue: T,
  writeLocal: (value: T) => void,
  client: LoveClient | null = getSupabaseClient()
): Promise<T> {
  const session = await getLoveSharedSession(client);
  if (!session) return localValue;

  const cloud = await loadLoveSharedValue<T | null>(key, null, session.client);
  if (cloud == null) {
    if (hasLocalValue(localValue)) {
      await saveLoveSharedValue(key, localValue, session.client);
    }
    return localValue;
  }

  if (JSON.stringify(cloud) !== JSON.stringify(localValue)) {
    writeLocal(cloud);
    return cloud;
  }
  return localValue;
}

async function getLoveSharedSession(client: LoveClient | null): Promise<LoveSession | null> {
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  const userId = data.user.id;
  const { data: coupleId, error: coupleError } = await client.rpc("current_active_couple_id", { p_user_id: userId });
  if (coupleError || typeof coupleId !== "string" || !coupleId) return null;
  return { client, coupleId, userId };
}

function hasLocalValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value != null;
}
