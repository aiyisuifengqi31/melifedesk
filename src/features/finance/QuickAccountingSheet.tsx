import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { TransactionType } from "@/features/finance/financeService";
import {
  createFinanceId,
  getDefaultFinanceStorage,
  loadCustomCategories,
  loadFinanceTransactions,
  saveFinanceTransactions,
  sortTransactions,
  type FinanceStorage,
  type FinanceTransaction
} from "@/features/finance/financeStorage";
import { QUICK_CAPTURE_DATA_EVENT } from "@/features/quick-capture/quickCapture";
import type { UiTokens } from "@/shared/ui/primitives";

type QuickAccountingSheetProps = {
  initialType?: TransactionType;
  onClose: () => void;
  onSaved: (transaction: FinanceTransaction) => void;
  storage?: FinanceStorage;
  tokens: UiTokens;
  visible: boolean;
};

type Step = "category" | "amount";

const todayIso = () => new Date().toISOString().slice(0, 10);
const expenseCategories = ["买菜", "加油", "餐饮", "出行", "随份子", "购物", "医疗", "更多"];
const incomeCategories = ["生活费", "工资", "奖学金", "兼职", "红包", "退款", "其他"];
const categoryIcons: Record<string, string> = {
  买菜: "菜",
  加油: "油",
  餐饮: "餐",
  出行: "车",
  随份子: "礼",
  购物: "购",
  医疗: "医",
  更多: "...",
  生活费: "家",
  工资: "薪",
  奖学金: "奖",
  兼职: "职",
  红包: "包",
  退款: "退",
  其他: "其"
};

export function QuickAccountingSheet({ initialType = "expense", onClose, onSaved, storage, tokens, visible }: QuickAccountingSheetProps) {
  const financeStorage = useMemo(() => storage ?? getDefaultFinanceStorage(), [storage]);
  const [step, setStep] = useState<Step>("category");
  const [transactionType, setTransactionType] = useState<TransactionType>(initialType);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date] = useState(todayIso());
  const [note, setNote] = useState("");
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const categories = useMemo(() => {
    const base = transactionType === "expense" ? expenseCategories : incomeCategories;
    const custom = loadCustomCategories(financeStorage).filter((category) => category.transactionType === transactionType).map((category) => category.name);
    return [...base, ...custom];
  }, [financeStorage, transactionType]);

  const recentCategories = useMemo(() => {
    const seen = new Set<string>();
    return loadFinanceTransactions(financeStorage)
      .filter((transaction) => transaction.transactionType === transactionType)
      .map((transaction) => transaction.categoryName)
      .filter((category) => {
        if (seen.has(category)) return false;
        seen.add(category);
        return true;
      })
      .slice(0, 4);
  }, [financeStorage, transactionType]);

  if (!visible) return null;

  const chooseCategory = (category: string) => {
    setSelectedCategory(category);
    setAmount("");
    setStep("amount");
  };

  const appendAmount = (value: string) => {
    setAmount((current) => normalizeAmountInput(`${current}${value}`));
  };

  const removeAmount = () => {
    setAmount((current) => current.slice(0, -1));
  };

  const cleanAmount = normalizeMoney(amount);
  const canSave = Boolean(cleanAmount);

  const save = () => {
    if (!cleanAmount || !selectedCategory) return;
    const transaction: FinanceTransaction = {
      amount: cleanAmount,
      categoryName: selectedCategory,
      createTime: new Date().toISOString(),
      id: createFinanceId("finance"),
      localDate: date,
      note: note.trim(),
      transactionType
    };
    const next = sortTransactions([transaction, ...loadFinanceTransactions(financeStorage)]);
    saveFinanceTransactions(next, financeStorage);
    dispatchFinanceRefresh();
    onSaved(transaction);
    onClose();
    setStep("category");
    setSelectedCategory("");
    setAmount("");
    setNote("");
  };

  return (
    <View testID="quick-accounting-sheet" style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="关闭快速记账遮罩" onPress={onClose} style={styles.dismissLayer} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {step === "category" ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            <View style={styles.sheetHeader}>
              <View style={styles.typeSwitch}>
                <TypeButton active={transactionType === "expense"} label="支出" onPress={() => setTransactionType("expense")} styles={styles} />
                <TypeButton active={transactionType === "income"} label="收入" onPress={() => setTransactionType("income")} styles={styles} />
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="关闭快速记账" onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>关闭</Text>
              </Pressable>
            </View>
            <Text style={styles.title}>选择分类</Text>
            {recentCategories.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>最近使用</Text>
                <View style={styles.recentRow}>
                  {recentCategories.map((category) => (
                    <Pressable key={category} accessibilityRole="button" accessibilityLabel={`选择最近分类：${category}`} onPress={() => chooseCategory(category)} style={styles.recentChip}>
                      <Text style={styles.recentText}>{category}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
            <View style={styles.categoryGrid}>
              {categories.map((category) => (
                <Pressable key={`${transactionType}-${category}`} accessibilityRole="button" accessibilityLabel={`选择分类：${category}`} onPress={() => chooseCategory(category)} style={styles.categoryButton}>
                  <View style={styles.categoryIconCircle}>
                    <Text style={styles.categoryIconText}>{categoryIcons[category] ?? category.slice(0, 1)}</Text>
                  </View>
                  <Text style={styles.categoryName} numberOfLines={1}>{category}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.sheetContent}>
            <View style={styles.amountHeader}>
              <Pressable accessibilityRole="button" accessibilityLabel="返回分类选择" onPress={() => setStep("category")} style={styles.backButton}>
                <Text style={styles.backText}>←</Text>
              </Pressable>
              <Text style={styles.amountTitle}>{selectedCategory}</Text>
              <Text style={styles.datePill}>今天</Text>
            </View>
            <Text style={styles.amountValue}>¥{amount || "0.00"}</Text>
            <TextInput onChangeText={setNote} placeholder="备注（可选）" style={styles.noteInput} value={note} />
            <View style={styles.keypad}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"].map((key) => (
                <Pressable key={key} accessibilityRole="button" accessibilityLabel={`输入金额 ${key}`} onPress={() => appendAmount(key)} style={styles.keyButton}>
                  <Text style={styles.keyText}>{key}</Text>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" accessibilityLabel="删除金额" onPress={removeAmount} style={styles.keyButton}>
                <Text style={styles.keyText}>删除</Text>
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="完成记账" accessibilityState={{ disabled: !canSave }} disabled={!canSave} onPress={save} style={[styles.doneButton, !canSave ? styles.doneButtonDisabled : null, transactionType === "income" ? styles.doneButtonIncome : null]}>
              <Text style={styles.doneText}>完成</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function TypeButton({ active, label, onPress, styles }: { active: boolean; label: string; onPress: () => void; styles: ReturnType<typeof createStyles> }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.typeButton, active ? styles.typeButtonActive : null]}>
      <Text style={[styles.typeText, active ? styles.typeTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function normalizeAmountInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length > 2) return `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
  if (parts.length === 2) return `${parts[0]}.${parts[1].slice(0, 2)}`;
  return cleaned.replace(/^0+(?=\d)/, "");
}

function normalizeMoney(value: string) {
  if (!/^\d+(\.\d{0,2})?$/.test(value)) return "";
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return amount.toFixed(2);
}

function dispatchFinanceRefresh() {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new Event(QUICK_CAPTURE_DATA_EVENT));
  }
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    amountHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    amountTitle: {
      color: tokens.text,
      fontSize: 18,
      fontWeight: "900"
    },
    amountValue: {
      color: tokens.text,
      fontSize: 38,
      fontWeight: "900",
      textAlign: "center"
    },
    backButton: {
      alignItems: "center",
      borderRadius: 999,
      height: 36,
      justifyContent: "center",
      width: 36
    },
    backText: {
      color: tokens.text,
      fontSize: 22,
      fontWeight: "900"
    },
    categoryButton: {
      alignItems: "center",
      flexBasis: "22%",
      gap: 6,
      minWidth: 0
    },
    categoryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      justifyContent: "space-between"
    },
    categoryIconCircle: {
      alignItems: "center",
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      height: 44,
      justifyContent: "center",
      width: 44
    },
    categoryIconText: {
      color: tokens.accent,
      fontSize: 13,
      fontWeight: "900"
    },
    categoryName: {
      color: tokens.text,
      fontSize: 12,
      fontWeight: "800",
      maxWidth: "100%"
    },
    closeButton: {
      paddingHorizontal: 8,
      paddingVertical: 6
    },
    closeText: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "900"
    },
    datePill: {
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "900",
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    dismissLayer: {
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0
    },
    doneButton: {
      alignItems: "center",
      backgroundColor: tokens.accent,
      borderRadius: 14,
      minHeight: 52,
      justifyContent: "center"
    },
    doneButtonDisabled: {
      backgroundColor: "#cbd5e1"
    },
    doneButtonIncome: {
      backgroundColor: tokens.success
    },
    doneText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "900"
    },
    handle: {
      alignSelf: "center",
      backgroundColor: "#d8dee6",
      borderRadius: 999,
      height: 4,
      marginTop: 10,
      width: 42
    },
    keyButton: {
      alignItems: "center",
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 12,
      flexBasis: "31%",
      flexGrow: 1,
      minHeight: 42,
      justifyContent: "center"
    },
    keyText: {
      color: tokens.text,
      fontSize: 18,
      fontWeight: "900"
    },
    keypad: {
      display: "flex",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    noteInput: {
      backgroundColor: tokens.surfaceMuted,
      borderColor: tokens.border,
      borderRadius: 12,
      borderWidth: 1,
      color: tokens.text,
      fontSize: 14,
      minHeight: 44,
      paddingHorizontal: 12
    },
    overlay: {
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      zIndex: 120
    },
    recentChip: {
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 7
    },
    recentRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    recentText: {
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "900"
    },
    sectionLabel: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "900"
    },
    sheet: {
      backgroundColor: tokens.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      bottom: 0,
      elevation: 12,
      left: 76,
      maxHeight: "75%",
      position: "absolute",
      right: 10,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.16,
      shadowRadius: 24
    },
    sheetContent: {
      gap: 14,
      padding: 16,
      paddingBottom: 22
    },
    sheetHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    title: {
      color: tokens.text,
      fontSize: 18,
      fontWeight: "900"
    },
    typeButton: {
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 7
    },
    typeButtonActive: {
      backgroundColor: tokens.accent
    },
    typeSwitch: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 999,
      flexDirection: "row",
      gap: 4,
      padding: 4
    },
    typeText: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "900"
    },
    typeTextActive: {
      color: "#ffffff"
    }
  });
}
