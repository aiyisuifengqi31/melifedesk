import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { hydrateFinanceTransactionsFromCloud, loadFinanceTransactions, type FinanceTransaction } from "@/features/finance/financeStorage";
import { hydrateNotesFromCloud, loadNotes } from "@/features/home/notesStorage";
import { hydratePackagesFromCloud, loadPackages, type PackageItem } from "@/features/plan/packageStorage";
import { hydrateRemindersFromCloud, loadReminders, type ReminderItem } from "@/features/plan/reminderStorage";
import { type PlanFocus } from "@/features/plan/planFocus";
import { getDefaultTodoStorage, hydrateTodosFromCloud, loadLocalTodos, saveLocalTodos, sortTodos, type TodoStorage, type TodoTask } from "@/features/plan/todoStorage";
import { QUICK_CAPTURE_DATA_EVENT } from "@/features/quick-capture/quickCapture";
import { HOME_CARDS, loadHomeCollapsed, loadHomeOrder, moveCardDown, moveCardUp, saveHomeCollapsed, saveHomeOrder, toggleCardHidden, type HomeCardId } from "@/features/home/homeLayout";
import { CollapsibleSectionFooter, useCollapsibleList } from "@/shared/ui/CollapsibleList";
import { AnimatedNumber } from "@/shared/ui/AnimatedNumber";
import { IconCheck, IconGripVertical, IconMoreHorizontal } from "@/shared/ui/lineIcons";
import { PressableScale } from "@/shared/ui/PressableScale";
import type { UiTokens } from "@/shared/ui/primitives";
import { HomeCard } from "@/shared/ui/HomeCard";
import { showUndoToast } from "@/shared/ui/UndoToast";
import { NotesPanel } from "./NotesPanel";
import { TodoPanel } from "@/features/plan/TodoPanel";
import { ExpiryHomeCard } from "@/features/expiry/ExpiryHomeCard";
import { ExpiryAddModal } from "@/features/expiry/ExpiryAddModal";
import { hydrateExpiryFromCloud, loadExpiryItems, saveExpiryItems } from "@/features/expiry/expiryStorage";
import { daysUntil, sortExpiryByUrgency, type ExpiryItem } from "@/features/expiry/expiryUtils";

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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dayIsoFromNow(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const PRIORITY_ORDER: Record<TodoTask["priority"], number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3
};

/** 首页待办排序：逾期 → 今天 → 未来 → 无日期；同类内按优先级，最后按创建时间。 */
function sortHomeTodos(todos: TodoTask[], today: string): TodoTask[] {
  const bucketOf = (todo: TodoTask) => {
    const dateIso = todoDateIso(todo);
    if (!dateIso) return 3;
    if (dateIso < today) return 0;
    if (dateIso === today) return 1;
    return 2;
  };
  return [...todos].sort((a, b) => {
    const ba = bucketOf(a);
    const bb = bucketOf(b);
    if (ba !== bb) return ba - bb;
    const pa = PRIORITY_ORDER[a.priority];
    const pb = PRIORITY_ORDER[b.priority];
    if (pa !== pb) return pa - pb;
    return (a.createTime ?? "").localeCompare(b.createTime ?? "");
  });
}

/** 待办的小标签：逾期 / 今天 / 明天 / 常规（无日期）；更远未来不显示标签以免喧宾夺主。 */
function todoDateTag(todo: TodoTask, today: string): string | null {
  const dateIso = todoDateIso(todo);
  if (!dateIso) return "常规";
  if (dateIso < today) return "逾期";
  if (dateIso === today) return "今天";
  if (dateIso === dayIsoFromNow(1)) return "明天";
  return null;
}

function todoDateIso(todo: TodoTask): string | null {
  const value = todo.remindAt || todo.deadline || todo.createTime;
  if (!value) return null;
  return value.slice(0, 10);
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

export function HomePanel({ onOpenFinance, onOpenPackages, onOpenQuickAccounting, shortcutNonce, shortcutView, storage, themeTokens }: HomePanelProps) {
  const todoStorage = useMemo(() => storage ?? getDefaultTodoStorage(), [storage]);
  const [todos, setTodos] = useState<TodoTask[]>(() => loadLocalTodos(todoStorage));
  const [notes, setNotes] = useState(() => loadNotes());
  const [packages, setPackages] = useState<PackageItem[]>(() => loadPackages());
  const [reminders, setReminders] = useState<ReminderItem[]>(() => loadReminders());
  const [expiryItems, setExpiryItems] = useState<ExpiryItem[]>(() => loadExpiryItems());
  const [expiryModalOpen, setExpiryModalOpen] = useState(false);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>(() => loadFinanceTransactions());
  const [viewState, setViewState] = useState<ViewState>("home");
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
    hydrateExpiryFromCloud().then((next) => !cancelled && setExpiryItems(next)).catch(() => {});
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
      setExpiryItems(loadExpiryItems());
      setTransactions(loadFinanceTransactions());
    };
    window.addEventListener(QUICK_CAPTURE_DATA_EVENT, refresh);
    return () => window.removeEventListener(QUICK_CAPTURE_DATA_EVENT, refresh);
  }, [todoStorage]);

  const today = todayIso();
  const homeTodos = useMemo(() => todos.filter((todo) => !todo.completed), [todos]);
  const pendingCount = homeTodos.length;
  const pendingPackages = packages.filter((item) => !item.pickedUp).length;
  const sortedHomeTodos = useMemo(() => sortHomeTodos(homeTodos, today), [homeTodos, today]);
  const todoList = useCollapsibleList(sortedHomeTodos);
  const sortedExpiry = useMemo(() => sortExpiryByUrgency(expiryItems, today), [expiryItems, today]);
  const expiringSoonCount = useMemo(
    () => expiryItems.filter((item) => {
      const remaining = daysUntil(item.expiryDate, today);
      return remaining < 0 || remaining <= 7;
    }).length,
    [expiryItems, today]
  );
  const todayExpenseCents = useMemo(() => {
    return transactions
      .filter((transaction) => transaction.transactionType === "expense" && transaction.localDate === today)
      .reduce((sum, transaction) => sum + moneyToCents(transaction.amount), 0);
  }, [transactions]);
  const statusChip = useMemo<{ text: string; icon: "check" | "dot"; onPress?: () => void } | null>(() => {
    if (pendingCount > 0) return { text: `还有 ${pendingCount} 项`, icon: "dot", onPress: () => setViewState("todos") };
    if (pendingPackages > 0) return { text: `${pendingPackages} 个待取快递`, icon: "dot", onPress: () => onOpenPackages?.() };
    if (homeTodos.length > 0) return { text: "今天已清空", icon: "check", onPress: () => setViewState("todos") };
    return { text: "今天很轻松", icon: "dot" };
  }, [pendingCount, pendingPackages, homeTodos.length, onOpenPackages]);
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

  const renderHomeCard = (id: HomeCardId, hidden: boolean, cardStyle?: import("react-native").StyleProp<import("react-native").ViewStyle>) => {
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
      tokens: themeTokens,
      style: cardStyle
    };

    switch (id) {
      case "summary":
        return (
          <HomeCard key={id} testID="home-summary-card" {...common} title={<Text style={styles.widgetTitle}>今日概览</Text>}>
            <View style={styles.summaryGrid}>
              <OverviewItem label="今日待办" onPress={() => setViewState("todos")} styles={styles} value={<AnimatedNumber value={pendingCount} format={(v) => `${Math.round(v)}`} style={styles.summaryValue} />} />
              <View style={styles.summaryDivider} />
              <OverviewItem label="待取快递" onPress={() => onOpenPackages?.()} styles={styles} value={<AnimatedNumber value={pendingPackages} format={(v) => `${Math.round(v)}`} style={styles.summaryValue} />} />
            </View>
            <Text style={styles.summaryLine} numberOfLines={1}>{statusSummaryLine(pendingCount, pendingPackages, todayExpenseCents)}</Text>
          </HomeCard>
        );
      case "quickAccounting":
        return (
          <HomeCard
            key={id}
            testID="home-quick-accounting-card"
            {...common}
            title={<Text style={styles.widgetTitle}>快速记账</Text>}
          >
            <View style={styles.qaHero}>
              <AnimatedNumber value={todayExpenseCents} format={(v) => `¥${centsToMoney(v)}`} style={styles.qaAmountHero} />
              <Text style={styles.qaHeroLabel}>今日支出</Text>
            </View>
            <View style={styles.qaActions}>
              <PressableScale
                accessibilityLabel="快速记账：记一笔"
                accessibilityRole="button"
                onPress={() => onOpenQuickAccounting?.()}
                style={styles.qaPrimaryButton}
                wrapperStyle={styles.qaButtonWrap}
                vibrate={12}
              >
                <Text style={styles.qaPrimaryText}>＋ 记一笔</Text>
              </PressableScale>
              <PressableScale
                accessibilityLabel="账单"
                accessibilityRole="button"
                onPress={() => onOpenFinance?.()}
                style={styles.qaSecondaryButton}
                wrapperStyle={styles.qaButtonWrap}
              >
                <Text style={styles.qaSecondaryText}>账单</Text>
              </PressableScale>
            </View>
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
                <TitleBadge>{`${pendingCount}`}</TitleBadge>
              </View>
            }
            headerRight={
              <PressableScale accessibilityRole="button" accessibilityLabel="查看全部每日待办" onPress={() => setViewState("todos")} style={styles.widgetMore} wrapperStyle={{ flexShrink: 0 }}>
                <Text style={styles.widgetMoreText}>全部 →</Text>
              </PressableScale>
            }
          >
            {sortedHomeTodos.length === 0 ? (
              <View style={styles.compactEmpty}>
                <Text style={styles.emptyHint}>暂无待办</Text>
                <PressableScale accessibilityRole="button" accessibilityLabel="添加待办" onPress={() => setViewState("todos")} style={styles.compactEmptyAction} wrapperStyle={{ width: "100%" }}>
                  <Text style={styles.quickLink}>＋ 添加待办</Text>
                </PressableScale>
              </View>
            ) : (
              <View style={styles.todoPreviewList}>
                {todoList.visibleItems.map((todo) => {
                  const tag = todoDateTag(todo, today);
                  const tagTone = tag === "逾期" ? "#e0533d" : tag === "今天" ? themeTokens.accent : tag === "明天" ? "#3d7be0" : themeTokens.textMuted;
                  return (
                    <View key={todo.id} style={styles.todoRow}>
                      <Pressable accessibilityRole="checkbox" accessibilityLabel={`${todo.completed ? "恢复" : "完成"}首页待办：${todo.title}`} accessibilityState={{ checked: todo.completed }} onPress={() => toggleHomeTodo(todo.id)} style={styles.todoCheckWrap}>
                        <View style={[styles.todoCheck, todo.completed ? styles.todoCheckActive : null]}>{todo.completed ? <Text style={styles.todoCheckMark}>✓</Text> : null}</View>
                      </Pressable>
                      <View style={styles.todoTextButton}>
                        <Text style={[styles.todoTitle, todo.completed ? styles.todoTitleDone : null]} numberOfLines={1}>{todo.title}</Text>
                      </View>
                      {tag ? <Text style={[styles.todoDateTag, { color: tagTone }]}>{tag}</Text> : null}
                    </View>
                  );
                })}
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
              <Pressable
                accessibilityLabel="打开今天吃什么转盘"
                accessibilityRole="button"
                onPress={() => router.push("/meal")}
              >
                <Text style={styles.widgetTitle}>今天吃什么</Text>
              </Pressable>
            }
          >
            <Pressable
              accessibilityLabel="打开今天吃什么转盘"
              accessibilityRole="button"
              onPress={() => router.push("/meal")}
              style={styles.mealCardBody}
              testID="meal-spinner-compact-entry"
            >
              <Text style={styles.mealCount}>{`${MEAL_PRESET_COUNT} 个候选`}</Text>
              <Text style={styles.mealCta}>去转盘 →</Text>
            </Pressable>
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
          {expiringSoonCount > 0 ? (
            <PressableScale
              testID="home-expiry-badge"
              accessibilityRole="button"
              accessibilityLabel={`${expiringSoonCount} 项即将到期`}
              onPress={() => router.push("/expiry")}
              style={styles.expiryBadge}
              wrapperStyle={styles.expiryBadgeWrap}
            >
              <View style={[styles.statusDot, { backgroundColor: themeTokens.danger ?? "#e57373" }]} />
              <Text style={styles.expiryBadgeText}>{expiringSoonCount} 项即将到期</Text>
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

      {workingOrder.map((id) => {
        if (id === "quickAccounting" && workingOrder.includes("meal")) {
          const qaHidden = !order.includes("quickAccounting");
          const mealHidden = !order.includes("meal");
          return (
            <View key="quick-accounting-meal-row" style={styles.dualRow}>
              <View style={styles.dualCell}>{renderHomeCard("quickAccounting", qaHidden, styles.dualCard)}</View>
              <View style={styles.dualCell}>{renderHomeCard("meal", mealHidden, styles.dualCard)}</View>
            </View>
          );
        }
        if (id === "meal" && workingOrder.includes("quickAccounting")) return null;
        return renderHomeCard(id, !order.includes(id));
      })}

      <ExpiryHomeCard items={sortedExpiry} onAdd={() => setExpiryModalOpen(true)} tokens={themeTokens} testID="home-expiry-card" />

      <ExpiryAddModal
        visible={expiryModalOpen}
        onCancel={() => setExpiryModalOpen(false)}
        onSave={(item) => {
          setExpiryItems((previous) => {
            const exists = previous.some((entry) => entry.id === item.id);
            const next = exists ? previous.map((entry) => (entry.id === item.id ? item : entry)) : [...previous, item];
            saveExpiryItems(next);
            return next;
          });
          setExpiryModalOpen(false);
        }}
        tokens={themeTokens}
      />
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
    /* ── 快速记账（紧凑两卡版）── */
    qaHero: {
      gap: 2
    },
    qaAmountHero: {
      color: tokens.text,
      fontSize: 24,
      fontWeight: "900"
    },
    qaHeroLabel: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "800"
    },
    qaActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10
    },
    qaButtonWrap: {
      flex: 1
    },
    qaPrimaryButton: {
      alignItems: "center",
      backgroundColor: tokens.accent,
      borderRadius: 12,
      justifyContent: "center",
      minHeight: 40,
      paddingVertical: 10
    },
    qaPrimaryText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "900"
    },
    qaSecondaryButton: {
      alignItems: "center",
      backgroundColor: tokens.accentSoft,
      borderRadius: 12,
      justifyContent: "center",
      minHeight: 40,
      paddingVertical: 10
    },
    qaSecondaryText: {
      color: tokens.accent,
      fontSize: 14,
      fontWeight: "900"
    },
    /* ── 今天吃什么（紧凑两卡版）── */
    mealCardBody: {
      alignItems: "flex-start",
      flex: 1,
      gap: 8,
      justifyContent: "center"
    },
    mealCount: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "800"
    },
    mealCta: {
      color: tokens.accent,
      fontSize: 16,
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
    todoDateTag: {
      backgroundColor: "#eef2ee",
      borderRadius: 6,
      fontSize: 10,
      fontWeight: "900",
      paddingHorizontal: 6,
      paddingVertical: 2
    },
    compactEmptyAction: {
      alignItems: "center",
      backgroundColor: tokens.accentSoft,
      borderRadius: 10,
      justifyContent: "center",
      minHeight: 34,
      paddingHorizontal: 12
    },
    dualRow: {
      flexDirection: "row",
      gap: 12,
      alignItems: "stretch"
    },
    dualCell: {
      flex: 1,
      minWidth: 0
    },
    dualCard: {
      flex: 1,
      minHeight: 168
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
      flexShrink: 0,
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
    expiryBadge: {
      alignItems: "center",
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7
    },
    expiryBadgeWrap: {
      flexShrink: 0
    },
    expiryBadgeText: {
      color: tokens.text,
      fontSize: 13,
      fontWeight: "900"
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
