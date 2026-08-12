import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { DatePickerPopup } from "@/shared/ui/DatePickerPopup";
import { FormField, TextFormField } from "@/shared/ui/FormField";
import { IconCalendarDays, IconChevronDown } from "@/shared/ui/lineIcons";
import { PressableScale } from "@/shared/ui/PressableScale";
import type { UiTokens } from "@/shared/ui/primitives";
import { overlaySurface } from "@/shared/ui/tokens";

import { createExpiryId } from "./expiryStorage";
import {
  categoryLabel,
  DEFAULT_REMINDER_DAYS,
  EXPIRY_CATEGORIES,
  REMINDER_NODES,
  todayIso,
  type ExpiryCategory,
  type ExpiryItem
} from "./expiryUtils";

type AnchorRect = { height: number; left: number; top: number; width: number };

type ExpiryAddModalProps = {
  editingItem?: ExpiryItem | null;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  onSave: (item: ExpiryItem) => void;
  tokens: UiTokens;
  visible: boolean;
};

function getAnchorRect(event: unknown): AnchorRect {
  const target = (event as { currentTarget?: unknown })?.currentTarget as { getBoundingClientRect?: () => DOMRect } | undefined;
  if (target && typeof target.getBoundingClientRect === "function") {
    const rect = target.getBoundingClientRect();
    return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
  }
  return { height: 44, left: 120, top: 180, width: 180 };
}

function getPopoverStyle(rect: AnchorRect, estimatedHeight = 320) {
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

export function ExpiryAddModal({ editingItem, onCancel, onDelete, onSave, tokens, visible }: ExpiryAddModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ExpiryCategory>("id");
  const [expiryDate, setExpiryDate] = useState(todayIso());
  const [reminderDays, setReminderDays] = useState<number[]>([...DEFAULT_REMINDER_DAYS]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [categoryRect, setCategoryRect] = useState<AnchorRect | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");

  useEffect(() => {
    if (!visible) return;
    if (editingItem) {
      setTitle(editingItem.title);
      setCategory(editingItem.category);
      setExpiryDate(editingItem.expiryDate);
      setReminderDays([...editingItem.reminderDays]);
      setNote(editingItem.note ?? "");
    } else {
      setTitle("");
      setCategory("id");
      setExpiryDate(todayIso());
      setReminderDays([...DEFAULT_REMINDER_DAYS]);
      setNote("");
    }
    setError(null);
    setDatePickerVisible(false);
    setCategoryOpen(false);
    setCustomValue("");
  }, [visible, editingItem]);

  if (!visible) return null;

  const styles = createStyles(tokens);

  const toggleReminder = (days: number) => {
    setReminderDays((previous) =>
      previous.includes(days) ? previous.filter((value) => value !== days) : [...previous, days]
    );
  };

  const addCustom = () => {
    const parsed = Number.parseInt(customValue, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("自定义提醒请填写大于 0 的天数");
      return;
    }
    if (!reminderDays.includes(parsed)) {
      setReminderDays((previous) => [...previous, parsed]);
    }
    setCustomValue("");
    setError(null);
  };

  const handleSave = () => {
    if (!title.trim()) {
      setError("请填写事项名称");
      return;
    }
    const now = new Date().toISOString();
    const days = [...reminderDays].sort((a, b) => b - a);
    const item: ExpiryItem = editingItem
      ? { ...editingItem, category, expiryDate, note: note.trim() || undefined, reminderDays: days, title: title.trim(), updatedAt: now }
      : { category, createdAt: now, expiryDate, id: createExpiryId(), note: note.trim() || undefined, reminderDays: days, title: title.trim(), updatedAt: now };
    onSave(item);
  };

  const handleDelete = () => {
    if (!editingItem) return;
    if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm(`确认删除「${editingItem.title}」吗？此操作不可撤销。`)) return;
    onDelete?.(editingItem.id);
  };

  const openCategory = (event: unknown) => {
    setCategoryRect(getAnchorRect(event));
    setCategoryOpen(true);
  };

  const categoryMenu = categoryOpen && categoryRect ? (
    <Pressable accessibilityLabel="关闭类型选择" onPress={() => setCategoryOpen(false)} style={styles.popoverBackdrop} testID="expiry-category-dismiss">
      <View style={[styles.popoverCard, getPopoverStyle(categoryRect, EXPIRY_CATEGORIES.length * 46 + 16)]} testID="expiry-category-popover">
        {EXPIRY_CATEGORIES.map((entry) => (
          <Pressable
            accessibilityLabel={`选择类型：${entry.label}`}
            accessibilityRole="button"
            key={entry.value}
            onPress={() => {
              setCategory(entry.value);
              setCategoryOpen(false);
            }}
            style={[styles.popoverOption, category === entry.value ? styles.popoverOptionActive : null]}
          >
            <Text style={[styles.popoverOptionText, category === entry.value ? { color: tokens.accent } : null]}>{entry.label}</Text>
          </Pressable>
        ))}
      </View>
    </Pressable>
  ) : null;

  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <Pressable accessibilityLabel="关闭到期提醒弹窗" onPress={onCancel} style={styles.backdrop}>
        <Pressable onPress={(event) => event.stopPropagation()} style={[overlaySurface(tokens), styles.card]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{editingItem ? "编辑到期提醒" : "添加到期提醒"}</Text>
            <Pressable accessibilityLabel="关闭" accessibilityRole="button" onPress={onCancel} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <TextFormField
              label="事项名称"
              tokens={tokens}
              value={title}
              onChangeText={setTitle}
              placeholder="如：驾驶证"
              testID="expiry-title-input"
            />

            <FormField label="类型" tokens={tokens}>
              <Pressable
                accessibilityLabel="选择类型"
                accessibilityRole="button"
                onPress={openCategory}
                style={styles.selectButton}
                testID="expiry-category-field"
              >
                <Text style={styles.selectValue}>{categoryLabel(category)}</Text>
                <IconChevronDown color={tokens.textMuted} size={16} />
              </Pressable>
            </FormField>

            <FormField label="到期日期" tokens={tokens}>
              <Pressable
                accessibilityLabel="选择到期日期"
                accessibilityRole="button"
                onPress={() => setDatePickerVisible(true)}
                style={styles.selectButton}
                testID="expiry-date-field"
              >
                <Text style={styles.selectValue}>{expiryDate}</Text>
                <IconCalendarDays color={tokens.textMuted} size={16} />
              </Pressable>
            </FormField>

            <FormField label="提醒时间" tokens={tokens}>
              <View style={styles.reminderRow}>
                {REMINDER_NODES.map((node) => {
                  const selected = reminderDays.includes(node.days);
                  return (
                    <Pressable
                      accessibilityLabel={`${selected ? "取消" : "设置"}${node.label}`}
                      accessibilityRole="button"
                      key={node.days}
                      onPress={() => toggleReminder(node.days)}
                      style={[
                        styles.reminderChip,
                        selected ? { backgroundColor: tokens.accentSoft, borderColor: tokens.accent } : { backgroundColor: tokens.surfaceMuted, borderColor: tokens.border }
                      ]}
                    >
                      <Text style={[styles.reminderChipText, { color: selected ? tokens.accent : tokens.textMuted }]}>{node.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.customRow}>
                <TextInput
                  keyboardType="numeric"
                  onChangeText={setCustomValue}
                  placeholder="自定义提前天数"
                  style={[styles.customInput, { borderColor: tokens.border, color: tokens.text }]}
                  testID="expiry-custom-input"
                  value={customValue}
                />
                <Pressable accessibilityLabel="添加自定义提醒" accessibilityRole="button" onPress={addCustom} style={styles.customAdd}>
                  <Text style={styles.customAddText}>＋ 自定义提醒</Text>
                </Pressable>
              </View>
            </FormField>

            <TextFormField
              label="备注（可选）"
              tokens={tokens}
              value={note}
              onChangeText={setNote}
              placeholder="如：去车管所办理换证"
              multiline
              numberOfLines={2}
              testID="expiry-note-input"
            />

            {error ? <Text style={[styles.error, { color: tokens.danger ?? "#ef4444" }]}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            {editingItem && onDelete ? (
              <Pressable accessibilityLabel="删除该提醒" accessibilityRole="button" onPress={handleDelete} style={styles.deleteButton} testID="expiry-delete">
                <Text style={styles.deleteText}>删除</Text>
              </Pressable>
            ) : (
              <View style={styles.footerSpacer} />
            )}
            <Pressable accessibilityLabel="取消" accessibilityRole="button" onPress={onCancel} style={[styles.footerButton, styles.cancelButton]}>
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
            <Pressable accessibilityLabel="保存到期提醒" accessibilityRole="button" onPress={handleSave} style={[styles.footerButton, styles.saveButton]} testID="expiry-save">
              <Text style={styles.saveText}>保存</Text>
            </Pressable>
          </View>

          <DatePickerPopup
            onCancel={() => setDatePickerVisible(false)}
            onConfirm={(date) => {
              setExpiryDate(date);
              setDatePickerVisible(false);
            }}
            selectedDate={expiryDate}
            title="选择到期日期"
            visible={datePickerVisible}
          />
        </Pressable>
      </Pressable>
      {shouldUsePortal() && categoryMenu ? createPortal(categoryMenu, document.body) : categoryMenu}
    </Modal>
  );
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    backdrop: {
      backgroundColor: "rgba(0, 0, 0, 0.35)",
      flex: 1
    },
    card: {
      alignSelf: "center",
      borderRadius: 22,
      gap: 12,
      maxHeight: "88%",
      maxWidth: 460,
      padding: 16,
      width: "90%"
    },
    closeButton: {
      alignItems: "center",
      borderRadius: 999,
      height: 30,
      justifyContent: "center",
      width: 30
    },
    closeText: {
      color: tokens.textMuted,
      fontSize: 16,
      fontWeight: "900"
    },
    customAdd: {
      alignItems: "center",
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 12,
      justifyContent: "center",
      paddingHorizontal: 14,
      paddingVertical: 10
    },
    customAddText: {
      color: tokens.text,
      fontSize: 13,
      fontWeight: "900"
    },
    customInput: {
      backgroundColor: tokens.surfaceMuted,
      borderColor: tokens.border,
      borderRadius: 12,
      borderWidth: 1.5,
      flex: 1,
      fontSize: 14,
      fontWeight: "800",
      minHeight: 44,
      paddingHorizontal: 12
    },
    customRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      marginTop: 8
    },
    deleteButton: {
      alignItems: "center",
      borderRadius: 12,
      borderColor: tokens.danger ?? "#ef4444",
      borderWidth: 1.5,
      justifyContent: "center",
      paddingHorizontal: 16,
      paddingVertical: 12
    },
    deleteText: {
      color: tokens.danger ?? "#ef4444",
      fontSize: 14,
      fontWeight: "900"
    },
    error: {
      fontSize: 12,
      fontWeight: "800"
    },
    footer: {
      flexDirection: "row",
      gap: 10
    },
    footerButton: {
      alignItems: "center",
      borderRadius: 12,
      justifyContent: "center",
      paddingVertical: 12,
      flex: 1
    },
    footerSpacer: {
      flex: 1
    },
    cancelButton: {
      backgroundColor: tokens.surfaceMuted,
      flexShrink: 0,
      paddingHorizontal: 16
    },
    cancelText: {
      color: tokens.text,
      fontSize: 14,
      fontWeight: "900"
    },
    saveButton: {
      backgroundColor: tokens.accent,
      flex: 2
    },
    saveText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "900"
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    headerTitle: {
      color: tokens.text,
      fontSize: 17,
      fontWeight: "900"
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
    popoverOption: {
      alignItems: "flex-start",
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11
    },
    popoverOptionActive: {
      backgroundColor: tokens.accentSoft
    },
    popoverOptionText: {
      color: tokens.text,
      fontSize: 14,
      fontWeight: "800"
    },
    reminderChip: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    reminderChipText: {
      fontSize: 13,
      fontWeight: "900"
    },
    reminderRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    scroll: {
      gap: 14,
      paddingVertical: 4
    },
    selectButton: {
      alignItems: "center",
      backgroundColor: tokens.surfaceMuted,
      borderColor: tokens.border,
      borderRadius: 14,
      borderWidth: 1.5,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 48,
      paddingHorizontal: 12
    },
    selectValue: {
      color: tokens.text,
      fontSize: 14,
      fontWeight: "800"
    }
  });
}
