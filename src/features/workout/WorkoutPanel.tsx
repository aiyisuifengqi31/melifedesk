import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type NativeSyntheticEvent, type TextInputChangeEventData } from "react-native";

import { getSupabaseClient } from "@/auth/supabaseClient";
import { addWorkoutPart, createWorkoutSession, softDeleteWorkoutSession } from "@/features/workout/workoutRepository";
import {
  createWorkoutId,
  getDefaultWorkoutStorage,
  loadLocalWorkouts,
  saveLocalWorkouts,
  sortWorkoutLogs,
  type WorkoutIntensity,
  type WorkoutLog,
  type WorkoutStatus,
  type WorkoutStorage
} from "@/features/workout/workoutStorage";

type WorkoutPanelProps = {
  storage?: WorkoutStorage;
};

const workoutParts = ["胸", "背", "肩", "手臂", "核心", "腿", "臀", "有氧", "全身", "拉伸", "休息"];
const intensityOptions: Array<{ label: string; value: WorkoutIntensity }> = [
  { label: "轻松", value: "easy" },
  { label: "适中", value: "moderate" },
  { label: "高强度", value: "hard" }
];
const titleInputWebProps = { id: "workout-title-input" } as object;
const durationInputWebProps = { id: "workout-duration-input" } as object;
const kcalInputWebProps = { id: "workout-kcal-input" } as object;

const todayIso = () => new Date().toISOString().slice(0, 10);

export function WorkoutPanel({ storage }: WorkoutPanelProps) {
  const workoutStorage = useMemo(() => storage ?? getDefaultWorkoutStorage(), [storage]);
  const [logs, setLogs] = useState<WorkoutLog[]>(() => sortWorkoutLogs(loadLocalWorkouts(workoutStorage)));
  const [status, setStatus] = useState<WorkoutStatus>("trained");
  const [selectedParts, setSelectedParts] = useState<string[]>(["背"]);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("10");
  const [kcal, setKcal] = useState("200");
  const [intensity, setIntensity] = useState<WorkoutIntensity>("moderate");
  const [feeling, setFeeling] = useState("");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState("选择部位、填写时长和热量后保存训练记录。");

  const stats = useMemo(() => buildWorkoutStats(logs), [logs]);
  const sevenDays = useMemo(() => buildSevenDayBars(logs), [logs]);

  const persistLogs = (nextLogs: WorkoutLog[]) => {
    const sorted = sortWorkoutLogs(nextLogs);
    setLogs(sorted);
    saveLocalWorkouts(sorted, workoutStorage);
  };

  const togglePart = (part: string) => {
    if (part === "休息") {
      setStatus("rest");
      setSelectedParts(["休息"]);
      return;
    }

    setStatus("trained");
    setSelectedParts((current) => {
      const withoutRest = current.filter((item) => item !== "休息");
      return withoutRest.includes(part) ? withoutRest.filter((item) => item !== part) : [...withoutRest, part];
    });
  };

  const saveWorkout = async () => {
    const cleanTitle = (title || readWebInputValue("workout-title-input")).trim();
    const parts = status === "rest" ? ["休息"] : selectedParts.filter((part) => part !== "休息");
    const durationMinutes = toNonNegativeInt(readWebInputValue("workout-duration-input") || duration);
    const kcalValue = toNonNegativeInt(readWebInputValue("workout-kcal-input") || kcal);

    if (status === "trained" && parts.length === 0) {
      setFeedback("请至少选择一个训练部位。");
      return;
    }

    if (status === "trained" && durationMinutes <= 0) {
      setFeedback("请填写大于 0 的训练时长。");
      return;
    }

    const log: WorkoutLog = {
      createTime: new Date().toISOString(),
      durationMinutes: status === "rest" ? 0 : durationMinutes,
      feeling: feeling.trim(),
      id: createWorkoutId(),
      intensity,
      kcal: status === "rest" ? 0 : kcalValue,
      kcalSource: "manual",
      notes: notes.trim(),
      parts,
      sessionDate: todayIso(),
      status,
      title: status === "rest" ? "休息" : cleanTitle || parts.join("、")
    };

    const nextLogs = [log, ...logs];
    persistLogs(nextLogs);
    setFeedback(status === "rest" ? "今天已记录为休息。" : "训练记录已保存。");
    setTitle("");
    setFeeling("");
    setNotes("");

    const client = getSupabaseClient();
    if (!client) {
      return;
    }

    const { data: userData } = await client.auth.getUser();
    if (!userData.user) {
      return;
    }

    const { data, error } = await createWorkoutSession(client, userData.user.id, {
      durationMinutes: log.durationMinutes,
      feeling: log.feeling || null,
      intensity: log.intensity,
      kcal: log.kcal,
      kcalSource: "manual",
      notes: log.notes || null,
      sessionDate: log.sessionDate,
      title: log.title,
      visibility: "private"
    });

    if (error || !data) {
      setFeedback("记录已保存在本地，远程同步稍后可重试。");
      return;
    }

    await Promise.all(log.parts.map((part) => addWorkoutPart(client, (data as { id: string }).id, part)));
    persistLogs(nextLogs.map((item) => (item.id === log.id ? { ...item, remoteId: (data as { id: string }).id } : item)));
  };

  const deleteWorkout = async (log: WorkoutLog) => {
    persistLogs(logs.filter((item) => item.id !== log.id));
    setFeedback("训练记录已删除。");

    const client = getSupabaseClient();
    if (client && log.remoteId) {
      await softDeleteWorkoutSession(client, log.remoteId);
    }
  };

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <View style={styles.segmentRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="今天训练了" onPress={() => setStatus("trained")} style={[styles.segment, status === "trained" ? styles.segmentActive : null]}>
            <Text style={[styles.segmentText, status === "trained" ? styles.segmentTextActive : null]}>训练</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="今天休息" onPress={() => {
            setStatus("rest");
            setSelectedParts(["休息"]);
          }} style={[styles.segment, status === "rest" ? styles.segmentActive : null]}>
            <Text style={[styles.segmentText, status === "rest" ? styles.segmentTextActive : null]}>休息</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>训练部位</Text>
        <View style={styles.partGrid}>
          {workoutParts.map((part) => {
            const selected = selectedParts.includes(part);
            return (
              <Pressable key={part} accessibilityRole="button" accessibilityLabel={`选择${part}`} onPress={() => togglePart(part)} style={[styles.partButton, selected ? styles.partButtonActive : null]}>
                <Text style={[styles.partText, selected ? styles.partTextActive : null]}>{part}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.formGrid}>
          <TextInput {...titleInputWebProps} nativeID="workout-title-input" onChange={makeTextInputChangeHandler(setTitle)} onChangeText={setTitle} placeholder="训练项目" style={styles.input} value={title} />
          <TextInput {...durationInputWebProps} keyboardType="numeric" nativeID="workout-duration-input" onChange={makeTextInputChangeHandler(setDuration)} onChangeText={setDuration} placeholder="训练时长" style={styles.input} value={duration} />
          <TextInput {...kcalInputWebProps} keyboardType="numeric" nativeID="workout-kcal-input" onChange={makeTextInputChangeHandler(setKcal)} onChangeText={setKcal} placeholder="消耗热量" style={styles.input} value={kcal} />
        </View>

        <Text style={styles.sectionLabel}>训练强度</Text>
        <View style={styles.segmentRow}>
          {intensityOptions.map((option) => {
            const selected = intensity === option.value;
            return (
              <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label} onPress={() => setIntensity(option.value)} style={[styles.chip, selected ? styles.chipActive : null]}>
                <Text style={[styles.chipText, selected ? styles.chipTextActive : null]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput onChange={makeTextInputChangeHandler(setFeeling)} onChangeText={setFeeling} placeholder="自我感受" style={styles.input} value={feeling} />
        <TextInput onChange={makeTextInputChangeHandler(setNotes)} onChangeText={setNotes} placeholder="备注" style={styles.input} value={notes} />
        <Text style={styles.muted}>热量第一版为手动输入，不作为准确测量值。</Text>

        <Pressable accessibilityRole="button" accessibilityLabel="保存记录" nativeID="workout-save-button" onPress={saveWorkout} style={styles.saveButton}>
          <Text style={styles.saveText}>保存记录</Text>
        </Pressable>
        <Text nativeID="workout-feedback" style={styles.feedback}>{feedback}</Text>
      </View>

      <View style={styles.metricRow}>
        <Metric title="本周训练" unit="分钟" value={String(stats.weekMinutes)} />
        <Metric title="本周消耗" unit="千卡" value={String(stats.weekKcal)} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.chartIcon}>▥</Text>
          <Text style={styles.cardTitle}>近7天训练时长</Text>
        </View>
        <View style={styles.chart}>
          {sevenDays.map((day) => (
            <View key={day.date} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${day.height}%` }]} />
              </View>
              <Text style={styles.barLabel}>{day.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>训练日志</Text>
        {logs.length === 0 ? (
          <Text style={styles.empty}>还没有训练记录，保存一条后会出现在这里。</Text>
        ) : (
          logs.map((log) => (
            <View key={log.id} style={styles.logItem}>
              <View style={styles.logBadge}>
                <Text style={styles.logBadgeText}>{log.parts[0] ?? "训"}</Text>
              </View>
              <View style={styles.logBody}>
                <Text style={styles.logDate}>{formatChineseDate(log.sessionDate)}</Text>
                <Text style={styles.logTitle}>{log.title}</Text>
                <Text style={styles.logMeta}>{log.durationMinutes}分钟 · {log.kcal}千卡 · {intensityLabel(log.intensity)}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`删除训练记录：${log.title}`} onPress={() => deleteWorkout(log)} style={styles.deleteButton}>
                <Text style={styles.deleteText}>删除</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <View style={styles.metricRow}>
        <Metric title="最近30天" unit="次" value={String(stats.monthCount)} />
        <Metric title="连续训练" unit="天" value={String(stats.streakDays)} />
        <Metric title="高频部位" unit="" value={stats.topPart} />
      </View>
    </View>
  );
}

function Metric({ title, unit, value }: { title: string; unit: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}<Text style={styles.metricUnit}> {unit}</Text></Text>
    </View>
  );
}

function buildWorkoutStats(logs: WorkoutLog[]) {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const thirtyDaysAgo = shiftDate(now, -29).toISOString().slice(0, 10);
  const weekLogs = logs.filter((log) => new Date(`${log.sessionDate}T00:00:00`).getTime() >= weekStart.getTime() && log.status === "trained");
  const monthLogs = logs.filter((log) => log.sessionDate >= thirtyDaysAgo && log.status === "trained");
  const partCounts = new Map<string, number>();

  for (const log of monthLogs) {
    for (const part of log.parts.filter((item) => item !== "休息")) {
      partCounts.set(part, (partCounts.get(part) ?? 0) + 1);
    }
  }

  const topPart = [...partCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "暂无";

  return {
    monthCount: monthLogs.length,
    streakDays: countStreakDays(logs),
    topPart,
    weekKcal: weekLogs.reduce((sum, log) => sum + log.kcal, 0),
    weekMinutes: weekLogs.reduce((sum, log) => sum + log.durationMinutes, 0)
  };
}

function buildSevenDayBars(logs: WorkoutLog[]) {
  const days = Array.from({ length: 7 }, (_, index) => shiftDate(new Date(), index - 6));
  const byDate = new Map<string, number>();

  for (const log of logs) {
    byDate.set(log.sessionDate, (byDate.get(log.sessionDate) ?? 0) + (log.status === "trained" ? log.durationMinutes : 0));
  }

  const maxMinutes = Math.max(10, ...days.map((day) => byDate.get(day.toISOString().slice(0, 10)) ?? 0));

  return days.map((day) => {
    const date = day.toISOString().slice(0, 10);
    const minutes = byDate.get(date) ?? 0;
    return {
      date,
      height: Math.max(minutes ? 10 : 0, Math.round((minutes / maxMinutes) * 100)),
      label: date.slice(5)
    };
  });
}

function countStreakDays(logs: WorkoutLog[]) {
  const trainedDates = new Set(logs.filter((log) => log.status === "trained").map((log) => log.sessionDate));
  let streak = 0;
  let cursor = new Date();

  while (trainedDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }

  return streak;
}

function formatChineseDate(dateText: string) {
  const [year, month, day] = dateText.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function intensityLabel(value: WorkoutIntensity) {
  return intensityOptions.find((option) => option.value === value)?.label ?? "适中";
}

function shiftDate(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - day + 1);
  return next;
}

function toNonNegativeInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function readWebInputValue(id: string) {
  if (typeof document === "undefined") {
    return "";
  }

  const input = document.getElementById(id) as HTMLInputElement | null;
  return input?.value ?? "";
}

function makeTextInputChangeHandler(setValue: (value: string) => void) {
  return (event: NativeSyntheticEvent<TextInputChangeEventData>) => {
    const webEvent = event as unknown as { currentTarget?: { value?: string }; target?: { value?: string } };
    const nextValue = event.nativeEvent.text ?? webEvent.currentTarget?.value ?? webEvent.target?.value;
    if (typeof nextValue === "string") {
      setValue(nextValue);
    }
  };
}

const styles = StyleSheet.create({
  barColumn: {
    alignItems: "center",
    flex: 1,
    gap: 8
  },
  barFill: {
    backgroundColor: "#1fa8e2",
    borderRadius: 8,
    bottom: 0,
    left: 0,
    minHeight: 0,
    position: "absolute",
    right: 0
  },
  barLabel: {
    color: "#697386",
    fontSize: 12,
    fontWeight: "700"
  },
  barTrack: {
    backgroundColor: "#f4f7fb",
    borderColor: "#e6edf5",
    borderRadius: 8,
    borderWidth: 1,
    height: 160,
    overflow: "hidden",
    width: "68%"
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e3e8ef",
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 18
  },
  cardTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900"
  },
  cardTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  chart: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 10,
    minHeight: 200,
    paddingTop: 8
  },
  chartIcon: {
    color: "#1fa8e2",
    fontSize: 24,
    fontWeight: "900"
  },
  chip: {
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  chipActive: {
    backgroundColor: "#dff3ff",
    borderColor: "#1fa8e2"
  },
  chipText: {
    color: "#697386",
    fontWeight: "800"
  },
  chipTextActive: {
    color: "#0f79ad"
  },
  deleteButton: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  deleteText: {
    color: "#697386",
    fontWeight: "800"
  },
  empty: {
    color: "#697386",
    fontSize: 15,
    lineHeight: 22
  },
  feedback: {
    color: "#697386",
    fontSize: 13,
    fontWeight: "800"
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  input: {
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 14,
    borderWidth: 1,
    color: "#111827",
    flexGrow: 1,
    fontSize: 16,
    minWidth: 150,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  logBadge: {
    alignItems: "center",
    backgroundColor: "#dff3ff",
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  logBadgeText: {
    color: "#0f79ad",
    fontSize: 17,
    fontWeight: "900"
  },
  logBody: {
    flex: 1,
    gap: 4
  },
  logDate: {
    color: "#697386",
    fontSize: 14,
    fontWeight: "700"
  },
  logItem: {
    alignItems: "center",
    borderColor: "#e3e8ef",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 12
  },
  logMeta: {
    color: "#697386",
    fontSize: 14,
    fontWeight: "700"
  },
  logTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900"
  },
  metric: {
    backgroundColor: "#eaf6ff",
    borderColor: "#d7eaf7",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    minWidth: 160,
    padding: 18
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14
  },
  metricTitle: {
    color: "#697386",
    fontSize: 16,
    fontWeight: "800"
  },
  metricUnit: {
    color: "#1fa8e2",
    fontSize: 16
  },
  metricValue: {
    color: "#1fa8e2",
    fontSize: 36,
    fontWeight: "900",
    marginTop: 8
  },
  muted: {
    color: "#697386",
    fontSize: 13,
    lineHeight: 20
  },
  partButton: {
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  partButtonActive: {
    backgroundColor: "#dff3ff",
    borderColor: "#1fa8e2"
  },
  partGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9
  },
  partText: {
    color: "#697386",
    fontWeight: "800"
  },
  partTextActive: {
    color: "#0f79ad"
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#1fa8e2",
    borderRadius: 14,
    paddingVertical: 14
  },
  saveText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900"
  },
  sectionLabel: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900"
  },
  segment: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12
  },
  segmentActive: {
    backgroundColor: "#1fa8e2",
    borderColor: "#1fa8e2"
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  segmentText: {
    color: "#697386",
    fontSize: 16,
    fontWeight: "900"
  },
  segmentTextActive: {
    color: "#ffffff"
  },
  stack: {
    gap: 18
  }
});
