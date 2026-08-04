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
  it("groups income and expense details by date in a compact statement list", async () => {
    const storage = makeStorage();
    const today = new Date().toISOString().slice(0, 10);
    saveFinanceTransactions(
      [
        {
          amount: "11.00",
          categoryName: "买菜",
          createTime: `${today}T08:10:00.000Z`,
          id: "expense-today-1",
          localDate: today,
          note: "早餐",
          transactionType: "expense"
        },
        {
          amount: "500.00",
          categoryName: "其他",
          createTime: `${today}T09:20:00.000Z`,
          id: "expense-today-2",
          localDate: today,
          note: "情侣存款",
          transactionType: "expense"
        },
        {
          amount: "300.00",
          categoryName: "工资",
          createTime: `${today}T10:20:00.000Z`,
          id: "income-today-1",
          localDate: today,
          note: "兼职",
          transactionType: "income"
        }
      ],
      storage
    );

    render(<FinancePanel storage={storage} />);

    expect(screen.getByTestId("finance-statement-list")).toBeOnTheScreen();
    expect(screen.getByTestId(`finance-date-group-${today}`)).toBeOnTheScreen();
    expect(screen.getByText(/今天/)).toBeOnTheScreen();
    expect(screen.getAllByText(/支出 ¥511.00/).length).toBeGreaterThan(0);
    expect(screen.getByTestId("finance-transaction-row-expense-today-1")).toHaveStyle({ minHeight: 56 });
    expect(screen.getByText("-¥11.00")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "删除账单：买菜" })).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "更多操作：买菜" }));
    expect(screen.getByRole("button", { name: "删除账单：买菜" })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "收入明细" }));
    expect(screen.getAllByText(/收入 ¥300.00/).length).toBeGreaterThan(0);
    expect(screen.getByText("+¥300.00")).toBeOnTheScreen();
  });

  it("uses four-column category buttons and does not show the old input hint", () => {
    render(<FinancePanel storage={makeStorage()} />);

    expect(screen.queryByText(/输入金额/)).toBeNull();
    expect(screen.getByRole("button", { name: "选择分类：餐饮" })).toHaveStyle({
      flexBasis: "22%",
      flexDirection: "row"
    });
    expect(screen.getByText("快速记一笔")).toBeOnTheScreen();
    expect(screen.getByTestId("finance-summary-panel")).toHaveStyle({ gap: 8 });
  });

  it("shows a single monthly summary balance card instead of separate metric cards", () => {
    render(<FinancePanel storage={makeStorage()} />);

    expect(screen.getAllByText("今日支出").length).toBeGreaterThan(0);
    expect(screen.getAllByText("本月总结").length).toBeGreaterThan(0);
    expect(screen.queryByText("今日收入")).toBeNull();
    expect(screen.getByTestId("finance-metric-本月总结")).toHaveStyle({ flexBasis: "100%" });
    expect(screen.getByTestId("finance-balance-summary")).toHaveStyle({ flexDirection: "row" });
    expect(screen.getAllByText(/收入 ¥0\.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/支出 ¥0\.00/).length).toBeGreaterThan(0);
    expect(screen.queryByText("本月支出")).toBeNull();
    expect(screen.queryByText("本月收入")).toBeNull();
  });

  it("uses the compact mobile quick record form layout", () => {
    render(<FinancePanel storage={makeStorage()} />);

    expect(screen.getByTestId("finance-quick-form")).toHaveStyle({ gap: 16 });
    expect(screen.getByTestId("finance-money-date-row")).toHaveStyle({ flexDirection: "row", gap: 12 });
    expect(screen.getByTestId("finance-amount-input")).toHaveStyle({ minHeight: 48, borderWidth: 1.5 });
    expect(screen.getByTestId("finance-date-field")).toHaveStyle({ minHeight: 48, borderWidth: 1.5 });
    expect(screen.getByTestId("finance-note-input")).toHaveStyle({ minHeight: 44 });
    expect(screen.getByTestId("finance-save-button")).toHaveProp("accessibilityState", { disabled: true });
  });

  it("renders very large monthly totals inside the summary card without breaking layout", () => {
    const storage = makeStorage();
    const transaction: FinanceTransaction = {
      amount: "1500000.00",
      categoryName: "工资",
      createTime: "2026-08-02T09:00:00.000Z",
      id: "finance-big",
      localDate: "2026-08-02",
      note: "",
      transactionType: "income"
    };
    saveFinanceTransactions([transaction], storage);

    render(<FinancePanel storage={storage} />);

    expect(screen.getByTestId("finance-balance-summary")).toBeOnTheScreen();
    expect(screen.getByText("¥1500000.00")).toBeOnTheScreen();
  });

  it("creates expense and income details, updates summary, and recalculates after deletion", async () => {
    const storage = makeStorage();
    render(<FinancePanel storage={storage} />);

    expect(screen.getAllByText("今日支出").length).toBeGreaterThan(0);
    expect(screen.getAllByText("本月总结").length).toBeGreaterThan(0);
    expect(screen.queryByText("今日收入")).toBeNull();
    expect(screen.queryByText("本月支出")).toBeNull();
    expect(screen.queryByText("本月收入")).toBeNull();
    expect(screen.queryByText("预算剩余")).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "选择分类：餐饮" }));
    fireEvent.changeText(screen.getByPlaceholderText("0.00"), "25.50");
    fireEvent.press(screen.getByRole("button", { name: "快速记账" }));

    await waitFor(() => expect(screen.getAllByText("餐饮").length).toBeGreaterThan(1));
    expect(screen.getByText("支出已保存，统计已更新。")).toBeOnTheScreen();
    expect(screen.getAllByText(/¥25\.50/).length).toBeGreaterThan(0);
    expect(screen.getByText("-¥25.50")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "统计" }));
    expect(screen.getByText("收支比例")).toBeOnTheScreen();
    expect(screen.getByText("本月分类占比")).toBeOnTheScreen();
    expect(screen.queryByText("本月结余")).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "记录" }));
    expect(screen.getByRole("button", { name: "支出明细" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "收入明细" })).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "更多操作：餐饮" }));
    fireEvent.press(screen.getByRole("button", { name: "删除账单：餐饮" }));
    await waitFor(() => expect(screen.getAllByText("餐饮")).toHaveLength(1));
    await waitFor(() => expect(screen.getAllByText(/¥0\.00/).length).toBeGreaterThanOrEqual(3));

    fireEvent.press(screen.getByRole("button", { name: "收入" }));
    fireEvent.press(screen.getByRole("button", { name: "选择分类：工资" }));
    fireEvent.changeText(screen.getByPlaceholderText("0.00"), "300.00");
    fireEvent.press(screen.getByRole("button", { name: "快速记账" }));

    expect(screen.getAllByText(/¥300\.00/).length).toBeGreaterThan(0);
    fireEvent.press(screen.getByRole("button", { name: "收入明细" }));
    await waitFor(() => expect(screen.getAllByText("工资").length).toBeGreaterThan(1));
    expect(screen.getByText("+¥300.00")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "更多操作：工资" }));
    fireEvent.press(screen.getByRole("button", { name: "删除账单：工资" }));
    await waitFor(() => expect(screen.getAllByText("工资")).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText("+¥300.00")).toBeNull());
  });
});
