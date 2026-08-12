import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/shared/ui/PressableScale";
import { MealSpinner } from "@/features/home/MealSpinner";

export default function MealRoute() {
  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="返回首页"
          onPress={() => router.back()}
          style={styles.backButton}
          wrapperStyle={styles.backButtonWrap}
        >
          <Text style={styles.backButtonText}>← 返回</Text>
        </PressableScale>
        <Text style={styles.headerTitle}>今天吃什么</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <MealSpinner />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f5f7f5"
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e8ede8"
  },
  backButton: {
    backgroundColor: "#f0f5f0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  backButtonWrap: {
    flexShrink: 0
  },
  backButtonText: {
    color: "#4a7c4a",
    fontSize: 14,
    fontWeight: "900"
  },
  headerTitle: {
    color: "#1f2937",
    fontSize: 17,
    fontWeight: "900"
  },
  headerSpacer: {
    width: 60
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  }
});
