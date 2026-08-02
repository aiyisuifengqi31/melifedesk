import type { ColorMode, NavIconResource, ThemeDefinition, ThemeId, ThemeTokens } from "./types";
import { createNavIconResource } from "./navIconFactory";
import type { RouteKey } from "@/navigation/items";

export const THEME_IDS: ThemeId[] = [
  "default",
  "cat",
  "dog",
  "sakura",
  "ocean",
  "sunset",
  "lavender",
  "matcha",
  "midnight",
  "coral"
];

const LICENSE = "项目原创占位资源，可在本项目内使用和再分发。";

const sharedDark: ThemeTokens = {
  background: "#17151f",
  surface: "#24202d",
  surfaceMuted: "#302b3a",
  text: "#fffaf5",
  textMuted: "#c9bdca",
  accent: "#f4a7c5",
  accentSoft: "#473141",
  border: "#453d52",
  danger: "#ff8a8a"
};

function buildIcons(themeId: ThemeId): Record<RouteKey, NavIconResource> {
  return {
    home: createNavIconResource(themeId, "home"),
    plan: createNavIconResource(themeId, "plan"),
    workout: createNavIconResource(themeId, "workout"),
    finance: createNavIconResource(themeId, "finance"),
    love: createNavIconResource(themeId, "love"),
    exam: createNavIconResource(themeId, "exam"),
    fun: createNavIconResource(themeId, "fun")
  };
}

type ThemeSeed = {
  id: ThemeId;
  name: string;
  description: string;
  light: ThemeTokens;
  dark?: Partial<ThemeTokens>;
  chartPalette: string[];
};

function buildTheme(seed: ThemeSeed): ThemeDefinition {
  const tokens: Record<ColorMode, ThemeTokens> = {
    light: seed.light,
    dark: { ...sharedDark, ...seed.dark }
  };

  return {
    chartPalette: seed.chartPalette,
    description: seed.description,
    emptyState: `${seed.id}/empty-states/generic.svg`,
    icons: buildIcons(seed.id),
    id: seed.id,
    license: LICENSE,
    name: seed.name,
    tokens
  };
}

const seeds: ThemeSeed[] = [
  {
    id: "default",
    name: "清新绿意",
    description: "初始配色，干净的浅绿，久看不累",
    light: {
      background: "#f0f7f0",
      surface: "#ffffff",
      surfaceMuted: "#e8f2e8",
      text: "#1f2937",
      textMuted: "#6b7c6b",
      accent: "#7cb87c",
      accentSoft: "#e2f2e2",
      border: "#d8e8d8",
      danger: "#e57373"
    },
    dark: { accent: "#8fd08f", accentSoft: "#294029" },
    chartPalette: ["#7cb87c", "#6ab0b0", "#e8b87c", "#b8a0d8", "#f28c8c"]
  },
  {
    id: "cat",
    name: "奶油猫咪",
    description: "奶油橘调，像趴在窗边晒太阳的猫",
    light: {
      background: "#fff8ed",
      surface: "#fffdfa",
      surfaceMuted: "#f4eadb",
      text: "#34261d",
      textMuted: "#7a685c",
      accent: "#e88f7a",
      accentSoft: "#ffe6d9",
      border: "#ebd8c6",
      danger: "#c75050"
    },
    dark: { accent: "#f0b08e", accentSoft: "#4a3328" },
    chartPalette: ["#e88f7a", "#f4c95d", "#8bc6a9", "#b895d6", "#6aaed6"]
  },
  {
    id: "dog",
    name: "柴犬日常",
    description: "暖姜黄，元气满满的日常感",
    light: {
      background: "#fffaf0",
      surface: "#ffffff",
      surfaceMuted: "#f2e6cf",
      text: "#322414",
      textMuted: "#75634e",
      accent: "#d9902f",
      accentSoft: "#ffe8bc",
      border: "#e5d4b5",
      danger: "#bd4b3e"
    },
    dark: { accent: "#efb15b", accentSoft: "#46351f" },
    chartPalette: ["#d9902f", "#5aa9a4", "#ef767a", "#7d8cc4", "#6bbf59"]
  },
  {
    id: "sakura",
    name: "樱花微醺",
    description: "淡粉与雪白，春天散步的心情",
    light: {
      background: "#fff5f7",
      surface: "#ffffff",
      surfaceMuted: "#ffe6ec",
      text: "#3a2630",
      textMuted: "#8a6b76",
      accent: "#f08ba8",
      accentSoft: "#ffe0e8",
      border: "#f7d3dd",
      danger: "#d9534f"
    },
    dark: { accent: "#f4a7c5", accentSoft: "#4a2f3b" },
    chartPalette: ["#f08ba8", "#f7c6a0", "#9ad0c2", "#a9a7e0", "#f5d76e"]
  },
  {
    id: "ocean",
    name: "海盐微风",
    description: "清透蓝白，像海边清晨的空气",
    light: {
      background: "#eef6fb",
      surface: "#ffffff",
      surfaceMuted: "#ddeef8",
      text: "#12303f",
      textMuted: "#5d7c8c",
      accent: "#3f9fc9",
      accentSoft: "#d6ecf7",
      border: "#cbe2ee",
      danger: "#e06666"
    },
    dark: { background: "#101c26", surface: "#172733", surfaceMuted: "#1f3442", accent: "#5cc0e8", accentSoft: "#1d3d4e", border: "#2b4453", text: "#f2fafd", textMuted: "#a9c3d1" },
    chartPalette: ["#3f9fc9", "#66c2b0", "#f0a868", "#8f9ae0", "#ef7f7f"]
  },
  {
    id: "sunset",
    name: "落日晚霞",
    description: "橘粉渐层，傍晚六点的天空",
    light: {
      background: "#fff6f0",
      surface: "#fffdfb",
      surfaceMuted: "#ffe8db",
      text: "#3d251a",
      textMuted: "#8a6552",
      accent: "#f2793f",
      accentSoft: "#ffe1cf",
      border: "#f6d5c2",
      danger: "#cf4b3c"
    },
    dark: { background: "#1f1418", surface: "#2b1c20", surfaceMuted: "#38252a", accent: "#ff9b63", accentSoft: "#4a2a1e", border: "#4a3138" },
    chartPalette: ["#f2793f", "#f5b940", "#8fbf7f", "#7f9fd8", "#d980b0"]
  },
  {
    id: "lavender",
    name: "薰衣草田",
    description: "柔紫调，安静专注的氛围",
    light: {
      background: "#f6f3fc",
      surface: "#ffffff",
      surfaceMuted: "#ebe4f8",
      text: "#2e2540",
      textMuted: "#6f6685",
      accent: "#8b6fd4",
      accentSoft: "#e7dffa",
      border: "#ded4f2",
      danger: "#d9534f"
    },
    dark: { background: "#17141f", surface: "#221d2e", surfaceMuted: "#2d2740", accent: "#a98ef0", accentSoft: "#342a4c", border: "#3b3350" },
    chartPalette: ["#8b6fd4", "#5eb6c9", "#f0a35e", "#e07f9f", "#77c48a"]
  },
  {
    id: "matcha",
    name: "抹茶拿铁",
    description: "深绿配奶白，沉稳耐看",
    light: {
      background: "#f4f7ee",
      surface: "#fffef9",
      surfaceMuted: "#e6eedb",
      text: "#24301c",
      textMuted: "#67765a",
      accent: "#6f9b45",
      accentSoft: "#e2eed2",
      border: "#d8e4c6",
      danger: "#c9553f"
    },
    dark: { background: "#151a13", surface: "#1f2619", surfaceMuted: "#293223", accent: "#9ac46a", accentSoft: "#2e3b22", border: "#38442e" },
    chartPalette: ["#6f9b45", "#c9a227", "#4f9d8f", "#a67fb5", "#d97b5c"]
  },
  {
    id: "midnight",
    name: "星夜私语",
    description: "靛蓝夜色，适合晚上使用",
    light: {
      background: "#eef1f8",
      surface: "#ffffff",
      surfaceMuted: "#e2e7f3",
      text: "#1c2136",
      textMuted: "#626a86",
      accent: "#4c5fd7",
      accentSoft: "#dfe3fb",
      border: "#d3d9ee",
      danger: "#e0576b"
    },
    dark: { background: "#0e1120", surface: "#171c30", surfaceMuted: "#20263f", accent: "#7c8bf0", accentSoft: "#252c4d", border: "#2c3350", text: "#f4f6ff", textMuted: "#a8b0cf" },
    chartPalette: ["#4c5fd7", "#39b3a6", "#f0a24b", "#e0637f", "#8f6fd0"]
  },
  {
    id: "coral",
    name: "蜜桃珊瑚",
    description: "甜暖珊瑚色，明亮有活力",
    light: {
      background: "#fff4f1",
      surface: "#ffffff",
      surfaceMuted: "#ffe3dc",
      text: "#3a231f",
      textMuted: "#8a6259",
      accent: "#f2705d",
      accentSoft: "#ffdcd4",
      border: "#f8cec4",
      danger: "#c94a3a"
    },
    dark: { accent: "#ff9382", accentSoft: "#4b2a25" },
    chartPalette: ["#f2705d", "#f6b26b", "#69b7a4", "#8d9ae2", "#d883b7"]
  }
];

export const themes: Record<ThemeId, ThemeDefinition> = seeds.reduce((acc, seed) => {
  acc[seed.id] = buildTheme(seed);
  return acc;
}, {} as Record<ThemeId, ThemeDefinition>);

export function getTheme(themeId: ThemeId): ThemeDefinition {
  return themes[themeId] ?? themes.default;
}

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as string[]).includes(value);
}
