import { buildFinanceSummary, buildGiftContactSummary, buildMonthlyFinanceOverview, planGiftFinanceSync } from "@/features/finance/financeService";

const julyTransactions = [
  { amount: "30.50", categoryName: "餐饮", giftRecordId: null, id: "t1", localDate: "2026-07-30", transactionType: "expense" as const },
  { amount: "12.30", categoryName: "交通", giftRecordId: null, id: "t2", localDate: "2026-07-30", transactionType: "expense" as const },
  { amount: "500.00", categoryName: "工资", giftRecordId: null, id: "t3", localDate: "2026-07-30", transactionType: "income" as const },
  { amount: "100.00", categoryName: "份子", giftRecordId: "g1", id: "t4", localDate: "2026-07-15", transactionType: "expense" as const },
  { amount: "120.00", categoryName: "餐饮", giftRecordId: null, id: "t5", localDate: "2026-07-01", transactionType: "expense" as const },
  { amount: "80.00", categoryName: "娱乐", giftRecordId: null, id: "t6", localDate: "2026-06-20", transactionType: "expense" as const },
  { amount: "300.00", categoryName: "兼职", giftRecordId: null, id: "t7", localDate: "2026-06-18", transactionType: "income" as const }
];

describe("Task 5 finance service", () => {
  it("calculates daily, monthly, budget, trend, category, and comparison totals with decimal strings", () => {
    const summary = buildFinanceSummary({
      budgets: [{ amount: "400.00", categoryName: null, month: "2026-07" }],
      now: "2026-07-30",
      transactions: julyTransactions
    });

    expect(summary.todayExpense).toBe("42.80");
    expect(summary.todayIncome).toBe("500.00");
    expect(summary.monthExpense).toBe("262.80");
    expect(summary.monthIncome).toBe("500.00");
    expect(summary.monthBalance).toBe("237.20");
    expect(summary.monthNet).toBe("237.20");
    expect(summary.monthBudgetRemaining).toBe("137.20");
    expect(summary.last7DaysExpense).toBe("42.80");
    expect(summary.last30DaysExpense).toBe("262.80");
    expect(summary.categoryShares).toEqual([
      { amount: "150.50", categoryName: "餐饮", ratio: 0.5727 },
      { amount: "100.00", categoryName: "份子", ratio: 0.3805 },
      { amount: "12.30", categoryName: "交通", ratio: 0.0468 }
    ]);
    expect(summary.monthComparison).toEqual({
      currentExpense: "262.80",
      currentIncome: "500.00",
      previousExpense: "80.00",
      previousIncome: "300.00"
    });
  });

  it("prevents duplicate gift finance sync plans", () => {
    expect(planGiftFinanceSync({ existingTransactionGiftIds: ["g1"], giftRecordId: "g1" })).toEqual({ shouldCreate: false });
    expect(planGiftFinanceSync({ existingTransactionGiftIds: ["g1"], giftRecordId: "g2" })).toEqual({ categoryName: "份子", shouldCreate: true, transactionType: "expense" });
  });

  it("builds a selected-month overview with month-over-month labels and category shares", () => {
    const overview = buildMonthlyFinanceOverview({
      initialBalance: "100.00",
      now: "2026-08-10",
      selectedMonth: "2026-08",
      transactions: [
        { amount: "500.00", categoryName: "工资", giftRecordId: null, id: "aug-income", localDate: "2026-08-01", transactionType: "income" },
        { amount: "120.00", categoryName: "餐饮", giftRecordId: null, id: "aug-food", localDate: "2026-08-02", transactionType: "expense" },
        { amount: "80.00", categoryName: "出行", giftRecordId: null, id: "aug-travel", localDate: "2026-08-03", transactionType: "expense" },
        { amount: "400.00", categoryName: "工资", giftRecordId: null, id: "jul-income", localDate: "2026-07-01", transactionType: "income" },
        { amount: "500.00", categoryName: "餐饮", giftRecordId: null, id: "jul-food", localDate: "2026-07-02", transactionType: "expense" }
      ]
    });

    expect(overview.monthLabel).toBe("2026年8月");
    expect(overview.income.amount).toBe("500.00");
    expect(overview.expense.amount).toBe("200.00");
    expect(overview.balance.amount).toBe("300.00");
    expect(overview.balance.label).toBe("当前余额");
    expect(overview.monthNet.amount).toBe("300.00");
    expect(overview.income.comparison).toEqual({ label: "较上月 ↑ 25.0%", tone: "up" });
    expect(overview.expense.comparison).toEqual({ label: "较上月 ↓ 60.0%", tone: "down" });
    expect(overview.categoryShares).toEqual([
      { amount: "120.00", categoryName: "餐饮", ratio: 0.6 },
      { amount: "80.00", categoryName: "出行", ratio: 0.4 }
    ]);
  });

  it("handles cross-year previous month and unavailable comparison data", () => {
    const overview = buildMonthlyFinanceOverview({
      initialBalance: "0.00",
      now: "2027-01-10",
      selectedMonth: "2027-01",
      transactions: [
        { amount: "100.00", categoryName: "工资", giftRecordId: null, id: "jan-income", localDate: "2027-01-05", transactionType: "income" },
        { amount: "20.00", categoryName: "餐饮", giftRecordId: null, id: "jan-food", localDate: "2027-01-05", transactionType: "expense" },
        { amount: "0.00", categoryName: "工资", giftRecordId: null, id: "dec-zero-income", localDate: "2026-12-05", transactionType: "income" }
      ]
    });

    expect(overview.previousMonth).toBe("2026-12");
    expect(overview.income.comparison).toEqual({ label: "暂无可比数据", tone: "muted" });
    expect(overview.expense.comparison).toEqual({ label: "暂无上月数据", tone: "muted" });
    expect(overview.monthNet.comparison).toEqual({ label: "暂无可比数据", tone: "muted" });
  });

  it("keeps total balance continuous across months while monthly net resets naturally", () => {
    const transactions = [
      { amount: "6000.00", categoryName: "工资", giftRecordId: null, id: "aug-income", localDate: "2026-08-15", transactionType: "income" as const },
      { amount: "4000.00", categoryName: "餐饮", giftRecordId: null, id: "aug-expense", localDate: "2026-08-20", transactionType: "expense" as const },
      { amount: "100.00", categoryName: "餐饮", giftRecordId: null, id: "sep-food", localDate: "2026-09-01", transactionType: "expense" as const },
      { amount: "6000.00", categoryName: "工资", giftRecordId: null, id: "sep-income", localDate: "2026-09-15", transactionType: "income" as const }
    ];

    const august = buildMonthlyFinanceOverview({ initialBalance: "1000.00", now: "2026-09-01", selectedMonth: "2026-08", transactions });
    const septemberBeforeSalary = buildMonthlyFinanceOverview({ initialBalance: "1000.00", now: "2026-09-01", selectedMonth: "2026-09", transactions: transactions.slice(0, 3) });
    const septemberAfterSalary = buildMonthlyFinanceOverview({ initialBalance: "1000.00", now: "2026-09-15", selectedMonth: "2026-09", transactions });

    expect(august.balance.label).toBe("月末余额");
    expect(august.income.amount).toBe("6000.00");
    expect(august.expense.amount).toBe("4000.00");
    expect(august.monthNet.amount).toBe("2000.00");
    expect(august.balance.amount).toBe("3000.00");

    expect(septemberBeforeSalary.balance.label).toBe("当前余额");
    expect(septemberBeforeSalary.balance.amount).toBe("2900.00");
    expect(septemberBeforeSalary.income.amount).toBe("0.00");
    expect(septemberBeforeSalary.expense.amount).toBe("100.00");
    expect(septemberBeforeSalary.monthNet.amount).toBe("-100.00");

    expect(septemberAfterSalary.balance.amount).toBe("8900.00");
    expect(septemberAfterSalary.income.amount).toBe("6000.00");
    expect(septemberAfterSalary.expense.amount).toBe("100.00");
    expect(septemberAfterSalary.monthNet.amount).toBe("5900.00");
  });

  it("excludes saving transfers from total balance, income, expense, category share, and largest expense", () => {
    const baseTransactions = [
      { amount: "6000.00", categoryName: "工资", giftRecordId: null, id: "sep-income", localDate: "2026-09-15", transactionType: "income" as const },
      { amount: "100.00", categoryName: "餐饮", giftRecordId: null, id: "sep-food", localDate: "2026-09-01", transactionType: "expense" as const },
      { amount: "500.00", categoryName: "储蓄", giftRecordId: null, id: "saving-deposit", localDate: "2026-09-16", savingEntryId: "saving-1", transactionType: "expense" as const },
      { amount: "300.00", categoryName: "储蓄取出", giftRecordId: null, id: "saving-withdraw", localDate: "2026-09-17", savingEntryId: "saving-2", transactionType: "income" as const }
    ];
    const withTrueExpense = [
      ...baseTransactions,
      { amount: "50.00", categoryName: "餐饮", giftRecordId: null, id: "sep-food-2", localDate: "2026-09-18", transactionType: "expense" as const }
    ];

    const afterTransfers = buildMonthlyFinanceOverview({ initialBalance: "3000.00", now: "2026-09-17", selectedMonth: "2026-09", transactions: baseTransactions });
    const afterTrueExpense = buildMonthlyFinanceOverview({ initialBalance: "3000.00", now: "2026-09-18", selectedMonth: "2026-09", transactions: withTrueExpense });

    expect(afterTransfers.balance.amount).toBe("8900.00");
    expect(afterTransfers.income.amount).toBe("6000.00");
    expect(afterTransfers.expense.amount).toBe("100.00");
    expect(afterTransfers.monthNet.amount).toBe("5900.00");
    expect(afterTransfers.categoryShares).toEqual([{ amount: "100.00", categoryName: "餐饮", ratio: 1 }]);
    expect(afterTransfers.maxExpense).toEqual({ amount: "100.00", categoryName: "餐饮", id: "sep-food" });

    expect(afterTrueExpense.balance.amount).toBe("8850.00");
    expect(afterTrueExpense.expense.amount).toBe("150.00");
    expect(afterTrueExpense.monthNet.amount).toBe("5850.00");
    expect(afterTrueExpense.maxExpense).toEqual({ amount: "100.00", categoryName: "餐饮", id: "sep-food" });
  });
});

describe("Task 7 gift service", () => {
  it("calculates contact totals, yearly totals, return list, and balance", () => {
    const summary = buildGiftContactSummary({
      now: "2026-07-30",
      records: [
        { amount: "200.00", contactId: "c1", direction: "sent", eventDate: "2026-05-01", needReturn: false },
        { amount: "300.00", contactId: "c1", direction: "received", eventDate: "2026-06-01", needReturn: true },
        { amount: "120.00", contactId: "c1", direction: "sent", eventDate: "2025-12-10", needReturn: false },
        { amount: "50.00", contactId: "c2", direction: "received", eventDate: "2026-01-02", needReturn: false }
      ]
    });

    expect(summary.byContact.c1).toEqual({
      balance: "100.00",
      contactId: "c1",
      totalReceived: "300.00",
      totalSent: "320.00",
      yearlyReceived: "300.00",
      yearlySent: "200.00"
    });
    expect(summary.pendingReturnContactIds).toEqual(["c1"]);
    expect(summary.yearlyTotals).toEqual({ received: "350.00", sent: "200.00" });
  });
});
