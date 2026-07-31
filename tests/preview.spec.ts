import { expect, test } from "@playwright/test";

const pageChecks = [
  { label: "login", path: "/login", hasShell: false },
  { label: "daily plan", path: "/plan", hasShell: true, routeKey: "plan" },
  { label: "workout", path: "/workout", hasShell: true, routeKey: "workout" },
  { label: "finance", path: "/finance", hasShell: true, routeKey: "finance" },
  { label: "love diary", path: "/love", hasShell: true, routeKey: "love" },
  { label: "gifts", path: "/gifts", hasShell: true, routeKey: "gifts" },
  { label: "exam", path: "/exam", hasShell: true, routeKey: "exam" }
] as const;

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 }
]) {
  test.describe(`preview checklist on ${viewport.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport);
    });

    for (const item of pageChecks) {
      test(`${item.label} opens without preview regressions`, async ({ page }) => {
        const runtimeErrors: string[] = [];
        page.on("pageerror", (error) => runtimeErrors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") {
            runtimeErrors.push(message.text());
          }
        });

        await page.goto(item.path);

        await expect(page.locator("body")).toBeVisible();
        await expect(page.getByText("LifeDesk")).toHaveCount(0);
        await expect(page.getByText(/(default|cat|dog)-plan/)).toHaveCount(0);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(overflow).toBe(false);

        if (item.hasShell) {
          await expect(page.locator("#sidebar")).toBeVisible();
          await expect(page.locator("#page-content")).toBeVisible();
          await expect(page.locator(`#nav-icon-${item.routeKey}`)).toHaveAttribute("data-icon-source", /selected\.svg/);
        }

        expect(runtimeErrors).toEqual([]);
      });
    }
  });
}

test("preview supports theme and dark mode switching", async ({ page }) => {
  await page.goto("/plan");

  await expect(page.locator("#page-diagnostics")).toHaveCount(0);
  await expect(page.locator("#settings-panel")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "cat" })).toHaveCount(0);

  await page.locator("#sidebar-settings-button").click();
  await expect(page.locator("#settings-panel")).toBeVisible();

  await page.getByRole("button", { name: "cat" }).click();
  await expect(page.locator("#sidebar-current-theme")).toContainText("cat");
  await expect(page.locator("#nav-icon-plan")).toHaveAttribute("data-icon-source", /cat\/nav-icons\/plan-selected\.svg/);

  await page.getByRole("button", { name: "dog" }).click();
  await expect(page.locator("#sidebar-current-theme")).toContainText("dog");
  await expect(page.locator("#nav-icon-plan")).toHaveAttribute("data-icon-source", /dog\/nav-icons\/plan-selected\.svg/);

  await page.getByRole("button", { name: /深色|dark/i }).click();
  await expect(page.locator("#sidebar-theme-mode")).toContainText(/dark|深色/);
});

test("settings entry stays available on every feature page", async ({ page }) => {
  for (const path of ["/plan", "/workout", "/finance", "/love", "/gifts", "/exam"]) {
    await page.goto(path);
    await expect(page.locator("#sidebar-settings-button")).toBeVisible();
    if (await page.locator("#settings-panel").isVisible()) {
      await page.locator("#sidebar-settings-button").click();
      await expect(page.locator("#settings-panel")).toHaveCount(0);
    }
    await page.locator("#sidebar-settings-button").click();
    await expect(page.locator("#settings-panel")).toBeVisible();
  }
});

test("primary preview buttons provide visible feedback", async ({ page }) => {
  await page.goto("/plan");
  await page.evaluate(() => localStorage.removeItem("fanfan-guanguan.todos.v1"));
  await page.reload();
  await page.getByRole("button", { name: "新增任务" }).click();
  await page.getByPlaceholder("任务名称").fill("网页端待办验收");
  await page.getByPlaceholder("截止日期").fill("2026-08-02");
  await page.getByPlaceholder("提醒时间，可选").fill("09:30");
  await page.getByRole("button", { name: "保存任务" }).click();
  await expect(page.getByText("网页端待办验收")).toBeVisible();
  await expect(page.locator("#plan-feedback")).toContainText("新任务已保存");

  await page.goto("/workout");
  await page.getByRole("button", { name: "今天训练了" }).click();
  await expect(page.locator("#workout-feedback")).toContainText("已选择训练");

  await page.goto("/finance");
  await page.locator("#finance-save-button").click();
  await expect(page.locator("#finance-feedback")).toContainText("请先输入金额");

  await page.goto("/love");
  await page.getByRole("button", { name: "记录心情" }).click();
  await expect(page.locator("#love-feedback")).toContainText("已记录到预览草稿");
});
