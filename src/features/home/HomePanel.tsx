import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { UiTokens } from "@/shared/ui/primitives";
import { hydrateNotesFromCloud, loadNotes, type NoteItem } from "@/features/home/notesStorage";
import { createTodoId, getDefaultTodoStorage, hydrateTodosFromCloud, loadLocalTodos, saveLocalTodos, type TodoTask, type TodoStorage } from "@/features/plan/todoStorage";
import type { NavItem } from "@/navigation/items";
import { MealSpinner } from "./MealSpinner";
import { NotesPanel } from "./NotesPanel";

const EXAM_WRONG_KEY = "fanfan-guanguan.exam.wrongQuestions.v1";
const MAX_HOME_NOTES = 3;

type HomePanelProps = {
  onNavigate?: (href: NavItem["href"]) => void;
  storage?: TodoStorage;
  themeTokens: UiTokens;
};

type ViewState = "home" | "notes";

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

export function HomePanel({ onNavigate, storage, themeTokens }: HomePanelProps) {
  const todoStorage = useMemo(() => storage ?? getDefaultTodoStorage(), [storage]);
  const [todos, setTodos] = useState<TodoTask[]>(() => loadLocalTodos(todoStorage));
  const [newTodo, setNewTodo] = useState("");
  const [viewState, setViewState] = useState<ViewState>("home");

  const styles = useMemo(() => createStyles(themeTokens), [themeTokens]);

  const persistTodos = (next: TodoTask[]) => {
    setTodos(next);
    saveLocalTodos(next, todoStorage);
  };

  const toggleTodo = (id: string) => {
    const next = todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    persistTodos(next);
  };

  const addTodo = () => {
    const title = newTodo.trim();
    if (!title) return;
    const task: TodoTask = {
      completed: false,
      createTime: new Date().toISOString(),
      deadline: null,
      id: createTodoId(),
      priority: "normal",
      title
    };
    persistTodos([task, ...todos]);
    setNewTodo("");
  };

  const displayedTodos = todos.slice(0, 4);
  const completedCount = todos.filter((t) => t.completed).length;
  const [notesCount, setNotesCount] = useState(() => loadNotes().length);

  useEffect(() => {
    let cancelled = false;
    hydrateTodosFromCloud(todoStorage)
      .then((next) => {
        if (!cancelled) {
          setTodos(next);
        }
      })
      .catch(() => {});
    hydrateNotesFromCloud()
      .then(() => {
        if (!cancelled) {
          setNotesCount(loadNotes().length);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [todoStorage]);
  const wrongCount = useMemo(() => {
    if (typeof window === "undefined") {
      return 0;
    }
    try {
      return (JSON.parse(window.localStorage.getItem(EXAM_WRONG_KEY) ?? "[]") as unknown[]).length;
    } catch {
      return 0;
    }
  }, []);
  const pendingCount = todos.length - completedCount;
  const summaryLine = useMemo(() => {
    if (todos.length === 0) return "今天还没有安排，给自己列三件小事吧。";
    if (completedCount === todos.length) return "今天的待办全部完成，生活掌控得不错！";
    if (completedCount === 0) return `还有 ${pendingCount} 件待办没动，先挑一件开始吧。`;
    return `已完成 ${completedCount} 件，还剩 ${pendingCount} 件，保持节奏。`;
  }, [completedCount, pendingCount, todos.length]);

  if (viewState === "notes") {
    return (
      <View style={styles.page}>
        <NotesPanel onClose={() => setViewState("home")} storage={undefined} themeTokens={themeTokens} />
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
        <View style={styles.progressBadge}>
          <Text>🪙</Text>
          <Text style={styles.progressText}>{completedCount}/{todos.length}</Text>
        </View>
      </View>

      <View style={styles.topWidgets}>
        <View style={[styles.widget, styles.widgetLeft]}>
          <View style={styles.widgetHeader}>
            <Text style={styles.widgetIcon}>📌</Text>
            <Text style={styles.widgetTitle} numberOfLines={1}>今日计划</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="查看全部待办" onPress={() => onNavigate?.("/plan")} style={styles.widgetMore}>
              <Text style={styles.widgetMoreText}>全部 →</Text>
            </Pressable>
          </View>

          <View style={styles.todoInputRow}>
            <TextInput
              onChangeText={setNewTodo}
              onSubmitEditing={addTodo}
              placeholder="添加待办..."
              style={styles.todoInput}
              value={newTodo}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="添加待办" onPress={addTodo} style={styles.todoAddButton}>
              <Text style={styles.todoAddText}>+</Text>
            </Pressable>
          </View>

          <View style={styles.todoList}>
            {displayedTodos.length === 0 ? (
              <Text style={styles.emptyHint}>还没有待办，添加一个吧</Text>
            ) : (
              displayedTodos.map((todo) => (
                <Pressable key={todo.id} accessibilityRole="button" accessibilityLabel={`切换待办状态：${todo.title}`} onPress={() => toggleTodo(todo.id)} style={styles.todoRow}>
                  <View style={[styles.todoCheck, todo.completed ? styles.todoCheckActive : null]}>
                    {todo.completed ? <Text style={styles.todoCheckMark}>✓</Text> : null}
                  </View>
                  <Text style={[styles.todoTitle, todo.completed ? styles.todoTitleDone : null]} numberOfLines={1}>{todo.title}</Text>
                </Pressable>
              ))
            )}
          </View>
        </View>

        <View style={[styles.widget, styles.widgetRight]}>
          <View style={styles.widgetHeader}>
            <Text style={styles.widgetIcon}>📝</Text>
            <Text style={styles.widgetTitle} numberOfLines={1}>备忘录</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="查看全部备忘" onPress={() => setViewState("notes")} style={styles.widgetMore}>
              <Text style={styles.widgetMoreText}>全部 →</Text>
            </Pressable>
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel="记一条备忘" onPress={() => setViewState("notes")} style={styles.notesCard}>
            {notesCount === 0 ? (
              <>
                <Text style={styles.notesPlaceholder}>闪过的念头、待买清单...</Text>
                <View style={styles.notesRecordButton}>
                  <Text style={styles.notesRecordText}>记一条</Text>
                </View>
              </>
            ) : (
              <View style={styles.notesList}>
                {loadNotes().slice(0, MAX_HOME_NOTES).map((note) => (
                  <View key={note.id} style={styles.noteRow}>
                    <View style={styles.noteDot} />
                    <Text style={styles.noteRowText} numberOfLines={1}>{note.title || note.content}</Text>
                  </View>
                ))}
                {notesCount > MAX_HOME_NOTES ? (
                  <Text style={styles.notesMore}>还有 {notesCount - MAX_HOME_NOTES} 条</Text>
                ) : null}
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Text style={styles.widgetIcon}>📊</Text>
          <Text style={styles.widgetTitle}>今日总结 · 生活控制中心</Text>
        </View>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{completedCount}/{todos.length}</Text>
            <Text style={styles.summaryLabel}>待办完成</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{notesCount}</Text>
            <Text style={styles.summaryLabel}>备忘录</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{wrongCount}</Text>
            <Text style={styles.summaryLabel}>错题本</Text>
          </View>
        </View>
        <Text style={styles.summaryLine}>{summaryLine}</Text>
      </View>

      <View style={styles.spinnerCard}>
        <MealSpinner />
      </View>
    </ScrollView>
  );
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    page: {
      gap: 16,
      paddingBottom: 40
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    greeting: {
      color: tokens.text,
      fontSize: 22,
      fontWeight: "900"
    },
    date: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 4
    },
    progressBadge: {
      alignItems: "center",
      backgroundColor: "#fff9e6",
      borderRadius: 999,
      flexDirection: "row",
      gap: 6,
      justifyContent: "center",
      minHeight: 38,
      paddingHorizontal: 14,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 1
    },
    progressText: {
      color: "#b08d2b",
      fontSize: 14,
      fontWeight: "900"
    },
    topWidgets: {
      flexDirection: "row",
      gap: 10
    },
    widget: {
      backgroundColor: "#ffffff",
      borderRadius: 18,
      flex: 1,
      gap: 8,
      minHeight: 138,
      padding: 12,
      shadowColor: "#7cb87c",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 2
    },
    widgetLeft: {
      flex: 1
    },
    widgetRight: {
      flex: 1
    },
    widgetHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 5,
      marginBottom: 2
    },
    widgetIcon: {
      fontSize: 15
    },
    widgetTitle: {
      color: tokens.text,
      flex: 1,
      flexShrink: 1,
      fontSize: 14,
      fontWeight: "900"
    },
    widgetMore: {
      alignSelf: "flex-start",
      flexShrink: 0
    },
    widgetMoreText: {
      color: tokens.textMuted,
      fontSize: 11,
      fontWeight: "800"
    },
    todoInputRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6
    },
    todoInput: {
      backgroundColor: "#f6faf6",
      borderRadius: 10,
      color: tokens.text,
      flex: 1,
      flexShrink: 1,
      fontSize: 13,
      minWidth: 0,
      paddingHorizontal: 10,
      paddingVertical: 7
    },
    todoAddButton: {
      alignItems: "center",
      backgroundColor: tokens.accent,
      borderRadius: 10,
      height: 32,
      justifyContent: "center",
      width: 32
    },
    todoAddText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "900"
    },
    todoList: {
      gap: 6
    },
    todoRow: {
      alignItems: "center",
      backgroundColor: "#f6faf6",
      borderRadius: 10,
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    todoCheck: {
      alignItems: "center",
      borderColor: tokens.border,
      borderRadius: 5,
      borderWidth: 1.5,
      height: 18,
      justifyContent: "center",
      width: 18
    },
    todoCheckActive: {
      backgroundColor: tokens.accent,
      borderColor: tokens.accent
    },
    todoCheckMark: {
      color: "#ffffff",
      fontSize: 11,
      fontWeight: "900"
    },
    todoTitle: {
      color: tokens.text,
      flex: 1,
      fontSize: 13,
      fontWeight: "700"
    },
    todoTitleDone: {
      color: tokens.textMuted,
      textDecorationLine: "line-through"
    },
    todoTag: {
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3
    },
    todoTagText: {
      color: tokens.accent,
      fontSize: 11,
      fontWeight: "900"
    },
    emptyHint: {
      color: tokens.textMuted,
      fontSize: 11,
      fontWeight: "700",
      textAlign: "center"
    },
    notesCard: {
      alignItems: "stretch",
      backgroundColor: "#f6faf6",
      borderRadius: 14,
      flex: 1,
      justifyContent: "center",
      padding: 10
    },
    notesPlaceholder: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "700"
    },
    notesRecordButton: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: tokens.accent,
      borderRadius: 10,
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 6
    },
    notesRecordText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "900"
    },
    notesHint: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "700"
    },
    notesList: {
      gap: 6
    },
    noteRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6
    },
    noteDot: {
      backgroundColor: tokens.accent,
      borderRadius: 999,
      height: 6,
      width: 6
    },
    noteRowText: {
      color: tokens.text,
      flex: 1,
      fontSize: 12,
      fontWeight: "700"
    },
    notesMore: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "800",
      marginLeft: 14
    },
    summaryCard: {
      backgroundColor: "#ffffff",
      borderRadius: 18,
      gap: 12,
      padding: 14,
      shadowColor: "#7cb87c",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 2
    },
    summaryHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8
    },
    summaryGrid: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-around"
    },
    summaryStat: {
      alignItems: "center",
      flex: 1,
      gap: 6
    },
    summaryValue: {
      color: tokens.accent,
      fontSize: 22,
      fontWeight: "900"
    },
    summaryLabel: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "800"
    },
    summaryDivider: {
      backgroundColor: tokens.border,
      height: 28,
      width: 1
    },
    summaryLine: {
      backgroundColor: tokens.accentSoft,
      borderRadius: 10,
      color: tokens.text,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 18,
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    dailyPickCard: {
      backgroundColor: "#ffffff",
      borderRadius: 22,
      gap: 14,
      padding: 18,
      shadowColor: "#7cb87c",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 2
    },
    dailyPickHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    dailyPickTitleRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8
    },
    dailyPickIcon: {
      fontSize: 18
    },
    dailyPickTitle: {
      color: tokens.text,
      fontSize: 18,
      fontWeight: "900"
    },
    refreshButton: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4
    },
    refreshText: {
      color: tokens.accent,
      fontSize: 14,
      fontWeight: "900"
    },
    dailyPickTabs: {
      flexDirection: "row",
      gap: 10
    },
    dailyPickTab: {
      alignItems: "center",
      backgroundColor: "#f6faf6",
      borderRadius: 14,
      flex: 1,
      paddingVertical: 12
    },
    dailyPickTabActive: {
      backgroundColor: tokens.accentSoft
    },
    dailyPickTabText: {
      color: tokens.textMuted,
      fontSize: 14,
      fontWeight: "900"
    },
    dailyPickTabTextActive: {
      color: tokens.accent
    },
    trendList: {
      gap: 12
    },
    trendRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10
    },
    trendRank: {
      color: tokens.textMuted,
      fontSize: 16,
      fontWeight: "900",
      width: 26
    },
    trendRankTop: {
      color: "#ef4444"
    },
    trendSourceBadge: {
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4
    },
    trendSourceText: {
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "900"
    },
    trendTitle: {
      color: tokens.text,
      flex: 1,
      fontSize: 15,
      fontWeight: "700"
    },
    fashionSection: {
      gap: 12
    },
    fashionFilters: {
      gap: 10
    },
    genderToggle: {
      alignSelf: "flex-start",
      flexDirection: "row",
      gap: 8
    },
    genderChip: {
      backgroundColor: "#f1f5f1",
      borderRadius: 999,
      paddingHorizontal: 18,
      paddingVertical: 8
    },
    genderChipActive: {
      backgroundColor: tokens.accent
    },
    genderChipText: {
      color: tokens.textMuted,
      fontSize: 14,
      fontWeight: "900"
    },
    genderChipTextActive: {
      color: "#ffffff"
    },
    fashionCategoryRow: {
      flexDirection: "row",
      gap: 8
    },
    fashionCategoryChip: {
      backgroundColor: "#f1f5f1",
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8
    },
    fashionCategoryChipActive: {
      backgroundColor: tokens.accentSoft
    },
    fashionCategoryText: {
      color: tokens.textMuted,
      fontSize: 14,
      fontWeight: "800"
    },
    fashionCategoryTextActive: {
      color: tokens.accent
    },
    fashionList: {
      gap: 10
    },
    fashionCard: {
      alignItems: "center",
      backgroundColor: "#f6faf6",
      borderRadius: 16,
      flexDirection: "row",
      gap: 14,
      padding: 12
    },
    fashionEmojiBox: {
      alignItems: "center",
      backgroundColor: "#ffffff",
      borderRadius: 14,
      height: 52,
      justifyContent: "center",
      width: 52
    },
    fashionEmoji: {
      fontSize: 26
    },
    fashionInfo: {
      flex: 1,
      gap: 4
    },
    fashionTitle: {
      color: tokens.text,
      fontSize: 16,
      fontWeight: "900"
    },
    fashionBrand: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "800"
    },
    spinnerCard: {
      backgroundColor: "#ffffff",
      borderRadius: 18,
      padding: 14,
      shadowColor: "#7cb87c",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 2
    }
  });
}
