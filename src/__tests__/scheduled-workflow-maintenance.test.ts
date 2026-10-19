import { readFileSync } from "node:fs";
import { join } from "node:path";

const workflowPath = join(
  process.cwd(),
  ".github",
  "workflows",
  "keep-scheduled-workflows-enabled.yml",
);

describe("scheduled workflow maintenance", () => {
  const readWorkflow = () => readFileSync(workflowPath, "utf8");

  it("runs after installation, manually, and once per month", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("push:");
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain(
      '      - ".github/workflows/keep-scheduled-workflows-enabled.yml"',
    );
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain('cron: "43 3 1 * *"');
  });

  it("uses narrowly scoped write permission and checks out main", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("timeout-minutes: 2");
    expect(workflow).toContain("ref: main");
    expect(workflow).toContain("fetch-depth: 0");
  });

  it("creates only a harmless repository activity commit", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain(".github/scheduled-workflow-heartbeat.txt");
    expect(workflow).toContain("git pull --rebase origin main");
    expect(workflow).toContain(
      'git commit -m "chore: refresh scheduled workflow heartbeat"',
    );
    expect(workflow).toContain("git push origin HEAD:main");
    expect(workflow).not.toMatch(/git\s+(reset|clean)/);
  });

  it("does not access Supabase or contain credentials", () => {
    const workflow = readWorkflow();

    expect(workflow).not.toContain("supabase.co");
    expect(workflow).not.toContain("SUPABASE");
    expect(workflow).not.toContain("secrets.");
    expect(workflow).not.toMatch(/sb_(publishable|secret)_/i);
    expect(workflow).not.toMatch(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
    );
  });
});
