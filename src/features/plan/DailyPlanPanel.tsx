import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { PuppyIllustration } from "@/shared/ui/PuppyIllustration";
import { IconCalendarDays } from "@/shared/ui/lineIcons";
import { QUICK_CAPTURE_DATA_EVENT } from "@/features/quick-capture/quickCapture";
import { consumePlanFocus } from "@/features/plan/planFocus";
import type { UiTokens } from "@/shared/ui/primitives";
import { getHolidayLabel, isWeekend } from "./holidays";
import { PackagePanel } from "./PackagePanel";
import { getDefaultPackageStorage, hydratePackagesFromCloud, loadPackages, type PackageItem, type PackageStorage } from "./packageStorage";
import {
  createReminderId,
  getDefaultReminderStorage,
  hydrateRemindersFromCloud,
  loadReminders,
  saveReminders,
  type ReminderItem,
  type ReminderStorage
} from "./reminderStorage";
import { createTodoId, getDefaultTodoStorage, hydrateTodosFromCloud, loadLocalTodos, saveLocalTodos, type TodoStorage, type TodoTask } from "./todoStorage";

type PlanStorage = TodoStorage & PackageStorage & ReminderStorage;

type DailyPlanPanelProps = {
  shortcutNonce?: number;
  shortcutTarget?: "packages" | "packageScan";
  storage?: PlanStorage;
  themeTokens: UiTokens;
};

type MonthDay = {
  date: string;
  day: number;
  inMonth: boolean;
};

type ScheduleItem =
  | { date: string; id: string; kind: "todo"; time: string | null; title: string; todo: TodoTask }
  | { date: string; id: string; kind: "reminder"; time: string | null; title: string; reminder: ReminderItem }
  | { date: string; id: string; kind: "package"; time: string | null; title: string; package: PackageItem };

const todayIso = () => toIsoDate(new Date());

export function DailyPlanPanel({ shortcutNonce, shortcutTarget, storage, themeTokens }: DailyPlanPanelProps) {
  const scrollRef = useRef<ScrollView>(null);
  const packageStorage = useMemo(() => storage ?? getDefaultPackageStorage(), [storage]);
  const reminderStorage = useMemo(() => storage ?? getDefaultReminderStorage(), [storage]);
  const todoStorage = useMemo(() => storage ?? getDefaultTodoStorage(), [storage]);
  const [packages, setPackages] = useState<PackageItem[]>(() => loadPackages(packageStorage));
  const [reminders, setReminders] = useState<ReminderItem[]>(() => loadReminders(reminderStorage));
  const [todos, setTodos] = useState<TodoTask[]>(() => loadLocalTodos(todoStorage));
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [viewMonth, setViewMonth] = useState(parseIsoDate(todayIso()).getMonth());
  const [viewYear, setViewYear] = useState(parseIsoDate(todayIso()).getFullYear());
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickKind, setQuickKind] = useState<"todo" | "reminder" | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    const focus = consumePlanFocus();
    if (!focus) return;
    const parsed = parseIsoDate(focus.date);
    setSelectedDate(focus.date);
    setViewYear(parsed.getFullYear());
    setViewMonth(parsed.getMonth());
    setFocusId(focus.id);
    const timer = setTimeout(() => setFocusId(null), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    hydrateTodosFromCloud(todoStorage).then((next) => !cancelled && setTodos(next)).catch(() => {});
    hydratePackagesFromCloud(packageStorage).then((next) => !cancelled && setPackages(next)).catch(() => {});
    hydrateRemindersFromCloud(reminderStorage).then((next) => !cancelled && setReminders(next)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [packageStorage, reminderStorage, todoStorage]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    const refresh = () => {
      setTodos(loadLocalTodos(todoStorage));
      setPackages(loadPackages(packageStorage));
      setReminders(loadReminders(reminderStorage));
    };
    window.addEventListener(QUICK_CAPTURE_DATA_EVENT, refresh);
    return () => window.removeEventListener(QUICK_CAPTURE_DATA_EVENT, refresh);
  }, [packageStorage, reminderStorage, todoStorage]);

  useEffect(() => {
    if (shortcutTarget !== "packages" && shortcutTarget !== "packageScan") return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [shortcutNonce, shortcutTarget]);

  const markers = useMemo(() => buildMarkers(todos, packages, reminders), [packages, reminders, todos]);
  const selectedSchedule = useMemo(() => buildScheduleForDate(selectedDate, todos, packages, reminders), [packages, reminders, selectedDate, todos]);
  const upcoming = useMemo(() => buildUpcomingThreeDays(selectedDate, todos, packages, reminders), [packages, reminders, selectedDate, todos]);

  const persistTodos = (next: TodoTask[]) => {
    setTodos(next);
    saveLocalTodos(next, todoStorage);
    dispatchDataEvent();
  };

  const persistReminders = (next: ReminderItem[]) => {
    setReminders(next);
    saveReminders(next, reminderStorage);
    dispatchDataEvent();
  };

  const toggleTodo = (id: string) => {
    persistTodos(todos.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)));
  };

  const goToday = () => {
    const next = todayIso();
    const parsed = parseIsoDate(next);
    setSelectedDate(next);
    setViewYear(parsed.getFullYear());
    setViewMonth(parsed.getMonth());
  };

  const saveQuickDraft = () => {
    const title = draftTitle.trim();
    if (!title || !quickKind) return;
    const now = new Date().toISOString();
    if (quickKind === "todo") {
      persistTodos([
        {
          completed: false,
          createTime: now,
          deadline: `${selectedDate}T${normalizeTime(draftTime) ?? "23:59"}:00.000Z`,
          id: createTodoId(),
          priority: "normal",
          remindAt: normalizeTime(draftTime) ? `${selectedDate}T${normalizeTime(draftTime)}:00.000Z` : null,
          title
        },
        ...todos
      ]);
    } else {
      persistReminders([{ createTime: now, date: selectedDate, id: createReminderId(), time: normalizeTime(draftTime), title }, ...reminders]);
    }
    setDraftTitle("");
    setDraftTime("");
    setQuickKind(null);
    setQuickAddOpen(false);
  };

  return (
    <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.stack}>
      <View style={styles.pageHeader}>
        <View pointerEvents="none" style={styles.pageWatermark}>
          <IconCalendarDays color="#111827" size={78} />
        </View>
        <View>
          <Text style={styles.kicker}>每日计划</Text>
          <Text style={styles.headerTitle}>{formatHeaderDate(selectedDate)}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="回到今天" onPress={goToday} style={styles.todayButton}>
          <Text style={styles.todayButtonText}>今天</Text>
        </Pressable>
      </View>

      <LifeCalendar
        markers={markers}
        onNextMonth={() => shiftMonth(viewYear, viewMonth, 1, setViewYear, setViewMonth)}
        onPrevMonth={() => shiftMonth(viewYear, viewMonth, -1, setViewYear, setViewMonth)}
        onSelectDate={setSelectedDate}
        selectedDate={selectedDate}
        today={todayIso()}
        viewMonth={viewMonth}
        viewYear={viewYear}
      />

      <View style={styles.card} testID="day-schedule">
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>当天安排</Text>
            <Text style={styles.sectionSub}>{selectedDate} · {selectedSchedule.length} 项</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="添加当天安排" onPress={() => setQuickAddOpen((value) => !value)} style={styles.addChip}>
            <Text style={styles.addChipText}>+ 添加</Text>
          </Pressable>
        </View>

        {quickAddOpen ? (
          <View style={styles.quickAddBox}>
            <View style={styles.quickAddKinds}>
              <Pressable accessibilityRole="button" accessibilityLabel="添加待办" onPress={() => setQuickKind("todo")} style={[styles.quickKindChip, quickKind === "todo" ? styles.quickKindActive : null]}>
                <Text style={styles.quickKindText}>添加待办</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="添加提醒" onPress={() => setQuickKind("reminder")} style={[styles.quickKindChip, quickKind === "reminder" ? styles.quickKindActive : null]}>
                <Text style={styles.quickKindText}>添加提醒</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="添加快递" onPress={() => scrollRef.current?.scrollToEnd({ animated: true })} style={styles.quickKindChip}>
                <Text style={styles.quickKindText}>添加快递</Text>
              </Pressable>
            </View>
            {quickKind ? (
              <View style={styles.quickForm}>
                <TextInput autoFocus onChangeText={setDraftTitle} placeholder={quickKind === "todo" ? "待办内容" : "提醒内容"} placeholderTextColor="#94a3b8" style={styles.input} value={draftTitle} />
                <View style={styles.quickFormRow}>
                  <TextInput onChangeText={setDraftTime} placeholder="时间，可选 09:30" placeholderTextColor="#94a3b8" style={[styles.input, styles.timeInput]} value={draftTime} />
                  <Pressable accessibilityRole="button" accessibilityLabel="保存当天安排" onPress={saveQuickDraft} style={[styles.saveButton, !draftTitle.trim() ? styles.saveButtonDisabled : null]}>
                    <Text style={styles.saveButtonText}>保存</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.scheduleList}>
          {selectedSchedule.length === 0 ? (
            <View style={styles.emptyBox}>
              <PuppyIllustration color="#9cc39c" scene="checklist" size={78} />
              <Text style={styles.emptyTitle}>当天暂无安排</Text>
              <Text style={styles.emptyText}>可以补一个待办、提醒，或把快递记在这一天。</Text>
            </View>
          ) : (
            selectedSchedule.map((item) => <ScheduleRow highlight={item.id === focusId} item={item} key={`${item.kind}-${item.id}`} onToggleTodo={toggleTodo} />)
          )}
        </View>
      </View>

      {upcoming.length > 0 ? (
        <View style={styles.card} testID="upcoming-three-days">
          <Text style={styles.sectionTitle}>未来 3 天</Text>
          <View style={styles.scheduleList}>
            {upcoming.map((item) => (
              <View key={`${item.kind}-${item.id}`} style={styles.upcomingRow}>
                <Text style={styles.upcomingDate}>{item.date.slice(5)}</Text>
                <Text numberOfLines={1} style={styles.upcomingTitle}>{item.title}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <PackagePanel shortcutCreate={shortcutTarget === "packages"} shortcutScan={shortcutTarget === "packageScan"} storage={packageStorage} themeTokens={themeTokens} />
    </ScrollView>
  );
}

function LifeCalendar({
  markers,
  onNextMonth,
  onPrevMonth,
  onSelectDate,
  selectedDate,
  today,
  viewMonth,
  viewYear
}: {
  markers: Record<string, Array<"todo" | "package" | "reminder">>;
  onNextMonth: () => void;
  onPrevMonth: () => void;
  onSelectDate: (date: string) => void;
  selectedDate: string;
  today: string;
  viewMonth: number;
  viewYear: number;
}) {
  const days = buildMonthDays(viewYear, viewMonth);
  return (
    <View style={styles.calendarCard} testID="life-calendar">
      <View style={styles.calendarTop}>
        <Pressable accessibilityRole="button" accessibilityLabel="上一个月" hitSlop={12} onPress={onPrevMonth}>
          <Text style={styles.calendarArrow}>‹</Text>
        </Pressable>
        <Text style={styles.calendarTitle}>生活日历 · {viewYear}年{viewMonth + 1}月</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="下一个月" hitSlop={12} onPress={onNextMonth}>
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
          const isToday = day.date === today;
          const dayMarkers = (markers[day.date] ?? []).slice(0, 3);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`选择日期 ${day.date}`}
              key={day.date}
              onPress={() => onSelectDate(day.date)}
              style={[styles.dayCell, selected ? styles.dayCellSelected : null, isToday && !selected ? styles.dayCellToday : null]}
              testID={`calendar-day-${day.date}`}
            >
              <Text style={[styles.dayText, !day.inMonth ? styles.mutedDay : null, weekend ? styles.weekendDay : null, selected ? styles.selectedDay : null]}>{day.day}</Text>
              <View style={styles.markerRow}>
                {dayMarkers.map((marker) => (
                  <View key={marker} style={[styles.markerDot, marker === "package" ? styles.packageDot : marker === "reminder" ? styles.reminderDot : null]} testID={`calendar-marker-${marker}-${day.date}`} />
                ))}
              </View>
              {holiday ? <Text numberOfLines={1} style={styles.holidayText}>{holiday}</Text> : <View style={styles.holidayPlaceholder} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ScheduleRow({ highlight, item, onToggleTodo }: { highlight?: boolean; item: ScheduleItem; onToggleTodo: (id: string) => void }) {
  const done = item.kind === "todo" && item.todo.completed;
  return (
    <View style={[styles.scheduleRow, done ? styles.scheduleRowDone : null, highlight ? styles.scheduleRowFocus : null]}>
      {item.kind === "todo" ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.todo.completed }}
          onPress={() => onToggleTodo(item.id)}
          style={[styles.scheduleCheck, item.todo.completed ? styles.scheduleCheckActive : null]}
          testID={`schedule-todo-toggle-${item.id}`}
        >
          {item.todo.completed ? <Text style={styles.scheduleCheckText}>✓</Text> : null}
        </Pressable>
      ) : (
        <View style={[styles.scheduleKind, item.kind === "package" ? styles.scheduleKindPackage : styles.scheduleKindReminder]} />
      )}
      <View style={styles.scheduleBody}>
        <Text numberOfLines={1} style={[styles.scheduleTitle, done ? styles.scheduleTitleDone : null]}>{item.title}</Text>
        <Text style={styles.scheduleMeta}>{kindLabel(item.kind)}{item.time ? ` · ${item.time}` : " · 未定时间"}</Text>
      </View>
    </View>
  );
}

function buildMarkers(todos: TodoTask[], packages: PackageItem[], reminders: ReminderItem[]) {
  const result: Record<string, Array<"todo" | "package" | "reminder">> = {};
  const push = (date: string | null | undefined, marker: "todo" | "package" | "reminder") => {
    if (!date) return;
    const key = date.slice(0, 10);
    result[key] = result[key] ?? [];
    if (!result[key].includes(marker)) result[key].push(marker);
  };
  todos.forEach((todo) => push(todo.remindAt ?? todo.deadline, "todo"));
  packages.forEach((item) => push(item.arrivalDate, "package"));
  reminders.forEach((item) => push(item.date, "reminder"));
  return result;
}

function buildScheduleForDate(date: string, todos: TodoTask[], packages: PackageItem[], reminders: ReminderItem[]): ScheduleItem[] {
  const todoItems = todos
    .filter((todo) => isoFromValue(todo.remindAt ?? todo.deadline) === date)
    .map((todo): ScheduleItem => ({ date, id: todo.id, kind: "todo", time: timeFromValue(todo.remindAt ?? todo.deadline), title: todo.title, todo }));
  const packageItems = packages
    .filter((item) => item.arrivalDate === date)
    .map((item): ScheduleItem => ({ date, id: item.id, kind: "package", time: null, title: item.pickupCode || "待取快递", package: item }));
  const reminderItems = reminders
    .filter((item) => item.date === date)
    .map((item): ScheduleItem => ({ date, id: item.id, kind: "reminder", time: item.time ?? null, title: item.title, reminder: item }));
  return [...todoItems, ...reminderItems, ...packageItems].sort(compareScheduleItems);
}

function buildUpcomingThreeDays(selectedDate: string, todos: TodoTask[], packages: PackageItem[], reminders: ReminderItem[]) {
  const start = parseIsoDate(selectedDate);
  const items: ScheduleItem[] = [];
  for (let offset = 1; offset <= 3; offset += 1) {
    const next = new Date(start);
    next.setDate(start.getDate() + offset);
    items.push(...buildScheduleForDate(toIsoDate(next), todos, packages, reminders));
  }
  return items.slice(0, 3);
}

function compareScheduleItems(left: ScheduleItem, right: ScheduleItem) {
  const leftTime = left.time ?? "99:99";
  const rightTime = right.time ?? "99:99";
  if (leftTime !== rightTime) return leftTime.localeCompare(rightTime);
  return kindLabel(left.kind).localeCompare(kindLabel(right.kind));
}

function kindLabel(kind: ScheduleItem["kind"]) {
  if (kind === "todo") return "待办";
  if (kind === "package") return "快递";
  return "提醒";
}

function isoFromValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : null;
}

function timeFromValue(value: string | null | undefined) {
  if (!value || !value.includes("T")) return null;
  return value.slice(11, 16);
}

function normalizeTime(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatHeaderDate(value: string) {
  const date = parseIsoDate(value);
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()]}`;
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

function shiftMonth(year: number, month: number, delta: number, setYear: (value: number) => void, setMonth: (value: number) => void) {
  const next = new Date(year, month + delta, 1);
  setYear(next.getFullYear());
  setMonth(next.getMonth());
}

function dispatchDataEvent() {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new Event(QUICK_CAPTURE_DATA_EVENT));
  }
}

const styles = StyleSheet.create({
  addChip: {
    backgroundColor: "#e8f6ee",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  addChipText: {
    color: "#248a51",
    fontSize: 13,
    fontWeight: "900"
  },
  calendarArrow: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "800"
  },
  calendarCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e3e6eb",
    borderRadius: 18,
    borderWidth: 1,
    padding: 10
  },
  calendarTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900"
  },
  calendarTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "#e6ebf2",
    borderRadius: 20,
    borderWidth: 1,
    elevation: 2,
    gap: 12,
    padding: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12
  },
  dayCell: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 10,
    borderWidth: 1,
    flexBasis: "14.285%",
    height: 42,
    justifyContent: "center",
    paddingVertical: 1
  },
  dayCellSelected: {
    backgroundColor: "#7cb87c"
  },
  dayCellToday: {
    borderColor: "#7cb87c"
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  dayText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 15,
    textAlign: "center"
  },
  emptyBox: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    gap: 4,
    minHeight: 132,
    justifyContent: "center",
    padding: 12
  },
  emptyText: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 3
  },
  emptyTitle: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "900"
  },
  headerTitle: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 2
  },
  holidayPlaceholder: {
    height: 8
  },
  holidayText: {
    color: "#ef4444",
    fontSize: 8,
    fontWeight: "800",
    lineHeight: 9,
    marginTop: 0,
    textAlign: "center"
  },
  input: {
    backgroundColor: "#f8fafc",
    borderColor: "#dbe5df",
    borderRadius: 12,
    borderWidth: 1,
    color: "#111827",
    flex: 1,
    fontSize: 14,
    minHeight: 42,
    paddingHorizontal: 12
  },
  kicker: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "800"
  },
  markerDot: {
    backgroundColor: "#7cb87c",
    borderRadius: 999,
    height: 4,
    width: 4
  },
  markerRow: {
    flexDirection: "row",
    gap: 2,
    height: 6,
    justifyContent: "center",
    marginTop: 1
  },
  mutedDay: {
    color: "#c9ced6"
  },
  packageDot: {
    backgroundColor: "#38bdf8"
  },
  pageHeader: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "#e6ebf2",
    borderRadius: 20,
    borderWidth: 1,
    elevation: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    overflow: "hidden",
    padding: 14,
    position: "relative",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12
  },
  pageWatermark: {
    bottom: -10,
    opacity: 0.05,
    position: "absolute",
    right: 66,
    top: -10
  },
  quickAddBox: {
    backgroundColor: "#f8fafc",
    borderColor: "#e3e6eb",
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    padding: 10
  },
  quickAddKinds: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  quickForm: {
    gap: 8
  },
  quickFormRow: {
    flexDirection: "row",
    gap: 8
  },
  quickKindActive: {
    backgroundColor: "#dff3e7",
    borderColor: "#7cb87c"
  },
  quickKindChip: {
    backgroundColor: "#ffffff",
    borderColor: "#e3e6eb",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  quickKindText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "900"
  },
  reminderDot: {
    backgroundColor: "#f59e0b"
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#7cb87c",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 16
  },
  saveButtonDisabled: {
    opacity: 0.45
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900"
  },
  scheduleBody: {
    flex: 1,
    gap: 2
  },
  scheduleCheck: {
    alignItems: "center",
    borderColor: "#94a3b8",
    borderRadius: 6,
    borderWidth: 1.6,
    height: 24,
    justifyContent: "center",
    width: 24
  },
  scheduleCheckActive: {
    backgroundColor: "#7cb87c",
    borderColor: "#7cb87c"
  },
  scheduleCheckText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  scheduleKind: {
    backgroundColor: "#f59e0b",
    borderRadius: 999,
    height: 14,
    width: 14
  },
  scheduleKindPackage: {
    backgroundColor: "#38bdf8"
  },
  scheduleKindReminder: {
    backgroundColor: "#f59e0b"
  },
  scheduleList: {
    gap: 8
  },
  scheduleMeta: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700"
  },
  scheduleRow: {
    alignItems: "center",
    backgroundColor: "#fbfdff",
    borderColor: "#edf1f4",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  scheduleRowDone: {
    opacity: 0.72
  },
  scheduleRowFocus: {
    backgroundColor: "#eef7ee",
    borderColor: "#7cb87c",
    borderWidth: 1.5
  },
  scheduleTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900"
  },
  scheduleTitleDone: {
    textDecorationLine: "line-through"
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  sectionSub: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900"
  },
  selectedDay: {
    color: "#ffffff"
  },
  stack: {
    gap: 14,
    paddingBottom: 40
  },
  timeInput: {
    flexBasis: 150
  },
  todayButton: {
    backgroundColor: "#7cb87c",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  todayButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900"
  },
  upcomingDate: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "900",
    width: 44
  },
  upcomingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 32
  },
  upcomingTitle: {
    color: "#111827",
    flex: 1,
    fontSize: 13,
    fontWeight: "800"
  },
  weekday: {
    color: "#697386",
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center"
  },
  weekendDay: {
    color: "#ef4444"
  },
  weekendHeader: {
    color: "#ef4444"
  },
  weekRow: {
    flexDirection: "row",
    gap: 4,
    justifyContent: "space-between",
    marginBottom: 6
  }
});
