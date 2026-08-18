import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";
import { FinancePanel } from "@/features/finance/FinancePanel";
import { loadFinanceTransactions, loadGiftRecords, loadSavingEntries, saveFinanceTransactions, saveSavingEntries, type FinanceTransaction } from "@/features/finance/financeStorage";
import { QuickAccountingSheet } from "@/features/finance/QuickAccountingSheet";
import type { UiTokens } from "@/shared/ui/primitives";

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

const testTokens: UiTokens = {
  accent: "#2f9e44",
  accentSoft: "#e8f6ec",
  background: "#f6fbf7",
  border: "#dfe8df",
  danger: "#ef4444",
  success: "#16a34a",
  surface: "#ffffff",
  surfaceMuted: "#f5f8f6",
  text: "#17231b",
  textMuted: "#6f7d73"
};

function renderQuickSheet(storage = makeStorage(), onSaved = jest.fn()) {
  render(
    <QuickAccountingSheet
      onClose={jest.fn()}
      onSaved={onSaved}
      storage={storage}
      tokens={testTokens}
      visible
    />
  );
  return { onSaved, storage };
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
  it("opens quick accounting from the homepage without navigating to finance", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByRole("button", { name: "快速记账：记一笔" }));

    expect(screen.getByTestId("quick-accounting-sheet")).toBeOnTheScreen();
    expect(screen.getByText("选择分类")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "支出" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "收入" })).toBeOnTheScreen();
    expect(screen.queryByTestId("secondary-tab-record")).toBeNull();
  });

  it("shows today's expense on the quick accounting card and opens the same sheet", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    expect(screen.getAllByText("今日支出").length).toBeGreaterThan(0);
    fireEvent.press(screen.getByRole("button", { name: "快速记账：记一笔" }));

    expect(screen.getByTestId("quick-accounting-sheet")).toBeOnTheScreen();
    expect(screen.getByText("选择分类")).toBeOnTheScreen();
  });

  it("records an expense from quick accounting and updates home today expense immediately", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByRole("button", { name: "快速记账：记一笔" }));
    fireEvent.press(screen.getByRole("button", { name: "选择分类：餐饮" }));
    fireEvent.press(screen.getByRole("button", { name: "输入金额 2" }));
    fireEvent.press(screen.getByRole("button", { name: "输入金额 6" }));
    fireEvent.press(screen.getByRole("button", { name: "完成记账" }));

    expect(screen.queryByTestId("quick-accounting-sheet")).toBeNull();
    expect(screen.getByText(/已记录/)).toBeOnTheScreen();
    expect(screen.getByText(/26\.00/)).toBeOnTheScreen();
  });

  it("opens the same quick accounting sheet from the sidebar finance shortcut", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByTestId("quick-fab"));
    fireEvent.press(screen.getByTestId("quick-shortcut-finance"));

    expect(screen.queryByTestId("quick-shortcut-menu")).toBeNull();
    expect(screen.getByTestId("quick-accounting-sheet")).toBeOnTheScreen();
    expect(screen.queryByTestId("finance-amount-input")).toBeNull();
  });

  it("removes the record tab and defaults finance to stats", () => {
    render(<AppShell initialRoute="/finance" viewport="mobile" />);

    expect(screen.queryByTestId("secondary-tab-record")).toBeNull();
    expect(screen.getByTestId("secondary-tab-stats")).toBeOnTheScreen();
    expect(screen.queryByText("收支比例")).toBeNull();
    expect(screen.getByTestId("finance-statement-list")).toBeOnTheScreen();
  });

  it("groups income and expense details by date in a compact statement list", () => {
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

  it("keeps monthly overview and statement list synced when selecting a history month", () => {
    const storage = makeStorage();
    saveFinanceTransactions(
      [
        {
          amount: "100.00",
          categoryName: "餐饮",
          createTime: "2026-08-18T08:10:00.000Z",
          id: "expense-aug",
          localDate: "2026-08-18",
          note: "八月晚饭",
          transactionType: "expense"
        },
        {
          amount: "500.00",
          categoryName: "工资",
          createTime: "2026-08-18T09:10:00.000Z",
          id: "income-aug",
          localDate: "2026-08-18",
          note: "八月收入",
          transactionType: "income"
        },
        {
          amount: "60.00",
          categoryName: "出行",
          createTime: "2026-07-12T08:10:00.000Z",
          id: "expense-jul",
          localDate: "2026-07-12",
          note: "七月公交",
          transactionType: "expense"
        }
      ],
      storage
    );

    render(<FinancePanel storage={storage} />);

    expect(screen.getByTestId("finance-summary-panel")).toBeOnTheScreen();
    expect(screen.queryByTestId("finance-monthly-overview-card")).toBeNull();
    expect(screen.getByText("本月分类占比")).toBeOnTheScreen();
    expect(screen.getByTestId("finance-category-pie-legend")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "选择月份：2026年8月" }));
    expect(screen.getByTestId("finance-month-menu")).toHaveStyle({ zIndex: 200 });
    fireEvent.press(screen.getByRole("button", { name: "筛选月份：2026年7月" }));

    expect(screen.getByText("本月结余")).toBeOnTheScreen();
    expect(screen.getByText("¥-60.00")).toBeOnTheScreen();
    expect(screen.getByText("本月支出 ¥60.00 · 1 笔")).toBeOnTheScreen();
    expect(screen.getByText("七月公交")).toBeOnTheScreen();
    expect(screen.queryByText("八月晚饭")).toBeNull();
  });

  it("uses four-column category buttons inside the quick accounting sheet", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByRole("button", { name: "快速记账：记一笔" }));

    expect(screen.queryByText(/输入金额，选择分类就可以记一笔/)).toBeNull();
    for (const category of ["餐饮", "购物", "出行", "随份子", "医疗", "情侣存款", "娱乐", "宠物", "礼物", "美容", "汽车", "储蓄"]) {
      expect(screen.getByRole("button", { name: `选择分类：${category}` })).toHaveStyle({ flexBasis: "22%" });
      expect(screen.getByTestId(`quick-category-icon-${category}`)).toBeOnTheScreen();
      expect(screen.queryByText(category.slice(0, 1))).toBeNull();
    }
    expect(screen.queryByRole("button", { name: "选择分类：更多" })).toBeNull();
  });

  it("uses a compact keypad amount step instead of the old finance page form", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByRole("button", { name: "快速记账：记一笔" }));
    fireEvent.press(screen.getByRole("button", { name: "选择分类：餐饮" }));

    expect(screen.queryByTestId("finance-quick-form")).toBeNull();
    expect(screen.getByText("¥0.00")).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("备注（可选）")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "输入金额 1" })).toHaveStyle({ flexBasis: "31%" });
    expect(screen.getByRole("button", { name: "完成记账" })).toHaveProp("accessibilityState", { disabled: true });
  });

  it("lets quick accounting pick yesterday and keeps it out of today's expense", () => {
    const storage = makeStorage();
    const onSaved = jest.fn();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayIso = yesterday.toISOString().slice(0, 10);

    renderQuickSheet(storage, onSaved);

    fireEvent.press(screen.getByRole("button", { name: "选择分类：餐饮" }));
    fireEvent.press(screen.getByRole("button", { name: "选择记账日期：今天" }));
    const yesterdayButtons = screen.getAllByRole("button", { name: `选择日期：${yesterdayIso}` });
    fireEvent.press(yesterdayButtons[yesterdayButtons.length - 1]);
    expect(screen.queryByText("选择记账日期")).toBeNull();
    expect(screen.getByRole("button", { name: "选择记账日期：昨天" })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "输入金额 2" }));
    fireEvent.press(screen.getByRole("button", { name: "输入金额 0" }));
    fireEvent.press(screen.getByRole("button", { name: "完成记账" }));

    expect(loadFinanceTransactions(storage)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amount: "20.00",
          categoryName: "餐饮",
          localDate: yesterdayIso,
          transactionType: "expense"
        })
      ])
    );
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ localDate: yesterdayIso }));
  });

  it("closes the quick accounting calendar without changing date when tapping outside", () => {
    renderQuickSheet();

    fireEvent.press(screen.getByRole("button", { name: "选择分类：餐饮" }));
    fireEvent.press(screen.getByRole("button", { name: "选择记账日期：今天" }));
    expect(screen.getByText("选择记账日期")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "关闭日期选择器" }));

    expect(screen.queryByText("选择记账日期")).toBeNull();
    expect(screen.getByRole("button", { name: "选择记账日期：今天" })).toBeOnTheScreen();
  });

  it("records quick saving once as both saving entry and expense transaction", () => {
    const storage = makeStorage();
    const onSaved = jest.fn();
    renderQuickSheet(storage, onSaved);

    fireEvent.press(screen.getByRole("button", { name: "选择分类：储蓄" }));
    fireEvent.press(screen.getByRole("button", { name: "输入金额 5" }));
    fireEvent.press(screen.getByRole("button", { name: "输入金额 0" }));
    fireEvent.press(screen.getByRole("button", { name: "输入金额 0" }));
    fireEvent.changeText(screen.getByPlaceholderText("备注（可选）"), "本月存款");
    fireEvent.press(screen.getByRole("button", { name: "完成记账" }));

    const transactions = loadFinanceTransactions(storage);
    const savings = loadSavingEntries(storage);
    expect(transactions).toHaveLength(1);
    expect(savings).toHaveLength(1);
    expect(transactions[0]).toEqual(expect.objectContaining({ amount: "500.00", categoryName: "储蓄", transactionType: "expense" }));
    expect(savings[0]).toEqual(expect.objectContaining({ amount: "500.00", note: "本月存款", type: "deposit", financeTransactionId: transactions[0].id }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ categoryName: "储蓄" }));
  });

  it("records quick gift money once as both gift record and expense transaction", () => {
    const storage = makeStorage();
    renderQuickSheet(storage);

    fireEvent.press(screen.getByRole("button", { name: "选择分类：随份子" }));
    fireEvent.changeText(screen.getByPlaceholderText("姓名（建议填写）"), "张三");
    fireEvent.changeText(screen.getByPlaceholderText("备注（可选，例如：结婚、满月、生日）"), "结婚");
    fireEvent.press(screen.getByRole("button", { name: "输入金额 5" }));
    fireEvent.press(screen.getByRole("button", { name: "输入金额 0" }));
    fireEvent.press(screen.getByRole("button", { name: "输入金额 0" }));
    fireEvent.press(screen.getByRole("button", { name: "完成记账" }));

    const transactions = loadFinanceTransactions(storage);
    const gifts = loadGiftRecords(storage);
    expect(transactions).toHaveLength(1);
    expect(gifts).toHaveLength(1);
    expect(transactions[0]).toEqual(expect.objectContaining({ amount: "500.00", categoryName: "随份子", note: "张三 · 结婚", transactionType: "expense" }));
    expect(gifts[0]).toEqual(expect.objectContaining({ amount: "500.00", contactName: "张三", direction: "sent", eventType: "结婚", financeTransactionId: transactions[0].id }));
  });

  it("shows income categories with real icons and saves income transactions", () => {
    const storage = makeStorage();
    renderQuickSheet(storage);

    fireEvent.press(screen.getByRole("button", { name: "收入" }));
    for (const category of ["工资", "奖金", "兼职", "报销", "红包", "理财收益", "退款", "其他"]) {
      expect(screen.getByRole("button", { name: `选择分类：${category}` })).toHaveStyle({ flexBasis: "22%" });
      expect(screen.getByTestId(`quick-category-icon-${category}`)).toBeOnTheScreen();
    }
    fireEvent.press(screen.getByRole("button", { name: "选择分类：工资" }));
    fireEvent.press(screen.getByRole("button", { name: "输入金额 2" }));
    fireEvent.press(screen.getByRole("button", { name: "输入金额 7" }));
    fireEvent.press(screen.getByRole("button", { name: "输入金额 0" }));
    fireEvent.press(screen.getByRole("button", { name: "输入金额 0" }));
    fireEvent.press(screen.getByRole("button", { name: "完成记账" }));

    expect(loadFinanceTransactions(storage)).toEqual([
      expect.objectContaining({ amount: "2700.00", categoryName: "工资", transactionType: "income" })
    ]);
  });

  it("shows a single monthly summary balance card instead of separate metric cards", () => {
    render(<FinancePanel storage={makeStorage()} />);

    expect(screen.queryByText("本月总结")).toBeNull();
    expect(screen.queryByText("收入与支出概览")).toBeNull();
    expect(screen.getByTestId("finance-summary-panel")).toBeOnTheScreen();
    expect(screen.queryByTestId("finance-monthly-overview-card")).toBeNull();
    expect(screen.getAllByText("本月结余").length).toBeGreaterThan(0);
    expect(screen.queryByText("今日支出")).toBeNull();
    expect(screen.queryByText("今日收入")).toBeNull();
    expect(screen.getByTestId("finance-metric-本月结余")).toBeOnTheScreen();
    expect(screen.getAllByText(/收入 ¥0\.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/支出 ¥0\.00/).length).toBeGreaterThan(0);
    expect(screen.getByText("本月分类占比")).toBeOnTheScreen();
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
    expect(screen.getAllByText("¥1500000.00").length).toBeGreaterThan(0);
  });

  it("deletes transactions from the compact statement list and recalculates summaries", async () => {
    const storage = makeStorage();
    const today = new Date().toISOString().slice(0, 10);
    saveFinanceTransactions(
      [
        {
          amount: "25.50",
          categoryName: "餐饮",
          createTime: `${today}T08:10:00.000Z`,
          id: "expense-delete",
          localDate: today,
          note: "午饭",
          transactionType: "expense"
        }
      ],
      storage
    );

    render(<FinancePanel storage={storage} />);

    expect(screen.getByText("-¥25.50")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "更多操作：餐饮" }));
    fireEvent.press(screen.getByRole("button", { name: "删除账单：餐饮" }));

    await waitFor(() => expect(screen.queryByText("-¥25.50")).toBeNull());
    expect(screen.getAllByText("¥0.00").length).toBeGreaterThanOrEqual(1);
  });

  it("redesigns saving as overview, segmented deposit form, compact details, and trend", () => {
    const storage = makeStorage();
    const today = new Date().toISOString().slice(0, 10);
    saveSavingEntries(
      [
        { amount: "500.00", createTime: `${today}T10:00:00.000Z`, financeTransactionId: "finance-saving-1", id: "saving-1", localDate: today, note: "工资到账先存一点", type: "deposit" },
        { amount: "200.00", createTime: `${today}T09:00:00.000Z`, financeTransactionId: "finance-saving-2", id: "saving-2", localDate: today, note: "临时取用", type: "withdraw" }
      ],
      storage
    );
    saveFinanceTransactions(
      [
        { amount: "500.00", categoryName: "储蓄", createTime: `${today}T10:00:00.000Z`, id: "finance-saving-1", localDate: today, note: "工资到账先存一点", savingEntryId: "saving-1", transactionType: "expense" },
        { amount: "200.00", categoryName: "储蓄取出", createTime: `${today}T09:00:00.000Z`, id: "finance-saving-2", localDate: today, note: "临时取用", savingEntryId: "saving-2", transactionType: "income" }
      ],
      storage
    );

    render(<FinancePanel activeTab="saving" storage={storage} />);

    expect(screen.queryByTestId("finance-balance-summary")).toBeNull();
    expect(screen.getByTestId("saving-overview-card")).toBeOnTheScreen();
    expect(screen.getByText("当前储蓄")).toBeOnTheScreen();
    expect(screen.getAllByText("¥300.00").length).toBeGreaterThan(0);
    expect(screen.getByText("本月存入")).toBeOnTheScreen();
    expect(screen.getByText("本月取出")).toBeOnTheScreen();
    expect(screen.getByText("本月净存")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "存入" })).toHaveStyle({ flex: 1 });
    expect(screen.getByRole("button", { name: "取出" })).toHaveStyle({ flex: 1 });
    expect(screen.getByTestId("saving-detail-list-deposit")).toBeOnTheScreen();
    expect(screen.getByText("存入明细")).toBeOnTheScreen();
    expect(screen.getByTestId("saving-entry-row-saving-1")).toHaveStyle({ minHeight: 56 });
    expect(screen.getByText("+¥500.00")).toBeOnTheScreen();
    expect(screen.getByTestId("saving-trend-card")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "取出" }));

    expect(screen.getByTestId("saving-detail-list-withdraw")).toBeOnTheScreen();
    expect(screen.getByText("取出明细")).toBeOnTheScreen();
    expect(screen.getByText("-¥200.00")).toBeOnTheScreen();
    expect(screen.queryByText("+¥500.00")).toBeNull();
  });

  it("keeps saving deposit and withdrawal linked to one finance transaction and supports delete", () => {
    const storage = makeStorage();
    render(<FinancePanel activeTab="saving" storage={storage} />);

    fireEvent.changeText(screen.getByPlaceholderText("¥0.00"), "300");
    fireEvent.changeText(screen.getByPlaceholderText("添加备注（可选）"), "本月存款");
    fireEvent.press(screen.getByRole("button", { name: "确认存入" }));

    let savings = loadSavingEntries(storage);
    let transactions = loadFinanceTransactions(storage);
    expect(savings).toHaveLength(1);
    expect(transactions).toHaveLength(1);
    expect(savings[0]).toEqual(expect.objectContaining({ amount: "300.00", type: "deposit", financeTransactionId: transactions[0].id }));
    expect(transactions[0]).toEqual(expect.objectContaining({ amount: "300.00", categoryName: "储蓄", savingEntryId: savings[0].id, transactionType: "expense" }));
    expect(screen.getByText("已存入 ¥300.00")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "取出" }));
    fireEvent.changeText(screen.getByPlaceholderText("¥0.00"), "200");
    fireEvent.changeText(screen.getByPlaceholderText("添加备注（可选）"), "临时取用");
    fireEvent.press(screen.getByRole("button", { name: "确认取出" }));

    savings = loadSavingEntries(storage);
    transactions = loadFinanceTransactions(storage);
    expect(savings).toHaveLength(2);
    expect(transactions).toHaveLength(2);
    expect(transactions[0]).toEqual(expect.objectContaining({ amount: "200.00", categoryName: "储蓄取出", savingEntryId: savings[0].id, transactionType: "income" }));
    expect(screen.getAllByText("¥100.00").length).toBeGreaterThan(0);

    fireEvent.press(screen.getByTestId(`saving-entry-menu-${savings[0].id}`));
    fireEvent.press(screen.getByRole("button", { name: "删除储蓄记录" }));
    expect(screen.getByText("确定删除这条储蓄记录吗？")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "确认删除储蓄记录" }));

    expect(loadSavingEntries(storage)).toHaveLength(1);
    expect(loadFinanceTransactions(storage)).toHaveLength(1);
    expect(screen.getAllByText("¥300.00").length).toBeGreaterThan(0);
  });
});
