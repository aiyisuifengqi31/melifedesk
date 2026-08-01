import { expect, test } from "@playwright/test";

test("shows the confirmed app name and no old brand", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("帆帆和关关");
  await expect(page.getByText("帆帆和关关").first()).toBeVisible();
  await expect(page.locator("#page-title")).toHaveCount(0);
  await expect(page.getByText("LifeDesk")).toHaveCount(0);
});

test("shows Task 2 auth and couple controls on the login page", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByPlaceholder("邮箱")).toBeVisible();
  await expect(page.getByPlaceholder("密码")).toBeVisible();
  await expect(page.getByPlaceholder("显示名称")).toBeVisible();
  await expect(page.getByPlaceholder("邀请码")).toBeVisible();
  await expect(page.getByRole("button", { name: "注册" })).toBeVisible();
  await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存主题" })).toBeVisible();
  await expect(page.getByRole("button", { name: "生成情侣邀请码" })).toBeVisible();
  await expect(page.getByRole("button", { name: "接受邀请" })).toBeVisible();
  await expect(page.getByRole("button", { name: "解除绑定" })).toBeVisible();
  await expect(page.getByText("LifeDesk")).toHaveCount(0);
});

test("navigates between the six primary routes", async ({ page }) => {
  await page.goto("/");

  const labels = ["每日计划", "运动健身", "收支记账", "恋爱日记", "份子记录", "考公练习"];
  for (const label of labels) {
    await expect(page.getByRole("button", { name: label })).toBeVisible();
  }

  await page.goto("/workout");
  await expect(page).toHaveURL(/\/workout$/);
  await expect(page.getByRole("button", { name: "今天训练了" })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/workout$/);
  await expect(page.getByText("训练日志")).toBeVisible();
});

test("shows Task 3 plan and Task 4 workout skeleton controls", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("上午好，把今天安排得轻一点")).toBeVisible();
  await expect(page.getByText("当前城市天气")).toBeVisible();
  await expect(page.getByRole("button", { name: "获取当前城市天气" })).toBeVisible();
  await expect(page.getByText("今日待办")).toBeVisible();
  await expect(page.getByPlaceholder("添加待办任务...")).toBeVisible();
  await expect(page.getByText("待办", { exact: true })).toBeVisible();
  await expect(page.getByText("已完成 0", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "新增任务" })).toBeVisible();

  await page.getByRole("button", { name: "运动健身" }).click();

  await expect(page.getByRole("button", { name: "今天训练了" })).toBeVisible();
  await expect(page.getByText("训练部位")).toBeVisible();
  await expect(page.getByText("训练强度")).toBeVisible();
  await expect(page.getByPlaceholder("训练项目")).toBeVisible();
  await expect(page.getByPlaceholder("消耗热量")).toBeVisible();
  await expect(page.getByText("本周训练")).toBeVisible();
});

test("shows Task 5 finance and Task 7 gift skeleton controls", async ({ page }) => {
  await page.goto("/finance");

  await expect(page.getByText("今日支出")).toBeVisible();
  await expect(page.getByText("本月结余")).toBeVisible();
  await expect(page.getByText("今日收入")).toHaveCount(0);
  await expect(page.getByText("预算剩余")).toHaveCount(0);
  await expect(page.getByPlaceholder("0.00")).toBeVisible();
  await expect(page.getByRole("button", { name: "快速记账" })).toBeVisible();
  await expect(page.getByRole("button", { name: "统计" })).toBeVisible();

  await page.getByRole("button", { name: "份子记录" }).click();

  await expect(page.getByText("新增份子记录")).toBeVisible();
  await expect(page.getByText("联系人列表")).toBeVisible();
  await expect(page.getByText("待回礼")).toBeVisible();
  await expect(page.getByText("是否同步到记账")).toBeVisible();
  await expect(page.getByRole("button", { name: "保存份子记录" })).toBeVisible();
});

test("shows Task 6 love diary and polished UI sections", async ({ page }) => {
  await page.goto("/love");

  await expect(page.getByText("记录每一个甜蜜瞬间")).toBeVisible();
  await expect(page.getByText("日记").first()).toBeVisible();
  await expect(page.getByText("纪念日").first()).toBeVisible();
  await expect(page.getByText("生理周期")).toHaveCount(0);
  await expect(page.getByText("写日记")).toBeVisible();
  await expect(page.getByRole("button", { name: "仅自己可见" })).toBeVisible();
  await expect(page.getByRole("button", { name: "双方可见" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("supports sidebar collapse and theme switching", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#sidebar")).toHaveCSS("width", "224px");
  await page.getByRole("button", { name: "折叠导航" }).click();
  await expect(page.locator("#sidebar")).toHaveCSS("width", "72px");

  await expect(page.getByRole("button", { name: "cat" })).toHaveCount(0);
  await page.locator("#sidebar-settings-button").click();
  await page.getByRole("button", { name: "cat" }).click();
  await expect(page.locator("#sidebar-current-theme")).toContainText("cat");
  await expect(page.locator("#nav-icon-plan svg")).toBeVisible();
  await expect(page.locator("#nav-icon-plan")).toHaveAttribute("data-icon-source", /cat\/nav-icons\/plan-selected\.svg/);
  await expect(page.locator("#nav-icon-workout")).toHaveAttribute("data-icon-source", /cat\/nav-icons\/workout-unselected\.svg/);
  await expect(page.getByText("cat-plan")).toHaveCount(0);

  await page.getByRole("button", { name: "dog" }).click();
  await expect(page.locator("#nav-icon-plan")).toHaveAttribute("data-icon-source", /dog\/nav-icons\/plan-selected\.svg/);

  await page.getByRole("button", { name: "dark mode" }).click();
  await expect(page.locator("#sidebar-theme-mode")).toContainText("dark");
});

test("keeps the mobile sidebar from covering content", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.locator("#sidebar")).toHaveCSS("width", "68px");

  const layout = await page.evaluate(() => {
    const sidebar = document.querySelector("#sidebar")?.getBoundingClientRect();
    const content = document.querySelector("#page-content")?.getBoundingClientRect();
    return {
      sidebarRight: sidebar?.right ?? 0,
      contentLeft: content?.left ?? 0
    };
  });

  expect(layout.contentLeft).toBeGreaterThanOrEqual(layout.sidebarRight);
});
