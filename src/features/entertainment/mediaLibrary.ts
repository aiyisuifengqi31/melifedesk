export type MediaType = "电影" | "电视剧" | "综艺" | "动漫" | "纪录片";
export type MediaStatus = "想看" | "在看" | "看过" | "收藏";

export type MediaItem = {
  area: string;
  currentEpisode: number;
  description: string;
  duration: string;
  episodes: number;
  genre: string;
  id: string;
  note: string;
  sourceUrl: string;
  status: MediaStatus;
  title: string;
  type: MediaType;
  updateStatus: string;
  year: string;
};

export type ReminderItem = {
  date: string;
  id: string;
  note: string;
  title: string;
};

const MEDIA_KEY = "fanfan-guanguan.fun.media.v1";
const REMINDER_KEY = "fanfan-guanguan.fun.reminders.v1";

export const MEDIA_TYPES = ["全部", "电影", "电视剧", "综艺", "动漫", "纪录片"];
export const MEDIA_GENRES = ["全部", "喜剧", "剧情", "动作", "悬疑", "科幻", "爱情", "犯罪", "动画", "历史", "纪录片"];
export const MEDIA_AREAS = ["全部", "中国大陆", "中国香港", "中国台湾", "美国", "日本", "韩国", "英国", "其他"];
export const MEDIA_STATUSES = ["全部", "想看", "在看", "看过", "收藏"];

export const HOLIDAYS_2026 = [
  { date: "2026-01-01", name: "元旦", detail: "法定节假日，具体调休以国务院办公厅通知为准。", source: "中国政府网节假日安排" },
  { date: "2026-02-17", name: "春节", detail: "春节假期前后通常伴随调休，出行和购票建议提前安排。", source: "中国政府网节假日安排" },
  { date: "2026-04-05", name: "清明节", detail: "清明前后适合提前规划祭扫、短途出行和交通安排。", source: "中国政府网节假日安排" },
  { date: "2026-05-01", name: "劳动节", detail: "劳动节假期出行需求较高，建议提前安排车票和住宿。", source: "中国政府网节假日安排" },
  { date: "2026-06-19", name: "端午节", detail: "端午假期适合短途出行，也可记录家庭安排。", source: "中国政府网节假日安排" },
  { date: "2026-09-25", name: "中秋节", detail: "中秋节适合提前记录团圆、礼物和出行安排。", source: "中国政府网节假日安排" },
  { date: "2026-10-01", name: "国庆节", detail: "国庆长假出行集中，建议提前规划交通和预算。", source: "中国政府网节假日安排" }
];

export function createMediaId() {
  return `media-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createReminderId() {
  return `reminder-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function emptyMediaItem(): MediaItem {
  return {
    area: "中国大陆",
    currentEpisode: 0,
    description: "",
    duration: "",
    episodes: 1,
    genre: "剧情",
    id: createMediaId(),
    note: "",
    sourceUrl: "",
    status: "想看",
    title: "",
    type: "电影",
    updateStatus: "已上映",
    year: String(new Date().getFullYear())
  };
}

export function loadMediaItems(): MediaItem[] {
  return readJson<MediaItem[]>(MEDIA_KEY, []);
}

export function saveMediaItems(items: MediaItem[]) {
  writeJson(MEDIA_KEY, items);
}

export function loadReminders(): ReminderItem[] {
  return readJson<ReminderItem[]>(REMINDER_KEY, []);
}

export function saveReminders(items: ReminderItem[]) {
  writeJson(REMINDER_KEY, items);
}

export function mediaYears(items: MediaItem[]) {
  return ["全部", ...Array.from(new Set(items.map((item) => item.year).filter(Boolean))).sort((left, right) => right.localeCompare(left)), "更早"];
}

export function daysUntil(date: string, now = new Date("2026-08-03T00:00:00+08:00")) {
  const target = new Date(`${date}T00:00:00+08:00`).getTime();
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.ceil((target - current) / 86400000);
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}
