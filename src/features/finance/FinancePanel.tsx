import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const expenseCategories = ["餐饮", "买菜", "交通", "加油", "购物", "学习", "娱乐", "恋爱", "医疗", "房租", "份子", "其他"];
const incomeCategories = ["生活费", "工资", "奖学金", "兼职", "红包", "退款", "其他"];

export function FinancePanel() {
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"income" | "expense">("expense");
  const [feedback, setFeedback] = useState("输入金额后可以保存为预览账单。");

  const savePreviewTransaction = () => {
    if (!amount.trim()) {
      setFeedback("请先输入金额。");
      return;
    }
    setFeedback(`已加入预览账单：${direction === "expense" ? "支出" : "收入"} ${amount}`);
  };

  return (
    <View style={styles.stack}>
      <View style={styles.grid}>
        {["今日支出", "今日收入", "本月支出", "本月收入", "本月结余", "预算剩余"].map((label) => (
          <Metric key={label} title={label} value="0.00" />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>快速记账入口</Text>
        <TextInput keyboardType="decimal-pad" onChangeText={setAmount} placeholder="输入金额" style={styles.input} value={amount} />
        <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel="收入" onPress={() => setDirection("income")} style={[styles.pillButton, direction === "income" ? styles.pillSelected : null]}>
            <Text style={styles.pill}>收入</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="支出" onPress={() => setDirection("expense")} style={[styles.pillButton, direction === "expense" ? styles.pillSelected : null]}>
            <Text style={styles.pill}>支出</Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>{"固定流程：输入金额 -> 选择分类 -> 可选备注 -> 保存。"}</Text>
        <TextInput placeholder="可选备注" style={styles.input} />
        <Pressable accessibilityRole="button" accessibilityLabel="快速记账" nativeID="finance-save-button" onPress={savePreviewTransaction} style={styles.button}>
          <Text style={styles.buttonText}>快速记账</Text>
        </Pressable>
        <Text nativeID="finance-feedback" style={styles.feedback}>{feedback}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>分类图标网格</Text>
        <View style={styles.categoryGrid}>
          {[...expenseCategories.map((name) => `支出-${name}`), ...incomeCategories.map((name) => `收入-${name}`)].map((category) => (
            <Text key={category} style={styles.category}>
              {category}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.grid}>
        <Metric title="最近账单" value="暂无账单" />
        <Metric title="最近 7 天支出趋势" value="基础图表占位" />
        <Metric title="最近 30 天支出趋势" value="基础图表占位" />
        <Metric title="本月分类占比" value="等待真实账单" />
        <Metric title="本月与上月对比" value="等待真实账单" />
        <Metric title="预算卡片" value="月度 / 分类预算" />
        <Metric title="存钱目标" value="目标进度" />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>状态示例</Text>
        <Text style={styles.muted}>加载状态 / 空数据状态 / 错误状态 / 防重复提交。</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="重试" onPress={() => setFeedback("已重新尝试读取账单。")} style={styles.button}>
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
    backgroundColor: "#273423",
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
    borderColor: "#d4dfca",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 16
  },
  category: {
    backgroundColor: "#e9f2df",
    borderRadius: 8,
    color: "#263421",
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  feedback: {
    backgroundColor: "#e9f2df",
    borderRadius: 8,
    color: "#263421",
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  input: {
    borderColor: "#d4dfca",
    borderRadius: 8,
    borderWidth: 1,
    color: "#263421",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  metric: {
    backgroundColor: "#ffffff",
    borderColor: "#d4dfca",
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 150,
    padding: 16
  },
  muted: {
    color: "#66725d",
    fontSize: 13,
    lineHeight: 18
  },
  pill: {
    color: "#263421",
    fontWeight: "800"
  },
  pillButton: {
    backgroundColor: "#e9f2df",
    borderColor: "transparent",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  pillSelected: {
    borderColor: "#273423"
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
    color: "#263421",
    fontSize: 16,
    fontWeight: "800"
  },
  value: {
    color: "#263421",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 4
  }
});
