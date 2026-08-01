import { render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";

describe("Task 5 and Task 7 pages", () => {
  it("renders the finance workspace controls", () => {
    render(<AppShell initialRoute="/finance" />);

    for (const label of ["记录", "统计", "储蓄", "分类", "今日支出", "本月支出", "本月收入", "本月结余", "支出明细", "收入明细"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText("今日收入")).toBeNull();
    expect(screen.queryByText("预算剩余")).toBeNull();
    expect(screen.getByPlaceholderText("0.00")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "选择分类：餐饮" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "快速记账" })).toBeOnTheScreen();
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
