import type { RouteKey } from "@/navigation/items";

export type ThemeId =
  | "cat"
  | "coral"
  | "default"
  | "dog"
  | "lavender"
  | "matcha"
  | "midnight"
  | "ocean"
  | "sakura"
  | "sunset";
export type ColorMode = "light" | "dark";

export type ThemeTokens = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  border: string;
  danger: string;
};

export type NavIconResource = {
  selected: ThemeSvgResource;
  unselected: ThemeSvgResource;
};

export type ThemeSvgResource = {
  source: string;
  xml: string;
};

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  description: string;
  tokens: Record<ColorMode, ThemeTokens>;
  icons: Record<RouteKey, NavIconResource>;
  emptyState: string;
  chartPalette: string[];
  license: string;
};
