import type { ThemeDefinition, ThemeId } from "./types";
import { createNavIconResource } from "./navIconFactory";

export const THEME_IDS: ThemeId[] = ["default", "cat", "dog"];

const sharedDark = {
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

export const themes: Record<ThemeId, ThemeDefinition> = {
  default: {
    id: "default",
    name: "简约主题",
    tokens: {
      light: {
        background: "#ffffff",
        surface: "#f7f5fb",
        surfaceMuted: "#ebe7f4",
        text: "#272234",
        textMuted: "#6e647a",
        accent: "#7d5fff",
        accentSoft: "#ebe5ff",
        border: "#ded8ea",
        danger: "#d94b4b"
      },
      dark: sharedDark
    },
    icons: {
      plan: createNavIconResource("default", "plan"),
      workout: createNavIconResource("default", "workout"),
      finance: createNavIconResource("default", "finance"),
      love: createNavIconResource("default", "love"),
      gifts: createNavIconResource("default", "gifts"),
      exam: createNavIconResource("default", "exam")
    },
    emptyState: "default/empty-states/generic.svg",
    chartPalette: ["#7d5fff", "#30bced", "#ffb84d", "#4bcf8f", "#f56cae"],
    license: "项目原创占位资源，可在本项目内使用和再分发。"
  },
  cat: {
    id: "cat",
    name: "奶油猫咪主题",
    tokens: {
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
      dark: { ...sharedDark, accent: "#f0b08e", accentSoft: "#4a3328" }
    },
    icons: {
      plan: createNavIconResource("cat", "plan"),
      workout: createNavIconResource("cat", "workout"),
      finance: createNavIconResource("cat", "finance"),
      love: createNavIconResource("cat", "love"),
      gifts: createNavIconResource("cat", "gifts"),
      exam: createNavIconResource("cat", "exam")
    },
    emptyState: "cat/empty-states/generic.svg",
    chartPalette: ["#e88f7a", "#f4c95d", "#8bc6a9", "#b895d6", "#6aaed6"],
    license: "项目原创占位资源，可在本项目内使用和再分发。"
  },
  dog: {
    id: "dog",
    name: "柴犬日常主题",
    tokens: {
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
      dark: { ...sharedDark, accent: "#efb15b", accentSoft: "#46351f" }
    },
    icons: {
      plan: createNavIconResource("dog", "plan"),
      workout: createNavIconResource("dog", "workout"),
      finance: createNavIconResource("dog", "finance"),
      love: createNavIconResource("dog", "love"),
      gifts: createNavIconResource("dog", "gifts"),
      exam: createNavIconResource("dog", "exam")
    },
    emptyState: "dog/empty-states/generic.svg",
    chartPalette: ["#d9902f", "#5aa9a4", "#ef767a", "#7d8cc4", "#6bbf59"],
    license: "项目原创占位资源，可在本项目内使用和再分发。"
  }
};

export function getTheme(themeId: ThemeId): ThemeDefinition {
  return themes[themeId];
}
