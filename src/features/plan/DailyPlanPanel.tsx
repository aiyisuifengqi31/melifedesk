import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { UiTokens } from "@/shared/ui/primitives";
import { hydrateTodosFromCloud, loadLocalTodos, saveLocalTodos, type TodoStorage, type TodoTask } from "@/features/plan/todoStorage";
import { getHolidayLabel, isWeekend } from "@/features/plan/holidays";
import { resolveCurrentCityWeather, weatherEmoji, type WeatherState } from "@/features/plan/weatherProvider";
import { PackagePanel } from "./PackagePanel";

type DailyPlanPanelProps = {
  storage?: TodoStorage;
  themeTokens: UiTokens;
};

type MonthDay = {
  date: string;
  day: number;
  inMonth: boolean;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const priorityOptions: Array<{ color: string; label: string; value: string }> = [
  { color: "#8fb3c9", label: "低", value: "low" },
  { color: "#63a7f8", label: "普通", value: "normal" },
  { color: "#ffb020", label: "高", value: "high" },
  { color: "#ef4444", label: "紧急", value: "urgent" }
];

export function DailyPlanPanel({ storage, themeTokens }: DailyPlanPanelProps) {
  const todoStorage = useMemo(() => storage ?? getDefaultTodoStorage(), [storage]);
  const [tasks, setTasks] = useState<TodoTask[]>(() => loadLocalTodos(todoStorage));
  const [weather, setWeather] = useState<WeatherState>({ message: "点击后获取当前城市实时天气。", status: "idle" });

  useEffect(() => {
    let cancelled = false;
    hydrateTodosFromCloud(todoStorage)
      .then((next) => {
        if (!cancelled) {
          setTasks(next);
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

  const toggleTask = (taskId: string) => {
    const nextTasks = tasks.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task));
    persistTasks(nextTasks);
  };

  const deleteTask = (taskId: string) => {
    persistTasks(tasks.filter((task) => task.id !== taskId));
  };

  const loadWeather = async () => {
    setWeather({ message: "正在读取当前城市天气...", status: "loading" });
    setWeather(await resolveCurrentCityWeather());
  };

  const pendingTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);
  const today = todayIso();

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stack}>
      <WeatherCard onRefresh={loadWeather} weather={weather} />

      <MonthCalendar onSelectDate={(date) => { /* 选中日期，未来可联动筛选当日待办 */ }} selectedDate={today} />

      <PackagePanel themeTokens={themeTokens} />

      <View style={styles.todoCard}>
        <View style={styles.todoHeader}>
          <Text style={styles.todoIcon}>☑</Text>
          <Text style={styles.todoTitle}>今日待办</Text>
        </View>
        <TaskSection emptyText="暂时没有待办，去首页添加一个吧。" onDelete={deleteTask} onToggle={toggleTask} tasks={pendingTasks} title="待办" />
        <TaskSection emptyText="完成的任务会移动到这里。" onDelete={deleteTask} onToggle={toggleTask} tasks={completedTasks} title={`已完成 ${completedTasks.length}`} />
      </View>
    </ScrollView>
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
  const priority = getPriorityMeta(task.priority);

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
        <View style={styles.taskMetaRow}>
          <View style={styles.taskPriority}>
            <Text style={[styles.priorityDotSmall, { color: priority.color }]}>●</Text>
            <Text style={styles.taskPriorityText}>{priority.label}</Text>
          </View>
          <Text style={styles.taskMeta}>{formatMeta(task, statusText)}</Text>
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`删除任务：${task.title}`} onPress={() => onDelete(task.id)} style={styles.moreButton}>
        <Text style={styles.moreText}>删除</Text>
      </Pressable>
    </Pressable>
  );
}

function WeatherCard({ onRefresh, weather }: { onRefresh: () => void; weather: WeatherState }) {
  if (weather.status !== "ready") {
    return (
      <View style={styles.weatherCard}>
        <View style={styles.weatherPlaceholder}>
          <Text style={styles.weatherCity}>当前城市天气</Text>
          <Text style={styles.weatherMeta}>{weather.message}</Text>
          <Text style={styles.weatherPrivacy}>会请求定位权限，并用于当前城市天气查询。</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="获取当前城市天气" onPress={onRefresh} style={styles.weatherButton}>
          <Text style={styles.weatherButtonText}>{weather.status === "loading" ? "读取中" : "获取天气"}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.weatherCard}>
      <View>
        <Text style={styles.weatherCity}>{weather.locationLabel}</Text>
        <Text style={styles.temperature}>{weather.temperature}°</Text>
        <Text style={styles.weatherMeta}>{weather.description} · 体感 {weather.apparentTemperature}°</Text>
      </View>
      <View style={styles.weatherRight}>
        <Text style={styles.weatherEmoji}>{weatherEmoji(weather.weatherCode)}</Text>
        <Text style={styles.weatherMeta}>湿度 {weather.humidity}%</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="刷新当前城市天气" onPress={onRefresh} style={styles.weatherSmallButton}>
          <Text style={styles.weatherSmallButtonText}>刷新</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MonthCalendar({ onSelectDate, selectedDate }: { onSelectDate?: (date: string) => void; selectedDate: string }) {
  const [viewYear, setViewYear] = useState(parseIsoDate(selectedDate).getFullYear());
  const [viewMonth, setViewMonth] = useState(parseIsoDate(selectedDate).getMonth());
  const days = buildMonthDays(viewYear, viewMonth);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <View style={styles.calendarCard}>
      <View style={styles.calendarTop}>
        <Pressable accessibilityRole="button" accessibilityLabel="上一月" onPress={goPrevMonth} hitSlop={12}>
          <Text style={styles.calendarArrow}>‹</Text>
        </Pressable>
        <Text style={styles.calendarTitle}>{viewYear}年{viewMonth + 1}月</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="下一月" onPress={goNextMonth} hitSlop={12}>
          <Text style={styles.calendarArrow}>›</Text>
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {["日", "一", "二", "三", "四", "五", "六"].map((weekday) => (
          <Text key={weekday} style={[styles.weekday, weekday === "日" || weekday === "六" ? styles.weekendHeader : null]}>{weekday}</Text>
        ))}
      </View>
      <View style={styles.dayGrid}>
        {days.map((day) => {
          const holiday = day.inMonth ? getHolidayLabel(day.date) : null;
          const weekend = day.inMonth && isWeekend(day.date);
          const selected = day.date === selectedDate;
          return (
            <Pressable
              key={day.date}
              accessibilityRole="button"
              accessibilityLabel={`选择日期 ${day.date}${holiday ? `，${holiday}` : ""}`}
              onPress={() => day.inMonth && onSelectDate?.(day.date)}
              style={[styles.dayCell, selected ? styles.dayCellSelected : null]}
            >
              <Text style={[styles.dayText, !day.inMonth ? styles.mutedDay : null, weekend ? styles.weekendDay : null, selected ? styles.selectedDay : null]}>{day.day}</Text>
              {holiday ? <Text style={styles.holidayText} numberOfLines={1}>{holiday}</Text> : <View style={styles.holidayPlaceholder} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function getPriorityMeta(priority: string) {
  return priorityOptions.find((option) => option.value === priority) ?? priorityOptions[1];
}

function formatMeta(task: TodoTask, statusText: string) {
  const dateText = task.deadline ? task.deadline.slice(0, 10) : "无截止日期";
  const timeText = task.remindAt ? task.remindAt.slice(11, 16) : "无提醒";
  return `${dateText} ${timeText} · ${statusText}`;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildMonthDays(year: number, monthIndex: number): MonthDay[] {
  const first = new Date(year, monthIndex, 1);
  const start = new Date(year, monthIndex, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date: toIsoDate(date),
      day: date.getDate(),
      inMonth: date.getMonth() === monthIndex
    };
  });
}

function sortTodos(tasks: TodoTask[]) {
  return [...tasks].sort((left, right) => {
    if (left.completed !== right.completed) {
      return left.completed ? 1 : -1;
    }
    const leftTime = left.deadline ?? left.createTime;
    const rightTime = right.deadline ?? right.createTime;
    return leftTime.localeCompare(rightTime);
  });
}

function getDefaultTodoStorage() {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: () => null,
    removeItem: () => {},
    setItem: () => {}
  };
}

const styles = StyleSheet.create({
  calendarArrow: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "500"
  },
  calendarCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e3e6eb",
    borderRadius: 18,
    borderWidth: 1,
    padding: 12
  },
  calendarTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900"
  },
  calendarTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10
  },
  checkbox: {
    alignItems: "center",
    borderColor: "#cfd8e3",
    borderRadius: 8,
    borderWidth: 2,
    height: 26,
    justifyContent: "center",
    width: 26
  },
  checkboxChecked: {
    backgroundColor: "#28aeea",
    borderColor: "#28aeea"
  },
  checkboxText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900"
  },
  dayCell: {
    alignItems: "center",
    flexBasis: "14.285%",
    height: 46,
    justifyContent: "center",
    paddingVertical: 4
  },
  dayCellSelected: {
    backgroundColor: "#28aeea",
    borderRadius: 10
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  dayText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    textAlign: "center"
  },
  emptyText: {
    color: "#8b93a1",
    fontSize: 14,
    lineHeight: 20
  },
  holidayPlaceholder: {
    height: 11
  },
  holidayText: {
    color: "#ef4444",
    fontSize: 9,
    fontWeight: "800",
    marginTop: 1,
    textAlign: "center"
  },
  moreButton: {
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  moreText: {
    color: "#697386",
    fontSize: 12,
    fontWeight: "800"
  },
  mutedDay: {
    color: "#c9ced6"
  },
  priorityDotSmall: {
    fontSize: 12,
    lineHeight: 14
  },
  section: {
    gap: 8,
    marginTop: 12
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900"
  },
  selectedDay: {
    color: "#ffffff"
  },
  stack: {
    gap: 18,
    paddingBottom: 40
  },
  taskBody: {
    flex: 1,
    gap: 4
  },
  taskCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#edf0f4",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12
  },
  taskMeta: {
    color: "#8b93a1",
    fontSize: 12,
    fontWeight: "700"
  },
  taskMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  taskPriority: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  taskPriorityText: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "900"
  },
  taskTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800"
  },
  taskTitleDone: {
    color: "#a8b0bc",
    textDecorationLine: "line-through"
  },
  temperature: {
    color: "#111827",
    fontSize: 52,
    fontWeight: "900",
    lineHeight: 58
  },
  todoCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e3e6eb",
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 14
  },
  todoHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  todoIcon: {
    color: "#28aeea",
    fontSize: 20,
    fontWeight: "900"
  },
  todoTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900"
  },
  weatherButton: {
    alignItems: "center",
    backgroundColor: "#28aeea",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  weatherButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  weatherCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e3e6eb",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14
  },
  weatherCity: {
    color: "#697386",
    fontSize: 16,
    fontWeight: "700"
  },
  weatherEmoji: {
    fontSize: 34,
    lineHeight: 40
  },
  weatherMeta: {
    color: "#697386",
    fontSize: 14,
    fontWeight: "700"
  },
  weatherPlaceholder: {
    flex: 1,
    gap: 8
  },
  weatherPrivacy: {
    color: "#9aa3af",
    fontSize: 12,
    lineHeight: 17
  },
  weatherRight: {
    alignItems: "center",
    gap: 6
  },
  weatherSmallButton: {
    backgroundColor: "#eef7ff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  weatherSmallButtonText: {
    color: "#1677a8",
    fontSize: 12,
    fontWeight: "900"
  },
  weekday: {
    color: "#697386",
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  weekRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    marginBottom: 12
  },
  weekendDay: {
    color: "#ef4444"
  },
  weekendHeader: {
    color: "#ef4444"
  }
});
