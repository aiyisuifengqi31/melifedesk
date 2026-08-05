import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { CollapsibleSectionFooter, sortByNewest, useCollapsibleList } from "@/shared/ui/CollapsibleList";
import type { UiTokens } from "@/shared/ui/primitives";
import {
  createTodoId,
  getDefaultTodoStorage,
  hydrateTodosFromCloud,
  loadLocalTodos,
  saveLocalTodos,
  sortTodos,
  type TodoStorage,
  type TodoTask
} from "@/features/plan/todoStorage";
import { QUICK_CAPTURE_DATA_EVENT } from "@/features/quick-capture/quickCapture";

type TodoPanelProps = {
  shortcutCreate?: boolean;
  onClose?: () => void;
  storage?: TodoStorage;
  themeTokens: UiTokens;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const priorityLabels: Record<TodoTask["priority"], string> = {
  high: "高",
  low: "低",
  normal: "普通",
  urgent: "紧急"
};

function formatToday(): string {
  const now = new Date();
  const weekDays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekDays[now.getDay()]}`;
}

export function TodoPanel({ onClose, shortcutCreate = false, storage, themeTokens }: TodoPanelProps) {
  const todoStorage = useMemo(() => storage ?? getDefaultTodoStorage(), [storage]);
  const newTitleInputRef = useRef<TextInput>(null);
  const [tasks, setTasks] = useState<TodoTask[]>(() => sortTodos(loadLocalTodos(todoStorage)));
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(todayIso());
  const [newTime, setNewTime] = useState("");
  const [newPriority, setNewPriority] = useState<TodoTask["priority"]>("normal");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const styles = useMemo(() => createStyles(themeTokens), [themeTokens]);

  useEffect(() => {
    let cancelled = false;
    hydrateTodosFromCloud(todoStorage)
      .then((next) => {
        if (!cancelled) {
          setTasks(sortTodos(next));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [todoStorage]);

  useEffect(() => {
    if (!shortcutCreate) return;
    const timer = setTimeout(() => newTitleInputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [shortcutCreate]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    const refresh = () => setTasks(sortTodos(loadLocalTodos(todoStorage)));
    window.addEventListener(QUICK_CAPTURE_DATA_EVENT, refresh);
    return () => window.removeEventListener(QUICK_CAPTURE_DATA_EVENT, refresh);
  }, [todoStorage]);

  const persistTasks = (nextTasks: TodoTask[]) => {
    const sorted = sortTodos(nextTasks);
    setTasks(sorted);
    saveLocalTodos(sorted, todoStorage);
  };

  const addTask = () => {
    const title = newTitle.trim();
    if (!title) return;
    persistTasks([
      {
        completed: false,
        createTime: new Date().toISOString(),
        deadline: newDate || todayIso(),
        id: createTodoId(),
        priority: newPriority,
        remindAt: newTime.trim() ? `${newDate || todayIso()}T${newTime.trim()}` : null,
        title
      },
      ...tasks
    ]);
    setNewTitle("");
    setNewTime("");
  };

  const toggleTask = (taskId: string) => {
    persistTasks(tasks.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task)));
  };

  const deleteTask = (taskId: string) => {
    persistTasks(tasks.filter((task) => task.id !== taskId));
  };

  const startEdit = (task: TodoTask) => {
    setEditingId(task.id);
    setEditingTitle(task.title);
  };

  const saveEdit = () => {
    const title = editingTitle.trim();
    if (!editingId || !title) return;
    persistTasks(tasks.map((task) => (task.id === editingId ? { ...task, title } : task)));
    setEditingId(null);
    setEditingTitle("");
  };

  // 未完成待办保留「截止时间升序」——最紧急的先做，比"最新在前"更实用。
  const pendingTasks = tasks.filter((task) => !task.completed);
  // 已完成待办是流水记录，按最新完成在前。
  const completedTasks = useMemo(
    () => sortByNewest(tasks.filter((task) => task.completed), (task) => task.createTime),
    [tasks]
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.page}>
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.headerText}>
            <Text style={styles.title}>每日待办</Text>
            <Text style={styles.date}>{formatToday()}</Text>
          </View>
          {onClose ? (
            <Pressable accessibilityRole="button" accessibilityLabel="返回首页" onPress={onClose} style={styles.backButton}>
              <Text style={styles.backText}>返回</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.addCard}>
        <TextInput
          autoFocus={shortcutCreate}
          onChangeText={setNewTitle}
          onSubmitEditing={addTask}
          placeholder="添加今天要做的事"
          ref={newTitleInputRef}
          style={styles.input}
          testID="todo-title-input"
          value={newTitle}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="添加待办" onPress={addTask} style={styles.addButton}>
          <Text style={styles.addButtonText}>添加</Text>
        </Pressable>
      </View>

      {shortcutCreate ? (
        <View style={styles.quickMetaCard}>
          <TextInput onChangeText={setNewDate} placeholder="日期，默认今天" style={styles.metaInput} value={newDate} />
          <TextInput onChangeText={setNewTime} placeholder="时间（可选）" style={styles.metaInput} value={newTime} />
          <View style={styles.priorityRow}>
            {(["normal", "high", "urgent", "low"] as TodoTask["priority"][]).map((priority) => (
              <Pressable key={priority} accessibilityRole="button" accessibilityLabel={`待办优先级${priorityLabels[priority]}`} onPress={() => setNewPriority(priority)} style={[styles.priorityChip, newPriority === priority ? styles.priorityChipActive : null]}>
                <Text style={[styles.priorityChipText, newPriority === priority ? styles.priorityChipTextActive : null]}>{priorityLabels[priority]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <TaskSection
        emptyText="今天还没有未完成待办。"
        editingId={editingId}
        editingTitle={editingTitle}
        onDelete={deleteTask}
        onEditTitleChange={setEditingTitle}
        onSaveEdit={saveEdit}
        onStartEdit={startEdit}
        onToggle={toggleTask}
        styles={styles}
        tasks={pendingTasks}
        title="未完成待办"
        tokens={themeTokens}
      />

      <TaskSection
        emptyText="完成的待办会出现在这里。"
        editingId={editingId}
        editingTitle={editingTitle}
        onDelete={deleteTask}
        onEditTitleChange={setEditingTitle}
        onSaveEdit={saveEdit}
        onStartEdit={startEdit}
        onToggle={toggleTask}
        styles={styles}
        tasks={completedTasks}
        title={`已完成待办 ${completedTasks.length}`}
        tokens={themeTokens}
      />
    </ScrollView>
  );
}

function TaskSection({
  editingId,
  editingTitle,
  emptyText,
  onDelete,
  onEditTitleChange,
  onSaveEdit,
  onStartEdit,
  onToggle,
  styles,
  tasks,
  title,
  tokens
}: {
  editingId: string | null;
  editingTitle: string;
  emptyText: string;
  onDelete: (taskId: string) => void;
  onEditTitleChange: (title: string) => void;
  onSaveEdit: () => void;
  onStartEdit: (task: TodoTask) => void;
  onToggle: (taskId: string) => void;
  styles: ReturnType<typeof createStyles>;
  tasks: TodoTask[];
  title: string;
  tokens: UiTokens;
}) {
  const taskList = useCollapsibleList(tasks);
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {tasks.length === 0 ? <Text style={styles.emptyText}>{emptyText}</Text> : null}
      {taskList.visibleItems.map((task) => (
        <TaskRow
          editing={editingId === task.id}
          editingTitle={editingTitle}
          key={task.id}
          onDelete={onDelete}
          onEditTitleChange={onEditTitleChange}
          onSaveEdit={onSaveEdit}
          onStartEdit={onStartEdit}
          onToggle={onToggle}
          styles={styles}
          task={task}
        />
      ))}
      <CollapsibleSectionFooter
        expanded={taskList.expanded}
        hiddenCount={taskList.hiddenCount}
        name={title}
        onPress={taskList.toggle}
        testID="todo-show-more"
        tokens={tokens}
        visible={taskList.canExpand}
      />
    </View>
  );
}

function TaskRow({
  editing,
  editingTitle,
  onDelete,
  onEditTitleChange,
  onSaveEdit,
  onStartEdit,
  onToggle,
  styles,
  task
}: {
  editing: boolean;
  editingTitle: string;
  onDelete: (taskId: string) => void;
  onEditTitleChange: (title: string) => void;
  onSaveEdit: () => void;
  onStartEdit: (task: TodoTask) => void;
  onToggle: (taskId: string) => void;
  styles: ReturnType<typeof createStyles>;
  task: TodoTask;
}) {
  return (
    <View style={[styles.taskRow, task.completed ? styles.taskRowDone : null]}>
      <Pressable
        accessibilityLabel={`${task.completed ? "恢复" : "完成"}任务：${task.title}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed }}
        onPress={() => onToggle(task.id)}
        style={[styles.checkbox, task.completed ? styles.checkboxChecked : null]}
      >
        {task.completed ? <Text style={styles.checkboxText}>✓</Text> : null}
      </Pressable>

      <View style={styles.taskBody}>
        {editing ? (
          <View style={styles.editRow}>
            <TextInput autoFocus onChangeText={onEditTitleChange} style={[styles.input, styles.editInput]} value={editingTitle} />
            <Pressable accessibilityRole="button" accessibilityLabel="保存编辑" onPress={onSaveEdit} style={styles.saveEditButton}>
              <Text style={styles.saveEditText}>保存</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={[styles.taskTitle, task.completed ? styles.taskTitleDone : null]}>{task.title}</Text>
            <Text style={styles.taskMeta}>{task.deadline?.slice(0, 10) ?? task.createTime.slice(0, 10)} · {priorityLabels[task.priority]}</Text>
          </>
        )}
      </View>

      {!editing ? (
        <View style={styles.actionRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={`编辑任务：${task.title}`} onPress={() => onStartEdit(task)} style={styles.actionButton}>
            <Text style={styles.actionText}>编辑</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`删除任务：${task.title}`} onPress={() => onDelete(task.id)} style={styles.deleteButton}>
            <Text style={styles.deleteText}>删除</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    actionButton: {
      backgroundColor: "#f1f5f9",
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8
    },
    actionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      justifyContent: "flex-end"
    },
    actionText: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "900"
    },
    addButton: {
      alignItems: "center",
      backgroundColor: tokens.accent,
      borderRadius: 12,
      justifyContent: "center",
      minHeight: 42,
      paddingHorizontal: 16
    },
    addButtonText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "900"
    },
    addCard: {
      alignItems: "center",
      backgroundColor: "#ffffff",
      borderColor: tokens.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      padding: 12
    },
    backButton: {
      alignItems: "center",
      backgroundColor: tokens.accentSoft,
      borderRadius: 12,
      justifyContent: "center",
      minHeight: 38,
      paddingHorizontal: 14
    },
    backText: {
      color: tokens.accent,
      fontSize: 13,
      fontWeight: "900"
    },
    checkbox: {
      alignItems: "center",
      borderColor: tokens.border,
      borderRadius: 6,
      borderWidth: 2,
      height: 26,
      justifyContent: "center",
      width: 26
    },
    checkboxChecked: {
      backgroundColor: tokens.accent,
      borderColor: tokens.accent
    },
    checkboxText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "900"
    },
    date: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "800"
    },
    deleteButton: {
      backgroundColor: "#fee2e2",
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8
    },
    deleteText: {
      color: "#dc2626",
      fontSize: 12,
      fontWeight: "900"
    },
    editInput: {
      minHeight: 38,
      paddingVertical: 8
    },
    editRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    emptyText: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "700"
    },
    headerCard: {
      backgroundColor: "#ffffff",
      borderColor: tokens.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: 6,
      padding: 16
    },
    headerText: {
      flex: 1,
      gap: 6,
      minWidth: 0
    },
    headerTop: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      justifyContent: "space-between"
    },
    input: {
      backgroundColor: "#f6faf6",
      borderColor: tokens.border,
      borderRadius: 12,
      borderWidth: 1,
      color: tokens.text,
      flex: 1,
      fontSize: 14,
      minWidth: 0,
      paddingHorizontal: 12,
      paddingVertical: 10
    },
    metaInput: {
      backgroundColor: "#f6faf6",
      borderColor: tokens.border,
      borderRadius: 12,
      borderWidth: 1,
      color: tokens.text,
      flex: 1,
      fontSize: 13,
      minWidth: 120,
      paddingHorizontal: 12,
      paddingVertical: 9
    },
    page: {
      gap: 16,
      paddingBottom: 40
    },
    priorityChip: {
      backgroundColor: "#f6faf6",
      borderColor: tokens.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 7
    },
    priorityChipActive: {
      backgroundColor: tokens.accent,
      borderColor: tokens.accent
    },
    priorityChipText: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "900"
    },
    priorityChipTextActive: {
      color: "#ffffff"
    },
    priorityRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    quickMetaCard: {
      backgroundColor: "#ffffff",
      borderColor: tokens.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      padding: 12
    },
    saveEditButton: {
      alignItems: "center",
      backgroundColor: tokens.accent,
      borderRadius: 10,
      justifyContent: "center",
      minHeight: 38,
      paddingHorizontal: 12
    },
    saveEditText: {
      color: "#ffffff",
      fontSize: 13,
      fontWeight: "900"
    },
    sectionCard: {
      backgroundColor: "#ffffff",
      borderColor: tokens.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: 10,
      padding: 14
    },
    sectionTitle: {
      color: tokens.text,
      fontSize: 16,
      fontWeight: "900"
    },
    taskBody: {
      flex: 1,
      gap: 4,
      minWidth: 0
    },
    taskMeta: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "800"
    },
    taskRow: {
      alignItems: "center",
      backgroundColor: "#f8fafc",
      borderColor: "#edf1f5",
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      padding: 12
    },
    taskRowDone: {
      backgroundColor: "#f6faf6"
    },
    taskTitle: {
      color: tokens.text,
      flexShrink: 1,
      fontSize: 15,
      fontWeight: "900",
      lineHeight: 20
    },
    taskTitleDone: {
      color: tokens.textMuted,
      textDecorationLine: "line-through"
    },
    title: {
      color: tokens.text,
      fontSize: 22,
      fontWeight: "900"
    }
  });
}
