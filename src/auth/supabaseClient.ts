import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { getSupabasePublicConfig, type SupabasePublicConfig } from "./supabaseConfig";
import { createSupabaseTransport } from "./supabaseTransport";

let cachedClient: SupabaseClient | null | undefined;

export function buildSupabaseClientOptions(
  platformOS: typeof Platform.OS = Platform.OS,
  config: SupabasePublicConfig = getSupabasePublicConfig()
) {
  const isWeb = platformOS === "web";
  return {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: isWeb,
      persistSession: true,
      storage: isWeb ? undefined : AsyncStorage
    },
    global: {
      fetch: createSupabaseTransport({
        proxyUrl: config.proxyUrl,
        supabaseUrl: config.url
      })
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

  cachedClient = createClient(config.url, config.anonKey, buildSupabaseClientOptions(Platform.OS, config));

  return cachedClient;
}

export function resetSupabaseClientForTests() {
  cachedClient = undefined;
}
