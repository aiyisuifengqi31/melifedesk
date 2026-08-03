import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { DatePickerPopup } from "@/shared/ui/DatePickerPopup";
import type { UiTokens } from "@/shared/ui/primitives";
import { createPackageId, getDefaultPackageStorage, hydratePackagesFromCloud, loadPackages, savePackages, type PackageItem, type PackageStorage } from "./packageStorage";

type PackagePanelProps = {
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

export function PackagePanel({ storage, themeTokens }: PackagePanelProps) {
  const pkgStorage = useMemo(() => storage ?? getDefaultPackageStorage(), [storage]);
  const [items, setItems] = useState<PackageItem[]>(() => loadPackages(pkgStorage));
  const [form, setForm] = useState(emptyItem());
  const [manualOpen, setManualOpen] = useState(false);
  const [pickedOpen, setPickedOpen] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const styles = useMemo(() => createStyles(themeTokens), [themeTokens]);

  useEffect(() => {
    let cancelled = false;
    hydratePackagesFromCloud(pkgStorage)
      .then((next) => {
        if (!cancelled) {
          setItems(next);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pkgStorage]);

  const persist = (next: PackageItem[]) => {
    setItems(next);
    savePackages(next, pkgStorage);
  };

  const togglePickedUp = (id: string) => {
    persist(items.map((item) => (item.id === id ? { ...item, pickedUp: !item.pickedUp } : item)));
  };

  const deleteItem = (id: string) => {
    persist(items.filter((item) => item.id !== id));
  };

  const addItem = () => {
    if (!isPackageDraftAddable(form)) {
      setFeedback("上传截图，或至少填写一项信息后再保存。");
      return;
    }

    const item: PackageItem = {
      ...form,
      arrivalDate: form.arrivalDate || todayIso(),
      company: form.company.trim(),
      createTime: new Date().toISOString(),
      id: createPackageId(),
      orderNumber: "",
      pickupCode: form.pickupCode.trim(),
      pickupLocation: form.pickupLocation.trim()
    };
    persist([item, ...items]);
    setForm(emptyItem());
    setManualOpen(false);
    setFeedback("快递已保存。");
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
      setManualOpen(true);
      setFeedback(Object.keys(extracted).length > 0 ? "已根据截图文件名尝试填入信息，请核对后保存。" : "已上传截图。暂未识别到文字，可直接保存或手动补充。");
    };
    reader.readAsDataURL(file);
  };

  const unpicked = items.filter((item) => !item.pickedUp);
  const picked = items.filter((item) => item.pickedUp);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>快递</Text>
        <Text style={styles.subtitle}>待取 {unpicked.length} 个</Text>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="上传快递截图" onPress={() => fileInputRef.current?.click()} style={styles.uploadHero}>
        <Text style={styles.uploadHeroIcon}>+</Text>
        <View style={styles.uploadHeroTextBox}>
          <Text style={styles.uploadHeroTitle}>上传快递截图</Text>
          <Text style={styles.uploadHeroSub}>截图可直接保存，信息识别不到也能手动补充。</Text>
        </View>
      </Pressable>

      {typeof document !== "undefined" ? <input accept="image/*" onChange={handleFileChange} ref={fileInputRef} style={{ display: "none" }} type="file" /> : null}

      {form.image ? (
        <View style={styles.pendingImageRow}>
          <Pressable onPress={() => setExpandedImage(form.image)} style={styles.thumbnailWrap}>
            <Image source={{ uri: form.image }} style={styles.thumbnail} />
          </Pressable>
          <Text style={styles.pendingImageText}>截图已添加，可以直接保存这条快递。</Text>
        </View>
      ) : null}

      <Pressable accessibilityRole="button" accessibilityLabel="切换手动填写快递信息" onPress={() => setManualOpen((value) => !value)} style={styles.manualToggle}>
        <Text style={styles.manualToggleText}>{manualOpen ? "收起手动填写" : "手动填写（备用）"}</Text>
      </Pressable>

      {manualOpen ? (
        <View style={styles.form}>
          <View style={styles.formRow}>
            <TextInput onChangeText={(text) => setForm((previous) => ({ ...previous, company: text }))} placeholder="快递公司（可空）" placeholderTextColor="#9ca3af" style={[styles.input, styles.inputHalf]} value={form.company} />
            <Pressable accessibilityRole="button" accessibilityLabel="选择到达日期" onPress={() => setDatePickerOpen(true)} style={[styles.input, styles.inputHalf, styles.dateTrigger]}>
              <Text style={styles.dateTriggerText} numberOfLines={1}>{form.arrivalDate || todayIso()}</Text>
            </Pressable>
          </View>
          <View style={styles.formRow}>
            <TextInput onChangeText={(text) => setForm((previous) => ({ ...previous, pickupLocation: text }))} placeholder="取件地点（可空）" placeholderTextColor="#9ca3af" style={[styles.input, styles.inputHalf]} value={form.pickupLocation} />
            <TextInput onChangeText={(text) => setForm((previous) => ({ ...previous, pickupCode: text }))} placeholder="取件码（可空）" placeholderTextColor="#9ca3af" style={[styles.input, styles.inputHalf]} value={form.pickupCode} />
          </View>
        </View>
      ) : null}

      <Pressable accessibilityRole="button" accessibilityLabel="保存快递" onPress={addItem} style={[styles.addButton, !isPackageDraftAddable(form) ? styles.addButtonDisabled : null]}>
        <Text style={styles.addText}>保存快递</Text>
      </Pressable>
      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list} contentContainerStyle={styles.listInner}>
        {unpicked.length === 0 && picked.length === 0 ? <Text style={styles.empty}>还没有快递。上传截图就能先记一条。</Text> : null}
        {unpicked.map((item) => (
          <PackageCard item={item} key={item.id} onDelete={deleteItem} onPreview={setExpandedImage} onToggle={togglePickedUp} styles={styles} />
        ))}
        {picked.length > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="展开已取快递" onPress={() => setPickedOpen((value) => !value)} style={styles.pickedToggle}>
            <Text style={styles.pickedToggleText}>已取 {picked.length} 个 {pickedOpen ? "收起" : "展开"}</Text>
          </Pressable>
        ) : null}
        {pickedOpen ? picked.map((item) => <PackageCard item={item} key={item.id} onDelete={deleteItem} onPreview={setExpandedImage} onToggle={togglePickedUp} styles={styles} />) : null}
      </ScrollView>

      {expandedImage ? (
        <Pressable onPress={() => setExpandedImage(null)} style={styles.imageModal}>
          <Image resizeMode="contain" source={{ uri: expandedImage }} style={styles.expandedImage} />
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
  item,
  onDelete,
  onPreview,
  onToggle,
  styles
}: {
  item: PackageItem;
  onDelete: (id: string) => void;
  onPreview: (image: string) => void;
  onToggle: (id: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={[styles.itemCard, item.pickedUp ? styles.itemCardDone : null]}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: item.pickedUp }} onPress={() => onToggle(item.id)} style={[styles.check, item.pickedUp ? styles.checkActive : null]}>
        {item.pickedUp ? <Text style={styles.checkMark}>✓</Text> : null}
      </Pressable>
      <View style={styles.itemBody}>
        <Text style={[styles.itemCompany, item.pickedUp ? styles.itemDoneText : null]} numberOfLines={1}>{item.company || "未填写快递公司"}</Text>
        <Text style={styles.itemMeta} numberOfLines={1}>取件码：{item.pickupCode || "未填"} · 地点：{item.pickupLocation || "未填"}</Text>
        <Text style={styles.itemMeta}>{item.arrivalDate}</Text>
      </View>
      {item.image ? (
        <Pressable onPress={() => onPreview(item.image!)} style={styles.itemThumbWrap}>
          <Image source={{ uri: item.image }} style={styles.itemThumb} />
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`删除快递${item.company || item.pickupCode || ""}`} onPress={() => onDelete(item.id)} style={styles.deleteButton}>
        <Text style={styles.deleteText}>删除</Text>
      </Pressable>
    </View>
  );
}

function extractPackageFieldsFromText(text: string): Partial<Omit<PackageItem, "id" | "createTime" | "image" | "pickedUp" | "orderNumber">> {
  const result: Partial<Omit<PackageItem, "id" | "createTime" | "image" | "pickedUp" | "orderNumber">> = {};
  const codeMatch = text.match(/(?:取件码|取件|code|码)[^\dA-Za-z]*([A-Za-z0-9-]{3,12})/i);
  if (codeMatch) result.pickupCode = codeMatch[1];
  const dateMatch = text.match(/(20\d{2})[-年.](\d{1,2})[-月.](\d{1,2})/);
  if (dateMatch) result.arrivalDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
  for (const company of ["顺丰", "中通", "圆通", "韵达", "申通", "京东", "邮政", "极兔"]) {
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
      overflow: "hidden",
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
    deleteButton: {
      backgroundColor: "#fff1f1",
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8
    },
    deleteText: {
      color: "#d14d4d",
      fontSize: 12,
      fontWeight: "900"
    },
    empty: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "700"
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
      gap: 3
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
      padding: 10,
      width: "100%"
    },
    itemCardDone: {
      opacity: 0.7
    },
    itemCompany: {
      color: tokens.text,
      fontSize: 15,
      fontWeight: "900"
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
      height: 50,
      width: 50
    },
    itemThumbWrap: {
      borderRadius: 8
    },
    list: {
      flexGrow: 0,
      maxHeight: 340
    },
    listInner: {
      gap: 8,
      paddingBottom: 4
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
    pendingImageRow: {
      alignItems: "center",
      backgroundColor: "#f0f7f0",
      borderRadius: 12,
      flexDirection: "row",
      gap: 10,
      padding: 8
    },
    pendingImageText: {
      color: tokens.textMuted,
      flex: 1,
      fontSize: 12,
      fontWeight: "700"
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
    subtitle: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "800"
    },
    thumbnail: {
      borderRadius: 10,
      height: 48,
      width: 48
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
