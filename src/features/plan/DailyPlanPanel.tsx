import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export function DailyPlanPanel() {
  const today = new Date().toLocaleDateString("zh-CN", {
    day: "2-digit",
    month: "2-digit",
    weekday: "long"
  });

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={styles.title}>今日日期</Text>
        <Text style={styles.value}>{today}</Text>
        <Text style={styles.muted}>早上好，今天也一起稳稳推进。</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.title}>天气</Text>
          <Text style={styles.muted}>天气 provider：placeholder</Text>
          <Text style={styles.muted}>未授权定位或未配置 key 时，页面仍可用。</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>月历</Text>
          <Text style={styles.value}>本月视图</Text>
          <Text style={styles.muted}>任务和日历事件会从 Supabase 查询。</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>今日待办</Text>
        <TextInput placeholder="新增待办" style={styles.input} />
        <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel="新增待办" style={styles.button}>
            <Text style={styles.buttonText}>新增</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="快速记录" style={styles.button}>
            <Text style={styles.buttonText}>快速记录</Text>
          </Pressable>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.status}>todo</Text>
          <Text style={styles.status}>进行中</Text>
          <Text style={styles.status}>done</Text>
          <Text style={styles.status}>cancelled</Text>
        </View>
        <Text style={styles.muted}>支持编辑待办、完成待办、取消完成、防重复提交。</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.title}>子任务</Text>
          <Text style={styles.muted}>子表权限跟随父 tasks。</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>重复规则</Text>
          <Text style={styles.muted}>按天、周、月保存到 task_recurrences。</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>延期处理</Text>
          <Text style={styles.muted}>未完成任务需要用户选择移到今天、逐项处理或取消。</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>状态示例</Text>
        <Text style={styles.muted}>加载状态 / 空数据状态 / 错误状态</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="重试" style={styles.button}>
          <Text style={styles.buttonText}>重试</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#34261d",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "800"
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#ded8ea",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 16
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  input: {
    borderColor: "#ded8ea",
    borderRadius: 8,
    borderWidth: 1,
    color: "#272234",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  muted: {
    color: "#6e647a",
    fontSize: 13,
    lineHeight: 18
  },
  row: {
    flexDirection: "row",
    gap: 8
  },
  stack: {
    gap: 14
  },
  status: {
    backgroundColor: "#ebe5ff",
    borderRadius: 8,
    color: "#272234",
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  title: {
    color: "#272234",
    fontSize: 16,
    fontWeight: "800"
  },
  value: {
    color: "#272234",
    fontSize: 20,
    fontWeight: "800"
  }
});
