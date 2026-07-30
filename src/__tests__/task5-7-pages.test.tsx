import { render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";

describe("Task 5 and Task 7 pages", () => {
  it("renders the finance workspace controls", () => {
    render(<AppShell initialRoute="/finance" />);

    for (const label of ["今日支出", "今日收入", "本月支出", "本月收入", "本月结余", "预算剩余", "最近账单", "最近 7 天支出趋势", "最近 30 天支出趋势", "本月分类占比", "本月与上月对比", "预算卡片", "存钱目标"]) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
    expect(screen.getByPlaceholderText("输入金额")).toBeOnTheScreen();
    expect(screen.getByText("分类图标网格")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "快速记账" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "重试" })).toBeOnTheScreen();
  });

  it("renders the gift workspace controls", () => {
    render(<AppShell initialRoute="/gifts" />);

    for (const label of ["新增份子记录", "联系人列表", "送出 / 收到", "联系人历史", "往来差额", "待回礼", "年度统计", "是否同步到记账"]) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
    expect(screen.getByPlaceholderText("搜索联系人")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "保存份子记录" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "重试" })).toBeOnTheScreen();
  });
});
