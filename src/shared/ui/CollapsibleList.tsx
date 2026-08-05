import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { UiTokens } from "./primitives";

/** 所有"会增长的列表"折叠后默认展示的条数。 */
export const DEFAULT_COLLAPSED_COUNT = 3;

type SortKey = string | number | undefined | null;

function toKeyList(value: SortKey | SortKey[]): SortKey[] {
  return Array.isArray(value) ? value : [value];
}

function compareKey(left: SortKey, right: SortKey): number {
  const leftValue = left ?? "";
  const rightValue = right ?? "";
  if (typeof leftValue === "number" && typeof rightValue === "number") {
    if (leftValue === rightValue) return 0;
    return leftValue < rightValue ? -1 : 1;
  }
  const leftText = String(leftValue);
  const rightText = String(rightValue);
  if (leftText === rightText) return 0;
  return leftText < rightText ? -1 : 1;
}

/**
 * 稳定的"最新在前"排序。getKey 可返回单个键或键数组（按优先级依次比较）。
 * 例：sortByNewest(list, (item) => [item.date, item.createTime])
 */
export function sortByNewest<T>(items: T[], getKey: (item: T) => SortKey | SortKey[]): T[] {
  return items
    .map((item, index) => ({ index, item, keys: toKeyList(getKey(item)) }))
    .sort((left, right) => {
      const length = Math.max(left.keys.length, right.keys.length);
      for (let position = 0; position < length; position += 1) {
        const result = compareKey(left.keys[position], right.keys[position]);
        if (result !== 0) return -result;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.item);
}

export type CollapsibleListState<T> = {
  canExpand: boolean;
  collapsedCount: number;
  expanded: boolean;
  hiddenCount: number;
  toggle: () => void;
  total: number;
  visibleItems: T[];
};

/**
 * 列表折叠三件套中的"默认条数 + 查看更多"。传入的数组应已是倒序。
 */
export function useCollapsibleList<T>(items: T[], collapsedCount: number = DEFAULT_COLLAPSED_COUNT): CollapsibleListState<T> {
  const [expanded, setExpanded] = useState(false);
  const total = items.length;
  const visibleItems = useMemo(
    () => (expanded ? items : items.slice(0, collapsedCount)),
    [collapsedCount, expanded, items]
  );
  const toggle = useCallback(() => setExpanded((previous) => !previous), []);
  return {
    canExpand: total > collapsedCount,
    collapsedCount,
    expanded,
    hiddenCount: Math.max(0, total - collapsedCount),
    toggle,
    total,
    visibleItems
  };
}

export type ShowMoreButtonProps = {
  expanded: boolean;
  hiddenCount: number;
  /** 无障碍标签用的列表名称，例如「日记」「训练记录」。 */
  name: string;
  onPress: () => void;
  testID?: string;
  tokens?: UiTokens;
  /** 计量单位，默认「条」。 */
  unit?: string;
};

/** 统一的「查看更多 N 条 / 收起」按钮。 */
export function ShowMoreButton({ expanded, hiddenCount, name, onPress, testID, tokens, unit = "条" }: ShowMoreButtonProps) {
  const label = expanded ? "收起" : `查看更多 ${hiddenCount} ${unit}`;
  const accessibilityLabel = expanded ? `收起${name}` : `查看更多${name}，还有 ${hiddenCount} ${unit}`;
  const borderColor = tokens?.border ?? "#e3e8ef";
  const backgroundColor = tokens?.surface ?? "#ffffff";
  const textColor = tokens?.accent ?? "#1fa8e2";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={[styles.button, { backgroundColor, borderColor }]}
      testID={testID}
    >
      <Text style={[styles.buttonText, { color: textColor }]}>
        {label} {expanded ? "▲" : "▼"}
      </Text>
    </Pressable>
  );
}

export type CollapsibleSectionFooterProps = ShowMoreButtonProps & {
  visible: boolean;
};

/** canExpand 为 false 时不渲染，省去调用方写三元。 */
export function CollapsibleSectionFooter({ visible, ...rest }: CollapsibleSectionFooterProps) {
  if (!visible) return null;
  return (
    <View style={styles.footer}>
      <ShowMoreButton {...rest} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "800"
  },
  footer: {
    marginTop: 4
  }
});
