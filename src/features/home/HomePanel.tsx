import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { hydrateFinanceTransactionsFromCloud, loadFinanceTransactions, type FinanceTransaction } from "@/features/finance/financeStorage";
import { hydrateNotesFromCloud, loadNotes } from "@/features/home/notesStorage";
import { hydratePackagesFromCloud, loadPackages, type PackageItem } from "@/features/plan/packageStorage";
import { hydrateRemindersFromCloud, loadReminders, type ReminderItem } from "@/features/plan/reminderStorage";
import { setPlanFocus, type PlanFocus } from "@/features/plan/planFocus";
import { getDefaultTodoStorage, hydrateTodosFromCloud, loadLocalTodos, saveLocalTodos, sortTodos, type TodoStorage, type TodoTask } from "@/features/plan/todoStorage";
import { QUICK_CAPTURE_DATA_EVENT } from "@/features/quick-capture/quickCapture";
import { HOME_CARDS, loadHomeCollapsed, loadHomeOrder, moveCardDown, moveCardUp, saveHomeCollapsed, saveHomeOrder, toggleCardHidden, type HomeCardId } from "@/features/home/homeLayout";
import { CollapsibleSectionFooter, useCollapsibleList } from "@/shared/ui/CollapsibleList";
import { AnimatedNumber } from "@/shared/ui/AnimatedNumber";
import { IconCheck, IconChecklist, IconChevronRight, IconClock, IconGripVertical, IconMoreHorizontal } from "@/shared/ui/lineIcons";
import { PressableScale } from "@/shared/ui/PressableScale";
import type { UiTokens } from "@/shared/ui/primitives";
import { EmptyState } from "@/shared/ui/primitives";
import { HomeCard } from "@/shared/ui/HomeCard";
import { showUndoToast } from "@/shared/ui/UndoToast";
import { StatusSticker } from "@/shared/ui/StatusSticker";
import { MealSpinner } from "./MealSpinner";
import { NotesPanel } from "./NotesPanel";
import { TodoPanel } from "@/features/plan/TodoPanel";

const MEAL_PRESET_COUNT = 8;

type HomePanelProps = {
  onOpenFinance?: () => void;
  onOpenPackages?: () => void;
  onOpenPlan?: (focus: PlanFocus) => void;
  onOpenQuickAccounting?: () => void;
  shortcutNonce?: number;
  shortcutView?: "notes" | "todos";
  storage?: TodoStorage;
  themeTokens: UiTokens;
};

type ViewState = "home" | "notes" | "todos";

type NextThing = {
  focus: PlanFocus;
  title: string;
  timeLabel: string;
  near: boolean;
};

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
  const safe = Math.max(0, Math.round(cents));
  return `${Math.floor(safe / 100)}.${String(safe % 100).padStart(2, "0")}`;
}

function timeLabelFromIso(iso?: string | null): string | null {
  if (!iso || !iso.includes("T")) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function buildNextThing(todos: TodoTask[], reminders: ReminderItem[], packages: PackageItem[]): NextThing | null {
  const today = todayIso();
  const now = Date.now();
  type Candidate = { focus: PlanFocus; title: string; timeLabel: string; sortKey: number };
  const candidates: Candidate[] = [];

  for (const todo of todos) {
    if (todo.completed || !todo.deadline) continue;
    const d = new Date(todo.deadline);
    if (Number.isNaN(d.getTime())) continue;
    const isoDate = d.toISOString().slice(0, 10);
    if (isoDate !== today) continue;
    candidates.push({
      focus: { date: isoDate, kind: "todo", id: todo.id },
      title: todo.title,
      timeLabel: timeLabelFromIso(todo.deadline) ?? "全天",
      sortKey: d.getTime()
    });
  }
  for (const reminder of reminders) {
    if (reminder.date !== today) continue;
    const sortKey = reminder.time ? new Date(`${reminder.date}T${reminder.time}`).getTime() : new Date(`${reminder.date}T23:59`).getTime();
    candidates.push({
      focus: { date: reminder.date, kind: "reminder", id: reminder.id },
      title: reminder.title,
      timeLabel: reminder.time ?? "全天",
      sortKey
    });
  }
  for (const pkg of packages) {
    if (pkg.pickedUp || pkg.arrivalDate !== today) continue;
    candidates.push({
      focus: { date: pkg.arrivalDate, kind: "package", id: pkg.id },
      title: pkg.company ? `取快递（${pkg.company}）` : "取快递",
      timeLabel: "待取",
      sortKey: new Date(`${pkg.arrivalDate}T23:58`).getTime()
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.sortKey - b.sortKey);
  const first = candidates[0];
  const near = first.sortKey - now > 0 && first.sortKey - now < 2 * 60 * 60 * 1000;
  return { ...first, near };
}

export function HomePanel({ onOpenFinance, onOpenPackages, onOpenPlan, onOpenQuickAccounting, shortcutNonce, shortcutView, storage, themeTokens }: HomePanelProps) {
  const todoStorage = useMemo(() => storage ?? getDefaultTodoStorage(), [storage]);
  const [todos, setTodos] = useState<TodoTask[]>(() => loadLocalTodos(todoStorage));
  const [notes, setNotes] = useState(() => loadNotes());
  const [packages, setPackages] = useState<PackageItem[]>(() => loadPackages());
  const [reminders, setReminders] = useState<ReminderItem[]>(() => loadReminders());
  const [transactions, setTransactions] = useState<FinanceTransaction[]>(() => loadFinanceTransactions());
  const [viewState, setViewState] = useState<ViewState>("home");
  const [mealOpen, setMealOpen] = useState(false);
  const [order, setOrder] = useState<HomeCardId[]>(() => loadHomeOrder());
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>(() => loadHomeCollapsed());
  const [editMode, setEditMode] = useState(false);
  const styles = useMemo(() => createStyles(themeTokens), [themeTokens]);

  const toggleCollapse = (id: HomeCardId) => {
    setCollapsedMap((previous) => {
      const next = { ...previous, [id]: !(previous[id] ?? false) };
      saveHomeCollapsed(next);
      return next;
    });
  };
  const moveUp = (id: HomeCardId) => {
    setOrder((previous) => {
      const next = moveCardUp(previous, id);
      if (next !== previous) saveHomeOrder(next);
      return next;
    });
  };
  const moveDown = (id: HomeCardId) => {
    setOrder((previous) => {
      const next = moveCardDown(previous, id);
      if (next !== previous) saveHomeOrder(next);
      return next;
    });
  };
  const toggleHide = (id: HomeCardId) => {
    setOrder((previous) => {
      const next = toggleCardHidden(previous, id);
      if (next !== previous) saveHomeOrder(next);
      return next;
    });
  };

  useEffect(() => {
    if (shortcutView) setViewState(shortcutView);
  }, [shortcutNonce, shortcutView]);

  useEffect(() => {
    let cancelled = false;
    hydrateTodosFromCloud(todoStorage).then((next) => !cancelled && setTodos(next)).catch(() => {});
    hydrateNotesFromCloud().then((next) => !cancelled && setNotes(next)).catch(() => {});
    hydratePackagesFromCloud().then((next) => !cancelled && setPackages(next)).catch(() => {});
    hydrateRemindersFromCloud().then((next) => !cancelled && setReminders(next)).catch(() => {});
    hydrateFinanceTransactionsFromCloud().then((next) => !cancelled && setTransactions(next)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [todoStorage]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    const refresh = () => {
      setTodos(sortTodos(loadLocalTodos(todoStorage)));
      setNotes(loadNotes());
      setPackages(loadPackages());
      setReminders(loadReminders());
      setTransactions(loadFinanceTransactions());
    };
    window.addEventListener(QUICK_CAPTURE_DATA_EVENT, refresh);
    return () => window.removeEventListener(QUICK_CAPTURE_DATA_EVENT, refresh);
  }, [todoStorage]);

  const completedCount = todos.filter((todo) => todo.completed).length;
  const pendingCount = todos.length - completedCount;
  const pendingPackages = packages.filter((item) => !item.pickedUp).length;
  const sortedHomeTodos = useMemo(() => sortTodos(todos), [todos]);
  const todoList = useCollapsibleList(sortedHomeTodos);
  const todayExpenseCents = useMemo(() => {
    const today = todayIso();
    return transactions
      .filter((transaction) => transaction.transactionType === "expense" && transaction.localDate === today)
      .reduce((sum, transaction) => sum + moneyToCents(transaction.amount), 0);
  }, [transactions]);
  const nextThing = useMemo(() => buildNextThing(todos, reminders, packages), [todos, reminders, packages]);
  const statusChip = useMemo<{ text: string; icon: "check" | "dot"; onPress?: () => void } | null>(() => {
    if (pendingCount > 0) return { text: `还有 ${pendingCount} 项`, icon: "dot", onPress: () => setViewState("todos") };
    if (pendingPackages > 0) return { text: `${pendingPackages} 个待取快递`, icon: "dot", onPress: () => onOpenPackages?.() };
    if (todos.length > 0) return { text: "今天已清空", icon: "check", onPress: () => setViewState("todos") };
    return { text: "今天很轻松", icon: "dot" };
  }, [pendingCount, pendingPackages, todos.length, onOpenPackages]);
  const allTodosDone = todos.length > 0 && pendingCount === 0;

  const toggleHomeTodo = (todoId: string) => {
    const target = todos.find((todo) => todo.id === todoId);
    if (!target) return;
    const wasCompleted = target.completed;
    const next = sortTodos(todos.map((todo) => (todo.id === todoId ? { ...todo, completed: !todo.completed } : todo)));
    setTodos(next);
    saveLocalTodos(next, todoStorage);
    if (!wasCompleted) {
      showUndoToast({
        message: "待办已完成",
        onUndo: () => {
          const revert = sortTodos(todos.map((todo) => (todo.id === todoId ? { ...todo, completed: wasCompleted } : todo)));
          setTodos(revert);
          saveLocalTodos(revert, todoStorage);
          if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
            window.dispatchEvent(new Event(QUICK_CAPTURE_DATA_EVENT));
          }
        }
      });
    }
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

  const renderHomeCard = (id: HomeCardId, hidden: boolean) => {
    const meta = HOME_CARDS.find((card) => card.id === id);
    if (!meta) return null;
    const index = order.indexOf(id);
    const collapsed = collapsedMap[id] ?? false;
    const common = {
      collapsed,
      collapsible: true,
      onToggleCollapse: () => toggleCollapse(id),
      editMode,
      onMoveUp: () => moveUp(id),
      onMoveDown: () => moveDown(id),
      onToggleHide: () => toggleHide(id),
      hidden,
      locked: meta.core,
      canMoveUp: index > 0,
      canMoveDown: index < order.length - 1,
      tokens: themeTokens
    };

    switch (id) {
      case "summary":
        return (
          <HomeCard key={id} testID="home-summary-card" {...common} title={<Text style={styles.widgetTitle}>今日概览</Text>}>
            <View style={styles.summaryGrid}>
              <OverviewItem label="今日待办" onPress={() => setViewState("todos")} styles={styles} value={<AnimatedNumber value={completedCount} format={(v) => `${Math.round(v)}/${todos.length}`} style={styles.summaryValue} />} />
              <View style={styles.summaryDivider} />
              <OverviewItem label="待取快递" onPress={() => onOpenPackages?.()} styles={styles} value={<AnimatedNumber value={pendingPackages} format={(v) => `${Math.round(v)}`} style={styles.summaryValue} />} />
            </View>
            <Text style={styles.summaryLine} numberOfLines={1}>{nextThing ? `下一件事：${nextThing.timeLabel} ${nextThing.title}` : statusSummaryLine(pendingCount, pendingPackages, todayExpenseCents)}</Text>
          </HomeCard>
        );
      case "nextThing":
        if (!nextThing && !editMode) return null;
        return (
          <HomeCard key={id} testID="home-next-thing" {...common} collapsible={false} accentSurface title={<Text style={styles.widgetTitle}>下一件事</Text>}>
            {nextThing ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`下一件事：${nextThing.timeLabel} ${nextThing.title}`}
                onPress={() => onOpenPlan?.(nextThing.focus)}
                style={[styles.nextThing, nextThing.near ? styles.nextThingNear : null]}
                wrapperStyle={{ width: "100%" }}
              >
                <View style={styles.nextTime}>
                  <IconClock size={14} color={themeTokens.accent} />
                  <Text style={styles.nextTimeText}>{nextThing.timeLabel}</Text>
                </View>
                <Text style={styles.nextTitle} numberOfLines={1}>{nextThing.title}</Text>
                <View style={styles.nextArrow}>
                  <IconChevronRight size={18} color={themeTokens.textMuted} />
                </View>
              </PressableScale>
            ) : (
              <Text style={styles.notesPlaceholder}>今天没有待办、提醒或快递需要处理。</Text>
            )}
          </HomeCard>
        );
      case "quickAccounting":
        return (
          <HomeCard
            key={id}
            testID="home-quick-accounting-card"
            {...common}
            title={
              <View>
                <Text style={styles.widgetTitle}>快速记账</Text>
                <Text style={styles.notesPlaceholder}>不进入记账页，直接记录一笔</Text>
              </View>
            }
            headerRight={
              <View style={styles.quickAccountingAmount}>
                <Text style={styles.summaryLabel}>今日支出</Text>
                <AnimatedNumber value={todayExpenseCents} format={(v) => `¥${centsToMoney(v)}`} style={styles.quickAccountingValue} />
              </View>
            }
          >
            <PressableScale accessibilityRole="button" accessibilityLabel="快速记账：记一笔" onPress={() => onOpenQuickAccounting?.()} style={styles.quickAccountingButton} wrapperStyle={{ width: "100%" }} vibrate={12}>
              <Text style={styles.quickAccountingButtonText}>＋ 记一笔</Text>
            </PressableScale>
            <PressableScale accessibilityRole="button" accessibilityLabel="查看账单" onPress={() => onOpenFinance?.()} style={styles.financeLink} wrapperStyle={{ alignSelf: "flex-end" }}>
              <Text style={styles.widgetMoreText}>查看账单 →</Text>
            </PressableScale>
          </HomeCard>
        );
      case "todos":
        return (
          <HomeCard
            key={id}
            testID="home-todo-widget"
            {...common}
            title={
              <View style={styles.titleRow}>
                <Text style={styles.widgetTitle}>今日待办</Text>
                <TitleBadge>{`${completedCount}/${todos.length}`}</TitleBadge>
              </View>
            }
            headerRight={
              <PressableScale accessibilityRole="button" accessibilityLabel="查看全部每日待办" onPress={() => setViewState("todos")} style={styles.widgetMore} wrapperStyle={{ flexShrink: 0 }}>
                <Text style={styles.widgetMoreText}>全部 →</Text>
              </PressableScale>
            }
          >
            {todos.length === 0 ? (
              <EmptyState
                description="今天还没有安排，先加一件小事。"
                icon={<IconChecklist size={34} color={themeTokens.text} />}
                title="今天暂时没有安排"
                tokens={themeTokens}
                action={{ label: "＋ 添加待办", onPress: () => setViewState("todos") }}
              />
            ) : (
              <View style={styles.todoPreviewList}>
                {todoList.visibleItems.map((todo) => (
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
                <CollapsibleSectionFooter testID="home-todo-show-more" name="待办" expanded={todoList.expanded} hiddenCount={todoList.hiddenCount} onPress={todoList.toggle} tokens={themeTokens} visible={todoList.canExpand} />
              </View>
            )}
          </HomeCard>
        );
      case "notes":
        return (
          <HomeCard
            key={id}
            testID="home-notes-card"
            {...common}
            title={
              <View style={styles.titleRow}>
                <Text style={styles.widgetTitle}>备忘录</Text>
                {notes.length > 0 ? <TitleBadge>{`${notes.length} 条`}</TitleBadge> : null}
              </View>
            }
            headerRight={
              <PressableScale accessibilityRole="button" accessibilityLabel="查看全部备忘" onPress={() => setViewState("notes")} style={styles.widgetMore} wrapperStyle={{ flexShrink: 0 }}>
                <Text style={styles.widgetMoreText}>全部 →</Text>
              </PressableScale>
            }
          >
            <PressableScale testID="home-notes-quick-entry" accessibilityRole="button" accessibilityLabel="快速记一条备忘" onPress={() => setViewState("notes")} style={styles.notesQuickEntry} wrapperStyle={{ width: "100%" }}>
              <Text style={styles.notesPlaceholder}>闪过的念头、待买清单……</Text>
              <Text style={styles.quickLink}>＋ 快速记一条备忘</Text>
            </PressableScale>
          </HomeCard>
        );
      case "meal":
        return (
          <HomeCard
            key={id}
            testID="home-meal-card"
            {...common}
            title={
              <View style={styles.titleRow}>
                <Text style={styles.widgetTitle}>今天吃什么</Text>
                <TitleBadge>{`${MEAL_PRESET_COUNT} 候选`}</TitleBadge>
              </View>
            }
            headerRight={
              <PressableScale testID="meal-spinner-compact-entry" accessibilityRole="button" accessibilityLabel="打开今天吃什么转盘" onPress={() => setMealOpen((value) => !value)} style={styles.widgetMore} wrapperStyle={{ flexShrink: 0 }}>
                <Text style={styles.widgetMoreText}>{mealOpen ? "收起" : "去转盘 →"}</Text>
              </PressableScale>
            }
          >
            {mealOpen ? <MealSpinner /> : null}
          </HomeCard>
        );
      default:
        return null;
    }
  };

  const workingOrder = editMode
    ? [...order, ...HOME_CARDS.filter((card) => !order.includes(card.id)).map((card) => card.id)]
    : order;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()}</Text>
          <Text style={styles.date}>{formatToday()}</Text>
        </View>
        <View style={styles.headerRight}>
          {allTodosDone ? (
            <StatusSticker
              icon={<IconCheck size={16} color={themeTokens.accent} />}
              label="DONE"
              storageKey="home-done"
              sublabel="今日清空"
              tokens={themeTokens}
            />
          ) : null}
          {statusChip ? (
            <PressableScale
              testID="home-status-chip"
              accessibilityRole="button"
              accessibilityLabel={`今日状态：${statusChip.text}`}
              onPress={statusChip.onPress}
              style={styles.statusChip}
              wrapperStyle={styles.statusChipWrap}
            >
              {statusChip.icon === "check" ? <IconCheck size={13} color={themeTokens.accent} /> : <View style={[styles.statusDot, { backgroundColor: themeTokens.accent }]} />}
              <Text style={styles.statusChipText}>{statusChip.text}</Text>
            </PressableScale>
          ) : null}
          <PressableScale
            testID="home-edit-toggle"
            accessibilityRole="button"
            accessibilityLabel={editMode ? "完成编辑首页" : "编辑首页"}
            onPress={() => setEditMode((value) => !value)}
            style={styles.editButton}
            wrapperStyle={styles.editButtonWrap}
          >
            {editMode ? <IconCheck size={16} color={themeTokens.accent} /> : <IconMoreHorizontal size={18} color={themeTokens.textMuted} />}
          </PressableScale>
        </View>
      </View>

      {editMode ? (
        <View style={styles.editBanner}>
          <IconGripVertical size={14} color={themeTokens.textMuted} />
          <Text style={styles.editBannerText}>拖动排序、隐藏卡片；核心模块已锁定不可隐藏</Text>
        </View>
      ) : null}

      {workingOrder.map((id) => renderHomeCard(id, !order.includes(id)))}
    </ScrollView>
  );
}

function statusSummaryLine(pendingCount: number, pendingPackages: number, todayExpenseCents: number) {
  if (pendingCount > 0) return `今天还有 ${pendingCount} 项待办未完成。`;
  if (pendingPackages > 0) return `你还有 ${pendingPackages} 个快递等待领取。`;
  if (todayExpenseCents === 0) return "今天还没有新增待办、快递或支出记录。";
  return `今天已记录支出 ¥${centsToMoney(todayExpenseCents)}。`;
}

function TitleBadge({ children }: { children: ReactNode }) {
  return <Text style={titleBadgeStyle}>{children}</Text>;
}

const titleBadgeStyle: import("react-native").TextStyle = {
  color: "#4f9d39",
  fontSize: 12,
  fontWeight: "900",
  backgroundColor: "#e8f6ee",
  borderRadius: 999,
  paddingHorizontal: 8,
  paddingVertical: 2,
  overflow: "hidden"
};

function OverviewItem({ label, onPress, styles, value }: { label: string; onPress: () => void; styles: ReturnType<typeof createStyles>; value: ReactNode }) {
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
    financeLink: {
      alignSelf: "flex-end"
    },
    quickAccountingAmount: {
      alignItems: "flex-end",
      flexShrink: 0
    },
    quickAccountingButton: {
      alignItems: "center",
      backgroundColor: tokens.accent,
      borderRadius: 12,
      justifyContent: "center",
      minHeight: 42
    },
    quickAccountingButtonText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "900"
    },
    quickAccountingHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 12,
      justifyContent: "space-between"
    },
    quickAccountingValue: {
      color: tokens.text,
      fontSize: 15,
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
    },
    titleRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8
    },
    statusChip: {
      alignItems: "center",
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7
    },
    statusChipWrap: {
      flexShrink: 0
    },
    statusChipText: {
      color: tokens.text,
      fontSize: 13,
      fontWeight: "900"
    },
    statusDot: {
      borderRadius: 999,
      height: 7,
      width: 7
    },
    nextThing: {
      alignItems: "center",
      backgroundColor: "#eef7ee",
      borderRadius: 14,
      flexDirection: "row",
      gap: 12,
      minHeight: 64,
      paddingHorizontal: 14,
      paddingVertical: 10
    },
    nextThingNear: {
      backgroundColor: tokens.accentSoft
    },
    nextTime: {
      alignItems: "center",
      backgroundColor: "#ffffff",
      borderRadius: 10,
      flexDirection: "row",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 7
    },
    nextTimeText: {
      color: tokens.text,
      fontSize: 14,
      fontWeight: "900"
    },
    nextTitle: {
      color: tokens.text,
      flex: 1,
      fontSize: 15,
      fontWeight: "800",
      minWidth: 0
    },
    nextArrow: {
      flexShrink: 0
    },
    headerRight: {
      alignItems: "center",
      flexDirection: "row",
      flexShrink: 0,
      gap: 8
    },
    editButton: {
      alignItems: "center",
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      height: 34,
      justifyContent: "center",
      width: 34
    },
    editButtonWrap: {
      flexShrink: 0
    },
    editBanner: {
      alignItems: "center",
      backgroundColor: "#f6faf6",
      borderColor: tokens.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    editBannerText: {
      color: tokens.textMuted,
      flex: 1,
      fontSize: 12,
      fontWeight: "800"
    }
  });
}
