import { StyleSheet, Text, View } from "react-native";

import type { UiTokens } from "@/shared/ui/primitives";

import { categoryLabel, daysUntil, expiryStatus, type ExpiryItem } from "./expiryUtils";

type ExpiryRowProps = {
  item: ExpiryItem;
  tokens: UiTokens;
  today: string;
  showCategory?: boolean;
};

/** 单条到期事项视觉行：左圆点 + 名称 + 剩余天数(局部强调) + 到期日期。首页与管理页共用。 */
export function ExpiryRow({ item, showCategory = false, tokens, today }: ExpiryRowProps) {
  const remaining = daysUntil(item.expiryDate, today);
  const status = expiryStatus(remaining);
  const styles = createStyles(tokens);

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: status.tone }]} />
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={[styles.name, { color: tokens.text }]}>
            {item.title}
          </Text>
          {showCategory ? <Text style={styles.category}>{categoryLabel(item.category)}</Text> : null}
        </View>
        <View style={styles.metaRow}>
          <View style={[styles.remaining, { backgroundColor: status.soft }]}>
            <Text style={[styles.remainingText, { color: status.tone }]}>{status.label}</Text>
          </View>
          <Text style={[styles.date, { color: tokens.textMuted }]}>{item.expiryDate}</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    category: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 999,
      color: tokens.textMuted,
      fontSize: 11,
      fontWeight: "800",
      marginLeft: 8,
      overflow: "hidden",
      paddingHorizontal: 8,
      paddingVertical: 2
    },
    date: {
      fontSize: 12,
      fontWeight: "800"
    },
    dot: {
      borderRadius: 999,
      flexShrink: 0,
      height: 9,
      marginTop: 5,
      width: 9
    },
    main: {
      flex: 1,
      gap: 4,
      minWidth: 0
    },
    metaRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    name: {
      flex: 1,
      fontSize: 14,
      fontWeight: "800",
      minWidth: 0
    },
    remaining: {
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2
    },
    remainingText: {
      fontSize: 12,
      fontWeight: "900"
    },
    row: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 10
    },
    titleRow: {
      alignItems: "center",
      flexDirection: "row"
    }
  });
}
