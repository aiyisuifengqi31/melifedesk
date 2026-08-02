import { hydrateFromCloud, saveCloudValue } from "@/features/sync/cloudSync";

export type BackgroundSource =
  | { kind: "preset"; uri: string }
  | { kind: "custom"; uri: string };

export type BackgroundOption = {
  id: string;
  name: string;
  source: BackgroundSource;
  thumbnail?: string;
};

export const BACKGROUND_STORAGE_KEY = "fanfan-guanguan.background.v1";
const EMPTY_BACKGROUND: BackgroundSource = { kind: "preset", uri: "" };

// 背景图作为静态文件随构建拷贝到 dist/backgrounds/，运行时按部署基路径拼接前缀。
function assetBase(): string {
  if (typeof window === "undefined" || !window.location) {
    return "/melifedesk";
  }
  const match = window.location.pathname.match(/^\/[^\/]+/);
  return match ? match[0] : "";
}

function bgUri(file: string): string {
  return `${assetBase()}/backgrounds/${file}`;
}

export const PRESET_BACKGROUNDS: BackgroundOption[] = [
  {
    id: "none",
    name: "无背景",
    source: { kind: "preset", uri: "" }
  },
  {
    id: "cat-blue",
    name: "蓝色小猫",
    source: { kind: "preset", uri: bgUri("theme-cat-blue.jpg") }
  },
  {
    id: "cat-cup",
    name: "茶杯猫咪",
    source: { kind: "preset", uri: bgUri("theme-cat-cup.jpg") }
  },
  {
    id: "dogs",
    name: "元气狗狗",
    source: { kind: "preset", uri: bgUri("theme-dogs.jpg") }
  },
  {
    id: "rainbow",
    name: "彩虹山河",
    source: { kind: "preset", uri: bgUri("theme-rainbow.jpg") }
  }
];

export function loadBackground(): BackgroundSource | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  const raw = window.localStorage.getItem(BACKGROUND_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as BackgroundSource;
    if (parsed && (parsed.kind === "preset" || parsed.kind === "custom") && typeof parsed.uri === "string") {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveBackground(source: BackgroundSource | null) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  const next = source ?? EMPTY_BACKGROUND;
  window.localStorage.setItem(BACKGROUND_STORAGE_KEY, JSON.stringify(next));
  void saveCloudValue(BACKGROUND_STORAGE_KEY, next);
}

export async function hydrateBackgroundFromCloud(): Promise<BackgroundSource | null> {
  const local = loadBackground();
  return hydrateFromCloud<BackgroundSource | null>(BACKGROUND_STORAGE_KEY, local, (value) => saveBackground(value));
}

export function findBackgroundOption(source: BackgroundSource | null): BackgroundOption | undefined {
  if (!source) {
    return PRESET_BACKGROUNDS[0];
  }
  if (source.kind === "custom") {
    return undefined;
  }
  return PRESET_BACKGROUNDS.find((option) => option.source.uri === source.uri);
}

export function getImageSource(source: BackgroundSource | null): { uri: string } | undefined {
  if (!source || !source.uri) {
    return undefined;
  }
  return { uri: source.uri };
}
