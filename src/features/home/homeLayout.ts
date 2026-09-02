/**
 * 首页卡片模型与本地持久化（折叠状态 + 排序/可见性）。
 * 顺序数组本身即「可见且有序」的列表：卡片不在数组中即视为已隐藏。
 */

export type HomeCardId = "summary" | "quickAccounting" | "today" | "meal";

export type HomeCardMeta = {
  id: HomeCardId;
  title: string;
  /** 核心模块不可隐藏（例如今日概览、快速记账、今天）。 */
  core: boolean;
};

export const HOME_CARDS: HomeCardMeta[] = [
  { id: "summary", title: "今日概览", core: true },
  { id: "quickAccounting", title: "快速记账", core: true },
  { id: "today", title: "今天", core: true },
  { id: "meal", title: "今天吃什么", core: false }
];

export const DEFAULT_ORDER: HomeCardId[] = HOME_CARDS.map((card) => card.id);

const ORDER_KEY = "fanfan-guanguan.home.order";
const COLLAPSED_KEY = "fanfan-guanguan.home.collapsed";
const KNOWN_IDS = HOME_CARDS.map((card) => card.id);

type Storage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

function readJson<T>(key: string, fallback: T): T {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* 隐私模式 / 配额满：静默降级，不阻断 UI */
  }
}

/** 读取并清洗顺序：只保留已知 id、丢弃未知项；非核心卡片缺失即视为「已隐藏」，不强行补回。 */
export function loadHomeOrder(): HomeCardId[] {
  const parsed = readJson<unknown[]>(ORDER_KEY, []);
  if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_ORDER];
  const migrated = parsed.map((id) => (id === "todos" || id === "notes" ? "today" : id));
  const filtered: HomeCardId[] = [];
  for (const id of migrated) {
    if (typeof id !== "string" || !KNOWN_IDS.includes(id as HomeCardId)) continue;
    if (!filtered.includes(id as HomeCardId)) filtered.push(id as HomeCardId);
  }
  // 核心模块不可丢失：若保存数据异常导致缺失，补回；非核心缺失 = 用户主动隐藏，保留隐藏态。
  for (const card of HOME_CARDS) {
    if (card.core && !filtered.includes(card.id)) filtered.push(card.id);
  }
  return filtered;
}

export function saveHomeOrder(order: HomeCardId[]): void {
  writeJson(ORDER_KEY, order);
}

export function loadHomeCollapsed(): Record<string, boolean> {
  return readJson<Record<string, boolean>>(COLLAPSED_KEY, {});
}

export function saveHomeCollapsed(map: Record<string, boolean>): void {
  writeJson(COLLAPSED_KEY, map);
}

/** 把 id 上移一位（与上一个交换）。已在首位则返回原数组。 */
export function moveCardUp(order: HomeCardId[], id: HomeCardId): HomeCardId[] {
  const index = order.indexOf(id);
  if (index <= 0) return order;
  const next = [...order];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  return next;
}

/** 把 id 下移一位（与下一个交换）。已在末位则返回原数组。 */
export function moveCardDown(order: HomeCardId[], id: HomeCardId): HomeCardId[] {
  const index = order.indexOf(id);
  if (index < 0 || index >= order.length - 1) return order;
  const next = [...order];
  [next[index + 1], next[index]] = [next[index], next[index + 1]];
  return next;
}

/** 隐藏 = 从顺序中移除；显示 = 追加到末尾。核心模块不可隐藏。 */
export function toggleCardHidden(order: HomeCardId[], id: HomeCardId): HomeCardId[] {
  const meta = HOME_CARDS.find((card) => card.id === id);
  if (meta?.core) return order;
  if (order.includes(id)) return order.filter((item) => item !== id);
  return [...order, id];
}
