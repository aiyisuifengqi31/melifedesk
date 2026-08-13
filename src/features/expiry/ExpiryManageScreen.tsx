import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { getTheme } from "@/theme/registry";
import { readStoredColorMode, readStoredThemeId } from "@/auth/userSettings";
import { DatePickerPopup } from "@/shared/ui/DatePickerPopup";
import { IconChevronDown, IconMoreHorizontal, IconPlus } from "@/shared/ui/lineIcons";
import { PressableScale } from "@/shared/ui/PressableScale";
import type { UiTokens } from "@/shared/ui/primitives";
import { frostedCard, overlaySurface, withSemanticTokens } from "@/shared/ui/tokens";

import { ExpiryRow } from "./ExpiryRow";
import { ExpiryAddModal } from "./ExpiryAddModal";
import { createExpiryId, hydrateExpiryFromCloud, loadExpiryItems, saveExpiryItems } from "./expiryStorage";
import { daysUntil, filterExpiry, sortExpiryByUrgency, todayIso, type ExpiryFilter, type ExpiryItem } from "./expiryUtils";

type AnchorRect = { height: number; left: number; top: number; width: number };

const FILTER_TABS: { label: string; value: ExpiryFilter }[] = [
  { label: "全部", value: "all" },
  { label: "即将到期", value: "soon" },
  { label: "已过期", value: "expired" }
];

function getAnchorRect(event: unknown): AnchorRect {
  const target = (event as { currentTarget?: unknown })?.currentTarget as { getBoundingClientRect?: () => DOMRect } | undefined;
  if (target && typeof target.getBoundingClientRect === "function") {
    const rect = target.getBoundingClientRect();
    return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
  }
  return { height: 42, left: 120, top: 180, width: 180 };
}

function getPopoverStyle(rect: AnchorRect, estimatedHeight = 200) {
  const padding = 12;
  const viewportHeight = typeof window === "undefined" ? 760 : window.innerHeight;
  const viewportWidth = typeof window === "undefined" ? 390 : window.innerWidth;
  const topBelow = rect.top + rect.height + 8;
  const top = topBelow + estimatedHeight > viewportHeight - padding ? Math.max(padding, rect.top - estimatedHeight - 8) : topBelow;
  const minWidth = Math.max(150, rect.width);
  const maxLeft = Math.max(padding, viewportWidth - minWidth - padding);
  return { left: Math.min(Math.max(padding, rect.left), maxLeft), minWidth, top };
}

function shouldUsePortal() {
  return Platform.OS === "web" && typeof document !== "undefined" && Boolean(document.body) && (typeof process === "undefined" || process.env.NODE_ENV !== "test");
}

function useExpiryTokens(): UiTokens {
  const themeId = readStoredThemeId(typeof window === "undefined" ? undefined : window.localStorage) ?? "default";
  const mode = readStoredColorMode(typeof window === "undefined" ? undefined : window.localStorage) ?? "light";
  const theme = getTheme(themeId);
  return withSemanticTokens(theme.tokens[mode], mode);
}

export function ExpiryManageScreen() {
  const tokens = useExpiryTokens();
  const [items, setItems] = useState<ExpiryItem[]>(() => loadExpiryItems());
  const [tab, setTab] = useState<ExpiryFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ExpiryItem | null>(null);
  const [renewId, setRenewId] = useState<string | null>(null);
  const [renewDate, setRenewDate] = useState(todayIso());
  const [menu, setMenu] = useState<{ id: string; rect: AnchorRect } | null>(null);

  useEffect(() => {
    let cancelled = false;
    hydrateExpiryFromCloud()
      .then((next) => !cancelled && setItems(next))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const today = todayIso();
  const visible = useMemo(() => sortExpiryByUrgency(filterExpiry(items, tab, today), today), [items, tab, today]);
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const persist = (next: ExpiryItem[]) => {
    setItems(next);
    saveExpiryItems(next);
  };

  const handleSave = (item: ExpiryItem) => {
    setItems((previous) => {
      const exists = previous.some((entry) => entry.id === item.id);
      const next = exists ? previous.map((entry) => (entry.id === item.id ? item : entry)) : [...previous, item];
      saveExpiryItems(next);
      return next;
    });
    setAddOpen(false);
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    const target = items.find((entry) => entry.id === id);
    if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm(`确认删除「${target?.title ?? ""}」吗？此操作不可撤销。`)) return;
    persist(items.filter((entry) => entry.id !== id));
    setMenu(null);
  };

  const openRenew = (id: string) => {
    const target = items.find((entry) => entry.id === id);
    if (!target) return;
    setRenewDate(target.expiryDate);
    setRenewId(id);
    setMenu(null);
  };

  const confirmRenew = (date: string) => {
    if (!renewId) return;
    const now = new Date().toISOString();
    persist(items.map((entry) => (entry.id === renewId ? { ...entry, expiryDate: date, updatedAt: now } : entry)));
    setRenewId(null);
  };

  const openMenu = (id: string, event: unknown) => {
    setMenu({ id, rect: getAnchorRect(event) });
  };

  const menuNode = menu ? (
    <Pressable accessibilityLabel="关闭操作菜单" onPress={() => setMenu(null)} style={styles.popoverBackdrop} testID="expiry-menu-dismiss">
      <View style={[styles.popoverCard, getPopoverStyle(menu.rect, 200)]} testID="expiry-menu">
        <Pressable accessibilityLabel="编辑该提醒" accessibilityRole="button" onPress={() => { const id = menu.id; setMenu(null); const target = items.find((e) => e.id === id); if (target) { setEditing(target); setAddOpen(true); } }} style={styles.popoverOption}>
          <Text style={styles.popoverOptionText}>编辑</Text>
        </Pressable>
        <Pressable accessibilityLabel="已办理 / 续期" accessibilityRole="button" onPress={() => openRenew(menu.id)} style={styles.popoverOption}>
          <Text style={styles.popoverOptionText}>已办理 / 续期</Text>
        </Pressable>
        <Pressable accessibilityLabel="删除该提醒" accessibilityRole="button" onPress={() => handleDelete(menu.id)} style={[styles.popoverOption, styles.popoverDelete]}>
          <Text style={[styles.popoverOptionText, styles.popoverDeleteText]}>删除</Text>
        </Pressable>
      </View>
    </Pressable>
  ) : null;

  return (
    <View style={[styles.page, { backgroundColor: tokens.background }]}>
      <View style={styles.header}>
        <PressableScale
          accessibilityLabel="返回首页"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
          wrapperStyle={styles.backButtonWrap}
        >
          <Text style={styles.backButtonText}>← 返回</Text>
        </PressableScale>
        <Text style={styles.headerTitle}>到期提醒</Text>
        <PressableScale
          accessibilityLabel="添加到期提醒"
          accessibilityRole="button"
          onPress={() => {
            setEditing(null);
            setAddOpen(true);
          }}
          style={styles.addTop}
          wrapperStyle={styles.addTopWrap}
        >
          <IconPlus color={tokens.accent} size={18} />
        </PressableScale>
      </View>

      <View style={styles.filterRow}>
        {FILTER_TABS.map((entry) => {
          const selected = tab === entry.value;
          return (
            <Pressable
              accessibilityLabel={`筛选：${entry.label}`}
              accessibilityRole="button"
              key={entry.value}
              onPress={() => setTab(entry.value)}
              style={[styles.filterChip, selected ? { backgroundColor: tokens.accentSoft, borderColor: tokens.accent } : { backgroundColor: tokens.surfaceMuted, borderColor: tokens.border }]}
            >
              <Text style={[styles.filterChipText, { color: selected ? tokens.accent : tokens.textMuted }]}>{entry.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {visible.length === 0 ? (
          <View style={[frostedCard(tokens), styles.empty]}>
            <Text style={styles.emptyTitle}>这里还没有到期提醒</Text>
            <Text style={styles.emptyHint}>证件、保单、会员、合同……记录后自动倒计时。</Text>
            <PressableScale accessibilityLabel="添加到期提醒" accessibilityRole="button" onPress={() => { setEditing(null); setAddOpen(true); }} style={styles.emptyAdd} wrapperStyle={{ width: "100%" }}>
              <Text style={styles.emptyAddText}>＋ 添加提醒</Text>
            </PressableScale>
          </View>
        ) : (
          <View style={styles.list}>
            {visible.map((item) => (
              <PressableScale
                key={item.id}
                accessibilityLabel={`编辑：${item.title}`}
                accessibilityRole="button"
                onPress={() => {
                  setEditing(item);
                  setAddOpen(true);
                }}
                style={[frostedCard(tokens), styles.row]}
                wrapperStyle={{ width: "100%" }}
              >
                <ExpiryRow item={item} showCategory tokens={tokens} today={today} />
                <Pressable
                  accessibilityLabel={`${item.title} 更多操作`}
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={(event) => {
                    event.stopPropagation();
                    openMenu(item.id, event);
                  }}
                  style={styles.moreButton}
                  testID={`expiry-menu-${item.id}`}
                >
                  <IconMoreHorizontal color={tokens.textMuted} size={18} />
                </Pressable>
              </PressableScale>
            ))}
          </View>
        )}
      </ScrollView>

      <ExpiryAddModal
        editingItem={editing}
        onCancel={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        onDelete={(id) => {
          handleDelete(id);
          setAddOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        tokens={tokens}
        visible={addOpen}
      />

      <DatePickerPopup
        onCancel={() => setRenewId(null)}
        onConfirm={(date) => confirmRenew(date)}
        selectedDate={renewDate}
        title="选择新的到期日期"
        visible={renewId !== null}
      />

      {shouldUsePortal() && menuNode ? createPortal(menuNode, document.body) : menuNode}
    </View>
  );
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    addTop: {
      alignItems: "center",
      backgroundColor: tokens.accentSoft,
      borderRadius: 10,
      height: 34,
      justifyContent: "center",
      width: 34
    },
    addTopWrap: {
      flexShrink: 0
    },
    backButton: {
      backgroundColor: tokens.accentSoft,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8
    },
    backButtonText: {
      color: tokens.accent,
      fontSize: 14,
      fontWeight: "900"
    },
    backButtonWrap: {
      flexShrink: 0
    },
    empty: {
      alignItems: "center",
      gap: 8,
      padding: 24
    },
    emptyAdd: {
      alignItems: "center",
      backgroundColor: tokens.accent,
      borderRadius: 12,
      justifyContent: "center",
      marginTop: 6,
      minHeight: 42,
      paddingHorizontal: 16
    },
    emptyAddText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "900"
    },
    emptyHint: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "700",
      textAlign: "center"
    },
    emptyTitle: {
      color: tokens.text,
      fontSize: 16,
      fontWeight: "900"
    },
    filterChip: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 8
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: "900"
    },
    filterRow: {
      flexDirection: "row",
      gap: 8,
      paddingBottom: 12,
      paddingHorizontal: 16,
      paddingTop: 14
    },
    header: {
      alignItems: "center",
      backgroundColor: tokens.surface,
      borderBottomColor: tokens.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12
    },
    headerTitle: {
      color: tokens.text,
      fontSize: 17,
      fontWeight: "900"
    },
    list: {
      gap: 12
    },
    moreButton: {
      alignItems: "center",
      height: 32,
      justifyContent: "center",
      width: 32
    },
    page: {
      flex: 1,
      paddingTop: "env(safe-area-inset-top, 0px)" as unknown as number
    },
    popoverBackdrop: {
      backgroundColor: "rgba(0, 0, 0, 0.25)",
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0
    },
    popoverCard: {
      backgroundColor: tokens.surfaceOverlay ?? "#ffffff",
      borderRadius: 14,
      borderColor: tokens.border,
      borderWidth: 1,
      gap: 2,
      padding: 6,
      position: "absolute",
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 22
    },
    popoverDelete: {
      borderTopColor: tokens.border,
      borderTopWidth: 1
    },
    popoverDeleteText: {
      color: tokens.danger ?? "#ef4444"
    },
    popoverOption: {
      alignItems: "flex-start",
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11
    },
    popoverOptionText: {
      color: tokens.text,
      fontSize: 14,
      fontWeight: "800"
    },
    row: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      justifyContent: "space-between",
      padding: 14
    },
    scroll: {
      gap: 14,
      padding: 16,
      paddingBottom: 40
    }
  });
}
