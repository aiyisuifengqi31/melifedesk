import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: "http://127.0.0.1:8091",
    trace: "on-first-retry"
  },
  webServer: {
    command: "pnpm exec expo start --web --port 8091",
    env: {
      CI: "1"
    },
    url: "http://127.0.0.1:8091",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
