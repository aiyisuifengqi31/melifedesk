import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const workoutParts = ["胸", "背", "肩", "手臂", "核心", "腿", "臀", "有氧", "全身", "拉伸", "休息"];

export function WorkoutPanel() {
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={styles.title}>今日是否训练</Text>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel="今天训练了" style={styles.button}>
            <Text style={styles.buttonText}>训练了</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="今天休息" style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>休息</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>训练部位</Text>
        <View style={styles.partGrid}>
          {workoutParts.map((part) => (
            <Text key={part} style={styles.part}>
              {part}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>训练记录</Text>
        <TextInput placeholder="训练项目" style={styles.input} />
        <TextInput keyboardType="numeric" placeholder="训练时长" style={styles.input} />
        <TextInput keyboardType="numeric" placeholder="消耗热量" style={styles.input} />
        <Text style={styles.muted}>热量第一版由用户手动输入；若后续提供估算值，必须标记为 estimated。</Text>

        <Text style={styles.title}>训练强度</Text>
        <View style={styles.row}>
          <Text style={styles.part}>轻松</Text>
          <Text style={styles.part}>适中</Text>
          <Text style={styles.part}>高强度</Text>
        </View>

        <TextInput placeholder="自我感受" style={styles.input} />
        <TextInput placeholder="备注" style={styles.input} />
        <Pressable accessibilityRole="button" accessibilityLabel="上传健身图片" style={styles.button}>
          <Text style={styles.buttonText}>上传健身图片</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        <Metric title="本周训练次数" value="0" />
        <Metric title="本周训练总时长" value="0 分钟" />
        <Metric title="本周热量" value="手动记录" />
        <Metric title="连续训练天数" value="0 天" />
      </View>

      <View style={styles.grid}>
        <Metric title="最近 30 天" value="训练日历" />
        <Metric title="各部位训练频率" value="等待真实记录" />
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
    borderColor: "#e5d4b5",
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
    borderColor: "#e5d4b5",
    borderRadius: 8,
    borderWidth: 1,
    color: "#322414",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  metric: {
    backgroundColor: "#ffffff",
    borderColor: "#e5d4b5",
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 150,
    padding: 16
  },
  muted: {
    color: "#75634e",
    fontSize: 13,
    lineHeight: 18
  },
  part: {
    backgroundColor: "#ffe8bc",
    borderRadius: 8,
    color: "#322414",
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  partGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  secondaryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#fffaf0",
    borderColor: "#d9902f",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  secondaryText: {
    color: "#322414",
    fontWeight: "800"
  },
  stack: {
    gap: 14
  },
  title: {
    color: "#322414",
    fontSize: 16,
    fontWeight: "800"
  },
  value: {
    color: "#322414",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 4
  }
});
