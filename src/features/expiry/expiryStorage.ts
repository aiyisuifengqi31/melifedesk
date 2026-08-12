/**
 * 到期提醒 —— 本地优先存储（镜像 reminderStorage）。
 *
 * 个人数据：键前缀 `fanfan-guanguan.`，切换账号时由 localScope.purgeLocalScope()
 * 清空该前缀下所有键，天然实现「仅当前登录用户本人可见」（spec 十八）。
 * 登录且已配置 Supabase 时，fire-and-forget 同步到云端 user_kv（带 RLS）。
 */
import { hydrateFromCloud, saveCloudValue } from "@/features/sync/cloudSync";

import type { ExpiryItem } from "./expiryUtils";

export type { ExpiryItem } from "./expiryUtils";

export const EXPIRY_STORAGE_KEY = "fanfan-guanguan.expiry.v1";

type ExpiryStorage = {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

let memoryExpiry: string | null = null;

const memoryStorage: ExpiryStorage = {
  getItem: (key) => (key === EXPIRY_STORAGE_KEY ? memoryExpiry : null),
  removeItem: (key) => {
    if (key === EXPIRY_STORAGE_KEY) memoryExpiry = null;
  },
  setItem: (key, value) => {
    if (key === EXPIRY_STORAGE_KEY) memoryExpiry = value;
  }
};

export function getDefaultExpiryStorage(): ExpiryStorage {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return memoryStorage;
}

export function loadExpiryItems(storage: ExpiryStorage = getDefaultExpiryStorage()): ExpiryItem[] {
  const raw = storage.getItem(EXPIRY_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as ExpiryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) => typeof item.id === "string" && typeof item.title === "string" && typeof item.expiryDate === "string" && typeof item.category === "string"
    );
  } catch {
    return [];
  }
}

export function saveExpiryItems(items: ExpiryItem[], storage: ExpiryStorage = getDefaultExpiryStorage()) {
  storage.setItem(EXPIRY_STORAGE_KEY, JSON.stringify(items));
  void saveCloudValue(EXPIRY_STORAGE_KEY, items);
}

export async function hydrateExpiryFromCloud(storage: ExpiryStorage = getDefaultExpiryStorage()): Promise<ExpiryItem[]> {
  const local = loadExpiryItems(storage);
  return hydrateFromCloud<ExpiryItem[]>(EXPIRY_STORAGE_KEY, local, (value) => saveExpiryItems(value, storage));
}

export function createExpiryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `expiry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function clearExpiryForTests(storage: ExpiryStorage = memoryStorage) {
  storage.removeItem(EXPIRY_STORAGE_KEY);
  memoryExpiry = null;
}
