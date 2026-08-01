import { getSupabasePublicConfig } from "@/auth/supabaseConfig";
import { buildUserSettingsPatch } from "@/auth/userSettings";

describe("Task 2 auth client configuration", () => {
  const savedUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const savedKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const savedExtra = process.env.EXTRA_SECRET_VALUE;

  afterAll(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = savedUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = savedKey;
    process.env.EXTRA_SECRET_VALUE = savedExtra;
  });

  it("uses only public Supabase URL and anon key in client config", () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const config = getSupabasePublicConfig();

    expect(config).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
      configured: true
    });
    expect(JSON.stringify(config)).not.toContain("service");
  });

  it("returns no extra secret-like values from client config", () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.EXTRA_SECRET_VALUE = "forbidden";

    const config = getSupabasePublicConfig();

    expect(JSON.stringify(config)).not.toContain("forbidden");
  });

  it("builds user_settings patches without app_name_override", () => {
    const patch = buildUserSettingsPatch({
      themeId: "cat",
      colorMode: "dark",
      workspaceTitle: "今天一起变强"
    });

    expect(patch).toEqual({
      theme_id: "cat",
      color_mode: "dark",
      workspace_title: "今天一起变强"
    });
    expect(JSON.stringify(patch)).not.toContain("app_name_override");
  });
});
