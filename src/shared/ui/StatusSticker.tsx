import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import type { UiTokens } from "./primitives";
import { MOTION, prefersReducedMotion, RADIUS } from "./tokens";

const STORAGE_PREFIX = "lifedesk.sticker.";

type Props = {
  /** 主标签，如 DONE / 7 DAYS / 本月首存。 */
  label: string;
  /** 副标签，如 今日清空 / 本周 3 次。 */
  sublabel?: string;
  icon?: ReactNode;
  /** 持久化键：看过后写入 localStorage，刷新不再重复弹出。 */
  storageKey: string;
  tokens: UiTokens;
  onDismiss?: () => void;
  /** 轻微旋转角度（度），默认 -1.5，营造纸张贴纸感。 */
  rotate?: number;
};

/**
 * 轻量状态贴纸：满足真实条件时出现的非成就型反馈。
 * 同屏最多由调用方保证 1 个；看过后持久化；支持「减少动态效果」。
 */
export function StatusSticker({ label, sublabel, icon, storageKey, tokens, onDismiss, rotate = -1.5 }: Props) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(STORAGE_PREFIX + storageKey) === "1";
    } catch {
      return false;
    }
  });
  const opacity = useRef(new Animated.Value(prefersReducedMotion() ? 1 : 0));
  const scale = useRef(new Animated.Value(prefersReducedMotion() ? 1 : 0.96));

  useEffect(() => {
    if (dismissed) return;
    if (prefersReducedMotion()) {
      opacity.current.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity.current, { duration: MOTION.sticker, toValue: 1, useNativeDriver: false }),
      Animated.timing(scale.current, { duration: MOTION.sticker, toValue: 1, useNativeDriver: false })
    ]).start();
  }, [dismissed]);

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_PREFIX + storageKey, "1");
    } catch {
      /* 忽略持久化失败 */
    }
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <Animated.View
      accessibilityRole="text"
      style={[
        styles.sticker,
        {
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
          opacity: opacity.current,
          transform: [{ rotate: `${rotate}deg` }, { scale: scale.current }]
        }
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.texts}>
        <Text style={[styles.label, { color: tokens.text }]}>{label}</Text>
        {sublabel ? <Text style={[styles.sub, { color: tokens.textMuted }]}>{sublabel}</Text> : null}
      </View>
      {onDismiss ? (
        <Pressable accessibilityLabel="关闭状态贴纸" hitSlop={6} onPress={handleDismiss} style={styles.close}>
          <Text style={[styles.closeText, { color: tokens.textMuted }]}>×</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sticker: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: RADIUS.card,
    elevation: 3,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8
  },
  icon: {
    flexShrink: 0
  },
  texts: {
    flexShrink: 0
  },
  label: {
    fontSize: 14,
    fontWeight: "900"
  },
  sub: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 1
  },
  close: {
    flexShrink: 0,
    marginLeft: 2,
    padding: 2
  },
  closeText: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 16
  }
});
