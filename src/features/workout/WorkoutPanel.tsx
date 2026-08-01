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

const WORKOUT_PARTS: Array<{ icon: string; name: string }> = [
  { icon: "❤️", name: "胸" },
  { icon: "🦋", name: "背" },
  { icon: "🦅", name: "肩" },
  { icon: "💪", name: "手臂" },
  { icon: "🦵", name: "腿" },
  { icon: "🏃", name: "有氧" }
];
const intensityOptions: Array<{ label: string; value: WorkoutIntensity }> = [
  { label: "轻松", value: "easy" },
  { label: "适中", value: "moderate" },
  { label: "高强度", value: "hard" }
];

type ChartPeriod = "month" | "week" | "year";

const chartPeriodOptions: Array<{ label: string; value: ChartPeriod }> = [
  { label: "近7天", value: "week" },
  { label: "近一月", value: "month" },
  { label: "近一年", value: "year" }
];
const chartPeriodTitle: Record<ChartPeriod, string> = {
  month: "近一个月训练时长",
  week: "近7天训练时长",
  year: "近一年训练时长"
};
const titleInputWebProps = { id: "workout-title-input" } as object;
const durationInputWebProps = { id: "workout-duration-input" } as object;
const kcalInputWebProps = { id: "workout-kcal-input" } as object;

const toLocalIso = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const todayIso = () => toLocalIso(new Date());

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
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("week");

  const stats = useMemo(() => buildWorkoutStats(logs), [logs]);
  const chartBars = useMemo(() => buildPeriodBars(logs, chartPeriod), [chartPeriod, logs]);
  const chartTotal = useMemo(() => chartBars.reduce((sum, bar) => sum + bar.minutes, 0), [chartBars]);

  const persistLogs = (nextLogs: WorkoutLog[]) => {
    const sorted = sortWorkoutLogs(nextLogs);
    setLogs(sorted);
    saveLocalWorkouts(sorted, workoutStorage);
  };

  const togglePart = (part: string) => {
    setStatus("trained");
    setSelectedParts((current) => {
      return current.includes(part) ? current.filter((item) => item !== part) : [...current, part];
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
            setSelectedParts([]);
          }} style={[styles.segment, status === "rest" ? styles.segmentActive : null]}>
            <Text style={[styles.segmentText, status === "rest" ? styles.segmentTextActive : null]}>休息</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>训练部位</Text>
        <View style={styles.partGrid}>
          {WORKOUT_PARTS.map((part) => {
            const selected = selectedParts.includes(part.name);
            return (
              <Pressable key={part.name} accessibilityRole="button" accessibilityLabel={`选择${part.name}`} onPress={() => togglePart(part.name)} style={[styles.partButton, selected ? styles.partButtonActive : null]}>
                <Text style={styles.partIcon}>{part.icon}</Text>
                <Text style={[styles.partText, selected ? styles.partTextActive : null]}>{part.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.tripleRow}>
          <TextInput {...titleInputWebProps} nativeID="workout-title-input" onChange={makeTextInputChangeHandler(setTitle)} onChangeText={setTitle} placeholder="训练项目" style={[styles.input, styles.tripleInput]} value={title} />
          <TextInput {...durationInputWebProps} keyboardType="numeric" nativeID="workout-duration-input" onChange={makeTextInputChangeHandler(setDuration)} onChangeText={setDuration} placeholder="训练时长" style={[styles.input, styles.tripleInput]} value={duration} />
          <TextInput {...kcalInputWebProps} keyboardType="numeric" nativeID="workout-kcal-input" onChange={makeTextInputChangeHandler(setKcal)} onChangeText={setKcal} placeholder="消耗热量" style={[styles.input, styles.tripleInput]} value={kcal} />
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

        <View style={styles.doubleRow}>
          <TextInput onChange={makeTextInputChangeHandler(setFeeling)} onChangeText={setFeeling} placeholder="自我感受" style={[styles.input, styles.halfInput]} value={feeling} />
          <TextInput onChange={makeTextInputChangeHandler(setNotes)} onChangeText={setNotes} placeholder="备注" style={[styles.input, styles.halfInput]} value={notes} />
        </View>
        <Text style={styles.muted}>热量第一版为手动输入，不作为准确测量值。</Text>

        <Pressable accessibilityRole="button" accessibilityLabel="保存记录" nativeID="workout-save-button" onPress={saveWorkout} style={styles.saveButton}>
          <Text style={styles.saveText}>保存记录</Text>
        </Pressable>
        <Text nativeID="workout-feedback" style={styles.feedback}>{feedback}</Text>
      </View>

      <View style={styles.metricRow}>
        <Metric compact title="本周训练" unit="分钟" value={String(stats.weekMinutes)} />
        <Metric compact title="本周消耗" unit="千卡" value={String(stats.weekKcal)} />
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.chartIcon}>▥</Text>
            <Text style={styles.chartTitle}>{chartPeriodTitle[chartPeriod]}</Text>
          </View>
          <Text style={styles.chartTotal}>合计 {chartTotal} 分钟</Text>
        </View>
        <View style={styles.periodRow}>
          {chartPeriodOptions.map((option) => {
            const selected = chartPeriod === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityLabel={`查看${option.label}训练时长`}
                accessibilityRole="button"
                onPress={() => setChartPeriod(option.value)}
                style={[styles.periodChip, selected ? styles.periodChipActive : null]}
              >
                <Text style={[styles.periodChipText, selected ? styles.periodChipTextActive : null]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.chart, chartPeriod === "week" ? null : styles.chartDense]}>
          {chartBars.map((bar) => (
            <View key={bar.key} style={styles.barColumn}>
              <View style={[styles.barTrack, chartPeriod === "week" ? null : styles.barTrackDense]}>
                <View style={[styles.barFill, { height: `${bar.height}%` }]} />
              </View>
              <Text style={[styles.barLabel, chartPeriod === "year" ? styles.barLabelTiny : null]}>{bar.label}</Text>
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

function Metric({ compact = false, title, unit, value }: { compact?: boolean; title: string; unit: string; value: string }) {
  return (
    <View style={[styles.metric, compact ? styles.metricCompact : null]}>
      <Text style={[styles.metricTitle, compact ? styles.metricTitleCompact : null]}>{title}</Text>
      <Text style={[styles.metricValue, compact ? styles.metricValueCompact : null]}>
        {value}
        <Text style={[styles.metricUnit, compact ? styles.metricUnitCompact : null]}> {unit}</Text>
      </Text>
    </View>
  );
}

function buildWorkoutStats(logs: WorkoutLog[]) {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const thirtyDaysAgo = toLocalIso(shiftDate(now, -29));
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

function buildPeriodBars(logs: WorkoutLog[], period: ChartPeriod) {
  const byDate = new Map<string, number>();

  for (const log of logs) {
    byDate.set(log.sessionDate, (byDate.get(log.sessionDate) ?? 0) + (log.status === "trained" ? log.durationMinutes : 0));
  }

  const today = new Date();
  const buckets: Array<{ key: string; label: string; minutes: number }> = [];

  if (period === "week") {
    for (let index = 6; index >= 0; index -= 1) {
      const date = toLocalIso(shiftDate(today, -index));
      buckets.push({ key: date, label: date.slice(5).replace("-", "/"), minutes: byDate.get(date) ?? 0 });
    }
  } else if (period === "month") {
    for (let group = 5; group >= 0; group -= 1) {
      const start = shiftDate(today, -(group * 5 + 4));
      let minutes = 0;

      for (let offset = 0; offset < 5; offset += 1) {
        minutes += byDate.get(toLocalIso(shiftDate(start, offset))) ?? 0;
      }

      const startIso = toLocalIso(start);
      buckets.push({ key: startIso, label: startIso.slice(5).replace("-", "/"), minutes });
    }
  } else {
    for (let index = 11; index >= 0; index -= 1) {
      const month = new Date(today.getFullYear(), today.getMonth() - index, 1);
      const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
      let minutes = 0;

      for (const [date, value] of byDate) {
        if (date.startsWith(prefix)) {
          minutes += value;
        }
      }

      buckets.push({ key: prefix, label: String(month.getMonth() + 1), minutes });
    }
  }

  const maxMinutes = Math.max(10, ...buckets.map((bucket) => bucket.minutes));

  return buckets.map((bucket) => ({
    ...bucket,
    height: Math.max(bucket.minutes ? 8 : 0, Math.round((bucket.minutes / maxMinutes) * 100))
  }));
}

function countStreakDays(logs: WorkoutLog[]) {
  const trainedDates = new Set(logs.filter((log) => log.status === "trained").map((log) => log.sessionDate));
  let streak = 0;
  let cursor = new Date();

  while (trainedDates.has(toLocalIso(cursor))) {
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
    gap: 5
  },
  barFill: {
    backgroundColor: "#7cb87c",
    borderRadius: 8,
    bottom: 0,
    left: 0,
    minHeight: 0,
    position: "absolute",
    right: 0
  },
  barLabel: {
    color: "#697386",
    fontSize: 10,
    fontWeight: "700"
  },
  barLabelTiny: {
    fontSize: 9
  },
  barTrack: {
    backgroundColor: "#f4f7fb",
    borderColor: "#e6edf5",
    borderRadius: 6,
    borderWidth: 1,
    height: 88,
    overflow: "hidden",
    width: "70%"
  },
  barTrackDense: {
    borderRadius: 4,
    width: "84%"
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e3e8ef",
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 14
  },
  cardTitle: {
    color: "#111827",
    fontSize: 18,
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
    gap: 6,
    minHeight: 110,
    paddingTop: 2
  },
  chartCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e3e8ef",
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  chartDense: {
    gap: 3
  },
  chartHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  chartIcon: {
    color: "#7cb87c",
    fontSize: 16,
    fontWeight: "900"
  },
  chartTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900"
  },
  chartTotal: {
    color: "#7cb87c",
    fontSize: 12,
    fontWeight: "800"
  },
  periodChip: {
    backgroundColor: "#f4f7fb",
    borderColor: "#e6edf5",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  periodChipActive: {
    backgroundColor: "#e2f2e2",
    borderColor: "#7cb87c"
  },
  periodChipText: {
    color: "#697386",
    fontSize: 11,
    fontWeight: "800"
  },
  periodChipTextActive: {
    color: "#5a8a5a"
  },
  periodRow: {
    flexDirection: "row",
    gap: 6
  },
  chip: {
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  chipActive: {
    backgroundColor: "#e2f2e2",
    borderColor: "#7cb87c"
  },
  chipText: {
    color: "#697386",
    fontSize: 13,
    fontWeight: "800"
  },
  chipTextActive: {
    color: "#5a8a5a"
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
  tripleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  doubleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  input: {
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 12,
    borderWidth: 1,
    color: "#111827",
    flexGrow: 1,
    fontSize: 14,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  tripleInput: {
    flex: 1,
    minWidth: 70
  },
  halfInput: {
    flex: 1,
    minWidth: 100
  },
  logBadge: {
    alignItems: "center",
    backgroundColor: "#e2f2e2",
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  logBadgeText: {
    color: "#5a8a5a",
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
    backgroundColor: "#f0f7f0",
    borderColor: "#d8e8d8",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minWidth: 100,
    padding: 12
  },
  metricCompact: {
    borderRadius: 12,
    minWidth: 84,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metricTitle: {
    color: "#697386",
    fontSize: 16,
    fontWeight: "800"
  },
  metricTitleCompact: {
    fontSize: 12
  },
  metricUnit: {
    color: "#7cb87c",
    fontSize: 16
  },
  metricUnitCompact: {
    fontSize: 11
  },
  metricValue: {
    color: "#7cb87c",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 6
  },
  metricValueCompact: {
    fontSize: 18,
    marginTop: 2
  },
  muted: {
    color: "#697386",
    fontSize: 12,
    lineHeight: 18
  },
  partButton: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    maxWidth: "32%",
    minWidth: "28%",
    paddingVertical: 8
  },
  partButtonActive: {
    backgroundColor: "#e2f2e2",
    borderColor: "#7cb87c"
  },
  partGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-start"
  },
  partIcon: {
    fontSize: 18
  },
  partText: {
    color: "#697386",
    fontSize: 12,
    fontWeight: "800"
  },
  partTextActive: {
    color: "#5a8a5a"
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#7cb87c",
    borderRadius: 12,
    paddingVertical: 12
  },
  saveText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900"
  },
  sectionLabel: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900"
  },
  segment: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10
  },
  segmentActive: {
    backgroundColor: "#7cb87c",
    borderColor: "#7cb87c"
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  segmentText: {
    color: "#697386",
    fontSize: 14,
    fontWeight: "900"
  },
  segmentTextActive: {
    color: "#ffffff"
  },
  stack: {
    gap: 18
  }
});
