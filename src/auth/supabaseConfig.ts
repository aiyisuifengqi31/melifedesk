export type SupabasePublicConfig = {
  anonKey: string;
  configured: boolean;
  url: string;
};

type EnvLike = Record<string, string | undefined>;

export function getSupabasePublicConfig(env: EnvLike = process.env): SupabasePublicConfig {
  const url = env.EXPO_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

  return {
    anonKey,
    configured: Boolean(url && anonKey),
    url
  };
}
