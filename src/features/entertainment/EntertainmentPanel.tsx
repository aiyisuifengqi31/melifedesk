import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { UiTokens } from "@/shared/ui/primitives";
import {
  FASHION_CHANNELS,
  MAKEUP_CHANNELS,
  generateFashion,
  generateMakeup,
  openLink,
  type FashionCategory,
  type FashionGender,
  type MakeupItem
} from "./entertainmentData";
import { fetchHotList, type HotItem, type HotSource } from "./hotListService";

type EntertainmentPanelProps = {
  themeTokens: UiTokens;
};

type EntTab = "trend" | "fashion" | "makeup";

const FASHION_CATEGORIES: FashionCategory[] = ["衣服", "鞋子", "上衣", "裤子", "裙子"];
const HOT_SOURCES: HotSource[] = ["百度", "微博", "知乎"];

export function EntertainmentPanel({ themeTokens: tokens }: EntertainmentPanelProps) {
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [tab, setTab] = useState<EntTab>("trend");

  const [hotSource, setHotSource] = useState<HotSource>("百度");
  const [hotItems, setHotItems] = useState<HotItem[]>([]);
  const [hotLoading, setHotLoading] = useState(false);
  const [hotError, setHotError] = useState("");
  const [hotUpdatedAt, setHotUpdatedAt] = useState("");

  const [fashionGender, setFashionGender] = useState<FashionGender>("女");
  const [fashionCategory, setFashionCategory] = useState<FashionCategory>("衣服");
  const [fashion, setFashion] = useState(() => generateFashion("女", "衣服"));
  const [makeup, setMakeup] = useState<MakeupItem[]>(() => generateMakeup());

  const loadHot = useCallback(async (source: HotSource, force = false) => {
    setHotLoading(true);
    setHotError("");
    const result = await fetchHotList(source, { force });
    setHotItems(result.items);
    setHotUpdatedAt(result.updatedAt);
    setHotError(result.error ?? "");
    setHotLoading(false);
  }, []);

  useEffect(() => {
    void loadHot(hotSource);
  }, [hotSource, loadHot]);

  const refreshFashion = () => setFashion(generateFashion(fashionGender, fashionCategory));
  const refreshMakeup = () => setMakeup(generateMakeup());

  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>娱乐</Text>
        <Text style={styles.heroSub}>实时热榜、穿搭灵感与妆容教程</Text>
      </View>

      {tab === "trend" ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{hotSource}热榜</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="刷新热榜" onPress={() => void loadHot(hotSource, true)} style={styles.refreshButton}>
              <Text style={styles.refreshText}>↻ 刷新</Text>
            </Pressable>
          </View>

          <View style={styles.sourceRow}>
            {HOT_SOURCES.map((source) => (
              <Pressable
                key={source}
                accessibilityRole="button"
                accessibilityLabel={`${source}热榜`}
                onPress={() => setHotSource(source)}
                style={[styles.sourceChip, hotSource === source ? styles.sourceChipActive : null]}
              >
                <Text style={[styles.sourceChipText, hotSource === source ? styles.sourceChipTextActive : null]}>{source}</Text>
              </Pressable>
            ))}
          </View>

          {hotUpdatedAt ? <Text style={styles.updatedText}>更新于 {hotUpdatedAt} · 点击条目查看原文</Text> : null}
          {hotError ? <Text style={styles.errorText}>{hotError}</Text> : null}

          {hotLoading && hotItems.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={tokens.accent} />
              <Text style={styles.loadingText}>正在获取实时热榜…</Text>
            </View>
          ) : null}

          <View style={styles.trendList}>
            {hotItems.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                disabled={!item.url}
                onPress={() => (item.url ? openLink(item.url) : undefined)}
                style={styles.trendRow}
              >
                <Text style={[styles.trendRank, item.rank <= 3 ? styles.trendRankTop : null]}>{item.rank}</Text>
                <View style={styles.trendBody}>
                  <Text style={styles.trendTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.desc ? (
                    <Text style={styles.trendDesc} numberOfLines={1}>
                      {item.desc}
                    </Text>
                  ) : null}
                </View>
                {item.hot ? <Text style={styles.trendHot}>{item.hot}</Text> : null}
              </Pressable>
            ))}
          </View>

          {!hotLoading && hotItems.length === 0 ? <Text style={styles.emptyText}>暂时没有拿到数据，点击“刷新”再试一次。</Text> : null}
        </View>
      ) : null}

      {tab === "fashion" ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>今日穿搭推荐</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="换一批穿搭" onPress={refreshFashion} style={styles.refreshButton}>
              <Text style={styles.refreshText}>↻ 换一批</Text>
            </Pressable>
          </View>

          <View style={styles.fashionFilters}>
            <View style={styles.genderToggle}>
              {(["女", "男"] as FashionGender[]).map((gender) => (
                <Pressable
                  key={gender}
                  accessibilityRole="button"
                  accessibilityLabel={`性别：${gender}`}
                  onPress={() => {
                    setFashionGender(gender);
                    setFashion(generateFashion(gender, fashionCategory));
                  }}
                  style={[styles.genderChip, fashionGender === gender ? styles.genderChipActive : null]}
                >
                  <Text style={[styles.genderChipText, fashionGender === gender ? styles.genderChipTextActive : null]}>{gender}</Text>
                </Pressable>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {FASHION_CATEGORIES.map((category) => (
                <Pressable
                  key={category}
                  accessibilityRole="button"
                  accessibilityLabel={`品类：${category}`}
                  onPress={() => {
                    setFashionCategory(category);
                    setFashion(generateFashion(fashionGender, category));
                  }}
                  style={[styles.categoryChip, fashionCategory === category ? styles.categoryChipActive : null]}
                >
                  <Text style={[styles.categoryText, fashionCategory === category ? styles.categoryTextActive : null]}>{category}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.itemList}>
            {fashion.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHead}>
                  <Text style={styles.itemEmoji}>{item.imageEmoji}</Text>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemTip}>{item.tip}</Text>
                  </View>
                </View>
                <View style={styles.channelRow}>
                  {FASHION_CHANNELS.map((channel) => (
                    <Pressable
                      key={channel.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${channel.label}搜索 ${item.title}`}
                      onPress={() => openLink(channel.build(item.keyword))}
                      style={styles.channelChip}
                    >
                      <Text style={styles.channelText}>{channel.label}</Text>
                    </Pressable>
                  ))}
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
          <View style={styles.itemList}>
            {makeup.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHead}>
                  <Text style={styles.itemEmoji}>{item.emoji}</Text>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemTip}>{item.level}向 · 点击下方渠道看教程</Text>
                  </View>
                </View>
                <View style={styles.channelRow}>
                  {MAKEUP_CHANNELS.map((channel) => (
                    <Pressable
                      key={channel.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${channel.label}搜索 ${item.title}`}
                      onPress={() => openLink(channel.build(item.keyword))}
                      style={styles.channelChip}
                    >
                      <Text style={styles.channelText}>{channel.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <View testID="entertainment-floating-tabs" style={[styles.tabs, styles.floatingTabs]}>
        <Pressable accessibilityRole="button" accessibilityLabel="热点推荐" onPress={() => setTab("trend")} style={[styles.tab, tab === "trend" ? styles.tabActive : null]}>
          <Text style={[styles.tabText, tab === "trend" ? styles.tabTextActive : null]}>📰 热点</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="衣服推荐" onPress={() => setTab("fashion")} style={[styles.tab, tab === "fashion" ? styles.tabActive : null]}>
          <Text style={[styles.tabText, tab === "fashion" ? styles.tabTextActive : null]}>👗 穿搭</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="化妆教程" onPress={() => setTab("makeup")} style={[styles.tab, tab === "makeup" ? styles.tabActive : null]}>
          <Text style={[styles.tabText, tab === "makeup" ? styles.tabTextActive : null]}>💄 化妆</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    card: {
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 20,
      borderWidth: 1,
      gap: 12,
      padding: 16
    },
    cardHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    cardTitle: {
      color: tokens.text,
      fontSize: 16,
      fontWeight: "900"
    },
    categoryChip: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 7
    },
    categoryChipActive: {
      backgroundColor: tokens.accent
    },
    categoryRow: {
      flexDirection: "row",
      gap: 8
    },
    categoryText: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "800"
    },
    categoryTextActive: {
      color: "#ffffff"
    },
    channelChip: {
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6
    },
    channelRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    channelText: {
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "800"
    },
    emptyText: {
      color: tokens.textMuted,
      fontSize: 13,
      paddingVertical: 12,
      textAlign: "center"
    },
    errorText: {
      color: "#d97706",
      fontSize: 12
    },
    fashionFilters: {
      gap: 10
    },
    floatingTabs: {
      bottom: 10,
      elevation: 10,
      left: 76,
      position: Platform.OS === "web" ? ("fixed" as "absolute") : "absolute",
      right: 10,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
      zIndex: 80
    },
    genderChip: {
      borderRadius: 999,
      flex: 1,
      paddingVertical: 8
    },
    genderChipActive: {
      backgroundColor: tokens.accent
    },
    genderChipText: {
      color: tokens.textMuted,
      fontSize: 14,
      fontWeight: "800",
      textAlign: "center"
    },
    genderChipTextActive: {
      color: "#ffffff"
    },
    genderToggle: {
      alignSelf: "flex-start",
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 999,
      flexDirection: "row",
      gap: 4,
      minWidth: 140,
      padding: 4
    },
    hero: {
      gap: 4
    },
    heroSub: {
      color: tokens.textMuted,
      fontSize: 13
    },
    heroTitle: {
      color: tokens.text,
      fontSize: 22,
      fontWeight: "900"
    },
    itemCard: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 16,
      gap: 10,
      padding: 12
    },
    itemEmoji: {
      fontSize: 26
    },
    itemHead: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 10
    },
    itemInfo: {
      flex: 1,
      gap: 3
    },
    itemList: {
      gap: 10
    },
    itemTip: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 18
    },
    itemTitle: {
      color: tokens.text,
      fontSize: 15,
      fontWeight: "900"
    },
    loadingBox: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 24
    },
    loadingText: {
      color: tokens.textMuted,
      fontSize: 13
    },
    refreshButton: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6
    },
    refreshText: {
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "800"
    },
    sourceChip: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 999,
      flex: 1,
      paddingVertical: 8
    },
    sourceChipActive: {
      backgroundColor: tokens.accent
    },
    sourceChipText: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "800",
      textAlign: "center"
    },
    sourceChipTextActive: {
      color: "#ffffff"
    },
    sourceRow: {
      flexDirection: "row",
      gap: 8
    },
    stack: {
      gap: 16,
      paddingBottom: 84,
      position: "relative"
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
      padding: 4,
      width: "auto"
    },
    trendBody: {
      flex: 1,
      gap: 2
    },
    trendDesc: {
      color: tokens.textMuted,
      fontSize: 11
    },
    trendHot: {
      color: tokens.textMuted,
      fontSize: 11,
      fontWeight: "800"
    },
    trendList: {
      gap: 2
    },
    trendRank: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "900",
      minWidth: 22,
      textAlign: "center"
    },
    trendRankTop: {
      color: "#e05a4f"
    },
    trendRow: {
      alignItems: "center",
      borderBottomColor: tokens.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 10,
      paddingVertical: 10
    },
    trendTitle: {
      color: tokens.text,
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 20
    },
    updatedText: {
      color: tokens.textMuted,
      fontSize: 11
    }
  });
}
