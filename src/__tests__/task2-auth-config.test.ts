import { getSupabasePublicConfig } from "@/auth/supabaseConfig";
import { buildUserSettingsPatch } from "@/auth/userSettings";

describe("Task 2 auth client configuration", () => {
  it("uses only public Supabase URL and anon key in client config", () => {
    const config = getSupabasePublicConfig({
      EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon-key"
    });

    expect(config).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
      configured: true
    });
    expect(JSON.stringify(config)).not.toContain("service");
  });

  it("returns no extra secret-like values from client config", () => {
    const config = getSupabasePublicConfig({
      EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      EXTRA_SECRET_VALUE: "forbidden"
    });

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
