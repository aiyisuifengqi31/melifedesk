import { getSupabaseClient } from "@/auth/supabaseClient";

const KV_TABLE = "user_kv";

type Session = {
  client: NonNullable<ReturnType<typeof getSupabaseClient>>;
  userId: string;
};

async function getSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

/**
 * Read a synced value from the cloud. Always resolves; falls back to `fallback`
 * when Supabase is not configured or the user is signed out.
 */
export async function loadCloudValue<T>(key: string, fallback: T): Promise<T> {
  const session = await getSession();
  if (!session) return fallback;
  const { data, error } = await session.client
    .from(KV_TABLE)
    .select("value")
    .eq("user_id", session.userId)
    .eq("key", key)
    .maybeSingle();
  if (error || !data || data.value == null) return fallback;
  return data.value as T;
}

/**
 * Persist a value to the cloud. Fire-and-forget: any failure is swallowed so the
 * local-first app never blocks on the network. No-op when signed out.
 */
export async function saveCloudValue(key: string, value: unknown): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await session.client
    .from(KV_TABLE)
    .upsert(
      { user_id: session.userId, key, value, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key" }
    );
}

export async function clearCloudValue(key: string): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await session.client.from(KV_TABLE).delete().eq("user_id", session.userId).eq("key", key);
}

/**
 * Pull the cloud copy and, if it differs from the local value, write it to
 * localStorage. Returns the winning value so the caller can refresh UI state.
 * Used on panel mount for cross-device hydration.
 */
export async function hydrateFromCloud<T>(key: string, localValue: T, writeLocal: (value: T) => void): Promise<T> {
  const cloud = await loadCloudValue<T | null>(key, null);
  if (cloud == null) return localValue;
  const same = JSON.stringify(cloud) === JSON.stringify(localValue);
  if (!same) {
    writeLocal(cloud);
    return cloud;
  }
  return localValue;
}
