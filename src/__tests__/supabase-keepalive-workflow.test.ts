import { readFileSync } from "node:fs";
import { join } from "node:path";

const workflowPath = join(
  process.cwd(),
  ".github",
  "workflows",
  "keep-supabase-alive.yml",
);
const deployWorkflowPath = join(process.cwd(), ".github", "workflows", "deploy.yml");
const relayUrl = "https://lifedesk-supabase-relay.netlify.app";

describe("LifeDesk Supabase keepalive workflow", () => {
  const readWorkflow = () => readFileSync(workflowPath, "utf8");

  it("supports merge, manual, and three off-hour scheduled runs per day", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("push:");
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain('cron: "17 0,8,16 * * *"');
  });

  it("uses only the active LifeDesk project's public configuration", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain(
      "SUPABASE_URL: https://yzoxgsqucugeatcxcurd.supabase.co",
    );
    expect(workflow).toContain(`SUPABASE_PROXY_URL: ${relayUrl}`);
    expect(workflow).toMatch(/SUPABASE_PUBLISHABLE_KEY: sb_publishable_[A-Za-z0-9_-]+/);
    expect(workflow).not.toContain("secrets.");
    expect(workflow).not.toContain("ycijporsgfgegmqzxdke");
    expect(workflow).not.toMatch(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
    );
    expect(workflow).not.toMatch(/service[_-]?role/i);
    expect(workflow).not.toMatch(/sb_secret_/i);
  });

  it("makes a bounded, read-only database query", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain(
      '"${SUPABASE_URL}/rest/v1/user_kv?select=key&limit=1"',
    );
    expect(workflow).toContain('"${SUPABASE_PROXY_URL}/health"');
    expect(workflow).toContain(
      '"${SUPABASE_PROXY_URL}/rest/v1/user_kv?select=key&limit=1"',
    );
    expect(workflow).toContain("--request GET");
    expect(workflow).toContain("--fail-with-body");
    expect(workflow).toContain("--connect-timeout 15");
    expect(workflow).toContain("--max-time 45");
    expect(workflow).toContain("--retry 2");
    expect(workflow).not.toContain("/auth/v1/settings");
    expect(workflow).not.toMatch(/--request\s+(POST|PUT|PATCH|DELETE)/);
  });

  it("builds the production app with the same public relay", () => {
    const deployWorkflow = readFileSync(deployWorkflowPath, "utf8");

    expect(deployWorkflow).toContain(`EXPO_PUBLIC_SUPABASE_PROXY_URL: ${relayUrl}`);
    expect(deployWorkflow).not.toContain("secrets.EXPO_PUBLIC_SUPABASE_PROXY_URL");
  });

  it("uses least privilege and rejects missing configuration", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("timeout-minutes: 2");
    expect(workflow).toContain(
      'if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_PUBLISHABLE_KEY" ]]',
    );
    expect(workflow).toContain('test -s "$response_file"');
    expect(workflow).toContain(
      "grep -Eq '^[[:space:]]*\\[' \"$response_file\"",
    );
  });
});
