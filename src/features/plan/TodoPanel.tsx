import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

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

type TodoPanelProps = {
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

export function TodoPanel({ storage, themeTokens }: TodoPanelProps) {
  const todoStorage = useMemo(() => storage ?? getDefaultTodoStorage(), [storage]);
  const [tasks, setTasks] = useState<TodoTask[]>(() => sortTodos(loadLocalTodos(todoStorage)));
  const [newTitle, setNewTitle] = useState("");
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
        deadline: todayIso(),
        id: createTodoId(),
        priority: "normal",
        title
      },
      ...tasks
    ]);
    setNewTitle("");
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

  const pendingTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.page}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>每日待办</Text>
        <Text style={styles.date}>{formatToday()}</Text>
      </View>

      <View style={styles.addCard}>
        <TextInput
          onChangeText={setNewTitle}
          onSubmitEditing={addTask}
          placeholder="添加今天要做的事"
          style={styles.input}
          value={newTitle}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="添加待办" onPress={addTask} style={styles.addButton}>
          <Text style={styles.addButtonText}>添加</Text>
        </Pressable>
      </View>

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
  title
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
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {tasks.length === 0 ? <Text style={styles.emptyText}>{emptyText}</Text> : null}
      {tasks.map((task) => (
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
    page: {
      gap: 16,
      paddingBottom: 40
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
