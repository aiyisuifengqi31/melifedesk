import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { createPortal } from "react-dom";

import { getSupabaseClient } from "@/auth/supabaseClient";
import { getCurrentCoupleId } from "@/auth/partnership";
import { PuppyIllustration } from "@/shared/ui/PuppyIllustration";
import { CollapsibleSectionFooter, sortByNewest, useCollapsibleList } from "@/shared/ui/CollapsibleList";
import {
  addWorkoutPart,
  createWorkoutSession,
  softDeleteWorkoutSession
} from "@/features/workout/workoutRepository";
import {
  createWorkoutId,
  getDefaultWorkoutStorage,
  hydrateWorkoutsFromCloud,
  loadLocalWorkouts,
  saveLocalWorkouts,
  sortWorkoutLogs,
  type WorkoutLog,
  type WorkoutStorage
} from "@/features/workout/workoutStorage";

type WorkoutPanelProps = {
  storage?: WorkoutStorage;
};

type WorkoutPopoverKind = "duration" | "log-filter" | "log-menu" | "part";
type LogFilter = "all" | "currentMonth" | "lastMonth";
type AnchorRect = { height: number; left: number; top: number; width: number };

const WORKOUT_PARTS: Array<{ icon: string; name: string }> = [
  { icon: "❤️", name: "胸" },
  { icon: "🦋", name: "背" },
  { icon: "🦅", name: "肩" },
  { icon: "💪", name: "手臂" },
  { icon: "🦵", name: "腿" },
  { icon: "🏃", name: "有氧" }
];
type ChartPeriod = "month" | "week" | "year";

const chartPeriodOptions: Array<{ label: string; value: ChartPeriod }> = [
  { label: "近7天", value: "week" },
  { label: "近一月", value: "month" },
  { label: "近一年", value: "year" }
];
const durationOptions = Array.from({ length: 36 }, (_, index) => (index + 1) * 5);
const logFilterOptions: Array<{ label: string; value: LogFilter }> = [
  { label: "全部", value: "all" },
  { label: "本月", value: "currentMonth" },
  { label: "上月", value: "lastMonth" }
];

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
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(40);
  const [feedback, setFeedback] = useState("");
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("week");
  const [popover, setPopover] = useState<{ kind: WorkoutPopoverKind; logId?: string; rect: AnchorRect } | null>(null);
  const [logFilter, setLogFilter] = useState<LogFilter>("all");
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const localDirtyRef = useRef(false);

  const stats = useMemo(() => buildWorkoutStats(logs), [logs]);
  const chartBars = useMemo(() => buildPeriodBars(logs, chartPeriod), [chartPeriod, logs]);
  const chartTotal = useMemo(() => chartBars.reduce((sum, bar) => sum + bar.minutes, 0), [chartBars]);
  const sortedLogs = useMemo(() => filterWorkoutLogs(sortByNewest(logs, (log) => [log.sessionDate, log.createTime]), logFilter), [logFilter, logs]);
  const logList = useCollapsibleList(sortedLogs, 5);
  const todayKey = todayIso();
  const todayLogs = useMemo(
    () => logs.filter((log) => log.sessionDate === todayKey && log.status === "trained"),
    [logs, todayKey]
  );

  useEffect(() => {
    let cancelled = false;
    void hydrateWorkoutsFromCloud(workoutStorage).then((next) => {
      if (!cancelled && !localDirtyRef.current) {
        setLogs(sortWorkoutLogs(next));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [workoutStorage]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = globalThis.setTimeout(() => setFeedback(""), 2200);
    return () => globalThis.clearTimeout(timer);
  }, [feedback]);

  const persistLogs = (nextLogs: WorkoutLog[]) => {
    localDirtyRef.current = true;
    const sorted = sortWorkoutLogs(nextLogs);
    setLogs(sorted);
    saveLocalWorkouts(sorted, workoutStorage);
  };

  const openPopover = (kind: WorkoutPopoverKind, event: unknown, logId?: string) => {
    setPopover({ kind, logId, rect: getAnchorRect(event) });
  };

  const closePopover = () => setPopover(null);

  const editWorkout = (log: WorkoutLog) => {
    setSelectedPart(log.parts[0] ?? null);
    setDurationMinutes(log.durationMinutes || 40);
    setEditingLogId(log.id);
    closePopover();
    setFeedback("正在编辑这条训练记录。");
  };

  const saveWorkout = async () => {
    if (!selectedPart) {
      setFeedback("请先选择训练部位。");
      return;
    }

    if (durationMinutes <= 0) {
      setFeedback("请选择训练时长。");
      return;
    }

    const log: WorkoutLog = {
      createTime: new Date().toISOString(),
      durationMinutes,
      id: createWorkoutId(),
      intensity: "moderate",
      kcal: 0,
      kcalSource: "manual",
      parts: [selectedPart],
      sessionDate: todayIso(),
      status: "trained",
      title: selectedPart
    };

    const nextLogs = editingLogId
      ? logs.map((item) => (item.id === editingLogId ? { ...item, durationMinutes, parts: [selectedPart], title: selectedPart } : item))
      : [log, ...logs];
    persistLogs(nextLogs);
    setFeedback(`✓ 已记录：${selectedPart} · ${durationMinutes}分钟`);
    if (editingLogId) {
      setEditingLogId(null);
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      return;
    }

    const { data: userData } = await client.auth.getUser();
    if (!userData.user) {
      return;
    }

    const userId = userData.user.id;
    // When the creator currently has an active partner, mark the session shared
    // (couple_read) and tag it with the active couple as a historical marker.
    // The active partner can READ it (RLS); only the owner can edit/delete.
    const activeCoupleId = await getCurrentCoupleId(client, userId);
    const isShared = Boolean(activeCoupleId);

    const { data, error } = await createWorkoutSession(client, userId, {
      coupleId: activeCoupleId,
      durationMinutes: log.durationMinutes,
      intensity: log.intensity,
      kcal: log.kcal,
      kcalSource: "manual",
      sessionDate: log.sessionDate,
      title: log.title,
      visibility: isShared ? "couple_read" : "private"
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
    closePopover();

    const client = getSupabaseClient();
    if (client && log.remoteId) {
      await softDeleteWorkoutSession(client, log.remoteId);
    }
  };

  return (
    <View style={styles.stack}>
      <View style={styles.todayStatusRow}>
        <View style={[styles.todayStatusDot, todayLogs.length > 0 ? styles.todayStatusDotTrained : styles.todayStatusDotRest]} />
        <Text style={styles.todayStatusText}>{formatTodayStatus(todayLogs)}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.todayStatusRow}>
          <Text style={styles.cardTitle}>记录训练</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="选择训练部位" onPress={(event) => openPopover("part", event)} style={styles.selectButton}>
          <Text style={styles.selectButtonText}>{selectedPart ? `${getWorkoutPartIcon(selectedPart)} ${selectedPart}` : "选择训练部位"}</Text>
          <Text style={styles.selectChevron}>▼</Text>
        </Pressable>
        <View style={styles.recordActionRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="选择训练时长" onPress={(event) => openPopover("duration", event)} style={styles.durationSelect}>
            <Text style={styles.selectButtonText}>{durationMinutes}分钟</Text>
            <Text style={styles.selectChevron}>▼</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="保存记录" nativeID="workout-save-button" onPress={saveWorkout} style={styles.saveButton}>
            <Text style={styles.saveText}>{editingLogId ? "更新记录" : "保存记录"}</Text>
          </Pressable>
        </View>
        {feedback ? <Text nativeID="workout-feedback" style={styles.feedback}>{feedback}</Text> : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>本周训练</Text>
          <Text style={styles.weekRange}>{stats.weekRangeLabel}</Text>
        </View>
        <View style={styles.weekMetricRow}>
          <View>
            <Text style={styles.weekMetricValue}>{stats.weekCount} 次</Text>
            <Text style={styles.weekMetricLabel}>训练次数</Text>
          </View>
          <View>
            <Text style={styles.weekMetricValue}>{stats.weekMinutes} 分钟</Text>
            <Text style={styles.weekMetricLabel}>总时长</Text>
          </View>
        </View>
        {stats.weekPartCounts.length > 0 ? (
          <View style={styles.partStatRow}>
            {stats.weekPartCounts.map((item) => (
              <View key={item.part} style={styles.partStatChip}>
                <Text style={styles.partStatText}>{item.part} ×{item.count}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.chartTitle}>训练趋势</Text>
          </View>
          <Text style={styles.chartTotal}>本周期合计 {chartTotal}分钟</Text>
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
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>训练日志</Text>
          <View style={styles.logHeaderActions}>
            <Text style={styles.logCount}>{logList.total}条</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="筛选训练日志" onPress={(event) => openPopover("log-filter", event)} style={styles.logFilterButton}>
              <Text style={styles.logFilterText}>{getLogFilterLabel(logFilter)}▼</Text>
            </Pressable>
          </View>
        </View>
        {logs.length === 0 ? (
          <View style={styles.emptyBox}>
            <PuppyIllustration color="#9cc39c" scene="generic" size={78} />
            <Text style={styles.empty}>还没有训练记录，保存一条后会出现在这里。</Text>
          </View>
        ) : (
          <>
          {logList.visibleItems.map((log) => (
            <View key={log.id} style={styles.logItem}>
              <Text style={styles.logMain}>{getWorkoutPartIcon(log.parts[0])} {log.title}</Text>
              <Text style={styles.logDate}>{formatShortDate(log.sessionDate)}</Text>
              <Text style={styles.logDuration}>{log.durationMinutes}分钟</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`打开训练记录菜单：${log.title}`} onPress={(event) => openPopover("log-menu", event, log.id)} style={styles.logMenuButton}>
                <Text style={styles.moreText}>•••</Text>
              </Pressable>
            </View>
          ))}
          <CollapsibleSectionFooter
            expanded={logList.expanded}
            hiddenCount={logList.hiddenCount}
            name="训练记录"
            onPress={logList.toggle}
            testID="workout-log-show-more"
            visible={logList.canExpand}
          />
          </>
        )}
      </View>

      {popover ? (
        <WorkoutPopover
          durationMinutes={durationMinutes}
          kind={popover.kind}
          log={popover.logId ? logs.find((item) => item.id === popover.logId) : undefined}
          logFilter={logFilter}
          onClose={closePopover}
          onDelete={deleteWorkout}
          onDurationChange={setDurationMinutes}
          onEdit={editWorkout}
          onLogFilterChange={setLogFilter}
          onPartChange={setSelectedPart}
          rect={popover.rect}
          selectedPart={selectedPart}
        />
      ) : null}
    </View>
  );
}

function buildWorkoutStats(logs: WorkoutLog[]) {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = shiftDate(weekStart, 6);
  weekEnd.setHours(23, 59, 59, 999);
  const weekStartIso = toLocalIso(weekStart);
  const weekEndIso = toLocalIso(weekEnd);
  const weekLogs = logs.filter((log) => log.sessionDate >= weekStartIso && log.sessionDate <= weekEndIso && log.status === "trained");
  const partCounts = new Map<string, number>();

  for (const log of weekLogs) {
    for (const part of log.parts.filter((item) => item !== "休息")) {
      partCounts.set(part, (partCounts.get(part) ?? 0) + 1);
    }
  }

  return {
    weekCount: weekLogs.length,
    weekMinutes: weekLogs.reduce((sum, log) => sum + log.durationMinutes, 0),
    weekPartCounts: [...partCounts.entries()].map(([part, count]) => ({ part, count })).sort((left, right) => right.count - left.count),
    weekRangeLabel: `${formatMonthDay(weekStartIso)} - ${formatMonthDay(weekEndIso)}`
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

function formatShortDate(dateText: string) {
  const [, month, day] = dateText.split("-");
  return `${month}/${day}`;
}

function formatMonthDay(dateText: string) {
  const [, month, day] = dateText.split("-");
  return `${Number(month)}.${Number(day)}`;
}

function formatTodayStatus(todayLogs: WorkoutLog[]) {
  if (todayLogs.length === 0) return "今天休息 · 未记录训练";
  const totalMinutes = todayLogs.reduce((sum, log) => sum + log.durationMinutes, 0);
  if (todayLogs.length === 1) {
    const log = todayLogs[0];
    return `今天已训练 · ${log.parts[0] ?? log.title} · ${log.durationMinutes}分钟`;
  }
  return `今天已训练 · ${todayLogs.length}次 · 共${totalMinutes}分钟`;
}

function getWorkoutPartIcon(part?: string | null) {
  return WORKOUT_PARTS.find((item) => item.name === part)?.icon ?? "🏋️";
}

function getLogFilterLabel(filter: LogFilter) {
  return logFilterOptions.find((item) => item.value === filter)?.label ?? "全部";
}

function filterWorkoutLogs(logs: WorkoutLog[], filter: LogFilter) {
  if (filter === "all") return logs;
  const now = new Date();
  const target = filter === "currentMonth" ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prefix = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
  return logs.filter((log) => log.sessionDate.startsWith(prefix));
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

function getAnchorRect(event: unknown): AnchorRect {
  const target = (event as { currentTarget?: unknown })?.currentTarget as { getBoundingClientRect?: () => DOMRect } | undefined;
  if (target && typeof target.getBoundingClientRect === "function") {
    const rect = target.getBoundingClientRect();
    return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
  }
  return { height: 42, left: 120, top: 180, width: 180 };
}

function getPopoverStyle(rect: AnchorRect, estimatedHeight = 220) {
  const padding = 12;
  const viewportHeight = typeof window === "undefined" ? 760 : window.innerHeight;
  const viewportWidth = typeof window === "undefined" ? 390 : window.innerWidth;
  const topBelow = rect.top + rect.height + 8;
  const top = topBelow + estimatedHeight > viewportHeight - padding ? Math.max(padding, rect.top - estimatedHeight - 8) : topBelow;
  const minWidth = Math.max(150, rect.width);
  const maxLeft = Math.max(padding, viewportWidth - minWidth - padding);
  return { left: Math.min(Math.max(padding, rect.left), maxLeft), minWidth, top };
}

function shouldUsePortal() {
  return Platform.OS === "web" && typeof document !== "undefined" && Boolean(document.body) && (typeof process === "undefined" || process.env.NODE_ENV !== "test");
}

function WorkoutPopover({
  durationMinutes,
  kind,
  log,
  logFilter,
  onClose,
  onDelete,
  onDurationChange,
  onEdit,
  onLogFilterChange,
  onPartChange,
  rect,
  selectedPart
}: {
  durationMinutes: number;
  kind: WorkoutPopoverKind;
  log?: WorkoutLog;
  logFilter: LogFilter;
  onClose: () => void;
  onDelete: (log: WorkoutLog) => void;
  onDurationChange: (value: number) => void;
  onEdit: (log: WorkoutLog) => void;
  onLogFilterChange: (value: LogFilter) => void;
  onPartChange: (value: string) => void;
  rect: AnchorRect;
  selectedPart: string | null;
}) {
  const menu = (
    <Pressable accessibilityLabel="关闭运动选择菜单" onPress={onClose} style={styles.popoverBackdrop} testID="workout-popover-dismiss">
      <View onStartShouldSetResponder={() => true} style={[styles.popoverCard, getPopoverStyle(rect, kind === "duration" ? 260 : 220)]} testID="workout-popover">
        {kind === "part" ? WORKOUT_PARTS.map((part) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`选择训练部位：${part.name}`}
            key={part.name}
            onPress={() => { onPartChange(part.name); onClose(); }}
            style={[styles.popoverOption, selectedPart === part.name ? styles.popoverOptionActive : null]}
          >
            <Text style={styles.popoverOptionText}>{part.icon} {part.name}</Text>
          </Pressable>
        )) : null}
        {kind === "duration" ? (
          <ScrollView style={styles.durationWheel}>
            {durationOptions.map((value) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`选择训练时长：${value}分钟`}
                key={value}
                onPress={() => { onDurationChange(value); onClose(); }}
                style={[styles.durationOption, durationMinutes === value ? styles.durationOptionActive : null]}
              >
                <Text style={[styles.durationOptionText, durationMinutes === value ? styles.durationOptionTextActive : null]}>{value} 分钟</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {kind === "log-filter" ? logFilterOptions.map((option) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`筛选训练日志：${option.label}`}
            key={option.value}
            onPress={() => { onLogFilterChange(option.value); onClose(); }}
            style={[styles.popoverOption, logFilter === option.value ? styles.popoverOptionActive : null]}
          >
            <Text style={styles.popoverOptionText}>{option.label}</Text>
          </Pressable>
        )) : null}
        {kind === "log-menu" && log ? (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel={`编辑训练记录：${log.title}`} onPress={() => onEdit(log)} style={styles.popoverOption}>
              <Text style={styles.popoverOptionText}>编辑</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`删除训练记录：${log.title}`}
              onPress={() => {
                if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm("确认删除这条训练记录吗？")) return;
                onDelete(log);
              }}
              style={styles.popoverOption}
            >
              <Text style={[styles.popoverOptionText, styles.popoverDeleteText]}>删除</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </Pressable>
  );
  if (shouldUsePortal()) return createPortal(menu, document.body);
  return menu;
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
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "#e6ebf2",
    borderRadius: 20,
    borderWidth: 1,
    elevation: 2,
    gap: 12,
    overflow: "hidden",
    padding: 14,
    position: "relative",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12
  },
  pageWatermark: {
    bottom: -12,
    opacity: 0.05,
    position: "absolute",
    right: 4,
    top: -12
  },
  emptyBox: {
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    minHeight: 132,
    paddingVertical: 6
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
  cardTitleStickerRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between"
  },
  cardHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
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
  durationOption: {
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 9
  },
  durationOptionActive: {
    backgroundColor: "#e2f2e2"
  },
  durationOptionText: {
    color: "#697386",
    fontSize: 15,
    fontWeight: "800"
  },
  durationOptionTextActive: {
    color: "#5a8a5a",
    fontSize: 17,
    fontWeight: "900"
  },
  durationSelect: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 10
  },
  durationWheel: {
    maxHeight: 240
  },
  empty: {
    color: "#697386",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center"
  },
  feedback: {
    color: "#5a8a5a",
    fontSize: 13,
    fontWeight: "800"
  },
  fieldHint: {
    color: "#697386",
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center"
  },
  fieldHintRow: {
    flexDirection: "row",
    gap: 8
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
  inputLabel: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "900"
  },
  inputLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  inputUnit: {
    color: "#697386",
    fontSize: 11,
    fontWeight: "700"
  },
  labeledInput: {
    flex: 1,
    gap: 5,
    minWidth: 90
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
    height: 44,
    justifyContent: "center",
    width: 44
  },
  logBadgeText: {
    color: "#5a8a5a",
    fontSize: 14,
    fontWeight: "900"
  },
  logCount: {
    color: "#697386",
    fontSize: 12,
    fontWeight: "800"
  },
  logBody: {
    flex: 1,
    gap: 4
  },
  logDate: {
    color: "#697386",
    fontSize: 12,
    fontWeight: "800"
  },
  logDuration: {
    color: "#5a8a5a",
    fontSize: 13,
    fontWeight: "900",
    minWidth: 50,
    textAlign: "right"
  },
  logFilterButton: {
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  logFilterText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "900"
  },
  logHeaderActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  logItem: {
    alignItems: "center",
    borderColor: "#e3e8ef",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  logMain: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
    flex: 1,
    lineHeight: 20
  },
  logMenuButton: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 32,
    minWidth: 32
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
  moreText: {
    color: "#697386",
    fontSize: 16,
    fontWeight: "900"
  },
  partButton: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    flex: 1,
    gap: 6,
    maxWidth: "32%",
    minWidth: "28%",
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 8,
    paddingVertical: 6
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
    fontSize: 15,
    lineHeight: 18
  },
  partText: {
    color: "#697386",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16
  },
  partTextActive: {
    color: "#5a8a5a"
  },
  popoverBackdrop: {
    bottom: 0,
    left: 0,
    position: Platform.OS === "web" ? ("fixed" as "absolute") : "absolute",
    right: 0,
    top: 0,
    zIndex: 9998
  },
  popoverCard: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e8d8",
    borderRadius: 16,
    borderWidth: 1,
    elevation: 18,
    gap: 4,
    maxHeight: 280,
    overflow: "hidden",
    padding: 6,
    position: Platform.OS === "web" ? ("fixed" as "absolute") : "absolute",
    shadowColor: "#7cb87c",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    zIndex: 9999
  },
  popoverDeleteText: {
    color: "#ef4444"
  },
  popoverOption: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  popoverOptionActive: {
    backgroundColor: "#e2f2e2"
  },
  popoverOptionText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "900"
  },
  recordActionRow: {
    flexDirection: "row",
    gap: 10
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#7cb87c",
    borderRadius: 12,
    flex: 1.2,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10
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
  selectButton: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12
  },
  selectButtonText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900"
  },
  selectChevron: {
    color: "#697386",
    fontSize: 10,
    fontWeight: "900"
  },
  todayStatusRow: {
    alignItems: "center",
    backgroundColor: "#f7faf7",
    borderColor: "#e3ebe3",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  todayStatusDot: {
    borderRadius: 999,
    height: 10,
    width: 10
  },
  todayStatusDotTrained: {
    backgroundColor: "#7cb87c"
  },
  todayStatusDotRest: {
    backgroundColor: "#c9b27c"
  },
  todayStatusText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800"
  },
  durationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  durationInputWrap: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8
  },
  durationInput: {
    flex: 1
  },
  durationUnit: {
    color: "#697386",
    fontSize: 14,
    fontWeight: "800"
  },
  statLine: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900"
  },
  weekMetricLabel: {
    color: "#697386",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2
  },
  weekMetricRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  weekMetricValue: {
    color: "#5a8a5a",
    fontSize: 22,
    fontWeight: "900"
  },
  weekRange: {
    color: "#697386",
    fontSize: 12,
    fontWeight: "900"
  },
  partStatRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  partStatChip: {
    backgroundColor: "#e2f2e2",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  partStatText: {
    color: "#5a8a5a",
    fontSize: 13,
    fontWeight: "900"
  },
  stack: {
    gap: 18
  }
});
