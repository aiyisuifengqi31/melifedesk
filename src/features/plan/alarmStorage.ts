import { hydrateFromCloud, saveCloudValue } from "@/features/sync/cloudSync";

export type AlarmItem = {
  enabled: boolean;
  id: string;
  label: string;
  repeat: number[];
  time: string;
};

export const ALARM_STORAGE_KEY = "fanfan-guanguan.plan.alarms.v1";

type AlarmStorage = {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

let memoryAlarms: string | null = null;

const memoryStorage: AlarmStorage = {
  getItem: (key) => (key === ALARM_STORAGE_KEY ? memoryAlarms : null),
  removeItem: (key) => {
    if (key === ALARM_STORAGE_KEY) {
      memoryAlarms = null;
    }
  },
  setItem: (key, value) => {
    if (key === ALARM_STORAGE_KEY) {
      memoryAlarms = value;
    }
  }
};

export function getDefaultAlarmStorage(): AlarmStorage {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return memoryStorage;
}

export function loadAlarms(storage: AlarmStorage = getDefaultAlarmStorage()): AlarmItem[] {
  const raw = storage.getItem(ALARM_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as AlarmItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((alarm) => typeof alarm.id === "string" && typeof alarm.time === "string")
      .map((alarm) => ({
        enabled: Boolean(alarm.enabled),
        id: alarm.id,
        label: typeof alarm.label === "string" ? alarm.label : "闹钟",
        repeat: Array.isArray(alarm.repeat) ? alarm.repeat.filter((d) => typeof d === "number") : [],
        time: alarm.time
      }));
  } catch {
    return [];
  }
}

export function saveAlarms(alarms: AlarmItem[], storage: AlarmStorage = getDefaultAlarmStorage()) {
  storage.setItem(ALARM_STORAGE_KEY, JSON.stringify(alarms));
  void saveCloudValue(ALARM_STORAGE_KEY, alarms);
}

export async function hydrateAlarmsFromCloud(storage: AlarmStorage = getDefaultAlarmStorage()): Promise<AlarmItem[]> {
  const local = loadAlarms(storage);
  return hydrateFromCloud<AlarmItem[]>(ALARM_STORAGE_KEY, local, (value) => saveAlarms(value, storage));
}

export function createAlarmId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `alarm-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const WEEK_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export function weekLabel(day: number): string {
  return WEEK_LABELS[day] ?? "";
}

export function repeatLabel(repeat: number[]): string {
  if (repeat.length === 0) {
    return "不重复";
  }
  if (repeat.length === 7) {
    return "每天";
  }
  if (repeat.length === 5 && repeat.every((d) => d >= 1 && d <= 5)) {
    return "工作日";
  }
  if (repeat.length === 2 && repeat.includes(0) && repeat.includes(6)) {
    return "周末";
  }
  return repeat
    .slice()
    .sort((a, b) => a - b)
    .map(weekLabel)
    .join("");
}
