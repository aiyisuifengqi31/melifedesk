import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { UiTokens } from "@/shared/ui/primitives";

const tabs = ["每日题", "错题收藏", "申论", "题源"] as const;
const chips = ["行测", "申论", "NATIONAL", "CN-HE", "CN-BJ", "已审核题目"];

export function ExamPanel({ themeTokens }: { themeTokens: UiTokens }) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("每日题");
  const [essayDraft, setEssayDraft] = useState("");
  const [feedback, setFeedback] = useState("题库功能已接入数据模型，等待真实题源导入。");
  const styles = useMemo(() => createStyles(themeTokens), [themeTokens]);

  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.kicker}>考公练习</Text>
          <Text accessibilityRole="header" role="heading" style={styles.title}>
            每日题、错题和申论工作台
          </Text>
          <Text style={styles.subtitle}>本阶段建立题源授权、去重、每日题和答题链路；不会展示未审核题目，也不开放后台授权备注。</Text>
        </View>
        <View style={styles.heroStats}>
          <Metric label="今日题目" value="0" styles={styles} />
          <Metric label="收藏题" value="0" styles={styles} />
          <Metric label="正确率" value="0%" styles={styles} />
        </View>
      </View>

      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="button"
            accessibilityLabel={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabButton, activeTab === tab ? styles.tabSelected : null]}
          >
            <Text style={[styles.tabText, activeTab === tab ? styles.tabTextSelected : null]}>{tab}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.chipGrid}>
        {chips.map((chip) => (
          <Text key={chip} style={styles.chip}>
            {chip}
          </Text>
        ))}
      </View>

      {activeTab === "每日题" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>每日任务</Text>
          <Text style={styles.body}>每日任务头部保存到 daily_assignments，题目明细保存到 daily_assignment_items，并通过事务锁保证同一天只生成一份。</Text>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" accessibilityLabel="生成每日题" onPress={() => setFeedback("已触发每日题生成预览，真实执行将调用 generate_daily_assignment RPC。")} style={styles.primaryButton}>
              <Text style={styles.primaryText}>生成每日题</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="刷新题目" onPress={() => setFeedback("只读取已审核题目和公开题源信息。")} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>刷新题目</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {activeTab === "错题收藏" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>错题与收藏</Text>
          <Text style={styles.body}>question_attempts 优先关联 daily_assignment_item_id；错题统计按 question_mastery 汇总，收藏写入 question_favorites。</Text>
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>暂无错题记录</Text>
            <Text style={styles.body}>完成真实答题后这里会显示错题、收藏和知识点统计。</Text>
          </View>
        </View>
      ) : null}

      {activeTab === "申论" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>申论草稿</Text>
          <Text style={styles.body}>申论本阶段保存材料、草稿、参考要点和人工反馈，不宣称自动评分准确。</Text>
          <TextInput
            multiline
            onChangeText={setEssayDraft}
            placeholder="写下申论草稿"
            style={styles.textArea}
            value={essayDraft}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="保存申论草稿" onPress={() => setFeedback(essayDraft.trim() ? "申论草稿已进入保存流程预览。" : "请先输入申论草稿。")} style={styles.primaryButton}>
            <Text style={styles.primaryText}>保存草稿</Text>
          </Pressable>
        </View>
      ) : null}

      {activeTab === "题源" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>题源与审核</Text>
          <Text style={styles.body}>questions 只保存规范化题目主体，question_attributions 保存同题多来源；答案或解析冲突进入 needs_review，不自动覆盖。</Text>
          <View style={styles.sourceList}>
            <Text style={styles.sourceItem}>公开来源名称</Text>
            <Text style={styles.sourceItem}>公开来源链接</Text>
            <Text style={styles.sourceItem}>年份 / 地区 / 官方或回忆标记</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.stateRow}>
        <View style={styles.stateBox}>
          <Text style={styles.sectionTitle}>加载状态</Text>
          <Text style={styles.body}>正在读取题库配置...</Text>
        </View>
        <View style={styles.stateBox}>
          <Text style={styles.sectionTitle}>错误状态</Text>
          <Text style={styles.body}>读取失败时保留页面结构，并允许重试。</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="重试考公练习" onPress={() => setFeedback("已重新尝试读取考公练习数据。")} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>重试</Text>
          </Pressable>
        </View>
      </View>

      <Text nativeID="exam-feedback" style={styles.feedback}>{feedback}</Text>
    </View>
  );
}

function Metric({ label, styles, value }: { label: string; styles: ReturnType<typeof createStyles>; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    body: {
      color: tokens.textMuted,
      fontSize: 14,
      lineHeight: 20
    },
    card: {
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 12,
      borderWidth: 1,
      gap: 12,
      padding: 16
    },
    chip: {
      backgroundColor: tokens.accentSoft,
      borderColor: tokens.border,
      borderRadius: 999,
      borderWidth: 1,
      color: tokens.text,
      fontSize: 13,
      fontWeight: "800",
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    emptyBox: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 12,
      padding: 14
    },
    emptyTitle: {
      color: tokens.text,
      fontSize: 16,
      fontWeight: "900",
      marginBottom: 4
    },
    feedback: {
      backgroundColor: tokens.accentSoft,
      borderRadius: 10,
      color: tokens.text,
      fontSize: 13,
      fontWeight: "800",
      paddingHorizontal: 12,
      paddingVertical: 10
    },
    hero: {
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 16,
      justifyContent: "space-between",
      padding: 18
    },
    heroStats: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10
    },
    heroText: {
      flex: 1,
      minWidth: 240
    },
    kicker: {
      color: tokens.accent,
      fontSize: 13,
      fontWeight: "900"
    },
    metric: {
      backgroundColor: tokens.surfaceMuted,
      borderColor: tokens.border,
      borderRadius: 12,
      borderWidth: 1,
      minWidth: 94,
      padding: 12
    },
    metricLabel: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "800"
    },
    metricValue: {
      color: tokens.text,
      fontSize: 22,
      fontWeight: "900",
      marginTop: 4
    },
    primaryButton: {
      alignSelf: "flex-start",
      backgroundColor: tokens.accent,
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
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10
    },
    secondaryText: {
      color: tokens.text,
      fontWeight: "900"
    },
    sectionTitle: {
      color: tokens.text,
      fontSize: 17,
      fontWeight: "900"
    },
    sourceItem: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 10,
      color: tokens.text,
      fontWeight: "800",
      paddingHorizontal: 12,
      paddingVertical: 9
    },
    sourceList: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    stack: {
      gap: 14
    },
    stateBox: {
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 12,
      borderWidth: 1,
      flex: 1,
      gap: 8,
      minWidth: 220,
      padding: 16
    },
    stateRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12
    },
    subtitle: {
      color: tokens.textMuted,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 8
    },
    tabButton: {
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 9
    },
    tabRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    tabSelected: {
      backgroundColor: tokens.accent
    },
    tabText: {
      color: tokens.text,
      fontSize: 14,
      fontWeight: "900"
    },
    tabTextSelected: {
      color: "#ffffff"
    },
    textArea: {
      borderColor: tokens.border,
      borderRadius: 12,
      borderWidth: 1,
      color: tokens.text,
      minHeight: 100,
      paddingHorizontal: 12,
      paddingVertical: 10,
      textAlignVertical: "top"
    },
    title: {
      color: tokens.text,
      fontSize: 26,
      fontWeight: "900",
      marginTop: 4
    }
  });
}
