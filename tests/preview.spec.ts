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

test("todo priority menu does not stretch the quick input", async ({ page }) => {
  await page.goto("/plan");

  const input = page.locator("#plan-quick-input");
  const priorityButton = page.locator("#plan-priority-button");

  await expect(input).toBeVisible();
  const before = await input.boundingBox();
  expect(before).not.toBeNull();

  await priorityButton.click();
  await expect(page.locator("#plan-priority-menu")).toBeVisible();

  const after = await input.boundingBox();
  expect(after).not.toBeNull();
  expect(after?.height).toBe(before?.height);
});

test("workout page saves a real training log", async ({ page }) => {
  await page.goto("/workout");
  await page.evaluate(() => localStorage.removeItem("fanfan-guanguan.workouts.v1"));
  await page.reload();

  await page.getByPlaceholder("训练项目").click();
  await page.keyboard.type("背部训练");
  await page.getByPlaceholder("训练时长").fill("10");
  await page.getByPlaceholder("消耗热量").fill("200");
  await page.getByRole("button", { name: "保存记录" }).click();

  await expect(page.locator("#workout-feedback")).toContainText("训练记录已保存");
  await expect(page.getByText("背部训练")).toBeVisible();

  await page.reload();
  await expect(page.getByText("背部训练")).toBeVisible();
});

test("finance page records expense and updates stats", async ({ page }) => {
  await page.goto("/finance");
  await page.evaluate(() => {
    localStorage.removeItem("fanfan-guanguan.finance.transactions.v1");
    localStorage.removeItem("fanfan-guanguan.finance.savings.v1");
    localStorage.removeItem("fanfan-guanguan.finance.categories.v1");
  });
  await page.reload();

  await expect(page.getByText("今日收入")).toHaveCount(0);
  await expect(page.getByText("预算剩余")).toHaveCount(0);
  await page.getByRole("button", { name: "选择分类：餐饮" }).click();
  await page.getByPlaceholder("0.00").click();
  await page.keyboard.type("25.50");
  await page.getByRole("button", { name: "快速记账" }).click();

  await expect(page.locator("#finance-feedback")).toContainText("支出已保存");
  await expect(page.getByText("¥-25.50")).toBeVisible();
  await page.getByRole("button", { name: "统计" }).click();
  await expect(page.getByText("近7天支出趋势")).toBeVisible();
  await expect(page.getByText("本月结余 = 本月收入 ¥0.00 - 本月支出 ¥25.50")).toBeVisible();
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
  await page.getByRole("button", { name: "选择截止日期" }).click();
  await expect(page.getByText("设置提醒时间")).toBeVisible();
  await page.getByPlaceholder("提醒时间").fill("09:30");
  await page.getByRole("button", { name: "确定提醒时间" }).click();
  await page.getByRole("button", { name: "保存任务" }).click();
  await expect(page.getByText("网页端待办验收")).toBeVisible();
  await expect(page.locator("#plan-feedback")).toContainText("新任务已保存");

  await page.goto("/workout");
  await page.evaluate(() => localStorage.removeItem("fanfan-guanguan.workouts.v1"));
  await page.reload();
  await page.getByPlaceholder("训练项目").fill("背部训练");
  await page.getByPlaceholder("训练时长").fill("10");
  await page.getByPlaceholder("消耗热量").fill("200");
  await page.getByRole("button", { name: "保存记录" }).click();
  await expect(page.locator("#workout-feedback")).toContainText("训练记录已保存");
  await expect(page.getByText("背部训练")).toBeVisible();

  await page.goto("/finance");
  await page.locator("#finance-save-button").click();
  await expect(page.locator("#finance-feedback")).toContainText("请先输入金额");

  await page.goto("/love");
  await page.getByPlaceholder("今天发生了什么...").fill("今天一起散步，很开心");
  await page.getByRole("button", { name: "双方可见" }).click();
  await page.getByRole("button", { name: "保存日记" }).click();
  await expect(page.locator("#love-feedback")).toContainText("日记已保存");
  await expect(page.getByText("双方可见")).toBeVisible();
});
