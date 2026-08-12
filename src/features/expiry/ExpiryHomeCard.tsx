import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { PressableScale } from "@/shared/ui/PressableScale";
import type { UiTokens } from "@/shared/ui/primitives";
import { frostedCard } from "@/shared/ui/tokens";

import { ExpiryRow } from "./ExpiryRow";
import { sortExpiryByUrgency, todayIso, type ExpiryItem } from "./expiryUtils";

type ExpiryHomeCardProps = {
  items: ExpiryItem[];
  onAdd: () => void;
  tokens: UiTokens;
  testID?: string;
};

const HOME_MAX = 3;

/** 首页底部「到期提醒」卡片：最多显示最近 3 条，空状态极简，底部 + 添加提醒。 */
export function ExpiryHomeCard({ items, onAdd, testID, tokens }: ExpiryHomeCardProps) {
  const today = todayIso();
  const visible = useMemo(() => sortExpiryByUrgency(items, today).slice(0, HOME_MAX), [items, today]);
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  return (
    <View style={[frostedCard(tokens), styles.card]} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.title}>到期提醒</Text>
        <PressableScale
          accessibilityLabel="查看全部到期提醒"
          accessibilityRole="button"
          onPress={() => router.push("/expiry")}
          style={styles.more}
          wrapperStyle={{ flexShrink: 0 }}
        >
          <Text style={styles.moreText}>全部 →</Text>
        </PressableScale>
      </View>

      {visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>暂无到期事项</Text>
          <PressableScale
            accessibilityLabel="添加到期提醒"
            accessibilityRole="button"
            onPress={onAdd}
            style={styles.addButton}
            wrapperStyle={{ width: "100%" }}
          >
            <Text style={styles.addText}>＋ 添加提醒</Text>
          </PressableScale>
        </View>
      ) : (
        <View style={styles.list}>
          {visible.map((item) => (
            <ExpiryRow key={item.id} item={item} tokens={tokens} today={today} />
          ))}
          <PressableScale
            accessibilityLabel="添加到期提醒"
            accessibilityRole="button"
            onPress={onAdd}
            style={styles.addButton}
            wrapperStyle={{ width: "100%" }}
          >
            <Text style={styles.addText}>＋ 添加提醒</Text>
          </PressableScale>
        </View>
      )}
    </View>
  );
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    addButton: {
      alignItems: "center",
      backgroundColor: tokens.accentSoft,
      borderRadius: 12,
      justifyContent: "center",
      minHeight: 38,
      paddingHorizontal: 12
    },
    addText: {
      color: tokens.accent,
      fontSize: 13,
      fontWeight: "900"
    },
    card: {
      gap: 12,
      padding: 14
    },
    empty: {
      alignItems: "center",
      gap: 10
    },
    emptyText: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "800"
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    list: {
      gap: 12
    },
    more: {
      flexShrink: 0
    },
    moreText: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "900"
    },
    title: {
      color: tokens.text,
      fontSize: 16,
      fontWeight: "900"
    }
  });
}
