import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { hydrateFinanceTransactionsFromCloud, loadFinanceTransactions, type FinanceTransaction } from "@/features/finance/financeStorage";
import { hydrateNotesFromCloud, loadNotes } from "@/features/home/notesStorage";
import { hydratePackagesFromCloud, loadPackages, type PackageItem } from "@/features/plan/packageStorage";
import { getDefaultTodoStorage, hydrateTodosFromCloud, loadLocalTodos, saveLocalTodos, sortTodos, type TodoStorage, type TodoTask } from "@/features/plan/todoStorage";
import type { UiTokens } from "@/shared/ui/primitives";
import { MealSpinner } from "./MealSpinner";
import { NotesPanel } from "./NotesPanel";
import { TodoPanel } from "@/features/plan/TodoPanel";

const MEAL_PRESET_COUNT = 8;

type HomePanelProps = {
  onOpenFinance?: () => void;
  onOpenPackages?: () => void;
  shortcutNonce?: number;
  shortcutView?: "notes" | "todos";
  storage?: TodoStorage;
  themeTokens: UiTokens;
};

type ViewState = "home" | "notes" | "todos";

const todoPriorityLabels: Record<TodoTask["priority"], string> = {
  high: "重要",
  low: "轻松",
  normal: "常规",
  urgent: "紧急"
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatToday(): string {
  const now = new Date();
  const weekDays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekDays[now.getDay()]}`;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function moneyToCents(value: string) {
  const [yuan = "0", cents = ""] = value.split(".");
  return Number.parseInt(yuan || "0", 10) * 100 + Number.parseInt(cents.padEnd(2, "0").slice(0, 2) || "0", 10);
}

function centsToMoney(cents: number) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function HomePanel({ onOpenFinance, onOpenPackages, shortcutNonce, shortcutView, storage, themeTokens }: HomePanelProps) {
  const todoStorage = useMemo(() => storage ?? getDefaultTodoStorage(), [storage]);
  const [todos, setTodos] = useState<TodoTask[]>(() => loadLocalTodos(todoStorage));
  const [notes] = useState(() => loadNotes());
  const [packages, setPackages] = useState<PackageItem[]>(() => loadPackages());
  const [transactions, setTransactions] = useState<FinanceTransaction[]>(() => loadFinanceTransactions());
  const [viewState, setViewState] = useState<ViewState>("home");
  const [mealOpen, setMealOpen] = useState(false);
  const styles = useMemo(() => createStyles(themeTokens), [themeTokens]);

  useEffect(() => {
    if (shortcutView) setViewState(shortcutView);
  }, [shortcutNonce, shortcutView]);

  useEffect(() => {
    let cancelled = false;
    hydrateTodosFromCloud(todoStorage).then((next) => !cancelled && setTodos(next)).catch(() => {});
    hydrateNotesFromCloud().catch(() => {});
    hydratePackagesFromCloud().then((next) => !cancelled && setPackages(next)).catch(() => {});
    hydrateFinanceTransactionsFromCloud().then((next) => !cancelled && setTransactions(next)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [todoStorage]);

  const completedCount = todos.filter((todo) => todo.completed).length;
  const pendingCount = todos.length - completedCount;
  const pendingPackages = packages.filter((item) => !item.pickedUp).length;
  const visibleTodos = todos.slice(0, 3);
  const todayExpense = useMemo(() => {
    const today = todayIso();
    return centsToMoney(
      transactions
        .filter((transaction) => transaction.transactionType === "expense" && transaction.localDate === today)
        .reduce((sum, transaction) => sum + moneyToCents(transaction.amount), 0)
    );
  }, [transactions]);
  const summaryLine = useMemo(() => {
    if (todos.length > 0 && pendingCount === 0) return "今天的待办已经全部完成。";
    if (pendingCount > 0) return `今天还有 ${pendingCount} 项待办未完成。`;
    if (pendingPackages > 0) return `你还有 ${pendingPackages} 个快递等待领取。`;
    if (Number(todayExpense) === 0) return "今天还没有新增待办、快递或支出记录。";
    return `今天已记录支出 ¥${todayExpense}。`;
  }, [pendingCount, pendingPackages, todayExpense, todos.length]);

  const toggleHomeTodo = (todoId: string) => {
    const next = sortTodos(todos.map((todo) => (todo.id === todoId ? { ...todo, completed: !todo.completed } : todo)));
    setTodos(next);
    saveLocalTodos(next, todoStorage);
  };

  if (viewState === "notes") {
    return (
      <View style={styles.page}>
        <NotesPanel shortcutCreate={shortcutView === "notes"} onClose={() => setViewState("home")} storage={undefined} themeTokens={themeTokens} />
      </View>
    );
  }

  if (viewState === "todos") {
    return (
      <View style={styles.page}>
        <TodoPanel shortcutCreate={shortcutView === "todos"} onClose={() => setViewState("home")} storage={todoStorage} themeTokens={themeTokens} />
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()}</Text>
          <Text style={styles.date}>{formatToday()}</Text>
        </View>
      </View>

      <View testID="home-control-strip" style={styles.controlStrip}>
        <View style={styles.summaryCard}>
          <Text style={styles.widgetTitle}>今日概览</Text>
          <View style={styles.summaryGrid}>
            <OverviewItem label="今日待办" onPress={() => setViewState("todos")} styles={styles} value={`${completedCount}/${todos.length}`} />
            <View style={styles.summaryDivider} />
            <OverviewItem label="待取快递" onPress={() => onOpenPackages?.()} styles={styles} value={String(pendingPackages)} />
            <View style={styles.summaryDivider} />
            <OverviewItem label="今日支出" onPress={() => onOpenFinance?.()} styles={styles} value={`¥${todayExpense}`} />
          </View>
          <Text style={styles.summaryLine} numberOfLines={1}>{summaryLine}</Text>
        </View>
      </View>

      <View testID="home-todo-widget" style={styles.widget}>
        <View style={styles.widgetHeader}>
          <Text style={styles.widgetTitle}>今日待办</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="查看全部每日待办" onPress={() => setViewState("todos")} style={styles.widgetMore}>
            <Text style={styles.widgetMoreText}>全部 →</Text>
          </Pressable>
        </View>
        {todos.length === 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="添加待办" onPress={() => setViewState("todos")} style={styles.compactEmpty}>
            <Text style={styles.emptyHint}>今天还没有待办</Text>
            <Text style={styles.quickLink}>添加待办</Text>
          </Pressable>
        ) : (
          <View style={styles.todoPreviewList}>
            {visibleTodos.map((todo) => (
              <View key={todo.id} style={styles.todoRow}>
                <Pressable accessibilityRole="checkbox" accessibilityLabel={`${todo.completed ? "恢复" : "完成"}首页待办：${todo.title}`} accessibilityState={{ checked: todo.completed }} onPress={() => toggleHomeTodo(todo.id)} style={styles.todoCheckWrap}>
                  <View style={[styles.todoCheck, todo.completed ? styles.todoCheckActive : null]}>{todo.completed ? <Text style={styles.todoCheckMark}>✓</Text> : null}</View>
                </Pressable>
                <View style={styles.todoTextButton}>
                  <Text style={[styles.todoTitle, todo.completed ? styles.todoTitleDone : null]} numberOfLines={1}>{todo.title}</Text>
                </View>
                <Text style={[styles.todoPriorityText, todo.completed ? styles.todoPriorityTextDone : null]}>{todoPriorityLabels[todo.priority]}</Text>
              </View>
            ))}
            {todos.length > 3 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="查看全部每日待办" onPress={() => setViewState("todos")} style={styles.inlineMore}>
                <Text style={styles.todoTagText}>查看全部 {todos.length} 条</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>

      <View style={styles.widget}>
        <View style={styles.widgetHeader}>
          <Text style={styles.widgetTitle}>备忘录</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="查看全部备忘" onPress={() => setViewState("notes")} style={styles.widgetMore}>
            <Text style={styles.widgetMoreText}>全部 →</Text>
          </Pressable>
        </View>
        <Pressable testID="home-notes-quick-entry" accessibilityRole="button" accessibilityLabel="快速记一条备忘" onPress={() => setViewState("notes")} style={styles.notesQuickEntry}>
          <Text style={styles.notesPlaceholder}>闪过的念头、待买清单……</Text>
          <Text style={styles.quickLink}>＋ 快速记一条备忘</Text>
          {notes.length > 0 ? <Text style={styles.notesCount}>已有 {notes.length} 条</Text> : null}
        </Pressable>
      </View>

      <View style={styles.widget}>
        <Pressable testID="meal-spinner-compact-entry" accessibilityRole="button" accessibilityLabel="打开今天吃什么转盘" onPress={() => setMealOpen((value) => !value)} style={styles.mealEntry}>
          <View>
            <Text style={styles.widgetTitle}>今天吃什么</Text>
            <Text style={styles.notesPlaceholder}>已添加 {MEAL_PRESET_COUNT} 个候选选项</Text>
          </View>
          <Text style={styles.quickLink}>{mealOpen ? "收起" : "去转盘 →"}</Text>
        </Pressable>
        {mealOpen ? <MealSpinner /> : null}
      </View>
    </ScrollView>
  );
}

function OverviewItem({ label, onPress, styles, value }: { label: string; onPress: () => void; styles: ReturnType<typeof createStyles>; value: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`打开${label}`} onPress={onPress} style={styles.summaryStat}>
      <Text numberOfLines={1} style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </Pressable>
  );
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    compactEmpty: {
      alignItems: "center",
      backgroundColor: "#f6faf6",
      borderRadius: 14,
      gap: 6,
      padding: 12
    },
    controlStrip: {
      flexDirection: "row"
    },
    date: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 4
    },
    emptyHint: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "800"
    },
    greeting: {
      color: tokens.text,
      fontSize: 22,
      fontWeight: "900"
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    inlineMore: {
      alignSelf: "flex-start",
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5
    },
    mealEntry: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    notesCount: {
      color: tokens.textMuted,
      fontSize: 11,
      fontWeight: "800"
    },
    notesPlaceholder: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "700"
    },
    notesQuickEntry: {
      backgroundColor: "#f6faf6",
      borderRadius: 14,
      gap: 8,
      padding: 12
    },
    page: {
      gap: 14,
      paddingBottom: 40
    },
    quickLink: {
      color: tokens.accent,
      fontSize: 13,
      fontWeight: "900"
    },
    summaryCard: {
      backgroundColor: "#ffffff",
      borderRadius: 18,
      elevation: 2,
      flex: 1,
      gap: 10,
      padding: 14,
      shadowColor: "#7cb87c",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16
    },
    summaryDivider: {
      backgroundColor: tokens.border,
      height: 42,
      width: 1
    },
    summaryGrid: {
      alignItems: "center",
      flexDirection: "row"
    },
    summaryLabel: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "800",
      textAlign: "center"
    },
    summaryLine: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "800"
    },
    summaryStat: {
      alignItems: "center",
      flex: 1,
      gap: 4,
      justifyContent: "center",
      minHeight: 54,
      paddingHorizontal: 4
    },
    summaryValue: {
      color: tokens.text,
      fontSize: 18,
      fontWeight: "900",
      maxWidth: "100%"
    },
    todoCheck: {
      alignItems: "center",
      borderColor: tokens.border,
      borderRadius: 5,
      borderWidth: 1.5,
      height: 20,
      justifyContent: "center",
      width: 20
    },
    todoCheckActive: {
      backgroundColor: tokens.accent,
      borderColor: tokens.accent
    },
    todoCheckMark: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "900"
    },
    todoCheckWrap: {
      alignItems: "center",
      justifyContent: "center"
    },
    todoPreviewList: {
      gap: 7
    },
    todoPriorityText: {
      color: "#4f9d39",
      fontSize: 11,
      fontWeight: "900"
    },
    todoPriorityTextDone: {
      color: tokens.textMuted
    },
    todoRow: {
      alignItems: "center",
      backgroundColor: "#f6faf6",
      borderColor: tokens.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 9,
      minHeight: 42,
      paddingHorizontal: 10,
      paddingVertical: 7
    },
    todoTagText: {
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "900"
    },
    todoTextButton: {
      flex: 1,
      minWidth: 0
    },
    todoTitle: {
      color: tokens.text,
      fontSize: 14,
      fontWeight: "800"
    },
    todoTitleDone: {
      color: tokens.textMuted,
      textDecorationLine: "line-through"
    },
    widget: {
      backgroundColor: "#ffffff",
      borderRadius: 18,
      elevation: 2,
      gap: 10,
      padding: 14,
      shadowColor: "#7cb87c",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16
    },
    widgetHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    widgetMore: {
      flexShrink: 0
    },
    widgetMoreText: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "900"
    },
    widgetTitle: {
      color: tokens.text,
      fontSize: 16,
      fontWeight: "900"
    }
  });
}
