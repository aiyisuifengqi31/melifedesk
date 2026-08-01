import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { UiTokens } from "@/shared/ui/primitives";
import {
  generateFashion,
  generateMakeup,
  generateTrends,
  type FashionCategory,
  type FashionGender,
  type MakeupItem
} from "./entertainmentData";

type EntertainmentPanelProps = {
  themeTokens: UiTokens;
};

type EntTab = "trend" | "fashion" | "makeup";

const FASHION_CATEGORIES: FashionCategory[] = ["衣服", "鞋子", "上衣", "裤子", "裙子"];

export function EntertainmentPanel({ themeTokens: tokens }: EntertainmentPanelProps) {
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [tab, setTab] = useState<EntTab>("trend");
  const [trends, setTrends] = useState(() => generateTrends());
  const [fashionGender, setFashionGender] = useState<FashionGender>("女");
  const [fashionCategory, setFashionCategory] = useState<FashionCategory>("衣服");
  const [fashion, setFashion] = useState(() => generateFashion("女", "衣服"));
  const [makeup, setMakeup] = useState<MakeupItem[]>(() => generateMakeup());

  const refreshTrends = () => setTrends(generateTrends());
  const refreshFashion = () => setFashion(generateFashion(fashionGender, fashionCategory));
  const refreshMakeup = () => setMakeup(generateMakeup());

  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>娱乐</Text>
        <Text style={styles.heroSub}>热点、穿搭与妆容，每天更新</Text>
      </View>

      <View style={styles.tabs}>
        <Pressable accessibilityRole="button" accessibilityLabel="热点推荐" onPress={() => setTab("trend")} style={[styles.tab, tab === "trend" ? styles.tabActive : null]}>
          <Text style={[styles.tabText, tab === "trend" ? styles.tabTextActive : null]}>📰 热点推荐</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="衣服推荐" onPress={() => setTab("fashion")} style={[styles.tab, tab === "fashion" ? styles.tabActive : null]}>
          <Text style={[styles.tabText, tab === "fashion" ? styles.tabTextActive : null]}>👗 衣服推荐</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="化妆教程" onPress={() => setTab("makeup")} style={[styles.tab, tab === "makeup" ? styles.tabActive : null]}>
          <Text style={[styles.tabText, tab === "makeup" ? styles.tabTextActive : null]}>💄 化妆教程</Text>
        </Pressable>
      </View>

      {tab === "trend" ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>今日热点推荐</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="换一批" onPress={refreshTrends} style={styles.refreshButton}>
              <Text style={styles.refreshText}>↻ 换一批</Text>
            </Pressable>
          </View>
          <View style={styles.trendList}>
            {trends.map((item) => (
              <View key={item.id} style={styles.trendRow}>
                <Text style={[styles.trendRank, item.rank <= 3 ? styles.trendRankTop : null]}>{item.rank}</Text>
                <View style={styles.trendSourceBadge}>
                  <Text style={styles.trendSourceText}>{item.source}</Text>
                </View>
                <Text style={styles.trendTitle} numberOfLines={1}>{item.title}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {tab === "fashion" ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>今日衣服推荐</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="换一批" onPress={refreshFashion} style={styles.refreshButton}>
              <Text style={styles.refreshText}>↻ 换一批</Text>
            </Pressable>
          </View>

          <View style={styles.fashionFilters}>
            <View style={styles.genderToggle}>
              {(["女", "男"] as FashionGender[]).map((g) => (
                <Pressable
                  key={g}
                  accessibilityRole="button"
                  accessibilityLabel={`性别：${g}`}
                  onPress={() => {
                    setFashionGender(g);
                    setFashion(generateFashion(g, fashionCategory));
                  }}
                  style={[styles.genderChip, fashionGender === g ? styles.genderChipActive : null]}
                >
                  <Text style={[styles.genderChipText, fashionGender === g ? styles.genderChipTextActive : null]}>{g}</Text>
                </Pressable>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fashionCategoryRow}>
              {FASHION_CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={`品类：${c}`}
                  onPress={() => {
                    setFashionCategory(c);
                    setFashion(generateFashion(fashionGender, c));
                  }}
                  style={[styles.fashionCategoryChip, fashionCategory === c ? styles.fashionCategoryChipActive : null]}
                >
                  <Text style={[styles.fashionCategoryText, fashionCategory === c ? styles.fashionCategoryTextActive : null]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.fashionList}>
            {fashion.map((item) => (
              <View key={item.id} style={styles.fashionCard}>
                <View style={styles.fashionEmojiBox}>
                  <Text style={styles.fashionEmoji}>{item.imageEmoji}</Text>
                </View>
                <View style={styles.fashionInfo}>
                  <Text style={styles.fashionTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.fashionBrand}>{item.brand}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {tab === "makeup" ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>热门化妆教程</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="换一批" onPress={refreshMakeup} style={styles.refreshButton}>
              <Text style={styles.refreshText}>↻ 换一批</Text>
            </Pressable>
          </View>
          <View style={styles.makeupList}>
            {makeup.map((item) => (
              <View key={item.id} style={styles.makeupCard}>
                <View style={styles.makeupThumb}>
                  <Text style={styles.makeupEmoji}>{item.emoji}</Text>
                  <View style={styles.makeupDuration}>
                    <Text style={styles.makeupDurationText}>{item.duration}</Text>
                  </View>
                </View>
                <View style={styles.makeupInfo}>
                  <Text style={styles.makeupTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.makeupMeta}>{item.author} · {item.views}次播放</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    card: {
      backgroundColor: "#ffffff",
      borderRadius: 22,
      gap: 14,
      padding: 18,
      shadowColor: "#7cb87c",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 2
    },
    cardHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    cardTitle: {
      color: tokens.text,
      fontSize: 18,
      fontWeight: "900"
    },
    fashionCategoryChip: {
      backgroundColor: "#f1f5f1",
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8
    },
    fashionCategoryChipActive: {
      backgroundColor: tokens.accentSoft
    },
    fashionCategoryRow: {
      flexDirection: "row",
      gap: 8
    },
    fashionCategoryText: {
      color: tokens.textMuted,
      fontSize: 14,
      fontWeight: "800"
    },
    fashionCategoryTextActive: {
      color: tokens.accent
    },
    fashionCard: {
      alignItems: "center",
      backgroundColor: "#f6faf6",
      borderRadius: 16,
      flexDirection: "row",
      gap: 14,
      padding: 12
    },
    fashionEmoji: {
      fontSize: 26
    },
    fashionEmojiBox: {
      alignItems: "center",
      backgroundColor: "#ffffff",
      borderRadius: 14,
      height: 52,
      justifyContent: "center",
      width: 52
    },
    fashionFilters: {
      gap: 10
    },
    fashionInfo: {
      flex: 1,
      gap: 4
    },
    fashionList: {
      gap: 10
    },
    fashionTitle: {
      color: tokens.text,
      fontSize: 16,
      fontWeight: "900"
    },
    fashionBrand: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "800"
    },
    genderChip: {
      backgroundColor: "#f1f5f1",
      borderRadius: 999,
      paddingHorizontal: 18,
      paddingVertical: 8
    },
    genderChipActive: {
      backgroundColor: tokens.accent
    },
    genderChipText: {
      color: tokens.textMuted,
      fontSize: 14,
      fontWeight: "900"
    },
    genderChipTextActive: {
      color: "#ffffff"
    },
    genderToggle: {
      alignSelf: "flex-start",
      flexDirection: "row",
      gap: 8
    },
    hero: {
      gap: 6
    },
    heroSub: {
      color: tokens.textMuted,
      fontSize: 15,
      fontWeight: "700"
    },
    heroTitle: {
      color: tokens.text,
      fontSize: 30,
      fontWeight: "900"
    },
    makeupCard: {
      backgroundColor: "#f6faf6",
      borderRadius: 16,
      flexDirection: "row",
      gap: 14,
      padding: 12
    },
    makeupDuration: {
      backgroundColor: "rgba(0,0,0,0.55)",
      borderRadius: 6,
      bottom: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      position: "absolute",
      right: 6
    },
    makeupDurationText: {
      color: "#ffffff",
      fontSize: 11,
      fontWeight: "800"
    },
    makeupEmoji: {
      fontSize: 30
    },
    makeupInfo: {
      flex: 1,
      gap: 6
    },
    makeupList: {
      gap: 12
    },
    makeupMeta: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "800"
    },
    makeupThumb: {
      backgroundColor: "#ffffff",
      borderRadius: 14,
      height: 72,
      justifyContent: "center",
      width: 100,
      alignItems: "center"
    },
    makeupTitle: {
      color: tokens.text,
      fontSize: 16,
      fontWeight: "900"
    },
    refreshButton: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4
    },
    refreshText: {
      color: tokens.accent,
      fontSize: 14,
      fontWeight: "900"
    },
    stack: {
      gap: 18
    },
    tab: {
      alignItems: "center",
      backgroundColor: "#f1f5f1",
      borderRadius: 14,
      flex: 1,
      paddingVertical: 13
    },
    tabActive: {
      backgroundColor: tokens.accent
    },
    tabs: {
      flexDirection: "row",
      gap: 8
    },
    tabText: {
      color: tokens.textMuted,
      fontSize: 15,
      fontWeight: "900"
    },
    tabTextActive: {
      color: "#ffffff"
    },
    trendList: {
      gap: 12
    },
    trendRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10
    },
    trendRank: {
      color: tokens.textMuted,
      fontSize: 16,
      fontWeight: "900",
      width: 26
    },
    trendRankTop: {
      color: "#ef4444"
    },
    trendSourceBadge: {
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4
    },
    trendSourceText: {
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "900"
    },
    trendTitle: {
      color: tokens.text,
      flex: 1,
      fontSize: 15,
      fontWeight: "700"
    }
  });
}
