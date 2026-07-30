import { Image, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionChip, AppPage, ContentCard, EmptyState, FloatingQuickAction, PageHeader, PrimaryButton, SectionHeader, SegmentedTabs, StatCard, type UiTokens } from "@/shared/ui/primitives";
import { calculateCycleWindow, calculateDaysTogether } from "./loveService";

const tabs = ["今日心情", "日记", "纪念日", "生理周期", "倒计时"];
const tokens: UiTokens = {
  accent: "#8f5a72",
  accentSoft: "#f4e4ec",
  background: "#fff8fb",
  border: "#ead4df",
  surface: "#ffffff",
  surfaceMuted: "#fbedf3",
  text: "#332431",
  textMuted: "#786574"
};

export function LovePanel({ themeTokens = tokens }: { themeTokens?: UiTokens }) {
  const daysTogether = calculateDaysTogether("2025-05-20", "2026-07-30");
  const cycleWindow = calculateCycleWindow("2026-07-10");

  return (
    <AppPage tokens={themeTokens}>
      <PageHeader meta={`在一起 ${daysTogether} 天 · 下一个纪念日还有 24 天`} subtitle="记录我们的小日常" title="恋爱日记" tokens={themeTokens} />
      <SegmentedTabs options={tabs} selected="今日心情" tokens={themeTokens} />

      <View style={styles.grid}>
        <StatCard label="在一起天数" value={`${daysTogether}`} tokens={themeTokens} />
        <StatCard label="下一纪念日倒计时" value="24 天" tokens={themeTokens} />
        <StatCard label="恋爱开始日期" value="2025-05-20" tokens={themeTokens} />
        <StatCard label="双方生日" value="已预留" tokens={themeTokens} />
      </View>

      <ContentCard tokens={themeTokens}>
        <SectionHeader title="今日心情" tokens={themeTokens} />
        <View style={styles.row}>
          <ActionChip label="我的心情" selected tokens={themeTokens} />
          <ActionChip label="对方心情" tokens={themeTokens} />
          <ActionChip label="心情分数 8/10" tokens={themeTokens} />
        </View>
        <TextInput placeholder="心情文字" style={[styles.input, { borderColor: themeTokens.border, color: themeTokens.text }]} />
        <View style={styles.row}>
          {["开心", "想念", "忙碌", "需要抱抱"].map((tag) => (
            <ActionChip key={tag} label={tag} tokens={themeTokens} />
          ))}
        </View>
        <PrimaryButton label="记录心情" tokens={themeTokens} />
      </ContentCard>

      <ContentCard tokens={themeTokens}>
        <SectionHeader title="日记" tokens={themeTokens} />
        <Text style={[styles.body, { color: themeTokens.textMuted }]}>日记时间轴 · private / couple_read / couple_edit · 共同编辑开关</Text>
        <View style={[styles.diaryPreview, { backgroundColor: themeTokens.surfaceMuted }]}>
          <View>
            <Text style={[styles.cardTitle, { color: themeTokens.text }]}>晚饭后散步</Text>
            <Text style={[styles.body, { color: themeTokens.textMuted }]}>2026-07-30 · 标签：日常 / 散步 · 可见范围：couple_read</Text>
          </View>
          <Image accessibilityLabel="日记图片缩略图" source={{ uri: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" }} style={styles.thumbnail} />
        </View>
        <PrimaryButton label="编辑日记" tokens={themeTokens} />
      </ContentCard>

      <ContentCard tokens={themeTokens}>
        <SectionHeader title="纪念日" tokens={themeTokens} />
        <View style={styles.row}>
          <ActionChip label="恋爱开始日期" selected tokens={themeTokens} />
          <ActionChip label="下一纪念日倒计时" tokens={themeTokens} />
          <ActionChip label="自定义倒计时" tokens={themeTokens} />
        </View>
      </ContentCard>

      <ContentCard tokens={themeTokens}>
        <SectionHeader title="生理周期" tokens={themeTokens} />
        <Text style={[styles.body, { color: themeTokens.textMuted }]}>当前状态：记录者本人可编辑；对象仅在授权开启时只读。</Text>
        <Text style={[styles.body, { color: themeTokens.text }]}>预测区间：{cycleWindow.startDate} 至 {cycleWindow.endDate}</Text>
        <Text style={[styles.disclaimer, { color: themeTokens.accent }]}>仅供日程参考，不构成医疗建议。</Text>
      </ContentCard>

      <EmptyState description="还没有更多共同记忆。可以先记录今天的心情，或者写一篇小日记。" title="空状态卡片" tokens={themeTokens} />
      <FloatingQuickAction label="快速记录" tokens={themeTokens} />
    </AppPage>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 14,
    lineHeight: 20
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "900"
  },
  diaryPreview: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 12
  },
  disclaimer: {
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 19
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  thumbnail: {
    borderRadius: 10,
    height: 58,
    width: 58
  }
});
