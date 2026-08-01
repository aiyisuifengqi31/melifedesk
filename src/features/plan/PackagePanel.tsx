import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { UiTokens } from "@/shared/ui/primitives";
import { createPackageId, hydratePackagesFromCloud, loadPackages, savePackages, type PackageItem, type PackageStorage } from "./packageStorage";

type PackagePanelProps = {
  storage?: PackageStorage;
  themeTokens: UiTokens;
};

const emptyItem = (): Omit<PackageItem, "id" | "createTime"> => ({
  arrivalDate: new Date().toISOString().slice(0, 10),
  company: "",
  image: null,
  orderNumber: "",
  pickedUp: false,
  pickupCode: "",
  pickupLocation: ""
});

export function PackagePanel({ storage, themeTokens }: PackagePanelProps) {
  const pkgStorage = useMemo(() => storage ?? getDefaultPackageStorage(), [storage]);
  const [items, setItems] = useState<PackageItem[]>(() => loadPackages(pkgStorage));
  const [form, setForm] = useState(emptyItem());
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
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
    const company = form.company.trim();
    if (!company) return;
    const item: PackageItem = {
      ...form,
      company,
      createTime: new Date().toISOString(),
      id: createPackageId(),
      orderNumber: form.orderNumber.trim(),
      pickupCode: form.pickupCode.trim(),
      pickupLocation: form.pickupLocation.trim()
    };
    persist([item, ...items]);
    setForm(emptyItem());
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((previous) => ({ ...previous, image: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  };

  const unpicked = items.filter((item) => !item.pickedUp);
  const picked = items.filter((item) => item.pickedUp);

  const PackageCard = ({
    item
  }: {
    item: PackageItem;
  }) => {
    return (
      <View style={[styles.itemCard, item.pickedUp ? styles.itemCardDone : null]}>
        <View style={styles.itemTop}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: item.pickedUp }} onPress={() => togglePickedUp(item.id)} style={[styles.check, item.pickedUp ? styles.checkActive : null]}>
            {item.pickedUp ? <Text style={styles.checkMark}>✓</Text> : null}
          </Pressable>
          <View style={styles.itemBody}>
            <Text style={[styles.itemCompany, item.pickedUp ? styles.itemDoneText : null]} numberOfLines={1}>{item.company}</Text>
            <Text style={styles.itemMeta} numberOfLines={1}>📍 {item.pickupLocation || "未填"}</Text>
            <Text style={styles.itemMeta} numberOfLines={1}>🔑 {item.pickupCode || "未填"}</Text>
            {item.orderNumber ? <Text style={styles.itemMeta} numberOfLines={1}>🧾 {item.orderNumber}</Text> : null}
            <Text style={styles.itemMeta} numberOfLines={1}>📅 {item.arrivalDate}</Text>
          </View>
          {item.image ? (
            <Pressable onPress={() => setExpandedImage(item.image!)} style={styles.itemThumbWrap}>
              <Image source={{ uri: item.image }} style={styles.itemThumb} />
            </Pressable>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="删除快递" onPress={() => deleteItem(item.id)} style={styles.deleteButton}>
          <Text style={styles.deleteText}>删除</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.icon}>📦</Text>
        <Text style={styles.title}>快递</Text>
        <Text style={styles.subtitle}>手动添加包裹，上传截图更方便</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.formRow}>
          <TextInput
            onChangeText={(text) => setForm((previous) => ({ ...previous, company: text }))}
            placeholder="快递公司"
            style={[styles.input, styles.inputHalf]}
            value={form.company}
          />
          <TextInput
            onChangeText={(text) => setForm((previous) => ({ ...previous, arrivalDate: text }))}
            placeholder="到达日期"
            style={[styles.input, styles.inputHalf]}
            value={form.arrivalDate}
          />
        </View>
        <View style={styles.formRow}>
          <TextInput
            onChangeText={(text) => setForm((previous) => ({ ...previous, pickupLocation: text }))}
            placeholder="取件地点"
            style={[styles.input, styles.inputHalf]}
            value={form.pickupLocation}
          />
          <TextInput
            onChangeText={(text) => setForm((previous) => ({ ...previous, pickupCode: text }))}
            placeholder="取件码"
            style={[styles.input, styles.inputHalf]}
            value={form.pickupCode}
          />
        </View>
        <TextInput
          onChangeText={(text) => setForm((previous) => ({ ...previous, orderNumber: text }))}
          placeholder="订单编号（可选）"
          style={styles.input}
          value={form.orderNumber}
        />
        <View style={styles.imageRow}>
          {form.image ? (
            <Pressable onPress={() => setExpandedImage(form.image)} style={styles.thumbnailWrap}>
              <Image source={{ uri: form.image }} style={styles.thumbnail} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => fileInputRef.current?.click()}
              style={styles.uploadButton}
            >
              <Text style={styles.uploadText}>📷 添加截图</Text>
            </Pressable>
          )}
          {typeof document !== "undefined" ? (
            <input
              accept="image/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              style={{ display: "none" }}
              type="file"
            />
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="添加快递" onPress={addItem} style={styles.addButton}>
            <Text style={styles.addText}>+ 添加</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.list}>
        <View style={styles.listInner}>
          {unpicked.length === 0 && picked.length === 0 ? (
            <Text style={styles.empty}>还没有快递，添加一个吧</Text>
          ) : null}
          {unpicked.map((item) => (
            <PackageCard key={item.id} item={item} />
          ))}
          {picked.length > 0 ? <View style={styles.divider} /> : null}
          {picked.map((item) => (
            <PackageCard key={item.id} item={item} />
          ))}
        </View>
      </ScrollView>

      {expandedImage ? (
        <Pressable onPress={() => setExpandedImage(null)} style={styles.imageModal}>
          <Image resizeMode="contain" source={{ uri: expandedImage }} style={styles.expandedImage} />
        </Pressable>
      ) : null}
    </View>
  );
}

function getDefaultPackageStorage() {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: () => null,
    removeItem: () => {},
    setItem: () => {}
  };
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    addButton: {
      alignItems: "center",
      backgroundColor: tokens.accent,
      borderRadius: 12,
      flex: 1,
      justifyContent: "center",
      paddingVertical: 10
    },
    addText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "900"
    },
    card: {
      backgroundColor: "#ffffff",
      borderColor: "#e3e6eb",
      borderRadius: 18,
      borderWidth: 1,
      gap: 12,
      overflow: "hidden",
      padding: 14,
      position: "relative",
      width: "100%"
    },
    check: {
      alignItems: "center",
      borderColor: tokens.border,
      borderRadius: 999,
      borderWidth: 1.5,
      height: 22,
      justifyContent: "center",
      width: 22
    },
    checkActive: {
      backgroundColor: tokens.accent,
      borderColor: tokens.accent
    },
    checkMark: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "900"
    },
    deleteButton: {
      alignItems: "center",
      backgroundColor: "#fdeaea",
      borderRadius: 10,
      paddingVertical: 6
    },
    deleteText: {
      color: "#e57373",
      fontSize: 12,
      fontWeight: "900"
    },
    divider: {
      backgroundColor: tokens.border,
      height: 1,
      marginVertical: 8,
      width: "100%"
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
    form: {
      gap: 8
    },
    formRow: {
      flexDirection: "row",
      gap: 8
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6
    },
    icon: {
      fontSize: 20
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
    imageRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8
    },
    input: {
      backgroundColor: "#f8fafc",
      borderColor: "#e3e6eb",
      borderRadius: 12,
      borderWidth: 1,
      color: tokens.text,
      fontSize: 13,
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    inputHalf: {
      flex: 1
    },
    itemBody: {
      flex: 1,
      gap: 2
    },
    itemCard: {
      backgroundColor: "#f8fafc",
      borderColor: "#e3e6eb",
      borderRadius: 14,
      borderWidth: 1,
      gap: 8,
      padding: 10,
      width: 220
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
      height: 56,
      width: 56
    },
    itemThumbWrap: {
      borderRadius: 8
    },
    itemTop: {
      flexDirection: "row",
      gap: 8
    },
    list: {
      flexGrow: 0
    },
    listInner: {
      gap: 8,
      paddingRight: 8
    },
    subtitle: {
      color: tokens.textMuted,
      flex: 1,
      fontSize: 11,
      fontWeight: "700",
      textAlign: "right"
    },
    thumbnail: {
      borderRadius: 10,
      height: 40,
      width: 40
    },
    thumbnailWrap: {
      borderRadius: 10
    },
    title: {
      color: tokens.text,
      fontSize: 17,
      fontWeight: "900"
    },
    uploadButton: {
      alignItems: "center",
      backgroundColor: "#f0f7f0",
      borderColor: tokens.accent,
      borderRadius: 12,
      borderStyle: "dashed",
      borderWidth: 1,
      flex: 1,
      paddingVertical: 10
    },
    uploadText: {
      color: tokens.accent,
      fontSize: 13,
      fontWeight: "900"
    }
  });
}
