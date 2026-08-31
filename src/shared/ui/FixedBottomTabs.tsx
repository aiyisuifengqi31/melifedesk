import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import type { UiTokens } from "@/shared/ui/primitives";
import { motionDurationMs, MOTION, RADIUS, SHADOW } from "@/shared/ui/tokens";
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

  if (hidden) return null;

  return (
    <View testID={testID} style={[styles.shell, style]}>
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
      zIndex: 80,
      ...SHADOW.overlay
    },
    tabSlot: {
      flex: 1,
      minWidth: 0
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
    tabActive: {
      backgroundColor: tokens.surface,
      transitionDuration: motionDurationMs(MOTION.toggle),
      transitionProperty: "background-color",
      transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)"
    } as never,
    tabText: {
      color: tokens.textMuted,
      fontSize: 14,
      fontWeight: "900"
    },
    tabTextActive: {
      color: tokens.text
    }
  });
}
