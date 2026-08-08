import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { DatePickerPopup } from "@/shared/ui/DatePickerPopup";
import { PuppyIllustration } from "@/shared/ui/PuppyIllustration";
import type { UiTokens } from "@/shared/ui/primitives";
import { QUICK_CAPTURE_DATA_EVENT } from "@/features/quick-capture/quickCapture";
import { createPackageId, getDefaultPackageStorage, hydratePackagesFromCloud, loadPackages, savePackages, type PackageItem, type PackageStorage } from "./packageStorage";

type PackagePanelProps = {
  shortcutCreate?: boolean;
  shortcutScan?: boolean;
  storage?: PackageStorage;
  themeTokens: UiTokens;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyItem = (): Omit<PackageItem, "id" | "createTime"> => ({
  arrivalDate: todayIso(),
  company: "",
  image: null,
  orderNumber: "",
  pickedUp: false,
  pickupCode: "",
  pickupLocation: ""
});

export function isPackageDraftAddable(form: Omit<PackageItem, "id" | "createTime">): boolean {
  return Boolean(form.company.trim() || form.image || form.pickupCode.trim() || form.pickupLocation.trim());
}

export function PackagePanel({ shortcutCreate = false, shortcutScan = false, storage, themeTokens }: PackagePanelProps) {
  const pkgStorage = useMemo(() => storage ?? getDefaultPackageStorage(), [storage]);
  const companyInputRef = useRef<TextInput>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<PackageItem[]>(() => loadPackages(pkgStorage));
  const [form, setForm] = useState(emptyItem());
  const [manualOpen, setManualOpen] = useState(false);
  const [pickedOpen, setPickedOpen] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const styles = useMemo(() => createStyles(themeTokens), [themeTokens]);

  useEffect(() => {
    let cancelled = false;
    hydratePackagesFromCloud(pkgStorage)
      .then((next) => !cancelled && setItems(next))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pkgStorage]);

  useEffect(() => {
    if (!shortcutCreate) return;
    setManualOpen(true);
    const timer = setTimeout(() => companyInputRef.current?.focus(), 140);
    return () => clearTimeout(timer);
  }, [shortcutCreate]);

  useEffect(() => {
    if (!shortcutScan) return;
    const timer = setTimeout(() => fileInputRef.current?.click(), 180);
    return () => clearTimeout(timer);
  }, [shortcutScan]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    const refresh = () => setItems(loadPackages(pkgStorage));
    window.addEventListener(QUICK_CAPTURE_DATA_EVENT, refresh);
    return () => window.removeEventListener(QUICK_CAPTURE_DATA_EVENT, refresh);
  }, [pkgStorage]);

  const unpicked = useMemo(() => sortByDate(items.filter((item) => !item.pickedUp)), [items]);
  const picked = useMemo(() => sortByDate(items.filter((item) => item.pickedUp)), [items]);

  const persist = (next: PackageItem[]) => {
    setItems(next);
    savePackages(next, pkgStorage);
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new Event(QUICK_CAPTURE_DATA_EVENT));
    }
  };

  const resetDraft = () => {
    setForm(emptyItem());
    setEditingId(null);
    setManualOpen(false);
  };

  const saveDraft = () => {
    if (!isPackageDraftAddable(form)) {
      setFeedback("上传截图，或至少填写一项信息后再保存。");
      return;
    }

    if (editingId) {
      persist(items.map((item) => (item.id === editingId ? normalizeSavedItem({ ...item, ...form }) : item)));
      resetDraft();
      setFeedback("快递已更新。");
      return;
    }

    persist([normalizeSavedItem({ ...form, createTime: new Date().toISOString(), id: createPackageId() }), ...items]);
    resetDraft();
    setFeedback("快递已保存。");
  };

  const togglePickedUp = (id: string) => {
    persist(items.map((item) => (item.id === id ? { ...item, pickedUp: !item.pickedUp } : item)));
  };

  const deleteItem = (id: string) => {
    persist(items.filter((item) => item.id !== id));
    setMenuId(null);
    setDeleteConfirmId(null);
  };

  const editItem = (item: PackageItem) => {
    setForm({
      arrivalDate: item.arrivalDate || todayIso(),
      company: item.company,
      image: item.image,
      orderNumber: "",
      pickedUp: item.pickedUp,
      pickupCode: item.pickupCode,
      pickupLocation: item.pickupLocation
    });
    setEditingId(item.id);
    setManualOpen(true);
    setMenuId(null);
    setTimeout(() => companyInputRef.current?.focus(), 80);
  };

  const copyCode = async (code: string) => {
    if (!code) return;
    try {
      await navigator?.clipboard?.writeText(code);
      setFeedback("取件码已复制。");
    } catch {
      setFeedback(`取件码：${code}`);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const extracted = extractPackageFieldsFromText(file.name);
      setForm((previous) => ({
        ...previous,
        ...extracted,
        arrivalDate: extracted.arrivalDate || previous.arrivalDate || todayIso(),
        image: String(reader.result)
      }));
      setManualOpen(false);
      setFeedback(Object.keys(extracted).length > 0 ? "已尝试识别截图信息，请核对后保存。" : "截图已上传，未识别到文字也可以直接保存。");
    };
    reader.readAsDataURL(file);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>快递</Text>
          <Text style={styles.subtitle}>待取 {unpicked.length} 个</Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="上传快递截图" onPress={() => fileInputRef.current?.click()} style={styles.uploadHero}>
        <Text style={styles.uploadHeroIcon}>+</Text>
        <View style={styles.uploadHeroTextBox}>
          <Text style={styles.uploadHeroTitle}>上传快递截图</Text>
          <Text style={styles.uploadHeroSub}>截图可直接保存，识别不到也能手动补充。</Text>
        </View>
      </Pressable>

      {typeof document !== "undefined" ? <input accept="image/*" onChange={handleFileChange} ref={fileInputRef} style={{ display: "none" }} type="file" /> : null}

      {form.image ? (
        <View style={styles.recognitionCard} testID="package-recognition-card">
          <Pressable onPress={() => setExpandedImage(form.image)} style={styles.thumbnailWrap}>
            <Image source={{ uri: form.image }} style={styles.thumbnail} />
          </Pressable>
          <View style={styles.recognitionBody}>
            <Text style={styles.recognitionTitle}>识别结果</Text>
            <Text numberOfLines={1} style={styles.recognitionMeta}>{form.pickupCode || "未识别取件码"} · {form.pickupLocation || "未识别地点"} · {form.company || "未识别公司"}</Text>
            <View style={styles.recognitionActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="确认保存截图快递" onPress={saveDraft} style={styles.miniPrimary}>
                <Text style={styles.miniPrimaryText}>确认保存</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="修改识别结果" onPress={() => setManualOpen(true)} style={styles.miniGhost}>
                <Text style={styles.miniGhostText}>修改</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      <Pressable accessibilityRole="button" accessibilityLabel="切换手动填写快递信息" onPress={() => setManualOpen((value) => !value)} style={styles.manualToggle}>
        <Text style={styles.manualToggleText}>{manualOpen ? "收起手动填写" : "手动填写（备用）"}</Text>
      </Pressable>

      {manualOpen ? (
        <View style={styles.form}>
          <View style={styles.formRow}>
            <TextInput autoFocus={shortcutCreate} ref={companyInputRef} onChangeText={(text) => setForm((previous) => ({ ...previous, company: text }))} placeholder="快递公司（可空）" placeholderTextColor="#9ca3af" style={[styles.input, styles.inputHalf]} testID="package-company-input" value={form.company} />
            <Pressable accessibilityRole="button" accessibilityLabel="选择到达日期" onPress={() => setDatePickerOpen(true)} style={[styles.input, styles.inputHalf, styles.dateTrigger]}>
              <Text numberOfLines={1} style={styles.dateTriggerText}>{form.arrivalDate || todayIso()}</Text>
            </Pressable>
          </View>
          <View style={styles.formRow}>
            <TextInput onChangeText={(text) => setForm((previous) => ({ ...previous, pickupLocation: text }))} placeholder="取件地点（可空）" placeholderTextColor="#9ca3af" style={[styles.input, styles.inputHalf]} value={form.pickupLocation} />
            <TextInput onChangeText={(text) => setForm((previous) => ({ ...previous, pickupCode: text }))} placeholder="取件码（可空）" placeholderTextColor="#9ca3af" style={[styles.input, styles.inputHalf]} value={form.pickupCode} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="保存快递" onPress={saveDraft} style={[styles.addButton, !isPackageDraftAddable(form) ? styles.addButtonDisabled : null]}>
            <Text style={styles.addText}>{editingId ? "保存修改" : "保存快递"}</Text>
          </Pressable>
        </View>
      ) : null}

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

      <View style={styles.list}>
        {unpicked.length === 0 && picked.length === 0 ? (
          <View style={styles.emptyBox}>
            <PuppyIllustration color={themeTokens.textMuted} scene="package" size={78} />
            <Text style={styles.empty}>还没有快递。上传截图就能先记一条。</Text>
          </View>
        ) : null}
        {unpicked.map((item) => (
          <PackageCard
            confirmDelete={deleteConfirmId === item.id}
            item={item}
            key={item.id}
            menuOpen={menuId === item.id}
            onCancelDelete={() => setDeleteConfirmId(null)}
            onCopy={copyCode}
            onDelete={deleteItem}
            onEdit={editItem}
            onMenu={() => {
              setMenuId((value) => (value === item.id ? null : item.id));
              setDeleteConfirmId(null);
            }}
            onPreview={setExpandedImage}
            onShowCode={setExpandedCode}
            onToggle={togglePickedUp}
            requestDelete={() => setDeleteConfirmId(item.id)}
            styles={styles}
          />
        ))}

        {picked.length > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="展开已取快递" onPress={() => setPickedOpen((value) => !value)} style={styles.pickedToggle}>
            <Text style={styles.pickedToggleText}>已取 {picked.length} 个 · {pickedOpen ? "收起" : "展开"}</Text>
          </Pressable>
        ) : null}

        {pickedOpen
          ? picked.map((item) => (
              <PackageCard
                confirmDelete={deleteConfirmId === item.id}
                item={item}
                key={item.id}
                menuOpen={menuId === item.id}
                onCancelDelete={() => setDeleteConfirmId(null)}
                onCopy={copyCode}
                onDelete={deleteItem}
                onEdit={editItem}
                onMenu={() => {
                  setMenuId((value) => (value === item.id ? null : item.id));
                  setDeleteConfirmId(null);
                }}
                onPreview={setExpandedImage}
                onShowCode={setExpandedCode}
                onToggle={togglePickedUp}
                requestDelete={() => setDeleteConfirmId(item.id)}
                styles={styles}
              />
            ))
          : null}
      </View>

      {expandedImage ? (
        <Pressable onPress={() => setExpandedImage(null)} style={styles.imageModal}>
          <Image resizeMode="contain" source={{ uri: expandedImage }} style={styles.expandedImage} />
        </Pressable>
      ) : null}

      {expandedCode ? (
        <Pressable onPress={() => setExpandedCode(null)} style={styles.codeModal} testID="package-code-modal">
          <View style={styles.codeModalCard}>
            <Text style={styles.codeModalLabel}>取件码</Text>
            <Text selectable style={styles.codeModalText}>{expandedCode}</Text>
            <View style={styles.codeModalActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="复制大号取件码" onPress={() => copyCode(expandedCode)} style={styles.codeModalButton}>
                <Text style={styles.codeModalButtonText}>复制</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="关闭取件码" onPress={() => setExpandedCode(null)} style={styles.codeModalButtonGhost}>
                <Text style={styles.codeModalButtonGhostText}>关闭</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      ) : null}

      <DatePickerPopup
        onCancel={() => setDatePickerOpen(false)}
        onConfirm={(date) => {
          setForm((previous) => ({ ...previous, arrivalDate: date }));
          setDatePickerOpen(false);
        }}
        selectedDate={form.arrivalDate}
        title="选择到达日期"
        visible={datePickerOpen}
      />
    </View>
  );
}

function PackageCard({
  confirmDelete,
  item,
  menuOpen,
  onCancelDelete,
  onCopy,
  onDelete,
  onEdit,
  onMenu,
  onPreview,
  onShowCode,
  onToggle,
  requestDelete,
  styles
}: {
  confirmDelete: boolean;
  item: PackageItem;
  menuOpen: boolean;
  onCancelDelete: () => void;
  onCopy: (code: string) => void;
  onDelete: (id: string) => void;
  onEdit: (item: PackageItem) => void;
  onMenu: () => void;
  onPreview: (image: string) => void;
  onShowCode: (code: string) => void;
  onToggle: (id: string) => void;
  requestDelete: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const displayCode = item.pickupCode.trim() || "待取快递";
  return (
    <View style={[styles.itemCard, item.pickedUp ? styles.itemCardDone : null]}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: item.pickedUp }} onPress={() => onToggle(item.id)} style={[styles.check, item.pickedUp ? styles.checkActive : null]}>
        {item.pickedUp ? <Text style={styles.checkMark}>✓</Text> : null}
      </Pressable>

      <View style={styles.itemBody}>
        <Pressable disabled={!item.pickupCode.trim()} onPress={() => item.pickupCode.trim() && onShowCode(item.pickupCode.trim())} testID={`package-code-${item.id}`}>
          <Text numberOfLines={1} style={[styles.pickupCode, item.pickedUp ? styles.itemDoneText : null]}>{displayCode}</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.itemMeta}>{item.pickupLocation || "未填取件地点"} · {item.company || "未填快递公司"}</Text>
        <Text style={styles.itemMeta}>{item.arrivalDate}</Text>
      </View>

      {item.image ? (
        <Pressable onPress={() => onPreview(item.image!)} style={styles.itemThumbWrap}>
          <Image source={{ uri: item.image }} style={styles.itemThumb} />
        </Pressable>
      ) : null}

      {item.pickupCode.trim() ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`复制取件码 ${item.pickupCode}`} onPress={() => onCopy(item.pickupCode)} style={styles.copyButton}>
          <Text style={styles.copyText}>复制</Text>
        </Pressable>
      ) : null}

      <Pressable accessibilityRole="button" accessibilityLabel={`更多快递操作 ${displayCode}`} onPress={onMenu} style={styles.moreButton} testID={`package-more-${item.id}`}>
        <Text style={styles.moreText}>···</Text>
      </Pressable>

      {menuOpen ? (
        <View style={styles.menu}>
          <Pressable accessibilityRole="button" accessibilityLabel={`编辑快递 ${displayCode}`} onPress={() => onEdit(item)} style={styles.menuItem}>
            <Text style={styles.menuText}>编辑</Text>
          </Pressable>
          {confirmDelete ? (
            <View style={styles.confirmRow}>
              <Pressable accessibilityRole="button" accessibilityLabel={`确认删除快递 ${displayCode}`} onPress={() => onDelete(item.id)} style={styles.dangerMini} testID={`package-delete-${item.id}`}>
                <Text style={styles.dangerMiniText}>确认</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="取消删除快递" onPress={onCancelDelete} style={styles.menuItem}>
                <Text style={styles.menuText}>取消</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel={`删除快递 ${displayCode}`} onPress={requestDelete} style={styles.menuItem} testID={`package-delete-${item.id}`}>
              <Text style={styles.deleteText}>删除</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

function normalizeSavedItem(item: PackageItem): PackageItem {
  return {
    ...item,
    arrivalDate: item.arrivalDate || todayIso(),
    company: item.company.trim(),
    orderNumber: "",
    pickupCode: item.pickupCode.trim(),
    pickupLocation: item.pickupLocation.trim()
  };
}

function sortByDate(items: PackageItem[]) {
  return [...items].sort((left, right) => `${right.arrivalDate}${right.createTime}`.localeCompare(`${left.arrivalDate}${left.createTime}`));
}

function extractPackageFieldsFromText(text: string): Partial<Omit<PackageItem, "id" | "createTime" | "image" | "pickedUp" | "orderNumber">> {
  const result: Partial<Omit<PackageItem, "id" | "createTime" | "image" | "pickedUp" | "orderNumber">> = {};
  const codeMatch = text.match(/(?:取件码|取件|code|码)[^\dA-Za-z]*([A-Za-z0-9-]{3,12})/i);
  if (codeMatch) result.pickupCode = codeMatch[1];
  const dateMatch = text.match(/(20\d{2})[-年](\d{1,2})[-月](\d{1,2})/);
  if (dateMatch) result.arrivalDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
  for (const company of ["顺丰", "中通", "圆通", "韵达", "申通", "京东", "邮政", "极兔", "SF"]) {
    if (text.includes(company)) {
      result.company = company;
      break;
    }
  }
  return result;
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    addButton: {
      alignItems: "center",
      backgroundColor: tokens.accent,
      borderRadius: 12,
      justifyContent: "center",
      minHeight: 46,
      paddingVertical: 11
    },
    addButtonDisabled: {
      opacity: 0.45
    },
    addText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "900"
    },
    card: {
      backgroundColor: "#ffffff",
      borderColor: "#e3e6eb",
      borderRadius: 18,
      borderWidth: 1,
      gap: 10,
      overflow: "visible",
      padding: 14,
      position: "relative",
      width: "100%"
    },
    check: {
      alignItems: "center",
      borderColor: tokens.textMuted,
      borderRadius: 999,
      borderWidth: 1.5,
      height: 24,
      justifyContent: "center",
      width: 24
    },
    checkActive: {
      backgroundColor: "#34a853",
      borderColor: "#34a853"
    },
    checkMark: {
      color: "#ffffff",
      fontSize: 13,
      fontWeight: "900"
    },
    codeModal: {
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.62)",
      bottom: 0,
      justifyContent: "center",
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      zIndex: 220
    },
    codeModalActions: {
      flexDirection: "row",
      gap: 10,
      justifyContent: "center",
      marginTop: 16
    },
    codeModalButton: {
      backgroundColor: tokens.accent,
      borderRadius: 999,
      paddingHorizontal: 18,
      paddingVertical: 9
    },
    codeModalButtonGhost: {
      backgroundColor: "#eef2f7",
      borderRadius: 999,
      paddingHorizontal: 18,
      paddingVertical: 9
    },
    codeModalButtonGhostText: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "900"
    },
    codeModalButtonText: {
      color: "#ffffff",
      fontSize: 13,
      fontWeight: "900"
    },
    codeModalCard: {
      alignItems: "center",
      backgroundColor: "#ffffff",
      borderRadius: 20,
      maxWidth: 360,
      padding: 24,
      width: "82%"
    },
    codeModalLabel: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "900"
    },
    codeModalText: {
      color: tokens.text,
      fontSize: 42,
      fontWeight: "900",
      letterSpacing: 0,
      marginTop: 8,
      textAlign: "center"
    },
    confirmRow: {
      flexDirection: "row",
      gap: 6
    },
    copyButton: {
      backgroundColor: "#eef7ff",
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 6
    },
    copyText: {
      color: "#1677a8",
      fontSize: 12,
      fontWeight: "900"
    },
    dangerMini: {
      backgroundColor: "#fee2e2",
      borderRadius: 9,
      paddingHorizontal: 9,
      paddingVertical: 7
    },
    dangerMiniText: {
      color: "#dc2626",
      fontSize: 12,
      fontWeight: "900"
    },
    dateTrigger: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "flex-start"
    },
    dateTriggerText: {
      color: tokens.text,
      fontSize: 13,
      fontWeight: "700"
    },
    deleteText: {
      color: "#d14d4d",
      fontSize: 12,
      fontWeight: "900"
    },
    empty: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "700",
      textAlign: "center"
    },
    emptyBox: {
      alignItems: "center",
      gap: 6,
      justifyContent: "center",
      minHeight: 132,
      paddingVertical: 8
    },
    expandedImage: {
      height: "80%",
      width: "90%"
    },
    feedback: {
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "800"
    },
    form: {
      gap: 8
    },
    formRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    imageModal: {
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.85)",
      bottom: 0,
      justifyContent: "center",
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      zIndex: 200
    },
    input: {
      backgroundColor: "#f8fafc",
      borderColor: "#e3e6eb",
      borderRadius: 12,
      borderWidth: 1,
      color: tokens.text,
      fontSize: 13,
      minHeight: 38,
      paddingHorizontal: 12,
      paddingVertical: 7
    },
    inputHalf: {
      flex: 1,
      flexBasis: "46%",
      minWidth: 120
    },
    itemBody: {
      flex: 1,
      gap: 2,
      minWidth: 90
    },
    itemCard: {
      alignItems: "center",
      backgroundColor: "#f8fafc",
      borderColor: "#e3e6eb",
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      minHeight: 64,
      padding: 10,
      position: "relative",
      width: "100%"
    },
    itemCardDone: {
      opacity: 0.72
    },
    itemDoneText: {
      textDecorationLine: "line-through"
    },
    itemMeta: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "700"
    },
    itemThumb: {
      borderRadius: 8,
      height: 46,
      width: 46
    },
    itemThumbWrap: {
      borderRadius: 8
    },
    list: {
      gap: 8
    },
    manualToggle: {
      alignSelf: "flex-start",
      backgroundColor: "#f1f5f9",
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7
    },
    manualToggleText: {
      color: "#64748b",
      fontSize: 12,
      fontWeight: "900"
    },
    menu: {
      backgroundColor: "#ffffff",
      borderColor: "#e3e6eb",
      borderRadius: 12,
      borderWidth: 1,
      gap: 4,
      padding: 6,
      position: "absolute",
      right: 8,
      top: 42,
      zIndex: 30
    },
    menuItem: {
      borderRadius: 9,
      paddingHorizontal: 10,
      paddingVertical: 7
    },
    menuText: {
      color: tokens.text,
      fontSize: 12,
      fontWeight: "900"
    },
    miniGhost: {
      backgroundColor: "#eef2f7",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    miniGhostText: {
      color: "#64748b",
      fontSize: 12,
      fontWeight: "900"
    },
    miniPrimary: {
      backgroundColor: tokens.accent,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    miniPrimaryText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "900"
    },
    moreButton: {
      alignItems: "center",
      backgroundColor: "#eef2f7",
      borderRadius: 999,
      height: 30,
      justifyContent: "center",
      width: 30
    },
    moreText: {
      color: tokens.textMuted,
      fontSize: 16,
      fontWeight: "900",
      lineHeight: 18
    },
    pickedToggle: {
      alignItems: "center",
      backgroundColor: "#f1f5f9",
      borderRadius: 12,
      paddingVertical: 9
    },
    pickedToggleText: {
      color: "#64748b",
      fontSize: 13,
      fontWeight: "900"
    },
    pickupCode: {
      color: tokens.text,
      fontSize: 20,
      fontWeight: "900",
      lineHeight: 24
    },
    recognitionActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 7
    },
    recognitionBody: {
      flex: 1
    },
    recognitionCard: {
      alignItems: "center",
      backgroundColor: "#f0f7f0",
      borderRadius: 12,
      flexDirection: "row",
      gap: 10,
      padding: 8
    },
    recognitionMeta: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2
    },
    recognitionTitle: {
      color: tokens.text,
      fontSize: 13,
      fontWeight: "900"
    },
    subtitle: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "800"
    },
    thumbnail: {
      borderRadius: 10,
      height: 50,
      width: 50
    },
    thumbnailWrap: {
      borderRadius: 10
    },
    title: {
      color: tokens.text,
      fontSize: 17,
      fontWeight: "900"
    },
    uploadHero: {
      alignItems: "center",
      backgroundColor: "#f0f7f0",
      borderColor: tokens.accent,
      borderRadius: 16,
      borderStyle: "dashed",
      borderWidth: 1.5,
      flexDirection: "row",
      gap: 12,
      padding: 14
    },
    uploadHeroIcon: {
      color: tokens.accent,
      fontSize: 28,
      fontWeight: "900",
      lineHeight: 30
    },
    uploadHeroSub: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 17
    },
    uploadHeroTextBox: {
      flex: 1,
      gap: 2
    },
    uploadHeroTitle: {
      color: tokens.accent,
      fontSize: 15,
      fontWeight: "900"
    }
  });
}
