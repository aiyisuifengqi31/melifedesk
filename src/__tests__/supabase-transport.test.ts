import { createSupabaseTransport } from "@/auth/supabaseTransport";

describe("Supabase relay transport", () => {
  const supabaseUrl = "https://project.supabase.co";
  const proxyUrl = "https://lifedesk-relay.example";

  it("rewrites only the origin and preserves the complete request", async () => {
    const fetchImpl = jest.fn(async () => new Response(null, { status: 204 }));
    const transport = createSupabaseTransport({ supabaseUrl, proxyUrl, fetchImpl });
    await transport(`${supabaseUrl}/rest/v1/user_kv?select=key`, {
      method: "POST",
      headers: { authorization: "Bearer session", "content-type": "application/json" },
      body: '{"key":"profile"}'
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      `${proxyUrl}/rest/v1/user_kv?select=key`,
      expect.objectContaining({ method: "POST", body: '{"key":"profile"}' })
    );
  });

  it("uses direct networking when no relay is configured", async () => {
    const fetchImpl = jest.fn(async () => new Response(null, { status: 204 }));
    const transport = createSupabaseTransport({ supabaseUrl, proxyUrl: "", fetchImpl });
    await transport(`${supabaseUrl}/auth/v1/token`, { method: "POST" });
    expect(fetchImpl).toHaveBeenCalledWith(`${supabaseUrl}/auth/v1/token`, { method: "POST" });
  });

  it("does not rewrite unrelated destinations", async () => {
    const fetchImpl = jest.fn(async () => new Response(null, { status: 204 }));
    const transport = createSupabaseTransport({ supabaseUrl, proxyUrl, fetchImpl });
    await transport("https://example.com/health");
    expect(fetchImpl).toHaveBeenCalledWith("https://example.com/health", undefined);
  });
});
