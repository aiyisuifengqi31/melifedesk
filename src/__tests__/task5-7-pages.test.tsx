import { fireEvent, render, screen } from "@testing-library/react-native";

import { FinancePanel } from "@/features/finance/FinancePanel";

describe("Task 5 and Task 7 pages", () => {
  it("renders the finance workspace controls", () => {
    render(<FinancePanel />);

    for (const label of ["记录", "统计", "份子", "储蓄", "分类", "今日支出", "本月支出", "本月收入", "本月结余", "支出明细", "收入明细"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText("今日收入")).toBeNull();
    expect(screen.queryByText("预算剩余")).toBeNull();
    expect(screen.getByPlaceholderText("0.00")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "选择分类：餐饮" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "快速记账" })).toBeOnTheScreen();
  });

  it("renders the gift (份子) workspace controls", () => {
    render(<FinancePanel />);

    fireEvent.press(screen.getByRole("button", { name: "份子" }));

    expect(screen.getByText("本年送出")).toBeOnTheScreen();
    expect(screen.getByText("本年收到")).toBeOnTheScreen();
    expect(screen.getByText("往来差额")).toBeOnTheScreen();
    expect(screen.getByText("事项类型")).toBeOnTheScreen();
    expect(screen.getByText("联系人")).toBeOnTheScreen();
    expect(screen.getByText("同步到支出账单")).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("姓名")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "保存份子记录" })).toBeOnTheScreen();
  });
});
