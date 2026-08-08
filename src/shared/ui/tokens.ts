import type { StyleProp, ViewStyle } from "react-native";

import type { UiTokens } from "./primitives";

/**
 * 统一动效时长（毫秒）。所有微交互从这里取，避免组件各自硬编码不同时长。
 * 范围遵循 Phase 3 规范：按压 120~160 / 切换 180~220 / 折叠 200~260 / 面板 220~300 / 数字 200~350。
 */
export const MOTION = {
  press: 140,
  toggle: 200,
  collapse: 220,
  sheet: 260,
  number: 280,
  sticker: 200
} as const;

/** 统一圆角四档：小芯片 / 输入框·小按钮 / 普通卡片 / 大型面板·BottomSheet。 */
export const RADIUS = {
  sm: 12,
  input: 14,
  card: 20,
  panel: 28
} as const;

type ShadowToken = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

/** 仅两级阴影：Level1 普通卡片（极轻），Level2 悬浮/模态（稍明显）。 */
export const SHADOW: { card: ShadowToken; overlay: ShadowToken } = {
  card: { shadowColor: "#000000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  overlay: { shadowColor: "#000000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 22, elevation: 10 }
};

/**
 * 卡片「轻磨砂」材质：近白半透明 + 1px 极淡边框 + 轻阴影。
 * 背景照片下仍可保证文字清晰（底色已是 0.92 不透明白）；
 * 不支持 backdrop-filter 时退化为普通白卡，不影响可读性。
 */
export function frostedCard(tokens: UiTokens): StyleProp<ViewStyle> {
  return {
    backgroundColor: tokens.surfaceCard ?? "rgba(255, 255, 255, 0.92)",
    borderColor: tokens.border,
    borderWidth: 1,
    borderRadius: RADIUS.card,
    ...SHADOW.card
  } as ViewStyle;
}

/** 悬浮/模态材质：比普通卡片更实，用于 BottomSheet / Modal。 */
export function overlaySurface(tokens: UiTokens): StyleProp<ViewStyle> {
  return {
    backgroundColor: tokens.surfaceOverlay ?? "rgba(255, 255, 255, 0.96)",
    borderColor: tokens.border,
    borderWidth: 1,
    ...SHADOW.overlay
  } as ViewStyle;
}

/** 系统是否开启「减少动态效果」。jsdom / 无 matchMedia 时返回 false（功能照常）。 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * 在现有主题 token 上补全语义色与圆角/材质所需的派生字段，
 * 不新建第二套主题系统，只做「按需回填默认值」。
 * 语义色遵循 Phase 3 规范：支出珊瑚红、收入绿、储蓄青绿、提醒橙。
 */
export function withSemanticTokens<T extends UiTokens>(base: T, mode: "light" | "dark" = "light"): T {
  const dark = mode === "dark";
  return {
    ...base,
    textSecondary: base.textSecondary ?? base.textMuted,
    surfaceCard: base.surfaceCard ?? (dark ? "rgba(36, 32, 45, 0.92)" : "rgba(255, 255, 255, 0.92)"),
    surfaceOverlay: base.surfaceOverlay ?? (dark ? "rgba(36, 32, 45, 0.97)" : "rgba(255, 255, 255, 0.96)"),
    expense: base.expense ?? (dark ? "#ff9a9a" : "#e57373"),
    income: base.income ?? "#2f9e44",
    saving: base.saving ?? "#2f9e8f",
    reminder: base.reminder ?? "#e8975a",
    success: base.success ?? "#2f9e44"
  };
}
