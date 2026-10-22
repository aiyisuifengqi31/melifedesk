import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Supabase relay deployment", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("starts the audited local relay handler", () => {
    const main = read("proxy/main.ts");
    expect(main).toContain('import { createRelayHandler } from "./handler.mjs"');
    expect(main).toContain("Deno.serve(createRelayHandler())");
  });

  it("has a repeatable local test task", () => {
    const config = JSON.parse(read("proxy/deno.json"));
    expect(config.tasks.test).toBe("deno test handler.test.mjs");
  });

  it("deploys the audited handler on every required Netlify route", () => {
    const netlifyHandler = read("netlify/functions/supabase-relay.mjs");
    const netlifyConfig = read("netlify.toml");
    expect(netlifyHandler).toContain('import { createRelayHandler } from "../../proxy/handler.mjs"');
    expect(netlifyHandler).toContain("createRelayHandler()");
    for (const path of [
      '"/health"',
      '"/auth/v1/*"',
      '"/rest/v1/*"',
      '"/storage/v1/*"',
      '"/functions/v1/*"',
      '"/realtime/v1/*"'
    ]) {
      expect(netlifyHandler).toContain(path);
    }
    expect(netlifyConfig).toContain('publish = "proxy/public"');
    expect(netlifyConfig).toContain('functions = "netlify/functions"');
  });

  it("contains no secret or configurable upstream", () => {
    const source = read("proxy/handler.mjs") + read("proxy/main.ts") + read("netlify/functions/supabase-relay.mjs");
    expect(source).not.toMatch(/service[_-]?role|sb_secret_|Deno\.env|getenv|process\.env/i);
  });
});
