import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import {
  FENBI_HOME,
  GOLDEN_SENTENCES,
  PRACTICE_MODULES,
  READING_SOURCES,
  openExternal,
  pickDailyIndex,
  todayEncouragement
} from "@/features/exam/examLinks";
import {
  HEBEI_IDIOMS,
  IDIOM_PAIRS,
  idiomStreak,
  loadIdiomCheckin,
  saveIdiomCheckin,
  todayIdiomBatch,
  type IdiomCheckinState
} from "@/features/exam/idiomData";
import {
  addStudyMinutes,
  buildStudyBars,
  elapsedMinutes,
  elapsedSeconds,
  formatDuration,
  formatStopwatch,
  hydrateStudyFromCloud,
  loadStudyState,
  minutesInRange,
  minutesOn,
  saveStudyState,
  shiftDate,
  studyStreakDays,
  toLocalIso,
  totalMinutes,
  type StudyState
} from "@/features/exam/studyTimer";
import type { UiTokens } from "@/shared/ui/primitives";

type ExamTab = "practice" | "reading" | "study";
type IdiomTab = "today" | "top" | "pairs";

const EXAM_TABS: Array<{ key: ExamTab; label: string }> = [
  { key: "practice", label: "做题" },
  { key: "reading", label: "申论阅读" },
  { key: "study", label: "学习时长" }
];

const IDIOM_TABS: Array<{ key: IdiomTab; label: string }> = [
  { key: "today", label: "今日背诵" },
  { key: "top", label: "高频榜" },
  { key: "pairs", label: "易混辨析" }
];

const ALL_CATEGORY = "全部";

export function ExamPanel({ themeTokens }: { themeTokens: UiTokens }) {
  const styles = useMemo(() => createStyles(themeTokens), [themeTokens]);

  const [activeTab, setActiveTab] = useState<ExamTab>("practice");
  const [idiomOpen, setIdiomOpen] = useState(false);
  const [idiomTab, setIdiomTab] = useState<IdiomTab>("today");
  const [study, setStudy] = useState<StudyState>(() => loadStudyState());
  const [checkin, setCheckin] = useState<IdiomCheckinState>(() => loadIdiomCheckin());
  const [manualMinutes, setManualMinutes] = useState("30");
  const [category, setCategory] = useState<string>(ALL_CATEGORY);
  const [tick, setTick] = useState(0);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let alive = true;
    void hydrateStudyFromCloud().then((next) => {
      if (alive) {
        setStudy(next);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!study.runningSince) {
      return;
    }
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [study.runningSince]);

  const todayKey = toLocalIso(new Date());
  const encouragement = useMemo(() => todayEncouragement(), []);
  const dailySentence = useMemo(() => GOLDEN_SENTENCES[pickDailyIndex(GOLDEN_SENTENCES.length, 3)], []);

  const runningSeconds = useMemo(
    () => elapsedSeconds(study.runningSince),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [study.runningSince, tick]
  );

  const stats = useMemo(() => {
    const weekFrom = toLocalIso(shiftDate(new Date(), -6));
    return {
      bars: buildStudyBars(study, 7),
      streak: studyStreakDays(study),
      today: minutesOn(study, todayKey),
      total: totalMinutes(study),
      week: minutesInRange(study, weekFrom, todayKey)
    };
  }, [study, todayKey]);

  const categories = useMemo(() => {
    const set = new Set(GOLDEN_SENTENCES.map((item) => item.category));
    return [ALL_CATEGORY, ...Array.from(set)];
  }, []);

  const visibleSentences = useMemo(
    () => (category === ALL_CATEGORY ? GOLDEN_SENTENCES : GOLDEN_SENTENCES.filter((item) => item.category === category)),
    [category]
  );

  const idiomBatch = useMemo(() => todayIdiomBatch(5), []);
  const idiomStreakDays = useMemo(() => idiomStreak(checkin.dates), [checkin.dates]);
  const checkedToday = checkin.dates.includes(todayKey);
  const learnedSet = useMemo(() => new Set(checkin.learnedIds), [checkin.learnedIds]);

  const persistStudy = (next: StudyState) => {
    setStudy(next);
    saveStudyState(next);
  };

  const persistCheckin = (next: IdiomCheckinState) => {
    setCheckin(next);
    saveIdiomCheckin(next);
  };

  const handleStart = () => {
    persistStudy({ ...study, runningSince: new Date().toISOString() });
    setFeedback("计时开始，专注这一段时间。");
  };

  const handleStop = () => {
    const minutes = elapsedMinutes(study.runningSince);
    const stopped: StudyState = { ...study, runningSince: null };
    const next = minutes > 0 ? addStudyMinutes(stopped, minutes, "timer") : stopped;
    persistStudy(next);
    setFeedback(minutes > 0 ? `本次记录 ${formatDuration(minutes)}，今天累计 ${formatDuration(minutesOn(next, todayKey))}。` : "不足 1 分钟，本次未计入。");
  };

  const handleManualAdd = () => {
    const minutes = Number.parseInt(manualMinutes, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setFeedback("请输入大于 0 的分钟数。");
      return;
    }
    const next = addStudyMinutes(study, minutes, "manual");
    persistStudy(next);
    setFeedback(`已补录 ${formatDuration(minutes)}。`);
  };

  const handleCheckin = () => {
    if (checkedToday) {
      setFeedback("今天已经打过卡啦，明天继续。");
      return;
    }
    const learned = new Set(checkin.learnedIds);
    idiomBatch.forEach((item) => learned.add(item.id));
    persistCheckin({ dates: [todayKey, ...checkin.dates].slice(0, 400), learnedIds: Array.from(learned) });
    setFeedback(`打卡成功，已连续 ${idiomStreakDays + 1} 天。`);
  };

  const toggleLearned = (id: string) => {
    const learned = new Set(checkin.learnedIds);
    if (learned.has(id)) {
      learned.delete(id);
    } else {
      learned.add(id);
    }
    persistCheckin({ ...checkin, learnedIds: Array.from(learned) });
  };

  if (idiomOpen) {
    return (
      <View style={styles.stack}>
        <View style={styles.detailHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="返回考公练习" onPress={() => setIdiomOpen(false)} style={styles.backButton}>
            <Text style={styles.backText}>‹ 返回</Text>
          </Pressable>
          <View style={styles.detailTitleBox}>
            <Text style={styles.detailTitle}>河北高频成语</Text>
            <Text style={styles.detailSubtitle}>近 5 年真题高频 · 共 {HEBEI_IDIOMS.length} 条</Text>
          </View>
        </View>

        <View style={styles.checkinCard}>
          <View style={styles.checkinInfo}>
            <Text style={styles.checkinStreak}>{idiomStreakDays}</Text>
            <Text style={styles.checkinLabel}>连续打卡（天）</Text>
          </View>
          <View style={styles.checkinInfo}>
            <Text style={styles.checkinStreak}>{learnedSet.size}</Text>
            <Text style={styles.checkinLabel}>已掌握（条）</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="成语背诵打卡"
            onPress={handleCheckin}
            style={[styles.checkinButton, checkedToday ? styles.checkinButtonDone : null]}
          >
            <Text style={[styles.checkinButtonText, checkedToday ? styles.checkinButtonTextDone : null]}>{checkedToday ? "今日已打卡" : "今日打卡"}</Text>
          </Pressable>
        </View>

        <View style={styles.tabs}>
          {IDIOM_TABS.map((item) => (
            <TabButton key={item.key} active={idiomTab === item.key} label={item.label} onPress={() => setIdiomTab(item.key)} styles={styles} />
          ))}
        </View>

        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

        {idiomTab === "today" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>今日 5 个（每天自动轮换）</Text>
            {idiomBatch.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`标记 ${item.word}`}
                onPress={() => toggleLearned(item.id)}
                style={[styles.idiomRow, learnedSet.has(item.id) ? styles.idiomRowDone : null]}
              >
                <View style={styles.idiomHead}>
                  <Text style={styles.idiomWord}>{item.word}</Text>
                  <Text style={styles.idiomPinyin}>{item.pinyin}</Text>
                  <Text style={styles.idiomFreq}>近5年 {item.freq} 次</Text>
                </View>
                <Text style={styles.idiomMeaning}>{item.meaning}</Text>
                <Text style={styles.idiomTip}>💡 {item.tip}</Text>
                <Text style={styles.idiomState}>{learnedSet.has(item.id) ? "✅ 已掌握，点击取消" : "点击标记为已掌握"}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {idiomTab === "top" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>高频榜（按出现次数排序）</Text>
            {HEBEI_IDIOMS.map((item, index) => (
              <View key={item.id} style={styles.rankRow}>
                <Text style={styles.rankIndex}>{index + 1}</Text>
                <View style={styles.rankBody}>
                  <View style={styles.idiomHead}>
                    <Text style={styles.idiomWord}>{item.word}</Text>
                    <Text style={styles.idiomPinyin}>{item.pinyin}</Text>
                    <Text style={styles.idiomFreq}>{item.freq} 次</Text>
                  </View>
                  <Text style={styles.idiomMeaning}>{item.meaning}</Text>
                  <Text style={styles.idiomTip}>💡 {item.tip}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {idiomTab === "pairs" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>易混辨析（{IDIOM_PAIRS.length} 组）</Text>
            {IDIOM_PAIRS.map((pair) => (
              <View key={pair.id} style={styles.pairCard}>
                <Text style={styles.pairFocus}>辨析要点 · {pair.focus}</Text>
                <View style={styles.pairRow}>
                  <View style={styles.pairSide}>
                    <Text style={styles.pairWord}>{pair.left.word}</Text>
                    <Text style={styles.pairNote}>{pair.left.note}</Text>
                  </View>
                  <Text style={styles.pairVs}>VS</Text>
                  <View style={styles.pairSide}>
                    <Text style={styles.pairWord}>{pair.right.word}</Text>
                    <Text style={styles.pairNote}>{pair.right.note}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.quoteCard}>
        <Text style={styles.quoteBadge}>每日一句</Text>
        <Text style={styles.quoteText}>{encouragement}</Text>
        <Text style={styles.quoteMeta}>{todayKey} · 今天已学 {formatDuration(stats.today)}</Text>
      </View>

      <View style={styles.tabs}>
        {EXAM_TABS.map((item) => (
          <TabButton key={item.key} active={activeTab === item.key} label={item.label} onPress={() => setActiveTab(item.key)} styles={styles} />
        ))}
      </View>

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

      {activeTab === "practice" ? (
        <View style={styles.section}>
          <Pressable accessibilityRole="button" accessibilityLabel={FENBI_HOME.title} onPress={() => openExternal(FENBI_HOME)} style={styles.primaryCta}>
            <Text style={styles.primaryCtaIcon}>{FENBI_HOME.icon}</Text>
            <View style={styles.primaryCtaBody}>
              <Text style={styles.primaryCtaTitle}>{FENBI_HOME.title}</Text>
              <Text style={styles.primaryCtaDesc}>{FENBI_HOME.description}</Text>
            </View>
            <Text style={styles.primaryCtaArrow}>›</Text>
          </Pressable>

          <Text style={styles.sectionTitle}>专项突破</Text>
          <View style={styles.grid}>
            {PRACTICE_MODULES.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                onPress={() => {
                  if (item.internal === "idiom") {
                    setIdiomOpen(true);
                    setFeedback("");
                    return;
                  }
                  openExternal(item);
                }}
                style={styles.gridCard}
              >
                <Text style={styles.gridIcon}>{item.icon}</Text>
                <Text style={styles.gridTitle}>{item.title}</Text>
                <Text style={styles.gridDesc}>{item.description}</Text>
                <Text style={styles.gridTag}>{item.internal === "idiom" ? "内置资料 →" : "去粉笔 →"}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {activeTab === "reading" ? (
        <View style={styles.section}>
          <View style={styles.sentenceCard}>
            <Text style={styles.sentenceBadge}>今日金句 · {dailySentence.category}</Text>
            <Text style={styles.sentenceText}>{dailySentence.text}</Text>
            <Text style={styles.sentenceSource}>—— {dailySentence.source}</Text>
          </View>

          <Text style={styles.sectionTitle}>权威阅读源</Text>
          <View style={styles.grid}>
            {READING_SOURCES.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                onPress={() => openExternal(item)}
                style={styles.sourceCard}
              >
                <Text style={styles.sourceIcon}>{item.icon}</Text>
                <Text style={styles.sourceTitle}>{item.title}</Text>
                <Text style={styles.sourceDesc}>{item.description}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>申论金句库</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {categories.map((item) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityLabel={`金句分类 ${item}`}
                onPress={() => setCategory(item)}
                style={[styles.chip, category === item ? styles.chipActive : null]}
              >
                <Text style={[styles.chipText, category === item ? styles.chipTextActive : null]}>{item}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.card}>
            {visibleSentences.map((item) => (
              <View key={item.id} style={styles.quoteRow}>
                <Text style={styles.quoteRowCategory}>{item.category}</Text>
                <Text style={styles.quoteRowText}>{item.text}</Text>
                <Text style={styles.quoteRowSource}>—— {item.source}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {activeTab === "study" ? (
        <View style={styles.section}>
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>{study.runningSince ? "正在计时" : "未开始"}</Text>
            <Text style={styles.timerValue}>{formatStopwatch(runningSeconds)}</Text>
            <View style={styles.timerActions}>
              {study.runningSince ? (
                <Pressable accessibilityRole="button" accessibilityLabel="结束计时" onPress={handleStop} style={[styles.timerButton, styles.timerButtonStop]}>
                  <Text style={styles.timerButtonStopText}>结束并记录</Text>
                </Pressable>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel="开始计时" onPress={handleStart} style={styles.timerButton}>
                  <Text style={styles.timerButtonText}>开始计时</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatBadge label="今日" styles={styles} value={formatDuration(stats.today)} />
            <StatBadge label="近 7 天" styles={styles} value={formatDuration(stats.week)} />
            <StatBadge label="连续天数" styles={styles} value={`${stats.streak} 天`} />
            <StatBadge label="累计" styles={styles} value={formatDuration(stats.total)} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>近 7 天学习时长</Text>
            <View style={styles.chart}>
              {stats.bars.map((bar) => (
                <View key={bar.date} style={styles.barColumn}>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { height: `${bar.height}%` }]} />
                  </View>
                  <Text style={styles.barValue}>{bar.minutes > 0 ? bar.minutes : ""}</Text>
                  <Text style={styles.barLabel}>{bar.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>手动补录</Text>
            <Text style={styles.cardHint}>忘记计时？直接补上今天的学习分钟数。</Text>
            <View style={styles.manualRow}>
              <TextInput
                accessibilityLabel="补录分钟数"
                keyboardType="numeric"
                onChangeText={setManualMinutes}
                placeholder="分钟"
                placeholderTextColor={themeTokens.textMuted}
                style={styles.manualInput}
                value={manualMinutes}
              />
              <Pressable accessibilityRole="button" accessibilityLabel="补录学习时长" onPress={handleManualAdd} style={styles.manualButton}>
                <Text style={styles.manualButtonText}>补录</Text>
              </Pressable>
            </View>
            <View style={styles.chipRowWrap}>
              {[15, 30, 45, 60, 90, 120].map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={`快速补录 ${value} 分钟`}
                  onPress={() => setManualMinutes(String(value))}
                  style={styles.chip}
                >
                  <Text style={styles.chipText}>{value} 分</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function TabButton({
  active,
  label,
  onPress,
  styles
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.tab, active ? styles.tabActive : null]}>
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function StatBadge({ label, styles, value }: { label: string; styles: ReturnType<typeof createStyles>; value: string }) {
  return (
    <View style={styles.statBadge}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    backButton: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8
    },
    backText: {
      color: tokens.accent,
      fontSize: 14,
      fontWeight: "900"
    },
    barColumn: {
      alignItems: "center",
      flex: 1,
      gap: 4
    },
    barFill: {
      backgroundColor: tokens.accent,
      borderRadius: 6,
      bottom: 0,
      left: "18%",
      position: "absolute",
      right: "18%"
    },
    barLabel: {
      color: tokens.textMuted,
      fontSize: 10
    },
    barTrack: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 6,
      height: 96,
      position: "relative",
      width: "100%"
    },
    barValue: {
      color: tokens.text,
      fontSize: 11,
      fontWeight: "800",
      minHeight: 14
    },
    card: {
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 20,
      borderWidth: 1,
      gap: 12,
      padding: 16
    },
    cardHint: {
      color: tokens.textMuted,
      fontSize: 13,
      lineHeight: 20
    },
    cardTitle: {
      color: tokens.text,
      fontSize: 16,
      fontWeight: "900"
    },
    chart: {
      alignItems: "flex-end",
      flexDirection: "row",
      gap: 8,
      minHeight: 130
    },
    checkinButton: {
      backgroundColor: tokens.accent,
      borderRadius: 999,
      paddingHorizontal: 18,
      paddingVertical: 12
    },
    checkinButtonDone: {
      backgroundColor: tokens.surfaceMuted
    },
    checkinButtonText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "900"
    },
    checkinButtonTextDone: {
      color: tokens.textMuted
    },
    checkinCard: {
      alignItems: "center",
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      justifyContent: "space-between",
      padding: 16
    },
    checkinInfo: {
      alignItems: "center",
      gap: 2
    },
    checkinLabel: {
      color: tokens.textMuted,
      fontSize: 12
    },
    checkinStreak: {
      color: tokens.accent,
      fontSize: 24,
      fontWeight: "900"
    },
    chip: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8
    },
    chipActive: {
      backgroundColor: tokens.accent
    },
    chipRow: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 2
    },
    chipRowWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    chipText: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "800"
    },
    chipTextActive: {
      color: "#ffffff"
    },
    detailHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12
    },
    detailSubtitle: {
      color: tokens.textMuted,
      fontSize: 13
    },
    detailTitle: {
      color: tokens.text,
      fontSize: 20,
      fontWeight: "900"
    },
    detailTitleBox: {
      gap: 2
    },
    feedback: {
      color: tokens.accent,
      fontSize: 13,
      fontWeight: "700"
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12
    },
    gridCard: {
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 18,
      borderWidth: 1,
      flexGrow: 1,
      gap: 6,
      minWidth: 150,
      padding: 14,
      width: "47%"
    },
    gridDesc: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 18
    },
    gridIcon: {
      fontSize: 22
    },
    gridTag: {
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "800"
    },
    gridTitle: {
      color: tokens.text,
      fontSize: 15,
      fontWeight: "900"
    },
    idiomFreq: {
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      color: tokens.accent,
      fontSize: 11,
      fontWeight: "800",
      paddingHorizontal: 8,
      paddingVertical: 2
    },
    idiomHead: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    idiomMeaning: {
      color: tokens.text,
      fontSize: 13,
      lineHeight: 20
    },
    idiomPinyin: {
      color: tokens.textMuted,
      fontSize: 12
    },
    idiomRow: {
      backgroundColor: tokens.surfaceMuted,
      borderColor: "transparent",
      borderRadius: 16,
      borderWidth: 1,
      gap: 6,
      padding: 12
    },
    idiomRowDone: {
      borderColor: tokens.accent
    },
    idiomState: {
      color: tokens.textMuted,
      fontSize: 11
    },
    idiomTip: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 19
    },
    idiomWord: {
      color: tokens.text,
      fontSize: 17,
      fontWeight: "900",
      letterSpacing: 1
    },
    manualButton: {
      backgroundColor: tokens.accent,
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 12
    },
    manualButtonText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "900"
    },
    manualInput: {
      backgroundColor: tokens.surfaceMuted,
      borderColor: tokens.border,
      borderRadius: 12,
      borderWidth: 1,
      color: tokens.text,
      flex: 1,
      fontSize: 15,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    manualRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10
    },
    pairCard: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 16,
      gap: 8,
      padding: 12
    },
    pairFocus: {
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "900"
    },
    pairNote: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 19
    },
    pairRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 10
    },
    pairSide: {
      flex: 1,
      gap: 4
    },
    pairVs: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "900",
      paddingTop: 4
    },
    pairWord: {
      color: tokens.text,
      fontSize: 15,
      fontWeight: "900"
    },
    primaryCta: {
      alignItems: "center",
      backgroundColor: tokens.accent,
      borderRadius: 20,
      flexDirection: "row",
      gap: 12,
      padding: 18
    },
    primaryCtaArrow: {
      color: "#ffffff",
      fontSize: 26,
      fontWeight: "900"
    },
    primaryCtaBody: {
      flex: 1,
      gap: 4
    },
    primaryCtaDesc: {
      color: "rgba(255,255,255,0.86)",
      fontSize: 12
    },
    primaryCtaIcon: {
      fontSize: 26
    },
    primaryCtaTitle: {
      color: "#ffffff",
      fontSize: 17,
      fontWeight: "900"
    },
    quoteBadge: {
      alignSelf: "flex-start",
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "900",
      paddingHorizontal: 10,
      paddingVertical: 4
    },
    quoteCard: {
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 20,
      borderWidth: 1,
      gap: 10,
      padding: 18
    },
    quoteMeta: {
      color: tokens.textMuted,
      fontSize: 12
    },
    quoteRow: {
      borderTopColor: tokens.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 4,
      paddingTop: 10
    },
    quoteRowCategory: {
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "900"
    },
    quoteRowSource: {
      color: tokens.textMuted,
      fontSize: 12
    },
    quoteRowText: {
      color: tokens.text,
      fontSize: 14,
      lineHeight: 22
    },
    quoteText: {
      color: tokens.text,
      fontSize: 18,
      fontWeight: "800",
      lineHeight: 28
    },
    rankBody: {
      flex: 1,
      gap: 4
    },
    rankIndex: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "900",
      minWidth: 22,
      paddingTop: 2
    },
    rankRow: {
      borderTopColor: tokens.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 8,
      paddingTop: 10
    },
    section: {
      gap: 14
    },
    sectionTitle: {
      color: tokens.text,
      fontSize: 16,
      fontWeight: "900"
    },
    sentenceBadge: {
      alignSelf: "flex-start",
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "900",
      paddingHorizontal: 10,
      paddingVertical: 4
    },
    sentenceCard: {
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 20,
      borderWidth: 1,
      gap: 10,
      padding: 18
    },
    sentenceSource: {
      color: tokens.textMuted,
      fontSize: 12,
      textAlign: "right"
    },
    sentenceText: {
      color: tokens.text,
      fontSize: 15,
      lineHeight: 25
    },
    sourceCard: {
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 16,
      borderWidth: 1,
      flexGrow: 1,
      gap: 4,
      minWidth: 140,
      padding: 12,
      width: "47%"
    },
    sourceDesc: {
      color: tokens.textMuted,
      fontSize: 11,
      lineHeight: 17
    },
    sourceIcon: {
      fontSize: 18
    },
    sourceTitle: {
      color: tokens.text,
      fontSize: 14,
      fontWeight: "900"
    },
    stack: {
      gap: 16
    },
    statBadge: {
      alignItems: "center",
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 16,
      borderWidth: 1,
      flexGrow: 1,
      gap: 4,
      minWidth: 78,
      paddingHorizontal: 10,
      paddingVertical: 12
    },
    statLabel: {
      color: tokens.textMuted,
      fontSize: 12
    },
    statValue: {
      color: tokens.text,
      fontSize: 15,
      fontWeight: "900"
    },
    statsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10
    },
    tab: {
      alignItems: "center",
      borderRadius: 12,
      flex: 1,
      paddingVertical: 10
    },
    tabActive: {
      backgroundColor: tokens.surface
    },
    tabText: {
      color: tokens.textMuted,
      fontSize: 14,
      fontWeight: "800"
    },
    tabTextActive: {
      color: tokens.accent
    },
    tabs: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 14,
      flexDirection: "row",
      gap: 4,
      padding: 4
    },
    timerActions: {
      flexDirection: "row",
      gap: 10
    },
    timerButton: {
      backgroundColor: tokens.accent,
      borderRadius: 999,
      paddingHorizontal: 28,
      paddingVertical: 12
    },
    timerButtonStop: {
      backgroundColor: tokens.surfaceMuted
    },
    timerButtonStopText: {
      color: tokens.accent,
      fontSize: 15,
      fontWeight: "900"
    },
    timerButtonText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "900"
    },
    timerCard: {
      alignItems: "center",
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 20,
      borderWidth: 1,
      gap: 10,
      padding: 20
    },
    timerLabel: {
      color: tokens.textMuted,
      fontSize: 13
    },
    timerValue: {
      color: tokens.text,
      fontSize: 40,
      fontWeight: "900",
      letterSpacing: 2
    }
  });
}
