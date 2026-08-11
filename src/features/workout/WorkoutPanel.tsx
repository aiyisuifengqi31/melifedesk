import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useCallback } from "react";
import { createPortal } from "react-dom";

import { getSupabaseClient } from "@/auth/supabaseClient";
import { getCurrentCoupleId, getCurrentPartnerId } from "@/auth/partnership";
import { loadLoveSharedValue, saveLoveSharedValue } from "@/features/love/loveSharedCloud";
import { PuppyIllustration } from "@/shared/ui/PuppyIllustration";
import { CollapsibleSectionFooter, sortByNewest, useCollapsibleList } from "@/shared/ui/CollapsibleList";
import {
  addWorkoutPart,
  createWorkoutSession,
  listPartnerWorkoutSessions,
  mapPartnerWorkoutRow,
  softDeleteWorkoutSession
} from "@/features/workout/workoutRepository";
import {
  createBodyMetricId,
  createWorkoutId,
  getDefaultWorkoutStorage,
  hydrateBodyMetricsFromCloud,
  hydrateWorkoutsFromCloud,
  loadLocalBodyMetrics,
  loadLocalWorkouts,
  saveLocalBodyMetrics,
  saveLocalWorkouts,
  sortBodyMetrics,
  sortWorkoutLogs,
  type BodyMetricLog,
  type WorkoutLog,
  type WorkoutStorage
} from "@/features/workout/workoutStorage";

type WorkoutPanelProps = {
  storage?: WorkoutStorage;
};

type WorkoutPopoverKind = "duration" | "log-filter" | "log-menu" | "part";
type LogFilter = "all" | "currentMonth" | "lastMonth";
type AnchorRect = { height: number; left: number; top: number; width: number };
type DataTrendType = "training" | "weight" | "fat";
type WorkoutOwnerView = "mine" | "partner";

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
  { label: "7天", value: "week" },
  { label: "1月", value: "month" },
  { label: "1年", value: "year" }
];
const dataTrendOptions: Array<{ label: string; value: DataTrendType }> = [
  { label: "训练", value: "training" },
  { label: "体重", value: "weight" },
  { label: "体脂", value: "fat" }
];
const durationOptions = Array.from({ length: 36 }, (_, index) => (index + 1) * 5);
const WORKOUT_SHARED_KEY_PREFIX = "fanfan-guanguan.workouts.shared.";
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
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetricLog[]>(() => sortBodyMetrics(loadLocalBodyMetrics(workoutStorage)));
  const [bodyDate, setBodyDate] = useState(todayIso());
  const [weightInput, setWeightInput] = useState("");
  const [bodyFatInput, setBodyFatInput] = useState("");
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(40);
  const [feedback, setFeedback] = useState("");
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("week");
  const [dataTrend, setDataTrend] = useState<DataTrendType>("training");
  const [ownerView, setOwnerView] = useState<WorkoutOwnerView>("mine");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("我的运动");
  const [activeCoupleId, setActiveCoupleId] = useState<string | null>(null);
  const [partnerUserId, setPartnerUserId] = useState<string | null>(null);
  const [partnershipResolved, setPartnershipResolved] = useState(false);
  const [partnerLogs, setPartnerLogs] = useState<WorkoutLog[]>([]);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [partnerRefreshToken, setPartnerRefreshToken] = useState(0);
  const [selectedMetricPoint, setSelectedMetricPoint] = useState<BodyMetricLog | null>(null);
  const [popover, setPopover] = useState<{ kind: WorkoutPopoverKind; logId?: string; rect: AnchorRect } | null>(null);
  const [logFilter, setLogFilter] = useState<LogFilter>("all");
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const localDirtyRef = useRef(false);
  const bodyDirtyRef = useRef(false);
  const logsSnapshotRef = useRef(JSON.stringify(logs));
  const bodyMetricsSnapshotRef = useRef(JSON.stringify(bodyMetrics));
  const sharedLogsSnapshotRef = useRef("");
  const workoutSyncingRef = useRef(new Set<string>());

  const stats = useMemo(() => buildWorkoutStats(logs), [logs]);
  const latestBodyMetric = useMemo(() => findLatestBodyMetric(bodyMetrics, todayIso()), [bodyMetrics]);
  const chartBars = useMemo(() => buildPeriodBars(logs, chartPeriod), [chartPeriod, logs]);
  const chartTotal = useMemo(() => chartBars.reduce((sum, bar) => sum + bar.minutes, 0), [chartBars]);
  const bodyTrendPoints = useMemo(() => buildBodyTrendPoints(bodyMetrics, chartPeriod, dataTrend), [bodyMetrics, chartPeriod, dataTrend]);
  const bodyTrendSummary = useMemo(() => buildBodyTrendSummary(bodyTrendPoints, dataTrend), [bodyTrendPoints, dataTrend]);
  const sortedLogs = useMemo(() => filterWorkoutLogs(sortByNewest(logs, (log) => [log.sessionDate, log.createTime]), logFilter), [logFilter, logs]);
  const logList = useCollapsibleList(sortedLogs, 5);
  const todayKey = todayIso();
  const todayLogs = useMemo(
    () => logs.filter((log) => log.sessionDate === todayKey && log.status === "trained"),
    [logs, todayKey]
  );

  const syncWorkoutLogsToCoupleState = useCallback((nextLogs: WorkoutLog[]) => {
    const client = getSupabaseClient();
    if (!client || !currentUserId || !activeCoupleId) return;
    const sharedLogs = sortWorkoutLogs(nextLogs.filter((log) => log.status === "trained"));
    const sharedSnapshot = JSON.stringify(sharedLogs);
    if (sharedSnapshot === sharedLogsSnapshotRef.current) return;
    sharedLogsSnapshotRef.current = sharedSnapshot;
    void saveLoveSharedValue(getWorkoutSharedKey(currentUserId), sharedLogs, client).catch(() => undefined);
  }, [activeCoupleId, currentUserId]);

  useEffect(() => {
    let cancelled = false;
    void hydrateWorkoutsFromCloud(workoutStorage).then((next) => {
      const sorted = sortWorkoutLogs(next);
      const snapshot = JSON.stringify(sorted);
      if (!cancelled && !localDirtyRef.current && snapshot !== logsSnapshotRef.current) {
        logsSnapshotRef.current = snapshot;
        setLogs(sorted);
      }
    });
    void hydrateBodyMetricsFromCloud(workoutStorage).then((next) => {
      const sorted = sortBodyMetrics(next);
      const snapshot = JSON.stringify(sorted);
      if (!cancelled && !bodyDirtyRef.current && snapshot !== bodyMetricsSnapshotRef.current) {
        bodyMetricsSnapshotRef.current = snapshot;
        setBodyMetrics(sorted);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [workoutStorage]);

  useEffect(() => {
    let cancelled = false;
    const client = getSupabaseClient();
    if (!client) return undefined;

    void client.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user || cancelled) return;
      const name = getUserDisplayName(user);
      setCurrentUserId(user.id);
      setCurrentUserName(name ? `${name} · 我的` : "我的运动");
      const [coupleId, partnerId] = await Promise.all([
        getCurrentCoupleId(client, user.id),
        getCurrentPartnerId(client, user.id)
      ]);
      if (cancelled) return;
      setActiveCoupleId(coupleId);
      setPartnerUserId(partnerId);
      setPartnershipResolved(true);
      if (!partnerId) {
        setOwnerView("mine");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const client = getSupabaseClient();
    if (!client || !currentUserId || !activeCoupleId) return undefined;

    syncWorkoutLogsToCoupleState(logs);

    const unsyncedLogs = logs.filter((log) => log.status === "trained" && !log.remoteId && !workoutSyncingRef.current.has(log.id));
    if (unsyncedLogs.length === 0) return undefined;

    void Promise.all(
      unsyncedLogs.map(async (log) => {
        workoutSyncingRef.current.add(log.id);
        const remoteId = await uploadWorkoutLog(client, currentUserId, activeCoupleId, log);
        return { localId: log.id, remoteId };
      })
    ).then((results) => {
      if (cancelled) return;
      const remoteIds = new Map(results.filter((result) => result.remoteId).map((result) => [result.localId, result.remoteId as string]));
      if (remoteIds.size === 0) return;
      localDirtyRef.current = true;
      setLogs((currentLogs) => {
        const nextLogs = sortWorkoutLogs(currentLogs.map((log) => remoteIds.has(log.id) ? { ...log, remoteId: remoteIds.get(log.id) ?? null } : log));
        logsSnapshotRef.current = JSON.stringify(nextLogs);
        saveLocalWorkouts(nextLogs, workoutStorage);
        return nextLogs;
      });
    }).finally(() => {
      unsyncedLogs.forEach((log) => workoutSyncingRef.current.delete(log.id));
    });

    return () => {
      cancelled = true;
    };
  }, [activeCoupleId, currentUserId, logs, syncWorkoutLogsToCoupleState, workoutStorage]);

  useEffect(() => {
    let cancelled = false;
    const client = getSupabaseClient();
    if (ownerView !== "partner") return undefined;
    if (!client || !partnerUserId) {
      setPartnerLogs([]);
      return undefined;
    }
    setPartnerLoading(true);
    void Promise.all([
      listPartnerWorkoutSessions(client, partnerUserId),
      loadLoveSharedValue<WorkoutLog[]>(getWorkoutSharedKey(partnerUserId), [], client).catch(() => [])
    ]).then(([{ data, error }, sharedLogs]) => {
      if (cancelled) return;
      const remoteLogs = error || !Array.isArray(data) ? [] : data.map((row) => mapPartnerWorkoutRow(row));
      const normalizedSharedLogs = normalizeSharedWorkoutLogs(sharedLogs);
      setPartnerLogs(mergeWorkoutLogs(remoteLogs, normalizedSharedLogs));
      setPartnerLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerView, partnerRefreshToken, partnerUserId]);

  useEffect(() => {
    const metricForDate = bodyMetrics.find((metric) => metric.recordDate === bodyDate) ?? latestBodyMetric;
    if (!metricForDate) {
      setWeightInput("");
      setBodyFatInput("");
      return;
    }
    setWeightInput(formatDecimalInput(metricForDate.weightKg));
    setBodyFatInput(metricForDate.bodyFatPercent ? formatDecimalInput(metricForDate.bodyFatPercent) : "");
  }, [bodyDate, bodyMetrics, latestBodyMetric]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = globalThis.setTimeout(() => setFeedback(""), 2200);
    return () => globalThis.clearTimeout(timer);
  }, [feedback]);

  const persistLogs = (nextLogs: WorkoutLog[]) => {
    localDirtyRef.current = true;
    const sorted = sortWorkoutLogs(nextLogs);
    logsSnapshotRef.current = JSON.stringify(sorted);
    setLogs(sorted);
    saveLocalWorkouts(sorted, workoutStorage);
    syncWorkoutLogsToCoupleState(sorted);
  };

  const persistBodyMetrics = (nextMetrics: BodyMetricLog[]) => {
    bodyDirtyRef.current = true;
    const sorted = sortBodyMetrics(nextMetrics);
    bodyMetricsSnapshotRef.current = JSON.stringify(sorted);
    setBodyMetrics(sorted);
    saveLocalBodyMetrics(sorted, workoutStorage);
  };

  const openPopover = (kind: WorkoutPopoverKind, event: unknown, logId?: string) => {
    setPopover({ kind, logId, rect: getAnchorRect(event) });
  };

  const closePopover = () => setPopover(null);

  const changeBodyDate = () => {
    if (typeof window === "undefined" || typeof window.prompt !== "function") return;
    const nextDate = window.prompt("记录日期（YYYY-MM-DD）", bodyDate);
    if (!nextDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
      setFeedback("请输入正确日期，例如 2026-08-11");
      return;
    }
    setBodyDate(nextDate);
  };

  const saveBodyMetric = () => {
    const weightKg = Number(weightInput);
    const bodyFatPercent = bodyFatInput.trim() ? Number(bodyFatInput) : null;

    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      setFeedback("请输入有效体重");
      return;
    }

    if (bodyFatPercent !== null && (!Number.isFinite(bodyFatPercent) || bodyFatPercent <= 0 || bodyFatPercent >= 100)) {
      setFeedback("请输入有效体脂率");
      return;
    }

    const now = new Date().toISOString();
    const existing = bodyMetrics.find((metric) => metric.recordDate === bodyDate);
    const nextMetric: BodyMetricLog = {
      bodyFatPercent,
      createTime: existing?.createTime ?? now,
      id: existing?.id ?? createBodyMetricId(),
      recordDate: bodyDate,
      updateTime: now,
      weightKg: normalizeBodyNumber(weightKg)
    };
    persistBodyMetrics([nextMetric, ...bodyMetrics.filter((metric) => metric.recordDate !== bodyDate)]);
    setWeightInput(formatDecimalInput(nextMetric.weightKg));
    setBodyFatInput(nextMetric.bodyFatPercent ? formatDecimalInput(nextMetric.bodyFatPercent) : "");
    setSelectedMetricPoint(nextMetric);
    setFeedback("✓ 身体数据已记录");
  };

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
    if (!editingLogId && currentUserId && activeCoupleId) {
      workoutSyncingRef.current.add(log.id);
    }
    persistLogs(nextLogs);
    setFeedback(`✓ 已记录：${selectedPart} · ${durationMinutes}分钟`);
    if (editingLogId) {
      setEditingLogId(null);
      return;
    }

    const client = getSupabaseClient();
    const remoteId = client && currentUserId && activeCoupleId ? await uploadWorkoutLog(client, currentUserId, activeCoupleId, log) : null;
    if (remoteId) {
      persistLogs(nextLogs.map((item) => (item.id === log.id ? { ...item, remoteId } : item)));
    } else if (client && currentUserId) {
      setFeedback("记录已保存在本地，远程同步稍后可重试。");
    }
    workoutSyncingRef.current.delete(log.id);
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
      <View style={styles.ownerSwitch}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="查看我的运动"
          onPress={() => setOwnerView("mine")}
          style={[styles.ownerSwitchItem, ownerView === "mine" ? styles.ownerSwitchItemActive : null]}
        >
          <Text style={[styles.ownerSwitchText, ownerView === "mine" ? styles.ownerSwitchTextActive : null]}>👤 {currentUserName}</Text>
        </Pressable>
        {partnerUserId || !partnershipResolved ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="查看TA的运动"
            onPress={() => {
              if (!partnerUserId) return;
              setOwnerView("partner");
              setPartnerRefreshToken((value) => value + 1);
            }}
            disabled={!partnerUserId}
            style={[styles.ownerSwitchItem, ownerView === "partner" ? styles.ownerSwitchItemActive : null]}
          >
            <Text style={[styles.ownerSwitchText, ownerView === "partner" ? styles.ownerSwitchTextActive : null]}>❤️ TA的运动</Text>
          </Pressable>
        ) : null}
      </View>

      {ownerView === "partner" ? (
        <PartnerWorkoutReadOnly
          chartPeriod={chartPeriod}
          loading={partnerLoading}
          logs={partnerLogs}
          onChartPeriodChange={setChartPeriod}
        />
      ) : (
        <>
      <View style={styles.todayStatusRow}>
        <View style={[styles.todayStatusDot, todayLogs.length > 0 ? styles.todayStatusDotTrained : styles.todayStatusDotRest]} />
        <Text style={styles.todayStatusText}>{formatTodayStatus(todayLogs)}</Text>
      </View>

      <View style={styles.bodyRecordCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.chartTitle}>身体记录</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="修改身体记录日期" onPress={changeBodyDate} style={styles.bodyDateButton}>
            <Text style={styles.bodyDateText}>{formatMonthDay(bodyDate)}</Text>
          </Pressable>
        </View>
        <View style={styles.bodyRecordRow}>
          <View style={styles.bodyInputWrap}>
            <TextInput
              accessibilityLabel="体重"
              inputMode="decimal"
              keyboardType="decimal-pad"
              onChangeText={setWeightInput}
              placeholder="体重"
              style={styles.bodyInput}
              value={weightInput}
            />
            <Text style={styles.bodyUnit}>kg</Text>
          </View>
          <View style={styles.bodyInputWrap}>
            <TextInput
              accessibilityLabel="体脂率"
              inputMode="decimal"
              keyboardType="decimal-pad"
              onChangeText={setBodyFatInput}
              placeholder="体脂率"
              style={styles.bodyInput}
              value={bodyFatInput}
            />
            <Text style={styles.bodyUnit}>%</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="保存身体数据" onPress={saveBodyMetric} style={styles.bodySaveButton}>
            <Text style={styles.bodySaveText}>保存</Text>
          </Pressable>
        </View>
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
          <View style={styles.weekMetricCell}>
            <Text style={styles.weekMetricValue}>{stats.weekCount} 次</Text>
            <Text style={styles.weekMetricLabel}>训练次数</Text>
          </View>
          <View style={styles.weekMetricCell}>
            <Text style={styles.weekMetricValue}>{stats.weekMinutes} 分钟</Text>
            <Text style={styles.weekMetricLabel}>总时长</Text>
          </View>
          <View style={styles.weekMetricCell}>
            <Text style={styles.weekMetricValue}>{latestBodyMetric ? `${formatDecimalInput(latestBodyMetric.weightKg)} kg` : "-- kg"}</Text>
            <Text style={styles.weekMetricLabel}>最新体重</Text>
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
            <Text style={styles.chartTitle}>数据趋势</Text>
          </View>
          <Text style={styles.chartTotal}>{dataTrend === "training" ? `合计 ${chartTotal}分钟` : bodyTrendSummary.latestLabel}</Text>
        </View>
        <View style={styles.trendTypeRow}>
          {dataTrendOptions.map((option) => {
            const selected = dataTrend === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityLabel={`查看${option.label}趋势`}
                accessibilityRole="button"
                onPress={() => { setDataTrend(option.value); setSelectedMetricPoint(null); }}
                style={[styles.trendTypeChip, selected ? styles.trendTypeChipActive : null]}
              >
                <Text style={[styles.trendTypeText, selected ? styles.trendTypeTextActive : null]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.periodRow}>
          {chartPeriodOptions.map((option) => {
            const selected = chartPeriod === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityLabel={`查看${option.label}数据趋势`}
                accessibilityRole="button"
                onPress={() => { setChartPeriod(option.value); setSelectedMetricPoint(null); }}
                style={[styles.periodChip, selected ? styles.periodChipActive : null]}
              >
                <Text style={[styles.periodChipText, selected ? styles.periodChipTextActive : null]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {dataTrend === "training" ? (
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
        ) : (
          <>
            <Text style={styles.trendDelta}>{bodyTrendSummary.deltaLabel}</Text>
            <BodyLineChart
              metricType={dataTrend}
              onPointPress={setSelectedMetricPoint}
              period={chartPeriod}
              points={bodyTrendPoints}
              selectedPoint={selectedMetricPoint}
            />
          </>
        )}
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
        </>
      )}
    </View>
  );
}

function PartnerWorkoutReadOnly({
  chartPeriod,
  loading,
  logs,
  onChartPeriodChange
}: {
  chartPeriod: ChartPeriod;
  loading: boolean;
  logs: WorkoutLog[];
  onChartPeriodChange: (period: ChartPeriod) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const monthOptions = useMemo(() => buildMonthOptions(logs), [logs]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const activeMonth = selectedMonth ?? monthOptions[0]?.value ?? null;
  const stats = useMemo(() => buildWorkoutStats(logs), [logs]);
  const chartBars = useMemo(() => buildPeriodBars(logs, chartPeriod), [chartPeriod, logs]);
  const chartTotal = useMemo(() => chartBars.reduce((sum, bar) => sum + bar.minutes, 0), [chartBars]);
  const distribution = useMemo(() => buildWorkoutDistribution(logs), [logs]);
  const recentLogs = useMemo(() => sortByNewest(logs, (log) => [log.sessionDate, log.createTime]), [logs]);
  const visibleLogs = expanded
    ? recentLogs.filter((log) => (activeMonth ? log.sessionDate.startsWith(activeMonth) : true))
    : recentLogs.slice(0, 5);
  const todayLogs = logs.filter((log) => log.sessionDate === todayIso() && log.status === "trained");

  useEffect(() => {
    if (!selectedMonth && monthOptions[0]) {
      setSelectedMonth(monthOptions[0].value);
    }
  }, [monthOptions, selectedMonth]);

  if (loading && logs.length === 0) {
    return (
      <View style={styles.partnerHintRow}>
        <Text style={styles.partnerHintText}>正在加载TA的运动数据…</Text>
      </View>
    );
  }

  if (logs.length === 0) {
    return (
      <>
        <View style={styles.partnerHintRow}>
          <Text style={styles.partnerHintText}>🔒 TA的运动数据 · 只读</Text>
        </View>
        <View style={styles.emptyBox}>
          <PuppyIllustration color="#9cc39c" scene="generic" size={82} />
          <Text style={styles.empty}>❤️ TA还没有训练记录</Text>
          <Text style={styles.muted}>等TA记录一次训练后，这里就会出现统计。</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <View style={styles.partnerHintRow}>
        <Text style={styles.partnerHintText}>🔒 TA的运动数据 · 只读</Text>
        <Text style={styles.partnerHintText}>{loading ? "正在更新…" : formatPartnerTodayStatus(todayLogs)}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>本周运动</Text>
          <Text style={styles.weekRange}>{stats.weekRangeLabel}</Text>
        </View>
        <View style={styles.weekMetricRow}>
          <View style={styles.weekMetricCell}>
            <Text style={styles.weekMetricValue}>{stats.weekCount} 次</Text>
            <Text style={styles.weekMetricLabel}>训练次数</Text>
          </View>
          <View style={styles.weekMetricCell}>
            <Text style={styles.weekMetricValue}>{stats.weekMinutes} 分钟</Text>
            <Text style={styles.weekMetricLabel}>总时长</Text>
          </View>
          <View style={styles.weekMetricCell}>
            <Text style={styles.weekMetricValue}>{recentLogs[0] ? formatShortDate(recentLogs[0].sessionDate) : "--"}</Text>
            <Text style={styles.weekMetricLabel}>最近训练</Text>
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
          <Text style={styles.chartTitle}>训练趋势</Text>
          <Text style={styles.chartTotal}>合计 {chartTotal}分钟</Text>
        </View>
        <View style={styles.periodRow}>
          {chartPeriodOptions.map((option) => {
            const selected = chartPeriod === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityLabel={`查看TA的${option.label}训练趋势`}
                accessibilityRole="button"
                onPress={() => onChartPeriodChange(option.value)}
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
          <Text style={styles.cardTitle}>训练分布</Text>
          <Text style={styles.weekRange}>近30天</Text>
        </View>
        {distribution.length === 0 ? <Text style={styles.empty}>近30天暂无训练记录</Text> : distribution.map((item) => (
          <View key={item.part} style={styles.distributionRow}>
            <Text style={styles.distributionPart}>{item.part}</Text>
            <View style={styles.distributionTrack}>
              <View style={[styles.distributionFill, { width: `${item.width}%` }]} />
            </View>
            <Text style={styles.distributionCount}>{item.count}次</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>最近训练</Text>
          {expanded ? (
            <Pressable accessibilityRole="button" accessibilityLabel="收起TA的全部训练" onPress={() => setExpanded(false)} style={styles.logFilterButton}>
              <Text style={styles.logFilterText}>收起</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="查看TA的全部训练" onPress={() => setExpanded(true)} style={styles.logFilterButton}>
              <Text style={styles.logFilterText}>查看全部 ›</Text>
            </Pressable>
          )}
        </View>
        {expanded && monthOptions.length > 0 ? (
          <View style={styles.monthChipRow}>
            {monthOptions.map((option) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`筛选TA的${option.label}训练`}
                key={option.value}
                onPress={() => setSelectedMonth(option.value)}
                style={[styles.periodChip, activeMonth === option.value ? styles.periodChipActive : null]}
              >
                <Text style={[styles.periodChipText, activeMonth === option.value ? styles.periodChipTextActive : null]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {visibleLogs.map((log) => (
          <View key={log.id} style={styles.partnerLogItem}>
            <Text style={styles.logMain}>{getWorkoutPartIcon(log.parts[0])} {log.title}</Text>
            <Text style={styles.logDate}>{formatShortDate(log.sessionDate)}</Text>
            <Text style={styles.logDuration}>{log.durationMinutes}分钟</Text>
          </View>
        ))}
      </View>
    </>
  );
}

async function uploadWorkoutLog(client: NonNullable<ReturnType<typeof getSupabaseClient>>, userId: string, activeCoupleId: string, log: WorkoutLog) {
  try {
    const { data, error } = await createWorkoutSession(client, userId, {
      coupleId: activeCoupleId,
      durationMinutes: log.durationMinutes,
      intensity: log.intensity,
      kcal: log.kcal,
      kcalSource: "manual",
      sessionDate: log.sessionDate,
      title: log.title,
      visibility: "couple_read"
    });

    if (error || !data) return null;

    const remoteId = (data as { id: string }).id;
    await Promise.all(log.parts.map((part) => addWorkoutPart(client, remoteId, part)));
    return remoteId;
  } catch {
    return null;
  }
}

function getWorkoutSharedKey(userId: string) {
  return `${WORKOUT_SHARED_KEY_PREFIX}${userId}`;
}

function normalizeSharedWorkoutLogs(value: unknown): WorkoutLog[] {
  if (!Array.isArray(value)) return [];

  return sortWorkoutLogs(
    value
      .filter((log): log is Partial<WorkoutLog> =>
        Boolean(
          log &&
            typeof log === "object" &&
            typeof (log as WorkoutLog).id === "string" &&
            typeof (log as WorkoutLog).sessionDate === "string" &&
            typeof (log as WorkoutLog).title === "string"
        )
      )
      .map((log): WorkoutLog => {
        const intensity: WorkoutLog["intensity"] = log.intensity === "easy" || log.intensity === "hard" ? log.intensity : "moderate";
        const kcalSource: WorkoutLog["kcalSource"] = log.kcalSource === "estimated" ? "estimated" : "manual";
        const status: WorkoutLog["status"] = log.status === "rest" ? "rest" : "trained";
        return {
          createTime: typeof log.createTime === "string" ? log.createTime : new Date().toISOString(),
          distanceKm: Number(log.distanceKm) > 0 ? Number(log.distanceKm) : undefined,
          durationMinutes: Math.max(0, Number(log.durationMinutes) || 0),
          feeling: typeof log.feeling === "string" ? log.feeling : undefined,
          id: String(log.id),
          intensity,
          kcal: Math.max(0, Number(log.kcal) || 0),
          kcalSource,
          notes: typeof log.notes === "string" ? log.notes : undefined,
          parts: Array.isArray(log.parts) ? log.parts.filter((part): part is string => typeof part === "string") : [],
          remoteId: typeof log.remoteId === "string" ? log.remoteId : null,
          restType: log.restType === "full" || log.restType === "stretch" || log.restType === "light" ? log.restType : undefined,
          sessionDate: String(log.sessionDate),
          sets: Number(log.sets) > 0 ? Number(log.sets) : undefined,
          status,
          title: String(log.title),
          weightKg: Number(log.weightKg) > 0 ? Number(log.weightKg) : undefined
        };
      })
      .filter((log) => log.status === "trained")
  );
}

function mergeWorkoutLogs(remoteLogs: WorkoutLog[], sharedLogs: WorkoutLog[]) {
  const logsById = new Map<string, WorkoutLog>();
  for (const log of sharedLogs) {
    logsById.set(log.remoteId || log.id, log);
  }
  for (const log of remoteLogs) {
    logsById.set(log.remoteId || log.id, log);
  }
  return sortWorkoutLogs([...logsById.values()]);
}

function BodyLineChart({
  metricType,
  onPointPress,
  period,
  points,
  selectedPoint
}: {
  metricType: DataTrendType;
  onPointPress: (point: BodyMetricLog) => void;
  period: ChartPeriod;
  points: Array<BodyMetricLog & { trendValue: number }>;
  selectedPoint: BodyMetricLog | null;
}) {
  if (points.length === 0) {
    return (
      <View style={styles.lineEmpty}>
        <Text style={styles.empty}>暂无记录</Text>
      </View>
    );
  }

  const values = points.map((point) => point.trendValue);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(0.1, maxValue - minValue);

  return (
    <View style={styles.lineChartWrap}>
      <View style={styles.lineChart}>
        {points.map((point, index) => {
          const top = 8 + ((maxValue - point.trendValue) / range) * 72;
          const selected = selectedPoint?.id === point.id;
          return (
            <View key={`${point.id}-${point.recordDate}`} style={styles.linePointColumn}>
              {index > 0 ? <View style={[styles.lineSegment, { top: top + 5 }]} /> : null}
              <Pressable
                accessibilityLabel={`查看${metricType === "weight" ? "体重" : "体脂"}记录：${formatMonthDay(point.recordDate)}`}
                accessibilityRole="button"
                onPress={() => onPointPress(point)}
                style={[styles.linePoint, { marginTop: top }, selected ? styles.linePointActive : null]}
              />
              <Text style={[styles.barLabel, period === "year" ? styles.barLabelTiny : null]}>{formatTrendLabel(point.recordDate, period)}</Text>
            </View>
          );
        })}
      </View>
      {selectedPoint ? (
        <View style={styles.metricTooltip}>
          <Text style={styles.metricTooltipText}>{selectedPoint.recordDate.split("-").join("/")}</Text>
          <Text style={styles.metricTooltipText}>体重：{formatDecimalInput(selectedPoint.weightKg)}kg</Text>
          {selectedPoint.bodyFatPercent ? <Text style={styles.metricTooltipText}>体脂：{formatDecimalInput(selectedPoint.bodyFatPercent)}%</Text> : null}
        </View>
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

function buildWorkoutDistribution(logs: WorkoutLog[]) {
  const today = new Date();
  const startIso = toLocalIso(shiftDate(today, -29));
  const todayKey = todayIso();
  const counts = new Map<string, number>();

  for (const log of logs) {
    if (log.sessionDate < startIso || log.sessionDate > todayKey || log.status !== "trained") continue;
    for (const part of log.parts.length ? log.parts : [log.title]) {
      counts.set(part, (counts.get(part) ?? 0) + 1);
    }
  }

  const max = Math.max(1, ...counts.values());
  return [...counts.entries()]
    .map(([part, count]) => ({ count, part, width: Math.max(10, Math.round((count / max) * 100)) }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);
}

function buildMonthOptions(logs: WorkoutLog[]) {
  const monthSet = new Set(logs.map((log) => log.sessionDate.slice(0, 7)));
  return [...monthSet].sort((left, right) => right.localeCompare(left)).map((value) => {
    const [year, month] = value.split("-");
    return { label: `${year}年${Number(month)}月`, value };
  });
}

function formatPartnerTodayStatus(todayLogs: WorkoutLog[]) {
  if (todayLogs.length === 0) return "今日暂无训练记录";
  const totalMinutes = todayLogs.reduce((sum, log) => sum + log.durationMinutes, 0);
  if (todayLogs.length === 1) {
    const log = todayLogs[0];
    return `今日已训练 · ${log.parts[0] ?? log.title} · ${log.durationMinutes}分钟`;
  }
  return `今日已训练 ${todayLogs.length}次 · 共${totalMinutes}分钟`;
}

function getUserDisplayName(user: unknown) {
  const metadata = (user as { user_metadata?: Record<string, unknown> })?.user_metadata ?? {};
  const name = metadata.display_name ?? metadata.full_name ?? metadata.name;
  return typeof name === "string" && name.trim() ? name.trim() : "";
}

function buildBodyTrendPoints(metrics: BodyMetricLog[], period: ChartPeriod, trendType: DataTrendType) {
  if (trendType === "training") return [];
  const today = new Date();
  const start = period === "week" ? shiftDate(today, -6) : period === "month" ? shiftDate(today, -29) : shiftDate(today, -364);
  const startIso = toLocalIso(start);
  const todayKey = todayIso();
  return sortBodyMetrics(metrics)
    .filter((metric) => metric.recordDate >= startIso && metric.recordDate <= todayKey)
    .filter((metric) => trendType === "weight" || metric.bodyFatPercent != null)
    .sort((left, right) => left.recordDate.localeCompare(right.recordDate))
    .map((metric) => ({
      ...metric,
      trendValue: trendType === "weight" ? metric.weightKg : Number(metric.bodyFatPercent)
    }));
}

function buildBodyTrendSummary(points: Array<BodyMetricLog & { trendValue: number }>, trendType: DataTrendType) {
  if (trendType === "training") {
    return { deltaLabel: "", latestLabel: "" };
  }
  if (points.length === 0) {
    return { deltaLabel: "暂无记录", latestLabel: "暂无记录" };
  }
  const unit = trendType === "weight" ? "kg" : "%";
  const latest = points[points.length - 1].trendValue;
  const first = points[0].trendValue;
  const diff = normalizeBodyNumber(latest - first);
  const sign = diff > 0 ? "+" : "";
  return {
    deltaLabel: `较区间开始 ${sign}${formatDecimalInput(diff)}${unit}`,
    latestLabel: `最新 ${formatDecimalInput(latest)}${unit}`
  };
}

function findLatestBodyMetric(metrics: BodyMetricLog[], maxDate: string) {
  return sortBodyMetrics(metrics).find((metric) => metric.recordDate <= maxDate) ?? null;
}

function normalizeBodyNumber(value: number) {
  return Math.round(value * 100) / 100;
}

function formatDecimalInput(value: number) {
  return Number.isInteger(value) ? String(value) : String(normalizeBodyNumber(value));
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

function formatTrendLabel(dateText: string, period: ChartPeriod) {
  if (period === "year") return dateText.slice(5, 7);
  return dateText.slice(5).replace("-", "/");
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
  bodyDateButton: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  bodyDateText: {
    color: "#697386",
    fontSize: 12,
    fontWeight: "900"
  },
  bodyInput: {
    color: "#111827",
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 0
  },
  bodyInputWrap: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    height: 42,
    minWidth: 0,
    overflow: "hidden"
  },
  bodyRecordCard: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "#e6ebf2",
    borderRadius: 16,
    borderWidth: 1,
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  bodyRecordRow: {
    flexDirection: "row",
    gap: 8
  },
  bodySaveButton: {
    alignItems: "center",
    backgroundColor: "#7cb87c",
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    minWidth: 62,
    paddingHorizontal: 12
  },
  bodySaveText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900"
  },
  bodyUnit: {
    color: "#697386",
    fontSize: 11,
    fontWeight: "900",
    paddingRight: 9
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
  trendDelta: {
    color: "#697386",
    fontSize: 12,
    fontWeight: "800"
  },
  trendTypeChip: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 30,
    paddingHorizontal: 6
  },
  trendTypeChipActive: {
    backgroundColor: "#e2f2e2",
    borderColor: "#7cb87c"
  },
  trendTypeRow: {
    flexDirection: "row",
    gap: 6
  },
  trendTypeText: {
    color: "#697386",
    fontSize: 12,
    fontWeight: "900"
  },
  trendTypeTextActive: {
    color: "#5a8a5a"
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
  distributionCount: {
    color: "#5a8a5a",
    fontSize: 12,
    fontWeight: "900",
    minWidth: 34,
    textAlign: "right"
  },
  distributionFill: {
    backgroundColor: "#7cb87c",
    borderRadius: 999,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0
  },
  distributionPart: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "900",
    minWidth: 42
  },
  distributionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 28
  },
  distributionTrack: {
    backgroundColor: "#eef4f0",
    borderRadius: 999,
    flex: 1,
    height: 9,
    overflow: "hidden",
    position: "relative"
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
  lineChart: {
    flexDirection: "row",
    minHeight: 112,
    overflow: "hidden"
  },
  lineChartWrap: {
    gap: 8
  },
  lineEmpty: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 96
  },
  linePoint: {
    backgroundColor: "#ffffff",
    borderColor: "#7cb87c",
    borderRadius: 999,
    borderWidth: 3,
    height: 13,
    width: 13,
    zIndex: 2
  },
  linePointActive: {
    backgroundColor: "#7cb87c",
    borderColor: "#5a8a5a"
  },
  linePointColumn: {
    alignItems: "center",
    flex: 1,
    position: "relative"
  },
  lineSegment: {
    backgroundColor: "#a7d3a7",
    height: 3,
    left: "-50%",
    position: "absolute",
    width: "100%",
    zIndex: 1
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
  metricTooltip: {
    alignSelf: "flex-start",
    backgroundColor: "#f0f7f0",
    borderColor: "#d8e8d8",
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  metricTooltipText: {
    color: "#334155",
    fontSize: 12,
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
  monthChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  muted: {
    color: "#697386",
    fontSize: 12,
    lineHeight: 18
  },
  ownerSwitch: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderColor: "#e3e8ef",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    minHeight: 46,
    padding: 4
  },
  ownerSwitchItem: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 8
  },
  ownerSwitchItemActive: {
    backgroundColor: "#e2f2e2"
  },
  ownerSwitchText: {
    color: "#697386",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  ownerSwitchTextActive: {
    color: "#5a8a5a",
    fontWeight: "900"
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
  partnerHintRow: {
    alignItems: "center",
    backgroundColor: "#f7faf7",
    borderColor: "#e3ebe3",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  partnerHintText: {
    color: "#5a8a5a",
    fontSize: 12,
    fontWeight: "900"
  },
  partnerLogItem: {
    alignItems: "center",
    borderColor: "#e3e8ef",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 10,
    paddingVertical: 7
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
  weekMetricCell: {
    alignItems: "center",
    flex: 1
  },
  weekMetricRow: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "space-between"
  },
  weekMetricValue: {
    color: "#5a8a5a",
    fontSize: 18,
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
