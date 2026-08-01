export type BackgroundSource =
  | { kind: "preset"; uri: string }
  | { kind: "custom"; uri: string };

export type BackgroundOption = {
  id: string;
  name: string;
  source: BackgroundSource;
  thumbnail?: string;
};

const STORAGE_KEY = "fanfan-guanguan.background.v1";

export const PRESET_BACKGROUNDS: BackgroundOption[] = [
  {
    id: "none",
    name: "无背景",
    source: { kind: "preset", uri: "" }
  },
  {
    id: "cat-blue",
    name: "蓝色小猫",
    source: { kind: "preset", uri: require("@/assets/backgrounds/theme-cat-blue.jpg") }
  },
  {
    id: "cat-cup",
    name: "茶杯猫咪",
    source: { kind: "preset", uri: require("@/assets/backgrounds/theme-cat-cup.jpg") }
  },
  {
    id: "dogs",
    name: "元气狗狗",
    source: { kind: "preset", uri: require("@/assets/backgrounds/theme-dogs.jpg") }
  },
  {
    id: "rainbow",
    name: "彩虹山河",
    source: { kind: "preset", uri: require("@/assets/backgrounds/theme-rainbow.jpg") }
  }
];

export function loadBackground(): BackgroundSource | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
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
  if (!source || !source.uri) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(source));
  }
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

export function getImageSource(source: BackgroundSource | null): number | { uri: string } | undefined {
  if (!source || !source.uri) {
    return undefined;
  }
  if (source.kind === "preset") {
    return source.uri as unknown as number;
  }
  return { uri: source.uri };
}
