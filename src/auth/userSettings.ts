import { isThemeId } from "@/theme/registry";
import type { ColorMode, ThemeId } from "@/theme/types";

export type UserSettingsInput = {
  colorMode?: ColorMode;
  themeId?: ThemeId;
  workspaceTitle?: string;
};

export type UserSettingsPatch = {
  color_mode?: ColorMode;
  theme_id?: ThemeId;
  workspace_title?: string | null;
};

export function buildUserSettingsPatch(input: UserSettingsInput): UserSettingsPatch {
  const patch: UserSettingsPatch = {};

  if (input.themeId) {
    patch.theme_id = input.themeId;
  }

  if (input.colorMode) {
    patch.color_mode = input.colorMode;
  }

  if (input.workspaceTitle !== undefined) {
    const title = input.workspaceTitle.trim();
    patch.workspace_title = title ? title : null;
  }

  return patch;
}

export function readStoredThemeId(storage: Storage | undefined): ThemeId | null {
  const value = storage?.getItem("fanfan-guanguan.theme_id");
  return value && isThemeId(value) ? value : null;
}

export function writeStoredThemeId(storage: Storage | undefined, themeId: ThemeId) {
  storage?.setItem("fanfan-guanguan.theme_id", themeId);
}

export function readStoredColorMode(storage: Storage | undefined): ColorMode | null {
  const value = storage?.getItem("fanfan-guanguan.color_mode");
  return value === "light" || value === "dark" ? value : null;
}

export function writeStoredColorMode(storage: Storage | undefined, mode: ColorMode) {
  storage?.setItem("fanfan-guanguan.color_mode", mode);
}
