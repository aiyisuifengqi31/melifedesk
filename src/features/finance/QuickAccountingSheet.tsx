import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Circle, Line, Path, Polyline, Rect } from "react-native-svg";

import type { TransactionType } from "@/features/finance/financeService";
import {
  createFinanceId,
  getDefaultFinanceStorage,
  loadFinanceTransactions,
  loadGiftRecords,
  loadSavingEntries,
  saveFinanceTransactions,
  saveGiftRecords,
  saveSavingEntries,
  sortGiftRecords,
  sortTransactions,
  type FinanceStorage,
  type FinanceTransaction,
  type GiftRecord,
  type SavingEntry
} from "@/features/finance/financeStorage";
import { QUICK_CAPTURE_DATA_EVENT } from "@/features/quick-capture/quickCapture";
import { DatePickerPopup } from "@/shared/ui/DatePickerPopup";
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
const expenseCategories = ["餐饮", "购物", "出行", "随份子", "医疗", "情侣存款", "娱乐", "宠物", "礼物", "美容", "汽车", "储蓄"];
const incomeCategories = ["工资", "奖金", "兼职", "报销", "红包", "理财收益", "退款", "其他"];

export function QuickAccountingSheet({ initialType = "expense", onClose, onSaved, storage, tokens, visible }: QuickAccountingSheetProps) {
  const financeStorage = useMemo(() => storage ?? getDefaultFinanceStorage(), [storage]);
  const [step, setStep] = useState<Step>("category");
  const [transactionType, setTransactionType] = useState<TransactionType>(initialType);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [note, setNote] = useState("");
  const [giftName, setGiftName] = useState("");
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  useEffect(() => {
    if (!visible) return;
    setStep("category");
    setTransactionType(initialType);
    setSelectedCategory("");
    setAmount("");
    setDate(todayIso());
    setDatePickerOpen(false);
    setNote("");
    setGiftName("");
  }, [initialType, visible]);

  const categories = transactionType === "expense" ? expenseCategories : incomeCategories;

  if (!visible) return null;

  const chooseCategory = (category: string) => {
    setSelectedCategory(category);
    setAmount("");
    setNote("");
    setGiftName("");
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
  const isGiftExpense = transactionType === "expense" && selectedCategory === "随份子";
  const isSavingExpense = transactionType === "expense" && selectedCategory === "储蓄";

  const save = () => {
    if (!cleanAmount || !selectedCategory) return;

    const createTime = new Date().toISOString();
    const transactionId = createFinanceId("finance");
    const transaction: FinanceTransaction = {
      amount: cleanAmount,
      categoryName: selectedCategory,
      createTime,
      id: transactionId,
      localDate: date,
      note: buildTransactionNote({ giftName, isGiftExpense, note }),
      transactionType
    };

    if (isSavingExpense) {
      const savingId = createFinanceId("saving");
      transaction.savingEntryId = savingId;
      const savingEntry: SavingEntry = {
        amount: cleanAmount,
        createTime,
        financeTransactionId: transactionId,
        id: savingId,
        localDate: date,
        note: note.trim(),
        type: "deposit"
      };
      saveSavingEntries([savingEntry, ...loadSavingEntries(financeStorage)], financeStorage);
    }

    if (isGiftExpense) {
      const giftId = createFinanceId("gift");
      transaction.giftRecordId = giftId;
      const giftRecord: GiftRecord = {
        amount: cleanAmount,
        contactName: giftName.trim(),
        createTime,
        direction: "sent",
        eventDate: date,
        eventType: note.trim() || "其他",
        financeTransactionId: transactionId,
        id: giftId,
        needReturn: false,
        note: note.trim(),
        place: "",
        syncFinance: true
      };
      saveGiftRecords(sortGiftRecords([giftRecord, ...loadGiftRecords(financeStorage)]), financeStorage);
    }

    const next = sortTransactions([transaction, ...loadFinanceTransactions(financeStorage)]);
    saveFinanceTransactions(next, financeStorage);
    dispatchFinanceRefresh();
    onSaved(transaction);
    resetAndClose();
  };

  const resetAndClose = () => {
    onClose();
    setStep("category");
    setSelectedCategory("");
    setAmount("");
    setDate(todayIso());
    setDatePickerOpen(false);
    setNote("");
    setGiftName("");
  };

  return (
    <View testID="quick-accounting-sheet" style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="关闭快速记账遮罩" onPress={resetAndClose} style={styles.dismissLayer} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {step === "category" ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            <View style={styles.sheetHeader}>
              <View style={styles.typeSwitch}>
                <TypeButton active={transactionType === "expense"} label="支出" onPress={() => setTransactionType("expense")} styles={styles} />
                <TypeButton active={transactionType === "income"} label="收入" onPress={() => setTransactionType("income")} styles={styles} />
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="关闭快速记账" onPress={resetAndClose} style={styles.closeButton}>
                <Text style={styles.closeText}>关闭</Text>
              </Pressable>
            </View>
            <Text style={styles.title}>选择分类</Text>
            <View style={styles.categoryGrid}>
              {categories.map((category) => (
                <Pressable key={`${transactionType}-${category}`} accessibilityRole="button" accessibilityLabel={`选择分类：${category}`} onPress={() => chooseCategory(category)} style={styles.categoryButton}>
                  <View testID={`quick-category-icon-${category}`} style={styles.categoryIconCircle}>
                    <CategoryLineIcon color={tokens.accent} name={category} />
                  </View>
                  <Text style={styles.categoryName} numberOfLines={2}>{category}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.sheetContent}>
            <View style={styles.amountHeader}>
              <Pressable accessibilityRole="button" accessibilityLabel="返回分类选择" onPress={() => setStep("category")} style={styles.backButton}>
                <Text style={styles.backText}>‹</Text>
              </Pressable>
              <Text style={styles.amountTitle}>{selectedCategory}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`选择记账日期：${formatDateLabel(date)}`} onPress={() => setDatePickerOpen((open) => !open)} style={styles.datePill}>
                <Text style={styles.datePillText}>{formatDateLabel(date)}</Text>
              </Pressable>
            </View>
            <Text style={styles.amountValue}>¥{amount || "0.00"}</Text>
            {isGiftExpense ? (
              <TextInput onChangeText={setGiftName} placeholder="姓名（建议填写）" style={styles.noteInput} value={giftName} />
            ) : null}
            <TextInput
              onChangeText={setNote}
              placeholder={isGiftExpense ? "备注（可选，例如：结婚、满月、生日）" : "备注（可选）"}
              style={styles.noteInput}
              value={note}
            />
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
            <DatePickerPopup
              onCancel={() => setDatePickerOpen(false)}
              onConfirm={(nextDate) => {
                setDate(nextDate);
                setDatePickerOpen(false);
              }}
              selectedDate={date}
              title="选择记账日期"
              visible={datePickerOpen}
            />
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

export function CategoryLineIcon({ color, name, size = 24 }: { color: string; name: string; size?: number }) {
  const common = { fill: "none", stroke: color, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 2 };
  if (name === "餐饮") return <Svg height={size} viewBox="0 0 24 24" width={size}><Path {...common} d="M7 3v8" /><Path {...common} d="M10 3v8" /><Path {...common} d="M8.5 11v10" /><Path {...common} d="M17 3v18" /><Path {...common} d="M14 3c3 2 3 6 0 8" /></Svg>;
  if (name === "买菜" || name === "生鲜") return <Svg height={size} viewBox="0 0 24 24" width={size}><Path {...common} d="M4 8h16l-1.5 12h-13L4 8Z" /><Path {...common} d="M9 8V6a3 3 0 0 1 6 0v2" /><Path {...common} d="M9 12v4M15 12v4" /></Svg>;
  if (name === "购物") return <Svg height={size} viewBox="0 0 24 24" width={size}><Path {...common} d="M6 8h12l-1 12H7L6 8Z" /><Path {...common} d="M9 8a3 3 0 0 1 6 0" /></Svg>;
  if (name === "加油") return <Svg height={size} viewBox="0 0 24 24" width={size}><Path {...common} d="M5 21V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15" /><Line {...common} x1={4} x2={15} y1={21} y2={21} /><Path {...common} d="M7 9h5" /><Path {...common} d="M14 9h3a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0v-6l-2-3" /></Svg>;
  if (name === "出行" || name === "汽车") return <Svg height={size} viewBox="0 0 24 24" width={size}><Path {...common} d="M5 12l2-5h10l2 5" /><Rect {...common} height={6} rx={2} width={16} x={4} y={11} /><Circle cx={8} cy={18} fill={color} r={1.4} /><Circle cx={16} cy={18} fill={color} r={1.4} /></Svg>;
  if (name === "随份子" || name === "礼物" || name === "红包") return <Svg height={size} viewBox="0 0 24 24" width={size}><Rect {...common} height={13} rx={2} width={16} x={4} y={8} /><Path {...common} d="M12 8v13M4 13h16M8 8c-2-2-1-5 2-4 1 .5 2 2 2 4M16 8c2-2 1-5-2-4-1 .5-2 2-2 4" /></Svg>;
  if (name === "医疗") return <Svg height={size} viewBox="0 0 24 24" width={size}><Path {...common} d="M12 5v14M5 12h14" /><Rect {...common} height={18} rx={4} width={18} x={3} y={3} /></Svg>;
  if (name === "情侣存款" || name === "储蓄" || name === "理财收益") return <Svg height={size} viewBox="0 0 24 24" width={size}><Path {...common} d="M5 9h14v10H5z" /><Path {...common} d="M8 9c1-3 3-5 4-5s3 2 4 5" /><Line {...common} x1={12} x2={12} y1={12} y2={17} /></Svg>;
  if (name === "娱乐") return <Svg height={size} viewBox="0 0 24 24" width={size}><Path {...common} d="M8 7h8l2 12H6L8 7Z" /><Circle cx={9} cy={13} fill={color} r={1.2} /><Circle cx={15} cy={13} fill={color} r={1.2} /><Path {...common} d="M10 17h4" /></Svg>;
  if (name === "宠物") return <Svg height={size} viewBox="0 0 24 24" width={size}><Circle cx={12} cy={15} fill="none" r={4} stroke={color} strokeWidth={2} /><Circle cx={7} cy={10} fill={color} r={1.6} /><Circle cx={11} cy={8} fill={color} r={1.6} /><Circle cx={15} cy={8} fill={color} r={1.6} /><Circle cx={17} cy={11} fill={color} r={1.6} /></Svg>;
  if (name === "美容") return <Svg height={size} viewBox="0 0 24 24" width={size}><Path {...common} d="M12 3c4 4 4 8 0 12-4-4-4-8 0-12Z" /><Path {...common} d="M5 21c2-4 5-6 7-6s5 2 7 6" /></Svg>;
  if (name === "生活费" || name === "住房" || name === "房租") return <Svg height={size} viewBox="0 0 24 24" width={size}><Path {...common} d="M4 11l8-6 8 6" /><Path {...common} d="M6 10v10h12V10" /><Path {...common} d="M10 20v-6h4v6" /></Svg>;
  if (name === "奖学金" || name === "学习" || name === "教育") return <Svg height={size} viewBox="0 0 24 24" width={size}><Path {...common} d="M12 5 3 9l9 4 9-4-9-4Z" /><Path {...common} d="M7 11v4c0 1.5 2.2 3 5 3s5-1.5 5-3v-4" /></Svg>;
  if (name === "工资" || name === "奖金" || name === "兼职" || name === "报销" || name === "退款") return <Svg height={size} viewBox="0 0 24 24" width={size}><Rect {...common} height={14} rx={2} width={18} x={3} y={5} /><Circle cx={12} cy={12} fill="none" r={3} stroke={color} strokeWidth={2} /><Line {...common} x1={6} x2={8} y1={9} y2={9} /><Line {...common} x1={16} x2={18} y1={15} y2={15} /></Svg>;
  if (name === "更多" || name === "其他") return <Svg height={size} viewBox="0 0 24 24" width={size}><Circle cx={12} cy={12} fill="none" r={9} stroke={color} strokeWidth={2} /><Circle cx={8} cy={12} fill={color} r={1.3} /><Circle cx={12} cy={12} fill={color} r={1.3} /><Circle cx={16} cy={12} fill={color} r={1.3} /></Svg>;
  return <Svg height={size} viewBox="0 0 24 24" width={size}><Circle cx={12} cy={12} fill="none" r={8} stroke={color} strokeWidth={2} /><Polyline {...common} points="9,12 12,15 16,9" /></Svg>;
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

function buildTransactionNote({ giftName, isGiftExpense, note }: { giftName: string; isGiftExpense: boolean; note: string }) {
  const cleanName = giftName.trim();
  const cleanNote = note.trim();
  if (!isGiftExpense) return cleanNote;
  return [cleanName, cleanNote].filter(Boolean).join(" · ");
}

function formatDateLabel(date: string) {
  if (date === todayIso()) return "今天";
  if (date === shiftIso(-1)) return "昨天";
  if (date === shiftIso(-2)) return "前天";
  const parsed = parseIso(date);
  const currentYear = new Date().getFullYear();
  if (parsed.getFullYear() === currentYear) return `${parsed.getMonth() + 1}月${parsed.getDate()}日`;
  return `${parsed.getFullYear()}年${parsed.getMonth() + 1}月${parsed.getDate()}日`;
}

function shiftIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
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
      fontSize: 28,
      fontWeight: "900",
      lineHeight: 28
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
    categoryName: {
      color: tokens.text,
      fontSize: 12,
      fontWeight: "800",
      lineHeight: 15,
      maxWidth: "100%",
      minHeight: 30,
      textAlign: "center"
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
      alignItems: "center",
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      justifyContent: "center",
      minWidth: 62,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    datePillText: {
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "900"
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
      justifyContent: "center",
      minHeight: 52
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
      justifyContent: "center",
      minHeight: 42
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
    sheet: {
      backgroundColor: tokens.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      bottom: 0,
      elevation: 12,
      left: 76,
      maxHeight: "78%",
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
