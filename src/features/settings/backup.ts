export const BACKUP_PREFIX = "fanfan-guanguan.";
export const BACKUP_VERSION = 1;

export type BackupPayload = {
  app: "fanfan-guanguan";
  version: number;
  exportedAt: string;
  data: Record<string, string>;
};

export function collectBackupData(storage?: Storage): Record<string, string> {
  const target = storage ?? (typeof window === "undefined" ? undefined : window.localStorage);
  if (!target) {
    return {};
  }

  const data: Record<string, string> = {};
  for (let index = 0; index < target.length; index += 1) {
    const key = target.key(index);
    if (key && key.startsWith(BACKUP_PREFIX)) {
      const value = target.getItem(key);
      if (typeof value === "string") {
        data[key] = value;
      }
    }
  }

  return data;
}

export function buildBackupPayload(storage?: Storage): BackupPayload {
  return {
    app: "fanfan-guanguan",
    data: collectBackupData(storage),
    exportedAt: new Date().toISOString(),
    version: BACKUP_VERSION
  };
}

export function parseBackupPayload(raw: string): BackupPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<BackupPayload>;
    if (!parsed || parsed.app !== "fanfan-guanguan" || typeof parsed.data !== "object" || parsed.data === null) {
      return null;
    }

    const data: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (key.startsWith(BACKUP_PREFIX) && typeof value === "string") {
        data[key] = value;
      }
    }

    return {
      app: "fanfan-guanguan",
      data,
      exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : new Date().toISOString(),
      version: typeof parsed.version === "number" ? parsed.version : BACKUP_VERSION
    };
  } catch {
    return null;
  }
}

export function applyBackupPayload(payload: BackupPayload, storage?: Storage): number {
  const target = storage ?? (typeof window === "undefined" ? undefined : window.localStorage);
  if (!target) {
    return 0;
  }

  let count = 0;
  for (const [key, value] of Object.entries(payload.data)) {
    target.setItem(key, value);
    count += 1;
  }

  return count;
}

export function clearLocalData(storage?: Storage): number {
  const target = storage ?? (typeof window === "undefined" ? undefined : window.localStorage);
  if (!target) {
    return 0;
  }

  const keys = Object.keys(collectBackupData(target));
  for (const key of keys) {
    target.removeItem(key);
  }

  return keys.length;
}

export function downloadBackupFile(payload: BackupPayload) {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    return;
  }

  const stamp = payload.exportedAt.slice(0, 19).replace(/[:T]/g, "-");
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `生活工作台备份-${stamp}.json`;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function openBackupFilePicker(onLoaded: (raw: string) => void) {
  if (typeof document === "undefined") {
    return;
  }

  const input = document.createElement("input");
  input.accept = "application/json,.json";
  input.type = "file";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onLoaded(reader.result);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

export function describeBackupSize(data: Record<string, string>): string {
  const bytes = Object.entries(data).reduce((sum, [key, value]) => sum + key.length + value.length, 0);
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const BACKUP_KEY_LABELS: Record<string, string> = {
  "fanfan-guanguan.color_mode": "深浅色偏好",
  "fanfan-guanguan.couple.v1": "伴侣绑定",
  "fanfan-guanguan.exam.study.v1": "学习时长",
  "fanfan-guanguan.finance.v1": "收支记账",
  "fanfan-guanguan.home.notes.v1": "首页便签",
  "fanfan-guanguan.packages.v1": "快递记录",
  "fanfan-guanguan.plan.alarms.v1": "提醒设置",
  "fanfan-guanguan.profile.v1": "个人资料",
  "fanfan-guanguan.theme_id": "主题",
  "fanfan-guanguan.todos.v1": "待办事项",
  "fanfan-guanguan.workouts.v1": "运动记录"
};

export function labelForBackupKey(key: string): string {
  return BACKUP_KEY_LABELS[key] ?? key.replace(BACKUP_PREFIX, "");
}
