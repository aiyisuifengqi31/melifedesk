import type { TransactionType } from "@/features/finance/financeService";

export type FinanceTransaction = {
  amount: string;
  categoryName: string;
  createTime: string;
  id: string;
  localDate: string;
  note: string;
  remoteId?: string | null;
  transactionType: TransactionType;
};

export type SavingEntry = {
  amount: string;
  createTime: string;
  id: string;
  localDate: string;
  note: string;
  type: "deposit" | "withdraw";
};

export type CustomCategory = {
  createTime: string;
  id: string;
  name: string;
  transactionType: TransactionType;
};

export type GiftDirection = "sent" | "received";

export type GiftRecord = {
  amount: string;
  contactName: string;
  createTime: string;
  direction: GiftDirection;
  eventDate: string;
  eventType: string;
  id: string;
  needReturn: boolean;
  note: string;
  place: string;
  syncFinance: boolean;
};

export type FinanceStorage = {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

export const FINANCE_TRANSACTIONS_KEY = "fanfan-guanguan.finance.transactions.v1";
export const FINANCE_SAVINGS_KEY = "fanfan-guanguan.finance.savings.v1";
export const FINANCE_CATEGORIES_KEY = "fanfan-guanguan.finance.categories.v1";
export const FINANCE_GIFTS_KEY = "fanfan-guanguan.finance.gifts.v1";

let memoryStore = new Map<string, string>();

const memoryStorage: FinanceStorage = {
  getItem: (key) => memoryStore.get(key) ?? null,
  removeItem: (key) => {
    memoryStore.delete(key);
  },
  setItem: (key, value) => {
    memoryStore.set(key, value);
  }
};

export function getDefaultFinanceStorage(): FinanceStorage {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return memoryStorage;
}

export function loadFinanceTransactions(storage: FinanceStorage = getDefaultFinanceStorage()) {
  return loadArray<FinanceTransaction>(storage, FINANCE_TRANSACTIONS_KEY).filter(
    (item) => typeof item.id === "string" && typeof item.amount === "string" && typeof item.localDate === "string" && (item.transactionType === "expense" || item.transactionType === "income")
  );
}

export function saveFinanceTransactions(transactions: FinanceTransaction[], storage: FinanceStorage = getDefaultFinanceStorage()) {
  storage.setItem(FINANCE_TRANSACTIONS_KEY, JSON.stringify(sortTransactions(transactions)));
}

export function loadSavingEntries(storage: FinanceStorage = getDefaultFinanceStorage()) {
  return loadArray<SavingEntry>(storage, FINANCE_SAVINGS_KEY).filter(
    (item) => typeof item.id === "string" && typeof item.amount === "string" && typeof item.localDate === "string" && (item.type === "deposit" || item.type === "withdraw")
  );
}

export function saveSavingEntries(entries: SavingEntry[], storage: FinanceStorage = getDefaultFinanceStorage()) {
  storage.setItem(FINANCE_SAVINGS_KEY, JSON.stringify(sortSavings(entries)));
}

export function loadCustomCategories(storage: FinanceStorage = getDefaultFinanceStorage()) {
  return loadArray<CustomCategory>(storage, FINANCE_CATEGORIES_KEY).filter(
    (item) => typeof item.id === "string" && typeof item.name === "string" && (item.transactionType === "expense" || item.transactionType === "income")
  );
}

export function saveCustomCategories(categories: CustomCategory[], storage: FinanceStorage = getDefaultFinanceStorage()) {
  storage.setItem(FINANCE_CATEGORIES_KEY, JSON.stringify(categories));
}

export function loadGiftRecords(storage: FinanceStorage = getDefaultFinanceStorage()) {
  return loadArray<GiftRecord>(storage, FINANCE_GIFTS_KEY).filter(
    (item) => typeof item.id === "string" && typeof item.amount === "string" && typeof item.contactName === "string" && (item.direction === "sent" || item.direction === "received")
  );
}

export function saveGiftRecords(records: GiftRecord[], storage: FinanceStorage = getDefaultFinanceStorage()) {
  storage.setItem(FINANCE_GIFTS_KEY, JSON.stringify(sortGiftRecords(records)));
}

export function sortGiftRecords(records: GiftRecord[]) {
  return [...records].sort((left, right) => {
    const dateCompare = right.eventDate.localeCompare(left.eventDate);
    return dateCompare === 0 ? right.createTime.localeCompare(left.createTime) : dateCompare;
  });
}

export function clearFinanceStorageForTests(storage: FinanceStorage = memoryStorage) {
  storage.removeItem(FINANCE_TRANSACTIONS_KEY);
  storage.removeItem(FINANCE_SAVINGS_KEY);
  storage.removeItem(FINANCE_CATEGORIES_KEY);
  storage.removeItem(FINANCE_GIFTS_KEY);
  memoryStore = new Map<string, string>();
}

export function createFinanceId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function sortTransactions(transactions: FinanceTransaction[]) {
  return [...transactions].sort((left, right) => {
    const dateCompare = right.localDate.localeCompare(left.localDate);
    return dateCompare === 0 ? right.createTime.localeCompare(left.createTime) : dateCompare;
  });
}

function sortSavings(entries: SavingEntry[]) {
  return [...entries].sort((left, right) => {
    const dateCompare = right.localDate.localeCompare(left.localDate);
    return dateCompare === 0 ? right.createTime.localeCompare(left.createTime) : dateCompare;
  });
}

function loadArray<T>(storage: FinanceStorage, key: string) {
  const raw = storage.getItem(key);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
