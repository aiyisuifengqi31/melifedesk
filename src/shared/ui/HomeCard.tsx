import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { UiTokens } from "@/shared/ui/primitives";
import { frostedCard, RADIUS } from "@/shared/ui/tokens";
import { IconChevronDown, IconEye, IconEyeOff, IconGripVertical } from "@/shared/ui/lineIcons";

type HomeCardProps = {
  title: ReactNode;
  /** 标题右侧的附加内容（如「全部 →」、今日支出金额）。 */
  headerRight?: ReactNode;
  collapsed: boolean;
  /** 是否允许折叠（下一件事等单行卡片可置 false）。 */
  collapsible: boolean;
  onToggleCollapse: () => void;
  editMode: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onToggleHide?: () => void;
  /** 编辑模式下是否处于隐藏态（普通模式隐藏卡片根本不渲染）。 */
  hidden: boolean;
  /** 核心模块：不可隐藏，显示「锁定」标签。 */
  locked: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** 使用浅绿底（如下一件事），保留辨识度。 */
  accentSurface?: boolean;
  tokens: UiTokens;
  testID?: string;
  children: ReactNode;
};

export function HomeCard({
  title,
  headerRight,
  collapsed,
  collapsible,
  onToggleCollapse,
  editMode,
  onMoveUp,
  onMoveDown,
  onToggleHide,
  hidden,
  locked,
  canMoveUp,
  canMoveDown,
  accentSurface,
  tokens,
  testID,
  children
}: HomeCardProps) {
  const wrapStyle = [styles.card, frostedCard(tokens), accentSurface ? styles.cardAccent : null, hidden && editMode ? styles.cardHidden : null];

  return (
    <View style={wrapStyle} testID={testID}>
      <View style={styles.headerRow}>
        {editMode ? (
          <View style={styles.controls}>
            <View style={styles.grip} accessibilityElementsHidden>
              <IconGripVertical size={16} color={tokens.textMuted} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="上移卡片"
              disabled={!canMoveUp}
              onPress={onMoveUp}
              style={[styles.ctrlBtn, !canMoveUp && styles.ctrlDisabled]}
            >
              <Text style={styles.ctrlGlyph}>↑</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="下移卡片"
              disabled={!canMoveDown}
              onPress={onMoveDown}
              style={[styles.ctrlBtn, !canMoveDown && styles.ctrlDisabled]}
            >
              <Text style={styles.ctrlGlyph}>↓</Text>
            </Pressable>
            {locked ? (
              <View style={styles.lockTag}>
                <Text style={styles.lockText}>锁定</Text>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={hidden ? "显示卡片" : "隐藏卡片"}
                onPress={onToggleHide}
                style={styles.ctrlBtn}
              >
                {hidden ? <IconEyeOff size={16} color={tokens.textMuted} /> : <IconEye size={16} color={tokens.textMuted} />}
              </Pressable>
            )}
          </View>
        ) : null}

        <View style={styles.titleArea}>{title}</View>
        {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
        {!editMode && collapsible ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={collapsed ? "展开卡片" : "收起卡片"}
            onPress={onToggleCollapse}
            style={styles.chevronBtn}
          >
            <IconChevronDown
              size={18}
              color={tokens.textMuted}
              style={{ transform: [{ rotate: collapsed ? "0deg" : "180deg" }] }}
            />
          </Pressable>
        ) : null}
      </View>

      {editMode || !collapsed ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 10,
    marginTop: 10
  },
  card: {
    borderRadius: RADIUS.card,
    gap: 0,
    padding: 14
  },
  cardAccent: {
    backgroundColor: "#eef7ee"
  },
  cardHidden: {
    opacity: 0.5
  },
  chevronBtn: {
    flexShrink: 0,
    padding: 2
  },
  ctrlBtn: {
    alignItems: "center",
    backgroundColor: "#f1f5f1",
    borderRadius: 8,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  ctrlDisabled: {
    opacity: 0.35
  },
  ctrlGlyph: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "900"
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  grip: {
    opacity: 0.5,
    width: 16
  },
  headerRight: {
    flexShrink: 0
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  lockTag: {
    backgroundColor: "#e2f2e2",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3
  },
  lockText: {
    color: "#2f7d3f",
    fontSize: 10,
    fontWeight: "900"
  },
  titleArea: {
    flex: 1,
    minWidth: 0
  }
});
