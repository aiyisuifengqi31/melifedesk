import { hydrateFromCloud, saveCloudValue } from "@/features/sync/cloudSync";

export type ReminderItem = {
  createTime: string;
  date: string;
  id: string;
  time?: string | null;
  title: string;
};

export type ReminderStorage = {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

export const REMINDER_STORAGE_KEY = "fanfan-guanguan.reminders.v1";

let memoryReminders: string | null = null;

const memoryStorage: ReminderStorage = {
  getItem: (key) => (key === REMINDER_STORAGE_KEY ? memoryReminders : null),
  removeItem: (key) => {
    if (key === REMINDER_STORAGE_KEY) {
      memoryReminders = null;
    }
  },
  setItem: (key, value) => {
    if (key === REMINDER_STORAGE_KEY) {
      memoryReminders = value;
    }
  }
};

export function getDefaultReminderStorage(): ReminderStorage {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return memoryStorage;
}

export function loadReminders(storage: ReminderStorage = getDefaultReminderStorage()): ReminderItem[] {
  const raw = storage.getItem(REMINDER_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as ReminderItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item.id === "string" && typeof item.title === "string" && typeof item.date === "string");
  } catch {
    return [];
  }
}

export function saveReminders(items: ReminderItem[], storage: ReminderStorage = getDefaultReminderStorage()) {
  storage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(items));
  void saveCloudValue(REMINDER_STORAGE_KEY, items);
}

export async function hydrateRemindersFromCloud(storage: ReminderStorage = getDefaultReminderStorage()): Promise<ReminderItem[]> {
  const local = loadReminders(storage);
  return hydrateFromCloud<ReminderItem[]>(REMINDER_STORAGE_KEY, local, (value) => saveReminders(value, storage));
}

export function createReminderId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `reminder-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function clearRemindersForTests(storage: ReminderStorage = memoryStorage) {
  storage.removeItem(REMINDER_STORAGE_KEY);
  memoryReminders = null;
}
