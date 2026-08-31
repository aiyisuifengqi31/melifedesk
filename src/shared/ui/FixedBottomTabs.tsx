import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import type { UiTokens } from "@/shared/ui/primitives";
import { motionDurationMs, RADIUS, SHADOW } from "@/shared/ui/tokens";
import { PressableScale } from "@/shared/ui/PressableScale";

export type FixedBottomTabItem<T extends string> = {
  label: string;
  value: T;
};

type FixedBottomTabsProps<T extends string> = {
  activeValue: T;
  hidden?: boolean;
  items: FixedBottomTabItem<T>[];
  onChange: (value: T) => void;
  style: ViewStyle;
  testID?: string;
  tokens: UiTokens;
};

export function FixedBottomTabs<T extends string>({ activeValue, hidden = false, items, onChange, style, testID = "secondary-floating-tabs", tokens }: FixedBottomTabsProps<T>) {
  const styles = createStyles(tokens);
  const activeIndex = Math.max(0, items.findIndex((item) => item.value === activeValue));
  const indicatorWidth = items.length > 0 ? `${100 / items.length}%` : "0%";

  if (hidden) return null;

  return (
    <View testID={testID} style={[styles.shell, style]}>
      <View pointerEvents="none" style={styles.indicatorTrack}>
        <View
          testID="secondary-tab-indicator"
          style={[
            styles.indicatorSlot,
            {
              transform: [{ translateX: `${activeIndex * 100}%` }],
              width: indicatorWidth
            } as never
          ]}
        >
          <View testID="secondary-tab-indicator-pill" style={styles.indicatorPill} />
        </View>
      </View>
      {items.map((item) => {
        const active = item.value === activeValue;
        return (
          <PressableScale
            key={item.value}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={() => onChange(item.value)}
            style={[styles.tab, active ? styles.tabActive : null]}
            testID={`secondary-tab-${item.value}`}
            wrapperStyle={styles.tabSlot}
            wrapperTestID={`secondary-tab-slot-${item.value}`}
          >
            <Text numberOfLines={1} style={[styles.tabText, active ? styles.tabTextActive : null]}>
              {item.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    shell: {
      backgroundColor: tokens.surfaceOverlay ?? "rgba(255, 255, 255, 0.96)",
      borderColor: tokens.border,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      flexDirection: "row",
      flexWrap: "nowrap",
      gap: 4,
      padding: 4,
      position: "relative",
      zIndex: 80,
      ...SHADOW.overlay
    },
    indicatorTrack: {
      bottom: 4,
      left: 4,
      pointerEvents: "none",
      position: "absolute",
      right: 4,
      top: 4,
      zIndex: 0
    },
    indicatorSlot: {
      bottom: 0,
      left: 0,
      position: "absolute",
      top: 0,
      transitionDuration: motionDurationMs(240),
      transitionProperty: "transform",
      transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)"
    } as never,
    indicatorPill: {
      backgroundColor: "rgba(93, 178, 235, 0.14)",
      borderRadius: 9999,
      bottom: 0,
      left: 6,
      position: "absolute",
      right: 6,
      top: 0
    },
    tabSlot: {
      flex: 1,
      minWidth: 0,
      zIndex: 1
    },
    tab: {
      alignItems: "center",
      borderRadius: RADIUS.sm,
      flex: 1,
      justifyContent: "center",
      minWidth: 0,
      paddingHorizontal: 4,
      paddingVertical: 10
    },
    tabActive: {},
    tabText: {
      color: tokens.textMuted,
      fontSize: 14,
      fontWeight: "900",
      transitionDuration: motionDurationMs(180),
      transitionProperty: "color",
      transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)"
    } as never,
    tabTextActive: {
      color: "#25485D"
    }
  });
}
