import { expect, test } from "@playwright/test";

test("shows the confirmed app name and no old brand", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("帆帆和关关");
  await expect(page.getByRole("heading", { name: "帆帆和关关" })).toBeVisible();
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

  await page.getByRole("button", { name: "运动健身" }).click();
  await expect(page).toHaveURL(/\/workout$/);
  await expect(page.getByRole("heading", { name: "运动健身" })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/workout$/);
  await expect(page.getByRole("heading", { name: "运动健身" })).toBeVisible();
});

test("shows Task 3 plan and Task 4 workout skeleton controls", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("今日日期")).toBeVisible();
  await expect(page.getByText("天气", { exact: true })).toBeVisible();
  await expect(page.getByText("月历", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("新增待办")).toBeVisible();
  await expect(page.getByRole("button", { name: "快速记录" })).toBeVisible();

  await page.getByRole("button", { name: "运动健身" }).click();

  await expect(page.getByText("今日是否训练")).toBeVisible();
  await expect(page.getByText("训练部位")).toBeVisible();
  await expect(page.getByText("训练强度")).toBeVisible();
  await expect(page.getByPlaceholder("训练项目")).toBeVisible();
  await expect(page.getByPlaceholder("消耗热量")).toBeVisible();
  await expect(page.getByText("本周训练次数")).toBeVisible();
});

test("shows Task 5 finance and Task 7 gift skeleton controls", async ({ page }) => {
  await page.goto("/finance");

  await expect(page.getByText("今日支出")).toBeVisible();
  await expect(page.getByText("本月结余")).toBeVisible();
  await expect(page.getByPlaceholder("输入金额")).toBeVisible();
  await expect(page.getByRole("button", { name: "快速记账" })).toBeVisible();
  await expect(page.getByText("最近 30 天支出趋势")).toBeVisible();

  await page.getByRole("button", { name: "份子记录" }).click();

  await expect(page.getByText("新增份子记录")).toBeVisible();
  await expect(page.getByText("联系人列表")).toBeVisible();
  await expect(page.getByText("待回礼")).toBeVisible();
  await expect(page.getByText("是否同步到记账")).toBeVisible();
  await expect(page.getByRole("button", { name: "保存份子记录" })).toBeVisible();
});

test("supports sidebar collapse and theme switching", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#sidebar")).toHaveCSS("width", "224px");
  await page.getByRole("button", { name: "折叠导航" }).click();
  await expect(page.locator("#sidebar")).toHaveCSS("width", "72px");

  await page.getByRole("button", { name: "cat" }).click();
  await expect(page.locator("#active-theme")).toContainText("当前主题：cat");
  await expect(page.locator("#nav-icon-plan svg")).toBeVisible();
  await expect(page.locator("#nav-icon-plan")).toHaveAttribute("data-icon-source", /cat\/nav-icons\/plan-selected\.svg/);
  await expect(page.locator("#nav-icon-workout")).toHaveAttribute("data-icon-source", /cat\/nav-icons\/workout-unselected\.svg/);
  await expect(page.getByText("cat-plan")).toHaveCount(0);

  await page.getByRole("button", { name: "dog" }).click();
  await expect(page.locator("#nav-icon-plan")).toHaveAttribute("data-icon-source", /dog\/nav-icons\/plan-selected\.svg/);

  await page.getByRole("button", { name: "切换深色模式" }).click();
  await expect(page.locator("#theme-mode")).toContainText("当前模式：dark");
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
