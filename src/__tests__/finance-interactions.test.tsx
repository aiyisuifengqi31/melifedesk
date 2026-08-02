import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { FinancePanel } from "@/features/finance/FinancePanel";
import { loadFinanceTransactions, saveFinanceTransactions, type FinanceTransaction } from "@/features/finance/financeStorage";

const transactionKey = "fanfan-guanguan.finance.transactions.v1";

function makeStorage() {
  const data = new Map<string, string>();

  return {
    getItem: jest.fn((key: string) => data.get(key) ?? null),
    removeItem: jest.fn((key: string) => data.delete(key)),
    setItem: jest.fn((key: string, value: string) => {
      data.set(key, value);
    })
  };
}

describe("finance storage", () => {
  it("saves and loads transactions", () => {
    const storage = makeStorage();
    const transaction: FinanceTransaction = {
      amount: "12.50",
      categoryName: "餐饮",
      createTime: "2026-07-31T09:00:00.000Z",
      id: "finance-1",
      localDate: "2026-07-31",
      note: "午饭",
      transactionType: "expense"
    };

    saveFinanceTransactions([transaction], storage);

    expect(storage.setItem).toHaveBeenCalledWith(transactionKey, JSON.stringify([transaction]));
    expect(loadFinanceTransactions(storage)).toEqual([transaction]);
  });
});

describe("FinancePanel interactions", () => {
  it("uses four-column category buttons and does not show the old input hint", () => {
    render(<FinancePanel storage={makeStorage()} />);

    expect(screen.queryByText(/输入金额/)).toBeNull();
    expect(screen.getByRole("button", { name: "选择分类：餐饮" })).toHaveStyle({ flexBasis: "22%" });
  });

  it("creates expense and income details, updates summary, and recalculates after deletion", async () => {
    const storage = makeStorage();
    render(<FinancePanel storage={storage} />);

    expect(screen.getAllByText("今日支出").length).toBeGreaterThan(0);
    expect(screen.getByText("本月支出")).toBeOnTheScreen();
    expect(screen.getByText("本月收入")).toBeOnTheScreen();
    expect(screen.getByText("本月结余")).toBeOnTheScreen();
    expect(screen.queryByText("今日收入")).toBeNull();
    expect(screen.queryByText("预算剩余")).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "选择分类：餐饮" }));
    fireEvent.changeText(screen.getByPlaceholderText("0.00"), "25.50");
    fireEvent.press(screen.getByRole("button", { name: "快速记账" }));

    await waitFor(() => expect(screen.getAllByText("餐饮").length).toBeGreaterThan(1));
    expect(screen.getByText("支出已保存，统计已更新。")).toBeOnTheScreen();
    expect(screen.getAllByText("¥25.50").length).toBeGreaterThan(0);
    expect(screen.getByText("¥-25.50")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "统计" }));
    expect(screen.getByText("近7天支出趋势")).toBeOnTheScreen();
    expect(screen.getByText("本月分类占比")).toBeOnTheScreen();
    expect(screen.getByText("本月结余 = 本月收入 ¥0.00 - 本月支出 ¥25.50")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "记录" }));
    expect(screen.getByRole("button", { name: "支出明细" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "收入明细" })).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "删除账单：餐饮" }));
    await waitFor(() => expect(screen.getAllByText("餐饮")).toHaveLength(1));
    await waitFor(() => expect(screen.getAllByText("¥0.00").length).toBeGreaterThanOrEqual(3));

    fireEvent.press(screen.getByRole("button", { name: "收入" }));
    fireEvent.press(screen.getByRole("button", { name: "选择分类：工资" }));
    fireEvent.changeText(screen.getByPlaceholderText("0.00"), "300.00");
    fireEvent.press(screen.getByRole("button", { name: "快速记账" }));

    expect(screen.getAllByText("¥300.00").length).toBeGreaterThan(0);
    fireEvent.press(screen.getByRole("button", { name: "收入明细" }));
    await waitFor(() => expect(screen.getAllByText("工资").length).toBeGreaterThan(1));
    expect(screen.getByText("+¥300.00")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "删除账单：工资" }));
    await waitFor(() => expect(screen.getAllByText("工资")).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText("+¥300.00")).toBeNull());
  });
});
