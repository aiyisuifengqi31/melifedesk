import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type NativeSyntheticEvent, type TextInputChangeEventData } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { DatePickerPopup } from "@/shared/ui/DatePickerPopup";
import { buildFinanceSummary, type TransactionType } from "@/features/finance/financeService";
import {
  createFinanceId,
  getDefaultFinanceStorage,
  loadCustomCategories,
  loadFinanceTransactions,
  loadGiftRecords,
  loadSavingEntries,
  saveCustomCategories,
  saveFinanceTransactions,
  saveGiftRecords,
  saveSavingEntries,
  sortGiftRecords,
  sortTransactions,
  type CustomCategory,
  type FinanceStorage,
  type FinanceTransaction,
  type GiftDirection,
  type GiftRecord,
  type SavingEntry
} from "@/features/finance/financeStorage";

type FinancePanelProps = {
  storage?: FinanceStorage;
};

type FinanceTab = "record" | "stats" | "gifts" | "saving" | "category";

const todayIso = () => new Date().toISOString().slice(0, 10);
const expenseCategories = ["买菜", "加油", "餐饮", "出行", "随份子", "购物", "医疗", "更多"];
const incomeCategories = ["生活费", "工资", "奖学金", "兼职", "红包", "退款", "其他"];
const giftEventTypes = ["婚礼", "订婚", "生日", "满月", "乔迁", "升学", "丧事", "节日", "其他"];
const categoryColors = ["#d8f8e7", "#fff3ce", "#ffe2e7", "#dfeeff", "#ffe6f3", "#eee5ff", "#d8f7f6", "#eef2f7"];
const chartColors = ["#1fa8e2", "#f59e0b", "#84cc16", "#fb7185", "#a78bfa", "#14b8a6", "#f97316", "#6366f1"];

function getCategoryColor(categoryName: string, index?: number): string {
  if (index !== undefined) return chartColors[index % chartColors.length];
  const hash = categoryName.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return chartColors[hash % chartColors.length];
}
const transactionTypeOptions: Array<{ label: string; value: TransactionType }> = [
  { label: "支出", value: "expense" },
  { label: "收入", value: "income" }
];

const amountInputWebProps = { id: "finance-amount-input" } as object;
const noteInputWebProps = { id: "finance-note-input" } as object;
const savingAmountInputWebProps = { id: "finance-saving-amount-input" } as object;
const categoryInputWebProps = { id: "finance-category-input" } as object;

export function FinancePanel({ storage }: FinancePanelProps) {
  const financeStorage = useMemo(() => storage ?? getDefaultFinanceStorage(), [storage]);
  const [tab, setTab] = useState<FinanceTab>("record");
  const [detailType, setDetailType] = useState<TransactionType>("expense");
  const [transactions, setTransactions] = useState<FinanceTransaction[]>(() => sortTransactions(loadFinanceTransactions(financeStorage)));
  const [savingEntries, setSavingEntries] = useState<SavingEntry[]>(() => loadSavingEntries(financeStorage));
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(() => loadCustomCategories(financeStorage));
  const [transactionType, setTransactionType] = useState<TransactionType>("expense");
  const [selectedCategory, setSelectedCategory] = useState("买菜");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [note, setNote] = useState("");
  const [savingType, setSavingType] = useState<"deposit" | "withdraw">("deposit");
  const [savingAmount, setSavingAmount] = useState("");
  const [savingDate, setSavingDate] = useState(todayIso());
  const [savingNote, setSavingNote] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState<TransactionType>("expense");
  const [feedback, setFeedback] = useState("输入金额，选择分类后就能记一笔。");

  const [giftRecords, setGiftRecords] = useState<GiftRecord[]>(() => sortGiftRecords(loadGiftRecords(financeStorage)));
  const [giftDirection, setGiftDirection] = useState<GiftDirection>("sent");
  const [giftEventType, setGiftEventType] = useState("婚礼");
  const [giftContact, setGiftContact] = useState("");
  const [giftAmount, setGiftAmount] = useState("");
  const [giftDate, setGiftDate] = useState(todayIso());
  const [giftPlace, setGiftPlace] = useState("");
  const [giftNote, setGiftNote] = useState("");
  const [giftSync, setGiftSync] = useState(true);
  const [giftNeedReturn, setGiftNeedReturn] = useState(false);
  const [giftDatePickerOpen, setGiftDatePickerOpen] = useState(false);
  const [savingDatePickerOpen, setSavingDatePickerOpen] = useState(false);

  const giftContactInputWebProps = { id: "finance-gift-contact-input" } as object;
  const giftAmountInputWebProps = { id: "finance-gift-amount-input" } as object;
  const giftPlaceInputWebProps = { id: "finance-gift-place-input" } as object;
  const giftNoteInputWebProps = { id: "finance-gift-note-input" } as object;

  const categories = useMemo(() => {
    const base = transactionType === "expense" ? expenseCategories : incomeCategories;
    const custom = customCategories
      .filter((category) => category.transactionType === transactionType)
      .map((category) => category.name);
    return [...base, ...custom];
  }, [transactionType, customCategories]);
  const allCategories = useMemo(
    () => [
      ...expenseCategories.map((name) => ({ isSystem: true, name, transactionType: "expense" as const })),
      ...incomeCategories.map((name) => ({ isSystem: true, name, transactionType: "income" as const })),
      ...customCategories.map((category) => ({ isSystem: false, name: category.name, transactionType: category.transactionType }))
    ],
    [customCategories]
  );
  const summary = useMemo(
    () =>
      buildFinanceSummary({
        budgets: [],
        now: todayIso(),
        transactions: transactions.map((transaction) => ({
          amount: transaction.amount,
          categoryName: transaction.categoryName,
          giftRecordId: null,
          id: transaction.id,
          localDate: transaction.localDate,
          transactionType: transaction.transactionType
        }))
      }),
    [transactions]
  );
  const todayExpenseCount = transactions.filter((transaction) => transaction.localDate === todayIso() && transaction.transactionType === "expense").length;
  const monthExpenseCount = transactions.filter((transaction) => transaction.localDate.startsWith(todayIso().slice(0, 7)) && transaction.transactionType === "expense").length;
  const monthIncomeCount = transactions.filter((transaction) => transaction.localDate.startsWith(todayIso().slice(0, 7)) && transaction.transactionType === "income").length;
  const sevenDayTrend = useMemo(() => buildSevenDayExpenseTrend(transactions), [transactions]);
  const savingTotal = useMemo(() => sumSavingEntries(savingEntries), [savingEntries]);
  const detailTransactions = transactions.filter((transaction) => transaction.transactionType === detailType).slice(0, 8);

  const persistTransactions = (nextTransactions: FinanceTransaction[]) => {
    const sorted = sortTransactions(nextTransactions);
    setTransactions(sorted);
    saveFinanceTransactions(sorted, financeStorage);
  };

  const saveTransaction = () => {
    const inputAmount = readWebInputValue("finance-amount-input") || amount;
    const cleanAmount = normalizeMoney(inputAmount);
    if (!cleanAmount) {
      setFeedback("请先输入金额。");
      return;
    }

    const transaction: FinanceTransaction = {
      amount: cleanAmount,
      categoryName: selectedCategory,
      createTime: new Date().toISOString(),
      id: createFinanceId("finance"),
      localDate: date,
      note: (readWebInputValue("finance-note-input") || note).trim(),
      transactionType
    };

    setTransactions((current) => {
      const sorted = sortTransactions([transaction, ...current]);
      saveFinanceTransactions(sorted, financeStorage);
      return sorted;
    });
    setAmount("");
    setNote("");
    setFeedback(`${transactionType === "expense" ? "支出" : "收入"}已保存，统计已更新。`);
  };

  const deleteTransaction = (transactionId: string) => {
    setTransactions((current) => {
      const sorted = sortTransactions(current.filter((transaction) => transaction.id !== transactionId));
      saveFinanceTransactions(sorted, financeStorage);
      return sorted;
    });
    setFeedback("账单已删除。");
  };

  const saveSaving = () => {
    const cleanAmount = normalizeMoney(readWebInputValue("finance-saving-amount-input") || savingAmount);
    if (!cleanAmount) {
      setFeedback("请先输入储蓄金额。");
      return;
    }

    const entry: SavingEntry = {
      amount: cleanAmount,
      createTime: new Date().toISOString(),
      id: createFinanceId("saving"),
      localDate: savingDate,
      note: savingNote.trim(),
      type: savingType
    };
    const nextEntries = [entry, ...savingEntries];
    setSavingEntries(nextEntries);
    saveSavingEntries(nextEntries, financeStorage);
    setSavingAmount("");
    setSavingNote("");
    setFeedback("储蓄记录已添加。");
  };

  const addCategory = () => {
    const name = (readWebInputValue("finance-category-input") || newCategoryName).trim();
    if (!name) {
      setFeedback("请输入分类名称。");
      return;
    }
    if (allCategories.some((category) => category.name === name && category.transactionType === categoryType)) {
      setFeedback("这个分类已经存在。");
      return;
    }

    const nextCategories = [
      ...customCategories,
      {
        createTime: new Date().toISOString(),
        id: createFinanceId("category"),
        name,
        transactionType: categoryType
      }
    ];
    setCustomCategories(nextCategories);
    saveCustomCategories(nextCategories, financeStorage);
    setNewCategoryName("");
    setSelectedCategory(name);
    setFeedback("自定义分类已添加。");
  };

  const giftStats = useMemo(() => {
    const year = todayIso().slice(0, 4);
    let sentCents = 0;
    let receivedCents = 0;
    let yearSentCents = 0;
    let yearReceivedCents = 0;

    for (const record of giftRecords) {
      const cents = moneyToCents(record.amount);
      if (record.direction === "sent") sentCents += cents;
      else receivedCents += cents;
      if (record.eventDate.startsWith(year)) {
        if (record.direction === "sent") yearSentCents += cents;
        else yearReceivedCents += cents;
      }
    }

    return {
      balance: centsToMoney(receivedCents - sentCents),
      yearReceived: centsToMoney(yearReceivedCents),
      yearSent: centsToMoney(yearSentCents)
    };
  }, [giftRecords]);

  const saveGift = () => {
    const contact = (readWebInputValue("finance-gift-contact-input") || giftContact).trim();
    const amount = normalizeMoney(readWebInputValue("finance-gift-amount-input") || giftAmount);
    const place = (readWebInputValue("finance-gift-place-input") || giftPlace).trim();
    const note = (readWebInputValue("finance-gift-note-input") || giftNote).trim();

    if (!contact) {
      setFeedback("请输入联系人姓名。");
      return;
    }
    if (!amount) {
      setFeedback("请输入有效的金额。");
      return;
    }

    const record: GiftRecord = {
      amount,
      contactName: contact,
      createTime: new Date().toISOString(),
      direction: giftDirection,
      eventDate: giftDate,
      eventType: giftEventType,
      id: createFinanceId("gift"),
      needReturn: giftNeedReturn,
      note,
      place,
      syncFinance: giftSync
    };

    const nextRecords = sortGiftRecords([record, ...giftRecords]);
    setGiftRecords(nextRecords);
    saveGiftRecords(nextRecords, financeStorage);

    if (giftSync && giftDirection === "sent") {
      const tx: FinanceTransaction = {
        amount,
        categoryName: "随份子",
        createTime: new Date().toISOString(),
        id: createFinanceId("finance"),
        localDate: giftDate,
        note: `${giftEventType} · ${contact}${place ? ` · ${place}` : ""}`,
        transactionType: "expense"
      };
      const nextTx = sortTransactions([tx, ...transactions]);
      setTransactions(nextTx);
      saveFinanceTransactions(nextTx, financeStorage);
    }

    setGiftContact("");
    setGiftAmount("");
    setGiftPlace("");
    setGiftNote("");
    setGiftNeedReturn(false);
    setFeedback(`${giftDirection === "sent" ? "送出" : "收到"}份子记录已保存${giftSync && giftDirection === "sent" ? "，已同步到支出账单。" : "。"}`);
  };

  const deleteGift = (giftId: string) => {
    const nextRecords = giftRecords.filter((record) => record.id !== giftId);
    setGiftRecords(nextRecords);
    saveGiftRecords(nextRecords, financeStorage);
    setFeedback("份子记录已删除。");
  };

  return (
    <View style={styles.stack}>
      <View style={styles.tabs}>
        <TabButton active={tab === "record"} label="记录" onPress={() => setTab("record")} />
        <TabButton active={tab === "stats"} label="统计" onPress={() => setTab("stats")} />
        <TabButton active={tab === "gifts"} label="份子" onPress={() => setTab("gifts")} />
        <TabButton active={tab === "saving"} label="储蓄" onPress={() => setTab("saving")} />
        <TabButton active={tab === "category"} label="分类" onPress={() => setTab("category")} />
      </View>

      <View style={styles.metricGrid}>
        <Metric count={`${todayExpenseCount} 笔`} title="今日支出" value={`¥${summary.todayExpense}`} />
        <Metric count={`${monthExpenseCount} 笔`} title="本月支出" value={`¥${summary.monthExpense}`} />
        <Metric count={`${monthIncomeCount} 笔`} title="本月收入" value={`¥${summary.monthIncome}`} />
        <Metric count="收入 - 支出" title="本月结余" value={`¥${summary.monthBalance}`} />
      </View>

      {tab === "record" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{transactionType === "expense" ? "今日支出" : "今日收入"}</Text>
            <View style={styles.segmentRow}>
              {transactionTypeOptions.map((option) => (
                <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label} onPress={() => {
                  setTransactionType(option.value);
                  setSelectedCategory(option.value === "expense" ? expenseCategories[0] : incomeCategories[0]);
                }} style={[styles.segment, transactionType === option.value ? styles.segmentActive : null]}>
                  <Text style={[styles.segmentText, transactionType === option.value ? styles.segmentTextActive : null]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.categoryGrid}>
              {categories.map((category, index) => (
                <Pressable key={category} accessibilityRole="button" accessibilityLabel={`选择分类：${category}`} onPress={() => setSelectedCategory(category)} style={[styles.categoryButton, selectedCategory === category ? styles.categorySelected : null]}>
                  <Text style={[styles.categoryIcon, { backgroundColor: categoryColors[index % categoryColors.length] }]}>{category.slice(0, 1)}</Text>
                  <Text style={styles.categoryName}>{category}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>金额 (¥)</Text>
                <TextInput {...amountInputWebProps} keyboardType="decimal-pad" nativeID="finance-amount-input" onChange={makeTextInputChangeHandler(setAmount)} onChangeText={setAmount} placeholder="0.00" style={[styles.input, styles.flexInput]} value={amount} />
              </View>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>日期</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="选择记账日期" onPress={() => setDatePickerOpen((value) => !value)} style={[styles.dateField, styles.flexInput]}>
                  <Text style={styles.dateValue}>{date.replaceAll("-", "/")}</Text>
                  <Text style={styles.dateChevron}>⌄</Text>
                </Pressable>
                <DatePickerPopup onCancel={() => setDatePickerOpen(false)} onConfirm={(date) => { setDate(date); setDatePickerOpen(false); }} selectedDate={date} title="选择记账日期" visible={datePickerOpen} />
              </View>
            </View>
            <Text style={styles.fieldLabel}>备注</Text>
            <TextInput {...noteInputWebProps} nativeID="finance-note-input" onChange={makeTextInputChangeHandler(setNote)} onChangeText={setNote} placeholder="可选备注..." style={[styles.input, styles.noteInput]} value={note} />
            <Pressable accessibilityRole="button" accessibilityLabel="快速记账" nativeID="finance-save-button" onPress={saveTransaction} style={styles.primaryButton}>
              <Text style={styles.primaryText}>记一笔</Text>
            </Pressable>
            <Text nativeID="finance-feedback" style={styles.feedback}>{feedback}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.detailTabs}>
              <Pressable accessibilityRole="button" accessibilityLabel="支出明细" onPress={() => setDetailType("expense")} style={[styles.detailTab, detailType === "expense" ? styles.detailTabActive : null]}>
                <Text style={[styles.detailTabText, detailType === "expense" ? styles.detailTabTextActive : null]}>支出明细</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="收入明细" onPress={() => setDetailType("income")} style={[styles.detailTab, detailType === "income" ? styles.detailTabActive : null]}>
                <Text style={[styles.detailTabText, detailType === "income" ? styles.detailTabTextActive : null]}>收入明细</Text>
              </Pressable>
            </View>
            {detailTransactions.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>💰</Text>
                <Text style={styles.emptyTitle}>{detailType === "expense" ? "暂无支出记录" : "暂无收入记录"}</Text>
                <Text style={styles.emptyText}>{detailType === "expense" ? "开始记录你的第一笔支出" : "开始记录你的第一笔收入"}</Text>
              </View>
            ) : (
              detailTransactions.map((transaction) => <TransactionItem key={transaction.id} onDelete={deleteTransaction} transaction={transaction} />)
            )}
          </View>
        </>
      ) : null}

      {tab === "stats" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>近7天支出趋势</Text>
            <View style={styles.lineChart}>
              {sevenDayTrend.map((day) => (
                <View key={day.date} style={styles.linePointWrap}>
                  <View style={styles.lineTrack}>
                    <View style={[styles.linePoint, { bottom: `${day.height}%` }]} />
                  </View>
                  <Text style={styles.chartLabel}>{day.label}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>本月分类占比</Text>
            {summary.categoryShares.length === 0 ? <Text style={styles.emptyText}>暂无支出分类数据。</Text> : summary.categoryShares.map((share, index) => {
              const color = getCategoryColor(share.categoryName, index);
              const percent = Math.round(share.ratio * 100);
              return (
                <View key={share.categoryName} style={styles.shareRow}>
                  <View style={[styles.shareDot, { backgroundColor: color }]} />
                  <Text style={styles.shareName}>{share.categoryName}</Text>
                  <View style={styles.shareTrack}>
                    <View style={[styles.shareFill, { width: `${percent}%`, backgroundColor: color }]} />
                  </View>
                  <Text style={[styles.sharePercent, { color }]}>{percent}%</Text>
                  <Text style={[styles.shareAmount, { color }]}>¥{share.amount}</Text>
                </View>
              );
            })}
            {summary.categoryShares.length > 0 ? <CategoryPieChart shares={summary.categoryShares} /> : null}
            <Text style={styles.formula}>本月结余 = 本月收入 ¥{summary.monthIncome} - 本月支出 ¥{summary.monthExpense}</Text>
          </View>
        </>
      ) : null}

      {tab === "gifts" ? (
        <>
          <View style={styles.metricGrid}>
            <Metric count="送出" title="本年送出" value={`¥${giftStats.yearSent}`} />
            <Metric count="收到" title="本年收到" value={`¥${giftStats.yearReceived}`} />
            <Metric count="差额" title="往来差额" value={`¥${giftStats.balance}`} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{giftDirection === "sent" ? "送出份子" : "收到份子"}</Text>
            <View style={styles.segmentRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="送出" onPress={() => setGiftDirection("sent")} style={[styles.segment, giftDirection === "sent" ? styles.segmentActive : null]}>
                <Text style={[styles.segmentText, giftDirection === "sent" ? styles.segmentTextActive : null]}>送出</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="收到" onPress={() => setGiftDirection("received")} style={[styles.segment, giftDirection === "received" ? styles.segmentActive : null]}>
                <Text style={[styles.segmentText, giftDirection === "received" ? styles.segmentTextActive : null]}>收到</Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>事项类型</Text>
            <View style={styles.categoryGrid}>
              {giftEventTypes.map((eventType) => (
                <Pressable key={eventType} accessibilityRole="button" accessibilityLabel={`选择事项：${eventType}`} onPress={() => setGiftEventType(eventType)} style={[styles.categoryButton, giftEventType === eventType ? styles.categorySelected : null]}>
                  <Text style={[styles.categoryIcon, { backgroundColor: categoryColors[giftEventTypes.indexOf(eventType) % categoryColors.length] }]}>{eventType.slice(0, 1)}</Text>
                  <Text style={styles.categoryName}>{eventType}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>联系人</Text>
            <TextInput {...giftContactInputWebProps} nativeID="finance-gift-contact-input" onChange={makeTextInputChangeHandler(setGiftContact)} onChangeText={setGiftContact} placeholder="姓名" style={styles.input} value={giftContact} />

            <Text style={styles.fieldLabel}>金额 (¥)</Text>
            <TextInput {...giftAmountInputWebProps} keyboardType="decimal-pad" nativeID="finance-gift-amount-input" onChange={makeTextInputChangeHandler(setGiftAmount)} onChangeText={setGiftAmount} placeholder="0.00" style={styles.input} value={giftAmount} />

            <Text style={styles.fieldLabel}>日期</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="选择份子日期" onPress={() => setGiftDatePickerOpen((value) => !value)} style={styles.dateField}>
              <Text style={styles.dateValue}>{giftDate.replaceAll("-", "/")}</Text>
              <Text style={styles.dateChevron}>⌄</Text>
            </Pressable>
            <DatePickerPopup onCancel={() => setGiftDatePickerOpen(false)} onConfirm={(date) => { setGiftDate(date); setGiftDatePickerOpen(false); }} selectedDate={giftDate} title="选择份子日期" visible={giftDatePickerOpen} />

            <Text style={styles.fieldLabel}>地点</Text>
            <TextInput {...giftPlaceInputWebProps} nativeID="finance-gift-place-input" onChange={makeTextInputChangeHandler(setGiftPlace)} onChangeText={setGiftPlace} placeholder="可选..." style={styles.input} value={giftPlace} />

            <Text style={styles.fieldLabel}>备注</Text>
            <TextInput {...giftNoteInputWebProps} nativeID="finance-gift-note-input" onChange={makeTextInputChangeHandler(setGiftNote)} onChangeText={setGiftNote} placeholder="可选备注..." style={[styles.input, styles.noteInput]} value={giftNote} />

            {giftDirection === "sent" ? (
              <View style={styles.giftToggleRow}>
                <Pressable accessibilityRole="switch" accessibilityLabel="同步到记账" accessibilityState={{ checked: giftSync }} onPress={() => setGiftSync((value) => !value)} style={styles.giftToggle}>
                  <View style={[styles.giftToggleTrack, giftSync ? styles.giftToggleTrackActive : null]}>
                    <View style={[styles.giftToggleThumb, giftSync ? styles.giftToggleThumbActive : null]} />
                  </View>
                  <Text style={styles.giftToggleText}>同步到支出账单</Text>
                </Pressable>
              </View>
            ) : null}

            {giftDirection === "sent" ? (
              <View style={styles.giftToggleRow}>
                <Pressable accessibilityRole="switch" accessibilityLabel="需要回礼提醒" accessibilityState={{ checked: giftNeedReturn }} onPress={() => setGiftNeedReturn((value) => !value)} style={styles.giftToggle}>
                  <View style={[styles.giftToggleTrack, giftNeedReturn ? styles.giftToggleTrackActive : null]}>
                    <View style={[styles.giftToggleThumb, giftNeedReturn ? styles.giftToggleThumbActive : null]} />
                  </View>
                  <Text style={styles.giftToggleText}>需要回礼提醒</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable accessibilityRole="button" accessibilityLabel="保存份子记录" nativeID="finance-gift-save-button" onPress={saveGift} style={styles.primaryButton}>
              <Text style={styles.primaryText}>保存份子记录</Text>
            </Pressable>
            <Text style={styles.feedback}>{feedback}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>份子记录</Text>
            {giftRecords.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🧧</Text>
                <Text style={styles.emptyTitle}>暂无份子记录</Text>
                <Text style={styles.emptyText}>开始记录第一笔份子</Text>
              </View>
            ) : (
              giftRecords.map((record) => <GiftItem key={record.id} onDelete={deleteGift} record={record} />)
            )}
          </View>
        </>
      ) : null}

      {tab === "saving" ? (
        <>
          <View style={styles.savingHero}>
            <Text style={styles.metricTitle}>储蓄总额</Text>
            <Text style={styles.savingValue}>¥{savingTotal}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>记录存取</Text>
            <View style={styles.formRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="存入" onPress={() => setSavingType("deposit")} style={[styles.selectField, savingType === "deposit" ? styles.selectActive : null]}>
                <Text style={styles.selectText}>存入</Text>
              </Pressable>
              <TextInput {...savingAmountInputWebProps} keyboardType="decimal-pad" nativeID="finance-saving-amount-input" onChange={makeTextInputChangeHandler(setSavingAmount)} onChangeText={setSavingAmount} placeholder="金额" style={[styles.input, styles.flexInput]} value={savingAmount} />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="取出" onPress={() => setSavingType("withdraw")} style={[styles.selectField, savingType === "withdraw" ? styles.selectActive : null]}>
              <Text style={styles.selectText}>取出</Text>
            </Pressable>
            <Text style={styles.fieldLabel}>日期</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="选择储蓄日期" onPress={() => setSavingDatePickerOpen((value) => !value)} style={styles.dateField}>
              <Text style={styles.dateValue}>{savingDate.replaceAll("-", "/")}</Text>
              <Text style={styles.dateChevron}>⌄</Text>
            </Pressable>
            <DatePickerPopup onCancel={() => setSavingDatePickerOpen(false)} onConfirm={(date) => { setSavingDate(date); setSavingDatePickerOpen(false); }} selectedDate={savingDate} title="选择储蓄日期" visible={savingDatePickerOpen} />
            <TextInput onChangeText={setSavingNote} placeholder="备注（可选）" style={styles.input} value={savingNote} />
            <Pressable accessibilityRole="button" accessibilityLabel="添加储蓄记录" onPress={saveSaving} style={styles.primaryButton}>
              <Text style={styles.primaryText}>添加</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {tab === "category" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>添加自定义分类</Text>
            <View style={styles.segmentRow}>
              {transactionTypeOptions.map((option) => (
                <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label} onPress={() => setCategoryType(option.value)} style={[styles.segment, categoryType === option.value ? styles.segmentActive : null]}>
                  <Text style={[styles.segmentText, categoryType === option.value ? styles.segmentTextActive : null]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.formRow}>
              <TextInput {...categoryInputWebProps} nativeID="finance-category-input" onChange={makeTextInputChangeHandler(setNewCategoryName)} onChangeText={setNewCategoryName} placeholder={`${categoryType === "expense" ? "支出" : "收入"}分类名称`} style={[styles.input, styles.flexInput]} value={newCategoryName} />
              <Pressable accessibilityRole="button" accessibilityLabel="添加分类" onPress={addCategory} style={styles.squareButton}>
                <Text style={styles.squareText}>+</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.listTitle}>所有分类</Text>
          {allCategories.map((category, index) => (
            <View key={`${category.transactionType}-${category.name}-${index}`} style={styles.categoryRow}>
              <Text style={[styles.categoryIcon, { backgroundColor: categoryColors[index % categoryColors.length] }]}>{category.name.slice(0, 1)}</Text>
              <Text style={styles.categoryRowName}>{category.name}</Text>
              <Text style={[styles.categoryBadge, { color: category.transactionType === "expense" ? "#ef4444" : "#16a34a" }]}>{category.transactionType === "expense" ? "支出" : "收入"}</Text>
              <Text style={styles.categoryBadge}>{category.isSystem ? "内置" : "自定义"}</Text>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.tab, active ? styles.tabActive : null]}>
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ count, title, value }: { count: string; title: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricCount}>{count}</Text>
    </View>
  );
}

function TransactionItem({ onDelete, transaction }: { onDelete: (transactionId: string) => void; transaction: FinanceTransaction }) {
  const isIncome = transaction.transactionType === "income";
  return (
    <View style={styles.transactionItem}>
      <View style={styles.transactionBody}>
        <Text style={styles.transactionTitle}>{transaction.categoryName}</Text>
        <Text style={styles.transactionMeta}>{transaction.localDate}{transaction.note ? ` · ${transaction.note}` : ""}</Text>
      </View>
      <Text style={[styles.transactionAmount, isIncome ? styles.transactionAmountIncome : null]}>{isIncome ? "+" : "-"}¥{transaction.amount}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`删除账单：${transaction.categoryName}`} onPress={() => onDelete(transaction.id)} style={styles.deleteButton}>
        <Text style={styles.deleteText}>删除</Text>
      </Pressable>
    </View>
  );
}

function GiftItem({ onDelete, record }: { onDelete: (giftId: string) => void; record: GiftRecord }) {
  const isReceived = record.direction === "received";
  return (
    <View style={styles.transactionItem}>
      <View style={styles.transactionBody}>
        <Text style={styles.transactionTitle}>{record.contactName} · {record.eventType}</Text>
        <Text style={styles.transactionMeta}>{record.eventDate}{record.place ? ` · ${record.place}` : ""}{record.note ? ` · ${record.note}` : ""}{record.syncFinance && !isReceived ? " · 已同步" : ""}</Text>
      </View>
      <Text style={[styles.transactionAmount, isReceived ? styles.transactionAmountIncome : null]}>{isReceived ? "+" : "-"}¥{record.amount}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`删除份子记录：${record.contactName}`} onPress={() => onDelete(record.id)} style={styles.deleteButton}>
        <Text style={styles.deleteText}>删除</Text>
      </Pressable>
    </View>
  );
}

function CategoryPieChart({ shares }: { shares: ReturnType<typeof buildFinanceSummary>["categoryShares"] }) {
  const size = 110;
  const radius = 36;
  const stroke = 18;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View accessibilityLabel="本月分类占比饼图" style={styles.piePanel}>
      <Svg height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <Circle cx={center} cy={center} fill="#ffffff" r={radius} stroke="#eef2f7" strokeWidth={stroke} />
        {shares.map((share, index) => {
          const length = Math.max(share.ratio * circumference, shares.length === 1 ? circumference : 2);
          const dashOffset = -offset;
          offset += length;
          return (
            <Circle
              key={share.categoryName}
              cx={center}
              cy={center}
              fill="transparent"
              r={radius}
              rotation="-90"
              origin={`${center}, ${center}`}
              stroke={chartColors[index % chartColors.length]}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeWidth={stroke}
            />
          );
        })}
        <Circle cx={center} cy={center} fill="#ffffff" r={radius - stroke / 2 - 2} />
      </Svg>
      <View style={styles.pieLegend}>
        {shares.map((share, index) => {
          const color = chartColors[index % chartColors.length];
          const percent = Math.round(share.ratio * 100);
          return (
            <View key={share.categoryName} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendName} numberOfLines={1}>{share.categoryName}</Text>
              <Text style={[styles.legendPercent, { color }]}>{percent}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function buildSevenDayExpenseTrend(transactions: FinanceTransaction[]) {
  const days = Array.from({ length: 7 }, (_, index) => shiftDate(new Date(), index - 6));
  const byDate = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.transactionType === "expense") {
      byDate.set(transaction.localDate, (byDate.get(transaction.localDate) ?? 0) + moneyToCents(transaction.amount));
    }
  }

  const maxCents = Math.max(100, ...days.map((day) => byDate.get(day.toISOString().slice(0, 10)) ?? 0));
  return days.map((day) => {
    const date = day.toISOString().slice(0, 10);
    const cents = byDate.get(date) ?? 0;
    return {
      date,
      height: Math.max(cents ? 8 : 0, Math.round((cents / maxCents) * 86)),
      label: date.slice(5)
    };
  });
}

function sumSavingEntries(entries: SavingEntry[]) {
  return centsToMoney(entries.reduce((sum, entry) => sum + (entry.type === "deposit" ? moneyToCents(entry.amount) : -moneyToCents(entry.amount)), 0));
}

function normalizeMoney(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return "";
  }
  return Number(trimmed).toFixed(2);
}

function moneyToCents(value: string) {
  const [yuan = "0", cents = ""] = value.split(".");
  return Number.parseInt(yuan || "0", 10) * 100 + Number.parseInt(cents.padEnd(2, "0").slice(0, 2) || "0", 10);
}

function centsToMoney(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

function shiftDate(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function readWebInputValue(id: string) {
  if (typeof document === "undefined") {
    return "";
  }
  const input = document.getElementById(id) as HTMLInputElement | null;
  return input?.value ?? "";
}

function makeTextInputChangeHandler(setValue: (value: string) => void) {
  return (event: NativeSyntheticEvent<TextInputChangeEventData>) => {
    const webEvent = event as unknown as { currentTarget?: { value?: string }; target?: { value?: string } };
    const nextValue = event.nativeEvent.text ?? webEvent.currentTarget?.value ?? webEvent.target?.value;
    if (typeof nextValue === "string") {
      setValue(nextValue);
    }
  };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e3e8ef",
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 14,
    position: "relative"
  },
  cardTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900"
  },
  categoryBadge: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    color: "#697386",
    fontSize: 14,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  categoryButton: {
    alignItems: "center",
    borderColor: "#e3e8ef",
    borderRadius: 12,
    borderWidth: 1,
    flexBasis: "23%",
    gap: 4,
    paddingVertical: 7
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-start"
  },
  categoryIcon: {
    borderRadius: 999,
    color: "#1599d3",
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 4
  },
  categoryName: {
    color: "#697386",
    fontSize: 11,
    fontWeight: "800"
  },
  categoryRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e3e8ef",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12
  },
  categoryRowName: {
    color: "#111827",
    flex: 1,
    fontSize: 16,
    fontWeight: "900"
  },
  categorySelected: {
    borderColor: "#1fa8e2",
    borderWidth: 2
  },
  chartLabel: {
    color: "#697386",
    fontSize: 12,
    fontWeight: "700"
  },
  deleteButton: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  deleteText: {
    color: "#697386",
    fontWeight: "800"
  },
  dateActions: {
    flexDirection: "row",
    gap: 12
  },
  dateCancelButton: {
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    flex: 1,
    paddingVertical: 12
  },
  dateCancelText: {
    color: "#111827",
    fontWeight: "900"
  },
  dateChevron: {
    color: "#697386",
    fontSize: 16,
    fontWeight: "900"
  },
  dateConfirmButton: {
    alignItems: "center",
    backgroundColor: "#1fa8e2",
    borderRadius: 12,
    flex: 1,
    paddingVertical: 12
  },
  dateConfirmText: {
    color: "#ffffff",
    fontWeight: "900"
  },
  dateField: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  datePickerCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e3e8ef",
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 14
  },
  datePickerMonth: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center"
  },
  datePickerTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center"
  },
  dateValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800"
  },
  dayCell: {
    alignItems: "center",
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    width: "13.2%"
  },
  dayCellSelected: {
    backgroundColor: "#1fa8e2"
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    justifyContent: "space-between"
  },
  dayMuted: {
    color: "#c6ccd5"
  },
  dayText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800"
  },
  dayTextSelected: {
    color: "#ffffff"
  },
  detailTab: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    paddingVertical: 10
  },
  detailTabActive: {
    backgroundColor: "#eaf6ff"
  },
  detailTabs: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    flexDirection: "row",
    gap: 6,
    padding: 5
  },
  detailTabText: {
    color: "#697386",
    fontSize: 17,
    fontWeight: "900"
  },
  detailTabTextActive: {
    color: "#0f79ad"
  },
  emptyBox: {
    alignItems: "center",
    gap: 8,
    minHeight: 180,
    justifyContent: "center"
  },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  weekText: {
    color: "#697386",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    width: "13.2%"
  },
  emptyIcon: {
    fontSize: 34
  },
  emptyText: {
    color: "#697386",
    fontSize: 15
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900"
  },
  feedback: {
    color: "#697386",
    fontSize: 13,
    fontWeight: "800"
  },
  fieldLabel: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900"
  },
  flexInput: {
    flex: 1
  },
  giftToggle: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  giftToggleRow: {
    flexDirection: "row",
    gap: 16
  },
  giftToggleText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800"
  },
  giftToggleThumb: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    height: 30,
    width: 30
  },
  giftToggleThumbActive: {
    marginLeft: 28
  },
  giftToggleTrack: {
    backgroundColor: "#e3e8ef",
    borderRadius: 999,
    padding: 3,
    width: 66
  },
  giftToggleTrackActive: {
    backgroundColor: "#1fa8e2"
  },
  formRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  formCol: {
    flex: 1,
    gap: 4,
    minWidth: 120
  },
  formula: {
    color: "#697386",
    fontSize: 14,
    fontWeight: "800"
  },
  hero: {
    gap: 6
  },
  heroSub: {
    color: "#697386",
    fontSize: 15,
    fontWeight: "700"
  },
  heroTitle: {
    color: "#111827",
    fontSize: 26,
    fontWeight: "900"
  },
  input: {
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 12,
    borderWidth: 1,
    color: "#111827",
    fontSize: 14,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  lineChart: {
    flexDirection: "row",
    gap: 8,
    height: 140
  },
  linePoint: {
    backgroundColor: "#1fa8e2",
    borderRadius: 999,
    height: 12,
    left: "50%",
    marginLeft: -6,
    position: "absolute",
    width: 12
  },
  linePointWrap: {
    alignItems: "center",
    flex: 1,
    gap: 8
  },
  lineTrack: {
    backgroundColor: "#f8fafc",
    borderColor: "#edf1f5",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    width: "100%"
  },
  listTitle: {
    color: "#697386",
    fontSize: 20,
    fontWeight: "900"
  },
  metric: {
    alignItems: "center",
    backgroundColor: "#eaf6ff",
    borderColor: "#d7eaf7",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexBasis: "23%",
    minWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 10
  },
  metricCount: {
    color: "#697386",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 8
  },
  metricTitle: {
    color: "#697386",
    fontSize: 11,
    fontWeight: "800"
  },
  metricValue: {
    color: "#1fa8e2",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2
  },
  noteInput: {
    minHeight: 64,
    textAlignVertical: "top"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#1fa8e2",
    borderRadius: 12,
    paddingVertical: 12
  },
  primaryText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900"
  },
  pieHint: {
    color: "#697386",
    fontSize: 12,
    fontWeight: "700"
  },
  piePanel: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#edf1f5",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12
  },
  pieLegend: {
    flex: 1,
    gap: 8
  },
  legendRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  legendDot: {
    borderRadius: 999,
    height: 10,
    width: 10
  },
  legendName: {
    color: "#111827",
    flex: 1,
    fontSize: 13,
    fontWeight: "900"
  },
  legendPercent: {
    fontSize: 13,
    fontWeight: "900",
    width: 40,
    textAlign: "right"
  },
  pieTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900"
  },
  savingHero: {
    backgroundColor: "#eaf6ff",
    borderColor: "#d7eaf7",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16
  },
  savingValue: {
    color: "#1fa8e2",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 8
  },
  segment: {
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7
  },
  segmentActive: {
    backgroundColor: "#1fa8e2",
    borderColor: "#1fa8e2"
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  segmentText: {
    color: "#697386",
    fontSize: 13,
    fontWeight: "900"
  },
  segmentTextActive: {
    color: "#ffffff"
  },
  selectActive: {
    borderColor: "#1fa8e2"
  },
  selectField: {
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 150,
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  selectText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900"
  },
  shareAmount: {
    fontWeight: "800",
    width: 80
  },
  shareDot: {
    borderRadius: 999,
    height: 10,
    width: 10
  },
  shareFill: {
    borderRadius: 999,
    height: "100%"
  },
  shareLine: {
    borderLeftWidth: 2,
    height: 14,
    marginLeft: 16,
    opacity: 0.3
  },
  shareName: {
    color: "#111827",
    fontWeight: "900",
    width: 56
  },
  sharePercent: {
    fontWeight: "900",
    width: 42,
    textAlign: "right"
  },
  shareRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  shareTrack: {
    backgroundColor: "#eef2f7",
    borderRadius: 999,
    flex: 1,
    height: 10,
    overflow: "hidden"
  },
  squareButton: {
    alignItems: "center",
    backgroundColor: "#7acbf0",
    borderRadius: 14,
    height: 54,
    justifyContent: "center",
    width: 54
  },
  squareText: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "500"
  },
  stack: {
    gap: 18
  },
  tab: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    paddingVertical: 10
  },
  tabActive: {
    backgroundColor: "#ffffff"
  },
  tabs: {
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    flexDirection: "row",
    gap: 4,
    padding: 4
  },
  tabText: {
    color: "#697386",
    fontSize: 14,
    fontWeight: "900"
  },
  tabTextActive: {
    color: "#111827"
  },
  transactionAmount: {
    color: "#ef4444",
    fontSize: 17,
    fontWeight: "900"
  },
  transactionAmountIncome: {
    color: "#16a34a"
  },
  transactionBody: {
    flex: 1,
    gap: 4
  },
  transactionItem: {
    alignItems: "center",
    borderColor: "#e3e8ef",
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 13
  },
  transactionMeta: {
    color: "#697386",
    fontSize: 13,
    fontWeight: "700"
  },
  transactionTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900"
  }
});
