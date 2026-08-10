import { StyleSheet, Text, View } from "react-native";

import type { UiTokens } from "@/shared/ui/primitives";

type SummaryCardProps = {
  count?: string;
  testID?: string;
  title: string;
  tokens: UiTokens;
  value: string;
};

type BalanceSummaryCardProps = {
  expense: string;
  income: string;
  testID?: string;
  title: string;
  tokens: UiTokens;
  value: string;
};

export function SummaryCard({ count, testID, title, tokens, value }: SummaryCardProps) {
  const styles = createStyles(tokens);

  return (
    <View testID={testID} style={styles.metric}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text numberOfLines={1} style={styles.metricValue}>{value}</Text>
      {count ? <Text style={styles.metricCount}>{count}</Text> : null}
    </View>
  );
}

export function BalanceSummaryCard({ expense, income, testID = "finance-balance-summary", title, tokens, value }: BalanceSummaryCardProps) {
  const styles = createStyles(tokens);
  const negative = value.includes("-");

  const toCents = (raw: string) => {
    const clean = raw.replace(/[^\d.]/g, "");
    const [yuan = "0", frac = ""] = clean.split(".");
    return Math.max(0, Number.parseInt(yuan || "0", 10) * 100 + Number.parseInt((frac + "00").slice(0, 2), 10));
  };
  const incomeCents = toCents(income);
  const expenseCents = toCents(expense);
  const expenseRatio = incomeCents > 0 ? Math.min(expenseCents / incomeCents, 1) : 0;
  const balanceRatio = 1 - expenseRatio;

  return (
    <View testID={testID} style={styles.balanceCard}>
      <View style={styles.balanceMain}>
        <Text style={styles.metricTitle}>{title}</Text>
        <Text numberOfLines={1} style={[styles.balanceValue, negative ? styles.balanceValueNegative : null]}>{value}</Text>
      </View>
      <View style={styles.balanceSide}>
        <Text style={styles.sideText}>收入 {income}</Text>
        <Text style={styles.sideText}>支出 {expense}</Text>
        <View style={styles.ratioTrack}>
          {incomeCents > 0 ? (
            <>
              <View style={[styles.ratioExpense, { flexGrow: expenseRatio }]} />
              <View style={[styles.ratioBalance, { flexGrow: balanceRatio }]} />
            </>
          ) : (
            <View style={styles.ratioEmpty} />
          )}
        </View>
      </View>
    </View>
  );
}

function createStyles(tokens: UiTokens) {
  const danger = tokens.danger ?? "#ef4444";

  return StyleSheet.create({
    balanceCard: {
      alignItems: "center",
      backgroundColor: "#f8fbff",
      borderColor: "#e1eef8",
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: "row",
      gap: 14,
      justifyContent: "space-between",
      minWidth: 0,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    balanceMain: {
      flex: 1,
      gap: 4,
      minWidth: 0
    },
    balanceSide: {
      gap: 5,
      minWidth: 110
    },
    balanceValue: {
      color: tokens.accent,
      fontSize: 22,
      fontWeight: "900"
    },
    balanceValueNegative: {
      color: danger
    },
    metric: {
      alignItems: "flex-start",
      backgroundColor: "#f8fbff",
      borderColor: "#e1eef8",
      borderRadius: 12,
      borderWidth: 1,
      flex: 1,
      flexBasis: "31%",
      minWidth: 0,
      overflow: "hidden",
      paddingHorizontal: 7,
      paddingVertical: 9
    },
    metricCount: {
      color: tokens.textMuted,
      fontSize: 10,
      fontWeight: "700",
      marginTop: 2
    },
    metricTitle: {
      color: tokens.textMuted,
      fontSize: 11,
      fontWeight: "800"
    },
    metricValue: {
      color: tokens.accent,
      flexShrink: 1,
      fontSize: 13,
      fontWeight: "900",
      marginTop: 2,
      maxWidth: "100%"
    },
    ratioExpense: {
      backgroundColor: "#1fa8e2"
    },
    ratioBalance: {
      backgroundColor: "#dff3e5"
    },
    ratioEmpty: {
      backgroundColor: "#e3e8ef",
      flex: 1
    },
    ratioTrack: {
      backgroundColor: "#eef6f0",
      borderColor: "#d7e9dc",
      borderWidth: 1,
      borderRadius: 999,
      flexDirection: "row",
      height: 9,
      overflow: "hidden"
    },
    sideText: {
      color: tokens.textMuted,
      fontSize: 11,
      fontWeight: "800"
    }
  });
}
