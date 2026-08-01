/**
 * 真实热榜数据源：60s API（开源聚合，返回 Access-Control-Allow-Origin: *，
 * 因此纯静态站点（GitHub Pages）也能直接在浏览器里请求，无需自建后端）。
 * 项目地址：https://github.com/vikiboss/60s
 */

export type HotSource = "百度" | "微博" | "知乎";

export type HotItem = {
  desc?: string;
  hot?: string;
  id: string;
  rank: number;
  source: HotSource;
  title: string;
  url: string;
};

export type HotListResult = {
  error?: string;
  fromCache: boolean;
  items: HotItem[];
  updatedAt: string;
};

const API_BASES = ["https://60s.viki.moe", "https://60s-api.viki.moe", "https://60s-cf.viki.moe"];

const ENDPOINTS: Record<HotSource, string> = {
  百度: "/v2/baidu/realtime",
  微博: "/v2/weibo",
  知乎: "/v2/zhihu"
};

const CACHE_PREFIX = "fanfan-guanguan.fun.hot.";
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

type RawItem = Record<string, unknown>;

function getStorage(): Storage | undefined {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return undefined;
}

function readString(raw: RawItem, key: string): string {
  const value = raw[key];
  return typeof value === "string" ? value : "";
}

/** 100000 -> 10.0万；"780.8w" -> 780.8万 */
export function formatHotValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(1)}亿`;
    }
    if (value >= 10000) {
      return `${(value / 10000).toFixed(1)}万`;
    }
    return String(Math.round(value));
  }

  if (typeof value === "string" && value.trim()) {
    const text = value.trim();
    const numeric = Number.parseFloat(text);
    if (Number.isFinite(numeric)) {
      if (/w$/i.test(text)) {
        return `${numeric}万`;
      }
      if (/亿|万|热度/.test(text)) {
        return text;
      }
      return formatHotValue(numeric);
    }
    return text;
  }

  return "";
}

function normalize(source: HotSource, list: RawItem[]): HotItem[] {
  return list
    .map<HotItem | null>((raw, index) => {
      const title = readString(raw, "title");
      if (!title) {
        return null;
      }

      const rankValue = raw.rank;
      const rank = typeof rankValue === "number" && rankValue > 0 ? rankValue : index + 1;
      const url = readString(raw, "link") || readString(raw, "url");
      const desc = readString(raw, "desc") || readString(raw, "detail");
      const hot = formatHotValue(raw.hot_value ?? raw.score_desc ?? raw.hot_value_desc ?? raw.score);

      return {
        desc: desc ? desc.slice(0, 60) : undefined,
        hot: hot || undefined,
        id: `${source}-${rank}-${title.slice(0, 12)}`,
        rank,
        source,
        title,
        url
      };
    })
    .filter((item): item is HotItem => item !== null)
    .slice(0, 20);
}

function readCache(source: HotSource): HotListResult | null {
  const raw = getStorage()?.getItem(`${CACHE_PREFIX}${source}`);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { items: HotItem[]; savedAt: number; updatedAt: string };
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return null;
    }
    return { fromCache: true, items: parsed.items, updatedAt: parsed.updatedAt };
  } catch {
    return null;
  }
}

function cacheIsFresh(source: HotSource): boolean {
  const raw = getStorage()?.getItem(`${CACHE_PREFIX}${source}`);
  if (!raw) {
    return false;
  }
  try {
    const parsed = JSON.parse(raw) as { savedAt: number };
    return typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

function writeCache(source: HotSource, items: HotItem[], updatedAt: string) {
  getStorage()?.setItem(`${CACHE_PREFIX}${source}`, JSON.stringify({ items, savedAt: Date.now(), updatedAt }));
}

async function requestOnce(url: string): Promise<RawItem[]> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;

  try {
    const response = await fetch(url, { signal: controller?.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = (await response.json()) as { data?: unknown };
    if (!Array.isArray(payload.data)) {
      throw new Error("数据格式异常");
    }
    return payload.data as RawItem[];
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/** 依次尝试多个镜像，任一成功即返回；全部失败时回落到本地缓存。 */
export async function fetchHotList(source: HotSource, options: { force?: boolean } = {}): Promise<HotListResult> {
  if (!options.force && cacheIsFresh(source)) {
    const cached = readCache(source);
    if (cached) {
      return cached;
    }
  }

  const path = ENDPOINTS[source];
  let lastError = "";

  for (const base of API_BASES) {
    try {
      const list = await requestOnce(`${base}${path}`);
      const items = normalize(source, list);
      if (items.length === 0) {
        lastError = "返回列表为空";
        continue;
      }
      const updatedAt = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
      writeCache(source, items, updatedAt);
      return { fromCache: false, items, updatedAt };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "网络异常";
    }
  }

  const cached = readCache(source);
  if (cached) {
    return { ...cached, error: `实时刷新失败（${lastError}），显示上次缓存` };
  }

  return { error: `热榜加载失败：${lastError}`, fromCache: false, items: [], updatedAt: "" };
}
