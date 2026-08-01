import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AnimatedToggle } from "@/shared/ui/AnimatedToggle";
import type { UiTokens } from "@/shared/ui/primitives";
import { getSupabaseClient } from "@/auth/supabaseClient";
import { createAlarmId, hydrateAlarmsFromCloud, loadAlarms, repeatLabel, saveAlarms, weekLabel, type AlarmItem } from "@/features/plan/alarmStorage";
import { createTask, listAllActiveTasks, softDeleteTask, updateTask } from "@/features/plan/taskRepository";
import { createTodoId, getDefaultTodoStorage, hydrateTodosFromCloud, loadLocalTodos, saveLocalTodos, sortTodos, type TodoPriority, type TodoStorage, type TodoTask } from "@/features/plan/todoStorage";
import { resolveCurrentCityWeather, type WeatherState } from "@/features/plan/weatherProvider";

type DailyPlanPanelProps = {
  storage?: TodoStorage;
  themeTokens: UiTokens;
};

type TaskRow = {
  completed_at: string | null;
  created_at: string;
  due_at: string | null;
  id: string;
  remind_at: string | null;
  notes: string | null;
  status: string;
  title: string;
};

type MonthDay = {
  date: string;
  day: number;
  inMonth: boolean;
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const priorityOptions: Array<{ color: string; label: string; value: TodoPriority }> = [
  { color: "#8fb3c9", label: "低", value: "low" },
  { color: "#63a7f8", label: "普通", value: "normal" },
  { color: "#ffb020", label: "高", value: "high" },
  { color: "#ef4444", label: "紧急", value: "urgent" }
];

export function DailyPlanPanel({ storage, themeTokens }: DailyPlanPanelProps) {
  const tokens = themeTokens;
  const todoStorage = useMemo(() => storage ?? getDefaultTodoStorage(), [storage]);
  const [tasks, setTasks] = useState<TodoTask[]>(() => sortTodos(loadLocalTodos(todoStorage)));
  const [composerOpen, setComposerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickPriority, setQuickPriority] = useState<TodoPriority>("normal");
  const [draftPriority, setDraftPriority] = useState<TodoPriority>("normal");
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
  const [draftDeadline, setDraftDeadline] = useState(todayIso());
  const [draftReminder, setDraftReminder] = useState("09:30");
  const [pickerDate, setPickerDate] = useState(todayIso());
  const [pickerTime, setPickerTime] = useState("09:30");
  const [feedback, setFeedback] = useState("待办会自动保存，刷新网页后仍然保留。");
  const [weather, setWeather] = useState<WeatherState>({ message: "点击后获取当前城市实时天气。", status: "idle" });
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [alarms, setAlarms] = useState<AlarmItem[]>(() => loadAlarms());

  useEffect(() => {
    let cancelled = false;
    hydrateTodosFromCloud(todoStorage)
      .then((next) => {
        if (!cancelled) {
          setTasks(sortTodos(next));
        }
      })
      .catch(() => {});
    hydrateAlarmsFromCloud()
      .then((next) => {
        if (!cancelled) {
          setAlarms(next);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [todoStorage]);
  const [alarmSheetOpen, setAlarmSheetOpen] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<AlarmItem | null>(null);
  const [ringingAlarm, setRingingAlarm] = useState<AlarmItem | null>(null);
  const [firedMinutes, setFiredMinutes] = useState<string[]>([]);

  const pendingTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);
  const now = new Date();
  const today = todayIso();

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

  const persistAlarms = (nextAlarms: AlarmItem[]) => {
    setAlarms(nextAlarms);
    saveAlarms(nextAlarms);
  };

  const toggleAlarm = (alarmId: string) => {
    persistAlarms(alarms.map((alarm) => (alarm.id === alarmId ? { ...alarm, enabled: !alarm.enabled } : alarm)));
  };

  const openNewAlarm = () => {
    setEditingAlarm({ enabled: true, id: createAlarmId(), label: "闹钟", repeat: [], time: "08:00" });
    setAlarmSheetOpen(true);
  };

  const openEditAlarm = (alarm: AlarmItem) => {
    setEditingAlarm({ ...alarm });
    setAlarmSheetOpen(true);
  };

  const saveEditingAlarm = () => {
    if (!editingAlarm) {
      return;
    }
    const time = editingAlarm.time.trim();
    if (!/^\d{1,2}:\d{2}$/.test(time)) {
      return;
    }
    const exists = alarms.some((alarm) => alarm.id === editingAlarm.id);
    const nextAlarms = exists
      ? alarms.map((alarm) => (alarm.id === editingAlarm.id ? editingAlarm : alarm))
      : [editingAlarm, ...alarms];
    persistAlarms(nextAlarms);
    setAlarmSheetOpen(false);
    setEditingAlarm(null);
  };

  const deleteEditingAlarm = () => {
    if (!editingAlarm) {
      return;
    }
    persistAlarms(alarms.filter((alarm) => alarm.id !== editingAlarm.id));
    setAlarmSheetOpen(false);
    setEditingAlarm(null);
  };

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
      const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const matched = alarms.find((alarm) => alarm.enabled && alarm.time === current);
      if (matched && !firedMinutes.includes(minuteKey)) {
        setRingingAlarm(matched);
        setFiredMinutes((previous) => [...previous, minuteKey].slice(-30));
      }
    };
    const timer = setInterval(check, 10000);
    check();
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarms]);

  const openComposer = () => {
    setDraftTitle(quickTitle);
    setDraftPriority(quickPriority);
    setPriorityMenuOpen(false);
    setComposerOpen(true);
  };

  const resetComposer = () => {
    setDraftTitle("");
    setQuickTitle("");
    setQuickPriority("normal");
    setDraftPriority("normal");
    setPriorityMenuOpen(false);
    setDraftDeadline(todayIso());
    setDraftReminder("09:30");
    setComposerOpen(false);
    setDatePickerOpen(false);
  };

  const openDatePicker = () => {
    setPickerDate(draftDeadline || todayIso());
    setPickerTime(draftReminder || "09:30");
    setDatePickerOpen(true);
  };

  const confirmDatePicker = () => {
    setDraftDeadline(pickerDate);
    setDraftReminder(pickerTime);
    setDatePickerOpen(false);
  };

  const loadWeather = async () => {
    setWeather({ message: "正在读取当前城市天气...", status: "loading" });
    setWeather(await resolveCurrentCityWeather());
  };

  const saveTask = async () => {
    const title = draftTitle.trim();
    if (!title) {
      setFeedback("请先输入任务名称。");
      return;
    }

    const createTime = new Date().toISOString();
    const deadline = buildDateTime(draftDeadline, draftReminder);
    const localTask: TodoTask = {
      completed: false,
      createTime,
      deadline,
      id: createTodoId(),
      priority: draftPriority,
      remindAt: deadline,
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
      notes: JSON.stringify({ priority: localTask.priority }),
      remindAt: localTask.remindAt ?? null,
      taskDate: (localTask.deadline ?? createTime).slice(0, 10),
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
      <View style={styles.greetingCard}>
        <Text style={styles.dateLine}>{formatFullDate(now)}</Text>
        <Text style={styles.greeting}>上午好，把今天安排得轻一点</Text>
      </View>

      {ringingAlarm ? (
        <View style={styles.ringBanner}>
          <Text style={styles.ringEmoji}>⏰</Text>
          <View style={styles.ringInfo}>
            <Text style={styles.ringTitle}>{ringingAlarm.label}</Text>
            <Text style={styles.ringMeta}>{ringingAlarm.time} · {repeatLabel(ringingAlarm.repeat)}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭闹钟提醒" onPress={() => setRingingAlarm(null)} style={styles.ringClose}>
            <Text style={styles.ringCloseText}>知道了</Text>
          </Pressable>
        </View>
      ) : null}

      <WeatherCard onRefresh={loadWeather} weather={weather} />

      <MonthCalendar selectedDate={today} />

      <View style={styles.todoCard}>
        <View style={styles.todoHeader}>
          <Text style={styles.todoIcon}>☑</Text>
          <Text style={styles.todoTitle}>今日待办</Text>
        </View>
        <View style={styles.quickAddRow}>
          <TextInput nativeID="plan-quick-input" onChangeText={setQuickTitle} placeholder="添加待办任务..." style={styles.quickInput} value={quickTitle} />
          <PrioritySelector onSelect={setQuickPriority} selectedPriority={quickPriority} />
          <Pressable accessibilityRole="button" accessibilityLabel="新增任务" nativeID="plan-add-button" onPress={openComposer} style={styles.addButton}>
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
        </View>

        <TaskSection emptyText="暂时没有待办，先写下一件最小的事。" onDelete={deleteTask} onToggle={toggleTask} tasks={pendingTasks} title="待办" />
        <TaskSection emptyText="完成的任务会移动到这里。" onDelete={deleteTask} onToggle={toggleTask} tasks={completedTasks} title={`已完成 ${completedTasks.length}`} />
      </View>

      <View style={styles.alarmCard}>
        <View style={styles.alarmHeader}>
          <View style={styles.alarmTitleWrap}>
            <Text style={styles.alarmIcon}>🔔</Text>
            <Text style={styles.alarmTitle}>闹钟</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="新增闹钟" onPress={openNewAlarm} style={styles.alarmAddButton}>
            <Text style={styles.alarmAddText}>+</Text>
          </Pressable>
        </View>
        {alarms.length === 0 ? (
          <Text style={styles.alarmEmpty}>还没有闹钟，点 + 添加一个提醒。</Text>
        ) : (
          <View style={styles.alarmList}>
            {alarms.map((alarm) => (
              <Pressable key={alarm.id} accessibilityRole="button" accessibilityLabel={`编辑闹钟 ${alarm.time}`} onPress={() => openEditAlarm(alarm)} style={styles.alarmRow}>
                <View style={styles.alarmRowInfo}>
                  <Text style={[styles.alarmTime, !alarm.enabled ? styles.alarmTimeOff : null]}>{alarm.time}</Text>
                  <Text style={styles.alarmMeta}>{alarm.label} · {repeatLabel(alarm.repeat)}</Text>
                </View>
                <AnimatedToggle onToggle={() => toggleAlarm(alarm.id)} themeTokens={tokens} value={alarm.enabled} />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {alarmSheetOpen && editingAlarm ? (
        <AlarmSheet
          alarm={editingAlarm}
          isNew={!alarms.some((alarm) => alarm.id === editingAlarm.id)}
          onCancel={() => { setAlarmSheetOpen(false); setEditingAlarm(null); }}
          onChange={setEditingAlarm}
          onDelete={deleteEditingAlarm}
          onSave={saveEditingAlarm}
        />
      ) : null}

      <Text nativeID="plan-feedback" style={styles.feedback}>{feedback}</Text>

      {composerOpen ? (
        <View style={styles.modalLayer}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>添加任务</Text>
            <TextInput onChangeText={setDraftTitle} placeholder="任务名称" style={styles.input} value={draftTitle} />
            <View style={styles.priorityFieldWrap}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`选择紧急程度：${getPriorityMeta(draftPriority).label}`}
                onPress={() => setPriorityMenuOpen((value) => !value)}
                style={styles.priorityField}
              >
                <Text style={styles.dateFieldLabel}>紧急程度</Text>
                <View style={styles.priorityInline}>
                  <Text style={[styles.priorityDot, { color: getPriorityMeta(draftPriority).color }]}>●</Text>
                  <Text style={styles.priorityText}>{getPriorityMeta(draftPriority).label}</Text>
                </View>
              </Pressable>
              {priorityMenuOpen ? (
                <View style={[styles.priorityMenu, styles.priorityFieldMenu]}>
                  {priorityOptions.map((option) => (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityLabel={option.label}
                      onPress={() => {
                        setDraftPriority(option.value);
                        setPriorityMenuOpen(false);
                      }}
                      style={styles.priorityOption}
                    >
                      <Text style={[styles.priorityDot, { color: option.color }]}>●</Text>
                      <Text style={styles.priorityText}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="选择截止日期" onPress={openDatePicker} style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>截止日期</Text>
              <Text style={styles.dateFieldValue}>{draftDeadline.replaceAll("-", "/")} {draftReminder}</Text>
            </Pressable>
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

      {datePickerOpen ? (
        <DateTimePickerSheet
          onCancel={() => setDatePickerOpen(false)}
          onConfirm={confirmDatePicker}
          selectedDate={pickerDate}
          selectedTime={pickerTime}
          setSelectedDate={setPickerDate}
          setSelectedTime={setPickerTime}
        />
      ) : null}
    </View>
  );
}

function MonthCalendar({ selectedDate }: { selectedDate: string }) {
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
          <Text key={weekday} style={styles.weekday}>{weekday}</Text>
        ))}
      </View>
      <View style={styles.dayGrid}>
        {days.map((day) => (
          <View key={day.date} style={styles.dayCell}>
            <Text style={[styles.dayText, !day.inMonth ? styles.mutedDay : null, day.date === selectedDate ? styles.selectedDay : null]}>{day.day}</Text>
          </View>
        ))}
      </View>
    </View>
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
        <Text style={styles.cloudMark}>{weather.description === "Clear" ? "晴" : "云"}</Text>
        <Text style={styles.weatherMeta}>湿度 {weather.humidity}%</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="刷新当前城市天气" onPress={onRefresh} style={styles.weatherSmallButton}>
          <Text style={styles.weatherSmallButtonText}>刷新</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PrioritySelector({ onSelect, selectedPriority }: { onSelect: (priority: TodoPriority) => void; selectedPriority: TodoPriority }) {
  const [open, setOpen] = useState(false);
  const selected = getPriorityMeta(selectedPriority);

  return (
    <View style={styles.prioritySelector}>
      <Pressable accessibilityRole="button" accessibilityLabel={`选择紧急程度：${selected.label}`} nativeID="plan-priority-button" onPress={() => setOpen((value) => !value)} style={styles.priorityPill}>
        <Text style={styles.flag}>⚐</Text>
        <Text style={[styles.priorityDot, { color: selected.color }]}>●</Text>
        <Text style={styles.priorityText}>{selected.label}</Text>
        <Text style={styles.priorityChevron}>⌄</Text>
      </Pressable>
      {open ? (
        <View nativeID="plan-priority-menu" style={[styles.priorityMenu, styles.quickPriorityMenu]}>
          {priorityOptions.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              onPress={() => {
                onSelect(option.value);
                setOpen(false);
              }}
              style={styles.priorityOption}
            >
              <Text style={[styles.priorityDot, { color: option.color }]}>●</Text>
              <Text style={styles.priorityText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function DateTimePickerSheet({
  onCancel,
  onConfirm,
  selectedDate,
  selectedTime,
  setSelectedDate,
  setSelectedTime
}: {
  onCancel: () => void;
  onConfirm: () => void;
  selectedDate: string;
  selectedTime: string;
  setSelectedDate: (date: string) => void;
  setSelectedTime: (time: string) => void;
}) {
  const initialDate = parseIsoDate(selectedDate);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const days = buildMonthDays(viewYear, viewMonth).filter((day) => day.inMonth);

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
    <View style={styles.sheetBackdrop}>
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>设置提醒时间</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>提醒时间</Text>
          <View style={styles.settingValueRow}>
            <Text style={styles.selectedDatePill}>{selectedDate.replaceAll("-", "/")}</Text>
            <TextInput onChangeText={setSelectedTime} placeholder="提醒时间" style={styles.timeInput} value={selectedTime} />
          </View>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>重复提醒</Text>
          <Text style={styles.settingHint}>不重复⌄</Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>农历</Text>
          <View style={styles.toggleOff} />
        </View>
        <View style={styles.sheetDivider} />
        <View style={styles.calendarTop}>
          <Pressable accessibilityRole="button" accessibilityLabel="上一月" onPress={goPrevMonth} hitSlop={12}>
            <Text style={styles.calendarArrow}>‹</Text>
          </Pressable>
          <Text style={styles.calendarTitle}>{viewYear}/{String(viewMonth + 1).padStart(2, "0")}⌄</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="下一月" onPress={goNextMonth} hitSlop={12}>
            <Text style={styles.calendarArrow}>›</Text>
          </Pressable>
        </View>
        <View style={styles.weekRow}>
          {["一", "二", "三", "四", "五", "六", "日"].map((weekday) => (
            <Text key={weekday} style={styles.weekday}>{weekday}</Text>
          ))}
        </View>
        <View style={styles.dayGrid}>
          {days.map((day) => (
            <Pressable key={day.date} accessibilityRole="button" accessibilityLabel={`选择日期 ${day.date}`} onPress={() => setSelectedDate(day.date)} style={styles.dayCell}>
              <Text style={[styles.sheetDayText, day.date === selectedDate ? styles.selectedDay : null]}>{day.day}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.sheetActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="取消提醒时间" onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>取消</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="确定提醒时间" onPress={onConfirm} style={styles.confirmButton}>
            <Text style={styles.confirmText}>确定</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function AlarmSheet({
  alarm,
  isNew,
  onCancel,
  onChange,
  onDelete,
  onSave
}: {
  alarm: AlarmItem;
  isNew: boolean;
  onCancel: () => void;
  onChange: (alarm: AlarmItem) => void;
  onDelete: () => void;
  onSave: () => void;
}) {
  const [timeDraft, setTimeDraft] = useState(alarm.time);
  const [labelDraft, setLabelDraft] = useState(alarm.label);
  const [repeatDraft, setRepeatDraft] = useState<number[]>(alarm.repeat);

  const commit = (patch: Partial<AlarmItem>) => {
    onChange({ ...alarm, ...patch });
  };

  const toggleRepeat = (day: number) => {
    const next = repeatDraft.includes(day) ? repeatDraft.filter((d) => d !== day) : [...repeatDraft, day];
    setRepeatDraft(next);
    commit({ repeat: next });
  };

  return (
    <View style={styles.sheetBackdrop}>
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{isNew ? "新增闹钟" : "编辑闹钟"}</Text>
        <View style={styles.alarmFieldRow}>
          <Text style={styles.alarmFieldLabel}>时间</Text>
          <TextInput
            accessibilityLabel="闹钟时间"
            onChangeText={(text) => {
              setTimeDraft(text);
              commit({ time: text });
            }}
            placeholder="08:00"
            style={styles.alarmTimeInput}
            value={timeDraft}
          />
        </View>
        <View style={styles.alarmFieldRow}>
          <Text style={styles.alarmFieldLabel}>标签</Text>
          <TextInput
            accessibilityLabel="闹钟标签"
            onChangeText={(text) => {
              setLabelDraft(text);
              commit({ label: text });
            }}
            placeholder="起床 / 喝水 / 吃药"
            style={styles.alarmLabelInput}
            value={labelDraft}
          />
        </View>
        <Text style={styles.alarmFieldLabel}>重复</Text>
        <View style={styles.weekRow}>
          {[0, 1, 2, 3, 4, 5, 6].map((day) => (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={`重复星期${weekLabel(day)}`}
              onPress={() => toggleRepeat(day)}
              style={[styles.weekChip, repeatDraft.includes(day) ? styles.weekChipActive : null]}
            >
              <Text style={[styles.weekChipText, repeatDraft.includes(day) ? styles.weekChipTextActive : null]}>{weekLabel(day)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.sheetActions}>
          {isNew ? null : (
            <Pressable accessibilityRole="button" accessibilityLabel="删除闹钟" onPress={onDelete} style={styles.alarmDeleteButton}>
              <Text style={styles.alarmDeleteText}>删除</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel="取消闹钟编辑" onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>取消</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="保存闹钟" onPress={onSave} style={styles.confirmButton}>
            <Text style={styles.confirmText}>保存</Text>
          </Pressable>
        </View>
      </View>
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

function mapRemoteTask(row: TaskRow): TodoTask {
  return {
    completed: row.status === "done" || Boolean(row.completed_at),
    createTime: row.created_at,
    deadline: row.due_at,
    id: row.id,
    priority: parsePriority(row.notes),
    remindAt: row.remind_at,
    remoteId: row.id,
    title: row.title
  };
}

function getPriorityMeta(priority: TodoPriority) {
  return priorityOptions.find((option) => option.value === priority) ?? priorityOptions[1];
}

function parsePriority(notes: string | null): TodoPriority {
  if (!notes) {
    return "normal";
  }

  try {
    const parsed = JSON.parse(notes) as { priority?: unknown };
    return priorityOptions.some((option) => option.value === parsed.priority) ? (parsed.priority as TodoPriority) : "normal";
  } catch {
    return "normal";
  }
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

function formatFullDate(date: Date) {
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日${weekdays[date.getDay()]}`;
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
  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date: toIsoDate(date),
      day: date.getDate(),
      inMonth: date.getMonth() === monthIndex
    };
  });
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: "center",
    backgroundColor: "#78c9ee",
    borderRadius: 14,
    height: 54,
    justifyContent: "center",
    width: 54
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 32,
    lineHeight: 34
  },
  calendarArrow: {
    color: "#111827",
    fontSize: 32,
    fontWeight: "500"
  },
  calendarCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e3e6eb",
    borderRadius: 18,
    borderWidth: 1,
    padding: 18
  },
  calendarTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900"
  },
  calendarTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18
  },
  cancelButton: {
    alignItems: "center",
    backgroundColor: "#f1f1f1",
    borderRadius: 16,
    flex: 1,
    paddingVertical: 14
  },
  cancelText: {
    color: "#111111",
    fontSize: 18,
    fontWeight: "900"
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
  cloudMark: {
    color: "#b8c8d3",
    fontSize: 38,
    fontWeight: "900"
  },
  confirmButton: {
    alignItems: "center",
    backgroundColor: "#2f85ff",
    borderRadius: 16,
    flex: 1,
    paddingVertical: 14
  },
  confirmText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900"
  },
  dateField: {
    backgroundColor: "#f8fafc",
    borderColor: "#e3e6eb",
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  dateFieldLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "800"
  },
  dateFieldValue: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900"
  },
  dateLine: {
    color: "#697386",
    fontSize: 17,
    fontWeight: "700"
  },
  dayCell: {
    alignItems: "center",
    flexBasis: "14.285%",
    height: 44,
    justifyContent: "center"
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  dayText: {
    color: "#111827",
    fontSize: 18,
    lineHeight: 34,
    minWidth: 38,
    textAlign: "center"
  },
  emptyText: {
    color: "#8b93a1",
    fontSize: 14,
    lineHeight: 20
  },
  feedback: {
    backgroundColor: "#eaf7ff",
    borderRadius: 12,
    color: "#156f9c",
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  flag: {
    color: "#111827",
    fontSize: 21
  },
  greeting: {
    color: "#111827",
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 42,
    marginTop: 8
  },
  greetingCard: {
    backgroundColor: "#eefbff",
    borderColor: "#dceef6",
    borderRadius: 20,
    borderWidth: 1,
    padding: 22
  },
  input: {
    borderColor: "#e3e6eb",
    borderRadius: 12,
    borderWidth: 1,
    color: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e3e6eb",
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  modalLayer: {
    backgroundColor: "rgba(17, 24, 39, 0.14)",
    borderRadius: 22,
    padding: 12
  },
  modalTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900"
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
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#28aeea",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  primaryText: {
    color: "#ffffff",
    fontWeight: "900"
  },
  priorityDot: {
    color: "#63a7f8",
    fontSize: 22,
    lineHeight: 24
  },
  priorityDotSmall: {
    fontSize: 12,
    lineHeight: 14
  },
  priorityChevron: {
    color: "#697386",
    fontSize: 15,
    fontWeight: "900"
  },
  priorityField: {
    backgroundColor: "#f8fafc",
    borderColor: "#e3e6eb",
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  priorityFieldMenu: {
    left: 0,
    right: 0,
    top: 66
  },
  priorityFieldWrap: {
    position: "relative",
    zIndex: 5
  },
  priorityInline: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  priorityMenu: {
    backgroundColor: "#ffffff",
    borderColor: "#e3e6eb",
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    padding: 8,
    position: "absolute",
    zIndex: 20
  },
  priorityOption: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  priorityPill: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e3e6eb",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    height: 54,
    paddingHorizontal: 14
  },
  prioritySelector: {
    flexShrink: 0,
    position: "relative"
  },
  priorityText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800"
  },
  quickAddRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  quickInput: {
    backgroundColor: "#f8fafc",
    borderColor: "#e3e6eb",
    borderRadius: 14,
    borderWidth: 1,
    color: "#111827",
    flex: 1,
    fontSize: 16,
    height: 54,
    minWidth: 180,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  quickPriorityMenu: {
    right: 0,
    top: 62,
    width: 130
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e3e6eb",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  secondaryText: {
    color: "#111827",
    fontWeight: "900"
  },
  section: {
    gap: 10,
    marginTop: 14
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900"
  },
  selectedDatePill: {
    backgroundColor: "#2f85ff",
    borderRadius: 10,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  selectedDay: {
    backgroundColor: "#28aeea",
    borderRadius: 12,
    color: "#ffffff",
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  settingHint: {
    color: "#9ca3af",
    fontSize: 18,
    fontWeight: "800"
  },
  settingLabel: {
    color: "#111111",
    fontSize: 20,
    fontWeight: "900"
  },
  settingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  settingValueRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    gap: 22,
    padding: 24
  },
  sheetActions: {
    flexDirection: "row",
    gap: 14,
    marginTop: 8
  },
  sheetBackdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: 30,
    padding: 10
  },
  sheetDayText: {
    color: "#111111",
    fontSize: 24,
    lineHeight: 38,
    minWidth: 40,
    textAlign: "center"
  },
  sheetDivider: {
    backgroundColor: "#e5e7eb",
    height: 1
  },
  sheetTitle: {
    color: "#111111",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center"
  },
  stack: {
    gap: 18
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
  timeInput: {
    backgroundColor: "#f1f1f1",
    borderRadius: 10,
    color: "#111111",
    fontSize: 16,
    fontWeight: "900",
    minWidth: 82,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: "center"
  },
  todoCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e3e6eb",
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 18
  },
  todoHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  todoIcon: {
    color: "#28aeea",
    fontSize: 24,
    fontWeight: "900"
  },
  todoTitle: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900"
  },
  toggleOff: {
    backgroundColor: "#eeeeee",
    borderRadius: 999,
    height: 34,
    width: 62
  },
  weatherCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e3e6eb",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18
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
  weatherCity: {
    color: "#697386",
    fontSize: 20,
    fontWeight: "700"
  },
  weatherMeta: {
    color: "#697386",
    fontSize: 16,
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
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center"
  },
  weekRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    marginBottom: 12
  },
  alarmAddButton: {
    alignItems: "center",
    backgroundColor: "#7cb87c",
    borderRadius: 12,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  alarmAddText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900"
  },
  alarmCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e3e6eb",
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 18
  },
  alarmDeleteButton: {
    alignItems: "center",
    backgroundColor: "#fdeaea",
    borderRadius: 16,
    flex: 1,
    paddingVertical: 14
  },
  alarmDeleteText: {
    color: "#e57373",
    fontSize: 16,
    fontWeight: "900"
  },
  alarmEmpty: {
    color: "#8b93a1",
    fontSize: 14,
    fontWeight: "700"
  },
  alarmFieldLabel: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4
  },
  alarmFieldRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  alarmHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  alarmIcon: {
    fontSize: 22
  },
  alarmLabelInput: {
    backgroundColor: "#f8fafc",
    borderColor: "#e3e6eb",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  alarmList: {
    gap: 10
  },
  alarmMeta: {
    color: "#8b93a1",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2
  },
  alarmRow: {
    alignItems: "center",
    backgroundColor: "#f6faf6",
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  alarmRowInfo: {
    flex: 1,
    gap: 2
  },
  alarmTime: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900"
  },
  alarmTimeInput: {
    backgroundColor: "#f8fafc",
    borderColor: "#e3e6eb",
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 18,
    fontWeight: "900",
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlign: "center",
    width: 110
  },
  alarmTimeOff: {
    color: "#a8b0bc"
  },
  alarmTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900"
  },
  alarmTitleWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  ringBanner: {
    alignItems: "center",
    backgroundColor: "#fff4f4",
    borderColor: "#f6caca",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14
  },
  ringClose: {
    alignItems: "center",
    backgroundColor: "#e57373",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  ringCloseText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900"
  },
  ringEmoji: {
    fontSize: 26
  },
  ringInfo: {
    flex: 1,
    gap: 2
  },
  ringMeta: {
    color: "#a86b6b",
    fontSize: 13,
    fontWeight: "700"
  },
  ringTitle: {
    color: "#b5453f",
    fontSize: 16,
    fontWeight: "900"
  },
  weekChip: {
    alignItems: "center",
    backgroundColor: "#f1f5f1",
    borderRadius: 999,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  weekChipActive: {
    backgroundColor: "#7cb87c"
  },
  weekChipText: {
    color: "#697386",
    fontSize: 15,
    fontWeight: "900"
  },
  weekChipTextActive: {
    color: "#ffffff"
  }
});
