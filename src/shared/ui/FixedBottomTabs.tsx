import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

import type { UiTokens } from "@/shared/ui/primitives";

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
          <Pressable
            key={item.value}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={() => onChange(item.value)}
            style={[styles.tab, active ? styles.tabActive : null]}
            testID={`secondary-tab-${item.value}`}
          >
            <Text numberOfLines={1} style={[styles.tabText, active ? styles.tabTextActive : null]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    shell: {
      backgroundColor: "rgba(241, 245, 249, 0.94)",
      borderColor: tokens.border,
      borderRadius: 16,
      borderWidth: 1,
      elevation: 10,
      flexDirection: "row",
      flexWrap: "nowrap",
      gap: 4,
      padding: 4,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
      zIndex: 80
    },
    tab: {
      alignItems: "center",
      borderRadius: 12,
      flex: 1,
      justifyContent: "center",
      minWidth: 0,
      paddingHorizontal: 4,
      paddingVertical: 10
    },
    tabActive: {
      backgroundColor: tokens.surface
    },
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
