import { readFileSync } from "node:fs";
import { join } from "node:path";

const workflowPath = join(
  process.cwd(),
  ".github",
  "workflows",
  "keep-supabase-alive.yml",
);

describe("legacy Supabase keepalive workflow", () => {
  const readWorkflow = () => readFileSync(workflowPath, "utf8");

  it("supports merge, manual, and three off-hour scheduled runs per day", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("push:");
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain('cron: "17 0,8,16 * * *"');
  });

  it("uses only the approved legacy project public configuration", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain(
      "SUPABASE_URL: https://ycijporsgfgegmqzxdke.supabase.co",
    );
    expect(workflow).toMatch(/SUPABASE_PUBLISHABLE_KEY: sb_publishable_[A-Za-z0-9_-]+/);
    expect(workflow).not.toContain("secrets.");
    expect(workflow).not.toContain("yzoxgsqucugeatcxcurd");
    expect(workflow).not.toMatch(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
    );
    expect(workflow).not.toMatch(/service[_-]?role/i);
    expect(workflow).not.toMatch(/sb_secret_/i);
  });

  it("makes a bounded, non-mutating GraphQL database query", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain('"${SUPABASE_URL}/graphql/v1"');
    expect(workflow).toContain("--request POST");
    expect(workflow).toContain('Content-Type: application/json');
    expect(workflow).toContain('query KeepAlive { __typename }');
    expect(workflow).toContain("--fail-with-body");
    expect(workflow).toContain("--connect-timeout 15");
    expect(workflow).toContain("--max-time 45");
    expect(workflow).toContain("--retry 2");
    expect(workflow).not.toMatch(/\bmutation\b/i);
    expect(workflow).not.toMatch(/--request\s+(PUT|PATCH|DELETE)/);
  });

  it("uses least privilege and rejects missing configuration", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("timeout-minutes: 2");
    expect(workflow).toContain(
      'if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_PUBLISHABLE_KEY" ]]',
    );
    expect(workflow).toContain('test -s "$response_file"');
    expect(workflow).toContain('grep -q \'"data"\' "$response_file"');
  });
});
