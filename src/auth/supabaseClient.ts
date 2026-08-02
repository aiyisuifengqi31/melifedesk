import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { getSupabasePublicConfig } from "./supabaseConfig";

let cachedClient: SupabaseClient | null | undefined;

export function buildSupabaseClientOptions(platformOS: typeof Platform.OS = Platform.OS) {
  const isWeb = platformOS === "web";
  return {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: isWeb,
      persistSession: true,
      storage: isWeb ? undefined : AsyncStorage
    }
  };
}

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const config = getSupabasePublicConfig();

  if (!config.configured) {
    cachedClient = null;
    return cachedClient;
  }

  cachedClient = createClient(config.url, config.anonKey, buildSupabaseClientOptions());

  return cachedClient;
}

export function resetSupabaseClientForTests() {
  cachedClient = undefined;
}
