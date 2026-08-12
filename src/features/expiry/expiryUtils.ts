/**
 * 到期提醒 —— 纯逻辑与类型。
 * 不依赖 RN / 存储，所有函数可在单测中直接运行。
 *
 * 设计要点：
 * - 剩余天数「每天根据当前日期重新计算」，不落库为固定数字（spec 三）。
 * - 紧迫度分 6 档（spec 四）：已过期 / 今天 / 1~7 / 8~30 / 31~90 / >90。
 * - 首页与管理页统一按「越需要处理的越靠前」排序（spec 十二）。
 */

export type ExpiryCategory =
  | "id"
  | "vehicle"
  | "insurance"
  | "membership"
  | "warranty"
  | "contract"
  | "other";

export type ExpiryItem = {
  id: string;
  title: string;
  category: ExpiryCategory;
  /** 到期日期 YYYY-MM-DD。 */
  expiryDate: string;
  /** 提醒节点（天）：如 [90,30,7,1,0]。仅保存配置，推送留待后续接入（spec 十六）。 */
  reminderDays: number[];
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export const EXPIRY_CATEGORIES: { value: ExpiryCategory; label: string }[] = [
  { value: "id", label: "证件" },
  { value: "vehicle", label: "车辆" },
  { value: "insurance", label: "保险" },
  { value: "membership", label: "会员" },
  { value: "warranty", label: "保修" },
  { value: "contract", label: "合同" },
  { value: "other", label: "其他" }
];

export function categoryLabel(category: ExpiryCategory): string {
  return EXPIRY_CATEGORIES.find((entry) => entry.value === category)?.label ?? "其他";
}

export const DEFAULT_REMINDER_DAYS = [90, 30, 7, 1, 0];

export const REMINDER_NODES: { days: number; label: string }[] = [
  { days: 90, label: "提前90天" },
  { days: 30, label: "提前30天" },
  { days: 7, label: "提前7天" },
  { days: 1, label: "提前1天" },
  { days: 0, label: "到期当天" }
];

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** 剩余天数 = 到期日 - 今天（本地日界，忽略时区）。支持显式传入 today 以便单测。 */
export function daysUntil(expiryDate: string, today: string = todayIso()): number {
  const start = parseDate(today).getTime();
  const end = parseDate(expiryDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return Number.NaN;
  return Math.round((end - start) / 86400000);
}

export type ExpiryStatusLevel = "expired" | "today" | "urgent" | "soon" | "near" | "normal";

export type ExpiryStatus = {
  level: ExpiryStatusLevel;
  /** 主色：圆点 / 剩余天数文字。 */
  tone: string;
  /** 浅色底：行左条 / 标签背景，局部强调而不整卡变色（spec 十九）。 */
  soft: string;
  /** 剩余文案：「还有 28 天」/「今天到期」/「已过期 3 天」。 */
  label: string;
  /** 排序桶：数字越小越紧急。 */
  bucket: number;
};

export function expiryStatus(days: number): ExpiryStatus {
  if (days < 0) {
    return { level: "expired", tone: "#d9534f", soft: "#fbe3e3", label: `已过期 ${-days} 天`, bucket: 0 };
  }
  if (days === 0) {
    return { level: "today", tone: "#e57373", soft: "#fbe3e3", label: "今天到期", bucket: 1 };
  }
  if (days <= 7) {
    return { level: "urgent", tone: "#e57373", soft: "#fbe3e3", label: `还有 ${days} 天`, bucket: 2 };
  }
  if (days <= 30) {
    return { level: "soon", tone: "#e8975a", soft: "#fdeede", label: `还有 ${days} 天`, bucket: 3 };
  }
  if (days <= 90) {
    return { level: "near", tone: "#caa53d", soft: "#fbf3d9", label: `还有 ${days} 天`, bucket: 4 };
  }
  return { level: "normal", tone: "#3a9d5d", soft: "#e8f6ee", label: `还有 ${days} 天`, bucket: 5 };
}

/** 按紧迫度排序：已过期 → 今天 → 1~7 → 8~30 → 31~90 → >90；同桶按到期日近→远。 */
export function sortExpiryByUrgency(items: ExpiryItem[], today: string = todayIso()): ExpiryItem[] {
  return [...items].sort((a, b) => {
    const bucketA = expiryStatus(daysUntil(a.expiryDate, today)).bucket;
    const bucketB = expiryStatus(daysUntil(b.expiryDate, today)).bucket;
    if (bucketA !== bucketB) return bucketA - bucketB;
    return a.expiryDate.localeCompare(b.expiryDate);
  });
}

export type ExpiryFilter = "all" | "soon" | "expired";

/** 筛选：全部 / 即将到期(0~30天) / 已过期(<0)。 */
export function filterExpiry(items: ExpiryItem[], tab: ExpiryFilter, today: string = todayIso()): ExpiryItem[] {
  if (tab === "expired") return items.filter((item) => daysUntil(item.expiryDate, today) < 0);
  if (tab === "soon") return items.filter((item) => {
    const remaining = daysUntil(item.expiryDate, today);
    return remaining >= 0 && remaining <= 30;
  });
  return items;
}

/** 首页角标计数：已过期 或 ≤7 天（spec 十五）。 */
export function expiringSoonCount(items: ExpiryItem[], today: string = todayIso()): number {
  return items.filter((item) => {
    const remaining = daysUntil(item.expiryDate, today);
    return remaining < 0 || remaining <= 7;
  }).length;
}
