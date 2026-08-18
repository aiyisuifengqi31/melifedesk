export type TransactionType = "expense" | "income";

export type FinanceTransactionForStats = {
  amount: string;
  categoryName: string;
  giftRecordId: string | null;
  id: string;
  localDate: string;
  transactionType: TransactionType;
};

export type FinanceBudgetForStats = {
  amount: string;
  categoryName: string | null;
  month: string;
};

export type GiftRecordForStats = {
  amount: string;
  contactId: string;
  direction: "sent" | "received";
  eventDate: string;
  needReturn: boolean;
};

type FinanceSummaryInput = {
  budgets: FinanceBudgetForStats[];
  now: string;
  transactions: FinanceTransactionForStats[];
};

type MonthlyFinanceOverviewInput = {
  selectedMonth: string;
  transactions: FinanceTransactionForStats[];
};

export type MonthComparisonTone = "down" | "flat" | "muted" | "up";

export type MonthComparisonResult = {
  label: string;
  tone: MonthComparisonTone;
};

type GiftSummaryInput = {
  now: string;
  records: GiftRecordForStats[];
};

function parseMoneyToCents(value: string) {
  const normalized = value.trim();
  const sign = normalized.startsWith("-") ? -1 : 1;
  const unsigned = normalized.replace(/^-/, "");
  const [whole = "0", fraction = ""] = unsigned.split(".");
  return sign * (Number.parseInt(whole || "0", 10) * 100 + Number.parseInt(fraction.padEnd(2, "0").slice(0, 2) || "0", 10));
}

function formatCents(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function previousMonthKey(currentMonth: string) {
  const [year, month] = currentMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function daysBetween(left: string, right: string) {
  const leftDate = new Date(`${left}T00:00:00Z`);
  const rightDate = new Date(`${right}T00:00:00Z`);
  return Math.floor((rightDate.getTime() - leftDate.getTime()) / 86_400_000);
}

function sumTransactions(transactions: FinanceTransactionForStats[], predicate: (transaction: FinanceTransactionForStats) => boolean) {
  return transactions.filter(predicate).reduce((sum, transaction) => sum + parseMoneyToCents(transaction.amount), 0);
}

export function buildFinanceSummary({ budgets, now, transactions }: FinanceSummaryInput) {
  const currentMonth = monthKey(now);
  const previousMonth = previousMonthKey(currentMonth);
  const currentMonthTransactions = transactions.filter((transaction) => monthKey(transaction.localDate) === currentMonth);
  const currentExpenseCents = sumTransactions(currentMonthTransactions, (transaction) => transaction.transactionType === "expense");
  const currentIncomeCents = sumTransactions(currentMonthTransactions, (transaction) => transaction.transactionType === "income");
  const budgetCents = budgets.filter((budget) => budget.month === currentMonth).reduce((sum, budget) => sum + parseMoneyToCents(budget.amount), 0);
  const categoryTotals = new Map<string, number>();

  for (const transaction of currentMonthTransactions) {
    if (transaction.transactionType === "expense") {
      categoryTotals.set(transaction.categoryName, (categoryTotals.get(transaction.categoryName) ?? 0) + parseMoneyToCents(transaction.amount));
    }
  }

  const categoryShares = [...categoryTotals.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([categoryName, cents]) => ({
      amount: formatCents(cents),
      categoryName,
      ratio: currentExpenseCents === 0 ? 0 : Number((cents / currentExpenseCents).toFixed(4))
    }));

  return {
    categoryShares,
    last30DaysExpense: formatCents(sumTransactions(transactions, (transaction) => transaction.transactionType === "expense" && daysBetween(transaction.localDate, now) >= 0 && daysBetween(transaction.localDate, now) < 30)),
    last7DaysExpense: formatCents(sumTransactions(transactions, (transaction) => transaction.transactionType === "expense" && daysBetween(transaction.localDate, now) >= 0 && daysBetween(transaction.localDate, now) < 7)),
    monthBalance: formatCents(currentIncomeCents - currentExpenseCents),
    monthBudgetRemaining: formatCents(budgetCents - currentExpenseCents),
    monthComparison: {
      currentExpense: formatCents(currentExpenseCents),
      currentIncome: formatCents(currentIncomeCents),
      previousExpense: formatCents(sumTransactions(transactions, (transaction) => monthKey(transaction.localDate) === previousMonth && transaction.transactionType === "expense")),
      previousIncome: formatCents(sumTransactions(transactions, (transaction) => monthKey(transaction.localDate) === previousMonth && transaction.transactionType === "income"))
    },
    monthExpense: formatCents(currentExpenseCents),
    monthIncome: formatCents(currentIncomeCents),
    todayExpense: formatCents(sumTransactions(transactions, (transaction) => transaction.localDate === now && transaction.transactionType === "expense")),
    todayIncome: formatCents(sumTransactions(transactions, (transaction) => transaction.localDate === now && transaction.transactionType === "income"))
  };
}

export function buildMonthlyFinanceOverview({ selectedMonth, transactions }: MonthlyFinanceOverviewInput) {
  const previousMonth = previousMonthKey(selectedMonth);
  const currentTransactions = transactions.filter((transaction) => monthKey(transaction.localDate) === selectedMonth);
  const previousTransactions = transactions.filter((transaction) => monthKey(transaction.localDate) === previousMonth);
  const expenseCents = sumTransactions(currentTransactions, (transaction) => transaction.transactionType === "expense");
  const incomeCents = sumTransactions(currentTransactions, (transaction) => transaction.transactionType === "income");
  const previousExpenseCents = sumTransactions(previousTransactions, (transaction) => transaction.transactionType === "expense");
  const previousIncomeCents = sumTransactions(previousTransactions, (transaction) => transaction.transactionType === "income");
  const balanceCents = incomeCents - expenseCents;
  const previousBalanceCents = previousIncomeCents - previousExpenseCents;
  const categoryTotals = new Map<string, number>();

  for (const transaction of currentTransactions) {
    if (transaction.transactionType === "expense") {
      categoryTotals.set(transaction.categoryName, (categoryTotals.get(transaction.categoryName) ?? 0) + parseMoneyToCents(transaction.amount));
    }
  }

  const categoryShares = [...categoryTotals.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([categoryName, cents]) => ({
      amount: formatCents(cents),
      categoryName,
      ratio: expenseCents === 0 ? 0 : Number((cents / expenseCents).toFixed(4))
    }));

  return {
    balance: {
      amount: formatCents(balanceCents),
      comparison: compareMonthValue(balanceCents, previousBalanceCents, previousTransactions.length, true)
    },
    categoryShares,
    expense: {
      amount: formatCents(expenseCents),
      comparison: compareMonthValue(expenseCents, previousExpenseCents, previousTransactions.filter((transaction) => transaction.transactionType === "expense").length)
    },
    income: {
      amount: formatCents(incomeCents),
      comparison: compareMonthValue(incomeCents, previousIncomeCents, previousTransactions.filter((transaction) => transaction.transactionType === "income").length)
    },
    monthLabel: formatMonthKeyLabel(selectedMonth),
    previousMonth
  };
}

function compareMonthValue(currentCents: number, previousCents: number, previousRecordCount: number, allowSignTransition = false): MonthComparisonResult {
  if (previousRecordCount === 0) return { label: "暂无上月数据", tone: "muted" };
  if (previousCents === 0) return { label: "暂无可比数据", tone: "muted" };

  if (allowSignTransition) {
    if (previousCents < 0 && currentCents >= 0) return { label: "较上月 由负转正", tone: "up" };
    if (previousCents >= 0 && currentCents < 0) return { label: "较上月 由正转负", tone: "down" };
  }

  const change = ((currentCents - previousCents) / Math.abs(previousCents)) * 100;
  if (change === 0) return { label: "较上月 0.0%", tone: "flat" };
  return {
    label: `较上月 ${change > 0 ? "↑" : "↓"} ${Math.abs(change).toFixed(1)}%`,
    tone: change > 0 ? "up" : "down"
  };
}

function formatMonthKeyLabel(month: string) {
  const [year, value] = month.split("-");
  return `${year}年${Number(value)}月`;
}

export function planGiftFinanceSync({ existingTransactionGiftIds, giftRecordId }: { existingTransactionGiftIds: string[]; giftRecordId: string }) {
  if (existingTransactionGiftIds.includes(giftRecordId)) {
    return { shouldCreate: false };
  }

  return {
    categoryName: "份子",
    shouldCreate: true,
    transactionType: "expense" as const
  };
}

export function buildGiftContactSummary({ now, records }: GiftSummaryInput) {
  const year = now.slice(0, 4);
  const byContact: Record<string, { balance: string; contactId: string; totalReceived: string; totalSent: string; yearlyReceived: string; yearlySent: string }> = {};
  const pendingReturnContactIds = new Set<string>();
  let yearlyReceivedCents = 0;
  let yearlySentCents = 0;

  for (const record of records) {
    const current = byContact[record.contactId] ?? {
      balance: "0.00",
      contactId: record.contactId,
      totalReceived: "0.00",
      totalSent: "0.00",
      yearlyReceived: "0.00",
      yearlySent: "0.00"
    };
    const amount = parseMoneyToCents(record.amount);
    const isCurrentYear = record.eventDate.startsWith(year);
    const totalSent = parseMoneyToCents(current.totalSent) + (record.direction === "sent" ? amount : 0);
    const totalReceived = parseMoneyToCents(current.totalReceived) + (record.direction === "received" ? amount : 0);
    const contactYearlySent = parseMoneyToCents(current.yearlySent) + (isCurrentYear && record.direction === "sent" ? amount : 0);
    const contactYearlyReceived = parseMoneyToCents(current.yearlyReceived) + (isCurrentYear && record.direction === "received" ? amount : 0);

    if (isCurrentYear && record.direction === "sent") yearlySentCents += amount;
    if (isCurrentYear && record.direction === "received") yearlyReceivedCents += amount;
    if (record.needReturn) pendingReturnContactIds.add(record.contactId);

    byContact[record.contactId] = {
      balance: formatCents(contactYearlyReceived - contactYearlySent),
      contactId: record.contactId,
      totalReceived: formatCents(totalReceived),
      totalSent: formatCents(totalSent),
      yearlyReceived: formatCents(contactYearlyReceived),
      yearlySent: formatCents(contactYearlySent)
    };
  }

  return {
    byContact,
    pendingReturnContactIds: [...pendingReturnContactIds].sort(),
    yearlyTotals: {
      received: formatCents(yearlyReceivedCents),
      sent: formatCents(yearlySentCents)
    }
  };
}
