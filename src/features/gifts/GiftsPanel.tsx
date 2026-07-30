import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const eventTypes = ["婚礼", "订婚", "生日", "满月", "乔迁", "升学", "丧事", "节日", "其他"];

export function GiftsPanel() {
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={styles.title}>新增份子记录</Text>
        <TextInput placeholder="搜索联系人" style={styles.input} />
        <View style={styles.row}>
          <Text style={styles.pill}>送出 / 收到切换</Text>
          <Text style={styles.pill}>默认 private</Text>
        </View>
        <View style={styles.categoryGrid}>
          {eventTypes.map((eventType) => (
            <Text key={eventType} style={styles.category}>
              {eventType}
            </Text>
          ))}
        </View>
        <TextInput keyboardType="decimal-pad" placeholder="金额" style={styles.input} />
        <TextInput placeholder="地点" style={styles.input} />
        <TextInput placeholder="备注" style={styles.input} />
        <Text style={styles.title}>是否同步到记账</Text>
        <Text style={styles.muted}>送出份子钱可同步生成支出账单，关联账单通过 gift_record_id 防重复。</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="保存份子记录" style={styles.button}>
          <Text style={styles.buttonText}>保存份子记录</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        <Metric title="联系人列表" value="支持联系人关系" />
        <Metric title="联系人历史" value="往来记录" />
        <Metric title="往来差额" value="0.00" />
        <Metric title="待回礼" value="回礼提醒日期" />
        <Metric title="年度统计" value="送出 / 收到" />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>状态示例</Text>
        <Text style={styles.muted}>加载状态 / 空数据状态 / 错误状态 / 防重复提交</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="重试" style={styles.button}>
          <Text style={styles.buttonText}>重试</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#3b271d",
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
    borderColor: "#e5d7c6",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 16
  },
  category: {
    backgroundColor: "#f6e5d0",
    borderRadius: 8,
    color: "#39271d",
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  input: {
    borderColor: "#e5d7c6",
    borderRadius: 8,
    borderWidth: 1,
    color: "#39271d",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  metric: {
    backgroundColor: "#ffffff",
    borderColor: "#e5d7c6",
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 150,
    padding: 16
  },
  muted: {
    color: "#756354",
    fontSize: 13,
    lineHeight: 18
  },
  pill: {
    backgroundColor: "#f6e5d0",
    borderRadius: 8,
    color: "#39271d",
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  stack: {
    gap: 14
  },
  title: {
    color: "#39271d",
    fontSize: 16,
    fontWeight: "800"
  },
  value: {
    color: "#39271d",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4
  }
});
