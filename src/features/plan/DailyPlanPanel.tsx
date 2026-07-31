import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { getSupabaseClient } from "@/auth/supabaseClient";
import { createTask, listAllActiveTasks, softDeleteTask, updateTask } from "@/features/plan/taskRepository";
import { createTodoId, getDefaultTodoStorage, loadLocalTodos, saveLocalTodos, sortTodos, type TodoStorage, type TodoTask } from "@/features/plan/todoStorage";

type DailyPlanPanelProps = {
  storage?: TodoStorage;
};

type TaskRow = {
  completed_at: string | null;
  created_at: string;
  due_at: string | null;
  id: string;
  remind_at: string | null;
  status: string;
  title: string;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export function DailyPlanPanel({ storage }: DailyPlanPanelProps) {
  const todoStorage = useMemo(() => storage ?? getDefaultTodoStorage(), [storage]);
  const [tasks, setTasks] = useState<TodoTask[]>(() => sortTodos(loadLocalTodos(todoStorage)));
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDeadline, setDraftDeadline] = useState("");
  const [draftReminder, setDraftReminder] = useState("");
  const [feedback, setFeedback] = useState("待办会自动保存，刷新网页后仍然保留。");
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);

  const pendingTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);
  const today = new Date().toLocaleDateString("zh-CN", {
    day: "2-digit",
    month: "2-digit",
    weekday: "long"
  });

  useEffect(() => {
    let cancelled = false;

    async function loadRemoteTasks() {
      const client = getSupabaseClient();
      if (!client) {
        return;
      }

      const { data: userData } = await client.auth.getUser();
      if (!userData.user || cancelled) {
        return;
      }

      setRemoteUserId(userData.user.id);
      const { data, error } = await listAllActiveTasks(client, userData.user.id);
      if (error || !data || cancelled) {
        return;
      }

      const remoteTasks = (data as TaskRow[]).map(mapRemoteTask);
      persistTasks(remoteTasks);
    }

    void loadRemoteTasks();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistTasks = (nextTasks: TodoTask[]) => {
    const sorted = sortTodos(nextTasks);
    setTasks(sorted);
    saveLocalTodos(sorted, todoStorage);
  };

  const resetComposer = () => {
    setDraftTitle("");
    setDraftDeadline("");
    setDraftReminder("");
    setComposerOpen(false);
  };

  const saveTask = async () => {
    const title = draftTitle.trim();
    if (!title) {
      setFeedback("请先输入任务名称。");
      return;
    }

    const now = new Date().toISOString();
    const deadline = buildDateTime(draftDeadline, draftReminder);
    const localTask: TodoTask = {
      completed: false,
      createTime: now,
      deadline,
      id: createTodoId(),
      remindAt: draftReminder ? buildDateTime(draftDeadline || todayIso(), draftReminder) : null,
      title
    };
    const nextTasks = [...tasks, localTask];
    persistTasks(nextTasks);
    resetComposer();
    setFeedback("新任务已保存。");

    const client = getSupabaseClient();
    if (!client || !remoteUserId) {
      return;
    }

    const { data, error } = await createTask(client, remoteUserId, {
      dueAt: localTask.deadline,
      remindAt: localTask.remindAt ?? null,
      taskDate: (localTask.deadline ?? now).slice(0, 10),
      title: localTask.title,
      visibility: "private"
    });

    if (error || !data) {
      setFeedback("任务已保存在本地，联网后可再次同步。");
      return;
    }

    persistTasks(nextTasks.map((task) => (task.id === localTask.id ? { ...task, remoteId: (data as TaskRow).id } : task)));
  };

  const toggleTask = async (taskId: string) => {
    const target = tasks.find((task) => task.id === taskId);
    if (!target) {
      return;
    }

    const completed = !target.completed;
    const completedAt = completed ? new Date().toISOString() : null;
    const nextTasks = tasks.map((task) => (task.id === taskId ? { ...task, completed } : task));
    persistTasks(nextTasks);
    setFeedback(completed ? "任务已完成。" : "任务已恢复到待办。");

    const client = getSupabaseClient();
    if (client && target.remoteId) {
      await updateTask(client, target.remoteId, {
        completedAt,
        status: completed ? "done" : "todo"
      });
    }
  };

  const deleteTask = async (taskId: string) => {
    const target = tasks.find((task) => task.id === taskId);
    persistTasks(tasks.filter((task) => task.id !== taskId));
    setFeedback("任务已删除。");

    const client = getSupabaseClient();
    if (client && target?.remoteId) {
      await softDeleteTask(client, target.remoteId);
    }
  };

  return (
    <View style={styles.stack}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>今日</Text>
        <Text style={styles.value}>{today}</Text>
        <Text style={styles.muted}>早上好，把事情一件件放稳就好。</Text>
      </View>

      <TaskSection emptyText="暂时没有待办，点右下角加号写下一件事。" onDelete={deleteTask} onToggle={toggleTask} tasks={pendingTasks} title="待办" />
      <TaskSection emptyText="完成的任务会移动到这里。" onDelete={deleteTask} onToggle={toggleTask} tasks={completedTasks} title={`已完成 ${completedTasks.length}`} />

      <View style={styles.infoGrid}>
        <View style={styles.infoCard}>
          <Text style={styles.title}>月历</Text>
          <Text style={styles.muted}>截止日期会进入任务卡片，后续可继续接入完整日历视图。</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.title}>天气</Text>
          <Text style={styles.muted}>天气服务保持占位抽象，不影响待办使用。</Text>
        </View>
      </View>

      <Text nativeID="plan-feedback" style={styles.feedback}>{feedback}</Text>

      {composerOpen ? (
        <View style={styles.modalLayer}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>添加任务</Text>
            <TextInput onChangeText={setDraftTitle} placeholder="任务名称" style={styles.input} value={draftTitle} />
            <TextInput onChangeText={setDraftDeadline} placeholder="截止日期" style={styles.input} value={draftDeadline} />
            <TextInput onChangeText={setDraftReminder} placeholder="提醒时间，可选" style={styles.input} value={draftReminder} />
            <View style={styles.row}>
              <Pressable accessibilityRole="button" accessibilityLabel="保存任务" onPress={saveTask} style={styles.primaryButton}>
                <Text style={styles.primaryText}>保存</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="取消添加任务" onPress={resetComposer} style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>取消</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      <Pressable accessibilityRole="button" accessibilityLabel="新增任务" nativeID="plan-add-button" onPress={() => setComposerOpen(true)} style={styles.fab}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

function TaskSection({
  emptyText,
  onDelete,
  onToggle,
  tasks,
  title
}: {
  emptyText: string;
  onDelete: (taskId: string) => void;
  onToggle: (taskId: string) => void;
  tasks: TodoTask[];
  title: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {tasks.length === 0 ? <Text style={styles.emptyText}>{emptyText}</Text> : null}
      {tasks.map((task) => (
        <TaskCard key={task.id} onDelete={onDelete} onToggle={onToggle} task={task} />
      ))}
    </View>
  );
}

function TaskCard({ onDelete, onToggle, task }: { onDelete: (taskId: string) => void; onToggle: (taskId: string) => void; task: TodoTask }) {
  const statusText = task.completed ? "已完成" : "待办";

  return (
    <Pressable onLongPress={() => onDelete(task.id)} style={styles.taskCard}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`${task.completed ? "恢复" : "完成"}任务：${task.title}`}
        accessibilityState={{ checked: task.completed }}
        onPress={() => onToggle(task.id)}
        style={[styles.checkbox, task.completed ? styles.checkboxChecked : null]}
      >
        <Text style={styles.checkboxText}>{task.completed ? "✓" : ""}</Text>
      </Pressable>
      <View style={styles.taskBody}>
        <Text style={[styles.taskTitle, task.completed ? styles.taskTitleDone : null]}>{task.title}</Text>
        <Text style={styles.taskMeta}>{formatMeta(task, statusText)}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`删除任务：${task.title}`} onPress={() => onDelete(task.id)} style={styles.moreButton}>
        <Text style={styles.moreText}>删除</Text>
      </Pressable>
    </Pressable>
  );
}

function mapRemoteTask(row: TaskRow): TodoTask {
  return {
    completed: row.status === "done" || Boolean(row.completed_at),
    createTime: row.created_at,
    deadline: row.due_at,
    id: row.id,
    remindAt: row.remind_at,
    remoteId: row.id,
    title: row.title
  };
}

function buildDateTime(dateText: string, timeText: string) {
  const date = dateText.trim();
  if (!date) {
    return null;
  }
  const time = timeText.trim() || "23:59";
  return `${date}T${time.length === 5 ? time : "23:59"}:00.000`;
}

function formatMeta(task: TodoTask, statusText: string) {
  const dateText = task.deadline ? task.deadline.slice(0, 10) : "无截止日期";
  const timeText = task.remindAt ? task.remindAt.slice(11, 16) : "无提醒";
  return `${dateText} ${timeText} · ${statusText}`;
}

const styles = StyleSheet.create({
  checkbox: {
    alignItems: "center",
    borderColor: "#cfc6d8",
    borderRadius: 8,
    borderWidth: 2,
    height: 26,
    justifyContent: "center",
    width: 26
  },
  checkboxChecked: {
    backgroundColor: "#34261d",
    borderColor: "#34261d"
  },
  checkboxText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900"
  },
  emptyText: {
    color: "#8b8192",
    fontSize: 14,
    lineHeight: 20
  },
  eyebrow: {
    color: "#6e647a",
    fontSize: 13,
    fontWeight: "800"
  },
  fab: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: "#34261d",
    borderRadius: 999,
    height: 54,
    justifyContent: "center",
    width: 54
  },
  fabText: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 34
  },
  feedback: {
    backgroundColor: "#ebe5ff",
    borderRadius: 12,
    color: "#272234",
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  heroCard: {
    backgroundColor: "#ffffff",
    borderColor: "#ded8ea",
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 18
  },
  infoCard: {
    backgroundColor: "#ffffff",
    borderColor: "#ded8ea",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minWidth: 220,
    padding: 16
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  input: {
    borderColor: "#ded8ea",
    borderRadius: 12,
    borderWidth: 1,
    color: "#272234",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderColor: "#ded8ea",
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  modalLayer: {
    backgroundColor: "rgba(39, 34, 52, 0.16)",
    borderRadius: 18,
    padding: 12
  },
  modalTitle: {
    color: "#272234",
    fontSize: 20,
    fontWeight: "900"
  },
  moreButton: {
    backgroundColor: "#f5f1f8",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  moreText: {
    color: "#6e647a",
    fontSize: 12,
    fontWeight: "800"
  },
  muted: {
    color: "#6e647a",
    fontSize: 14,
    lineHeight: 20
  },
  primaryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#34261d",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  primaryText: {
    color: "#ffffff",
    fontWeight: "900"
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  secondaryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderColor: "#ded8ea",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  secondaryText: {
    color: "#272234",
    fontWeight: "900"
  },
  section: {
    backgroundColor: "#ffffff",
    borderColor: "#ded8ea",
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 16
  },
  sectionTitle: {
    color: "#272234",
    fontSize: 20,
    fontWeight: "900"
  },
  stack: {
    gap: 14
  },
  taskBody: {
    flex: 1,
    gap: 4
  },
  taskCard: {
    alignItems: "center",
    backgroundColor: "#fbf9fd",
    borderColor: "#eee8f3",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12
  },
  taskMeta: {
    color: "#8b8192",
    fontSize: 12,
    fontWeight: "700"
  },
  taskTitle: {
    color: "#272234",
    fontSize: 16,
    fontWeight: "800"
  },
  taskTitleDone: {
    color: "#aaa3af",
    textDecorationLine: "line-through"
  },
  title: {
    color: "#272234",
    fontSize: 16,
    fontWeight: "800"
  },
  value: {
    color: "#272234",
    fontSize: 24,
    fontWeight: "900"
  }
});
