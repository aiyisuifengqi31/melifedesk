import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import type { FixedBottomTabItem } from "@/shared/ui/FixedBottomTabs";
import type { UiTokens } from "@/shared/ui/primitives";
import { openLink } from "./entertainmentData";
import { fetchHotList, type HotItem, type HotSource } from "./hotListService";

type EntertainmentPanelProps = {
  activeTab?: EntTab;
  onTabChange?: (tab: EntTab) => void;
  showInlineTabs?: boolean;
  themeTokens: UiTokens;
};

export type EntTab = "hot" | "film" | "useful";

export const entertainmentTabs: FixedBottomTabItem<EntTab>[] = [
  { label: "热点", value: "hot" },
  { label: "影视", value: "film" },
  { label: "实用", value: "useful" }
];

const HOT_SOURCES: HotSource[] = ["百度", "微博", "知乎"];

const FILM_ITEMS = [
  {
    id: "film-weekend",
    title: "周末观影清单",
    type: "电影",
    time: "近期可看",
    summary: "把想看的电影先记在这里，周末前快速筛选，不需要来回翻聊天记录。"
  },
  {
    id: "film-drama",
    title: "追剧进度",
    type: "电视剧",
    time: "随用随记",
    summary: "适合记录正在看的剧、看到第几集、是否适合两个人一起看。"
  },
  {
    id: "film-variety",
    title: "下饭综艺",
    type: "综艺",
    time: "晚饭前查看",
    summary: "保留轻量推荐，不做复杂评分；收藏后可以作为下一次娱乐选择。"
  }
];

const USEFUL_ITEMS = [
  {
    id: "useful-holiday",
    title: "节假日和调休提醒",
    tag: "生活",
    summary: "提前记录假期、调休、车票、出行安排，避免临时手忙脚乱。"
  },
  {
    id: "useful-delivery",
    title: "快递和取件提醒",
    tag: "实用",
    summary: "和快递模块配合使用，优先关注待取快递和取件码。"
  },
  {
    id: "useful-date",
    title: "约会小安排",
    tag: "关系",
    summary: "记录想去的地方、想看的电影、想吃的店，避免每次都临时想。"
  }
];

export function EntertainmentPanel({ activeTab, onTabChange, showInlineTabs = true, themeTokens: tokens }: EntertainmentPanelProps) {
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [localTab, setLocalTab] = useState<EntTab>("hot");
  const tab = activeTab ?? localTab;
  const setTab = onTabChange ?? setLocalTab;
  const [hotSource, setHotSource] = useState<HotSource>("百度");
  const [hotItems, setHotItems] = useState<HotItem[]>([]);
  const [hotLoading, setHotLoading] = useState(false);
  const [hotError, setHotError] = useState("");
  const [hotUpdatedAt, setHotUpdatedAt] = useState("");
  const [expandedHotId, setExpandedHotId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

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

  const toggleRead = (id: string) => {
    setReadIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [id, ...current]));
  };

  const toggleFavorite = (id: string) => {
    setFavoriteIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [id, ...current]));
  };

  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>娱乐</Text>
        <Text style={styles.heroSub}>先看摘要，再决定要不要打开原文或收藏。</Text>
      </View>

      {tab === "hot" ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{hotSource}热点</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="刷新热点" onPress={() => void loadHot(hotSource, true)} style={styles.refreshButton}>
              <Text style={styles.refreshText}>刷新</Text>
            </Pressable>
          </View>

          <View style={styles.sourceRow}>
            {HOT_SOURCES.map((source) => (
              <Pressable
                key={source}
                accessibilityRole="button"
                accessibilityLabel={`${source}热点`}
                onPress={() => setHotSource(source)}
                style={[styles.sourceChip, hotSource === source ? styles.sourceChipActive : null]}
              >
                <Text style={[styles.sourceChipText, hotSource === source ? styles.sourceChipTextActive : null]}>{source}</Text>
              </Pressable>
            ))}
          </View>

          {hotUpdatedAt ? <Text style={styles.updatedText}>更新于 {hotUpdatedAt}</Text> : null}
          {hotError ? <Text style={styles.errorText}>{hotError}</Text> : null}

          {hotLoading && hotItems.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={tokens.accent} />
              <Text style={styles.loadingText}>正在获取实时热点...</Text>
            </View>
          ) : null}

          <View style={styles.list}>
            {hotItems.map((item) => (
              <HotRow
                expanded={expandedHotId === item.id}
                favorite={favoriteIds.includes(item.id)}
                item={item}
                key={item.id}
                onOpen={() => (item.url ? openLink(item.url) : undefined)}
                onPress={() => setExpandedHotId(expandedHotId === item.id ? null : item.id)}
                onRead={() => toggleRead(item.id)}
                onToggleFavorite={() => toggleFavorite(item.id)}
                read={readIds.includes(item.id)}
                styles={styles}
              />
            ))}
          </View>

          {!hotLoading && hotItems.length === 0 ? <Text style={styles.emptyText}>暂时没有拿到数据，点“刷新”再试一次。</Text> : null}
        </View>
      ) : null}

      {tab === "film" ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>影视</Text>
          <Text style={styles.cardHint}>轻量记录近期想看的内容，不做复杂评分。</Text>
          {FILM_ITEMS.map((item) => (
            <InfoRow
              favorite={favoriteIds.includes(item.id)}
              key={item.id}
              meta={`${item.type} · ${item.time}`}
              onRead={() => toggleRead(item.id)}
              onToggleFavorite={() => toggleFavorite(item.id)}
              read={readIds.includes(item.id)}
              styles={styles}
              summary={item.summary}
              title={item.title}
            />
          ))}
        </View>
      ) : null}

      {tab === "useful" ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>实用</Text>
          <Text style={styles.cardHint}>只保留能配合日常使用的提醒，不放空功能。</Text>
          {USEFUL_ITEMS.map((item) => (
            <InfoRow
              favorite={favoriteIds.includes(item.id)}
              key={item.id}
              meta={item.tag}
              onRead={() => toggleRead(item.id)}
              onToggleFavorite={() => toggleFavorite(item.id)}
              read={readIds.includes(item.id)}
              styles={styles}
              summary={item.summary}
              title={item.title}
            />
          ))}
        </View>
      ) : null}

      {showInlineTabs ? (
        <View testID="entertainment-floating-tabs" style={styles.inlineTabs}>
          {entertainmentTabs.map((item) => (
            <Pressable key={item.value} accessibilityRole="button" accessibilityLabel={item.label} onPress={() => setTab(item.value)} style={[styles.tab, tab === item.value ? styles.tabActive : null]}>
              <Text numberOfLines={1} style={[styles.tabText, tab === item.value ? styles.tabTextActive : null]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function HotRow({
  expanded,
  favorite,
  item,
  onOpen,
  onPress,
  onRead,
  onToggleFavorite,
  read,
  styles
}: {
  expanded: boolean;
  favorite: boolean;
  item: HotItem;
  onOpen: () => void;
  onPress: () => void;
  onRead: () => void;
  onToggleFavorite: () => void;
  read: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={item.title} onPress={onPress} style={[styles.row, read ? styles.rowRead : null]}>
      <Text style={[styles.rank, item.rank <= 3 ? styles.rankTop : null]}>{item.rank}</Text>
      <View style={styles.rowBody}>
        <Text numberOfLines={expanded ? 4 : 2} style={[styles.rowTitle, read ? styles.readText : null]}>{item.title}</Text>
        {item.desc || expanded ? <Text style={styles.summary}>{item.desc || "暂无摘要，点击查看原文前可先收藏或标记已读。"}</Text> : null}
        {expanded ? (
          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={`标记已读${item.title}`} onPress={onRead} style={styles.softButton}>
              <Text style={styles.softButtonText}>{read ? "取消已读" : "已读"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`收藏${item.title}`} onPress={onToggleFavorite} style={styles.softButton}>
              <Text style={styles.softButtonText}>{favorite ? "已收藏" : "收藏"}</Text>
            </Pressable>
            {item.url ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`查看原文${item.title}`} onPress={onOpen} style={styles.softButton}>
                <Text style={styles.softButtonText}>原文</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      {item.hot ? <Text style={styles.hot}>{item.hot}</Text> : null}
    </Pressable>
  );
}

function InfoRow({
  favorite,
  meta,
  onRead,
  onToggleFavorite,
  read,
  styles,
  summary,
  title
}: {
  favorite: boolean;
  meta: string;
  onRead: () => void;
  onToggleFavorite: () => void;
  read: boolean;
  styles: ReturnType<typeof createStyles>;
  summary: string;
  title: string;
}) {
  return (
    <View style={[styles.infoCard, read ? styles.rowRead : null]}>
      <View style={styles.infoTop}>
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, read ? styles.readText : null]}>{title}</Text>
          <Text style={styles.updatedText}>{meta}</Text>
        </View>
        <Text style={styles.statePill}>{read ? "已读" : "未读"}</Text>
      </View>
      <Text style={styles.summary}>{summary}</Text>
      <View style={styles.actionRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={`标记已读${title}`} onPress={onRead} style={styles.softButton}>
          <Text style={styles.softButtonText}>{read ? "取消已读" : "已读"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`收藏${title}`} onPress={onToggleFavorite} style={styles.softButton}>
          <Text style={styles.softButtonText}>{favorite ? "已收藏" : "收藏"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    actionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    card: {
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: 12,
      padding: 14
    },
    cardHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    cardHint: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 18
    },
    cardTitle: {
      color: tokens.text,
      fontSize: 17,
      fontWeight: "900"
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
    hot: {
      color: tokens.textMuted,
      fontSize: 11,
      fontWeight: "800"
    },
    infoCard: {
      backgroundColor: tokens.surfaceMuted,
      borderColor: tokens.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: 8,
      padding: 12
    },
    infoTop: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 10
    },
    inlineTabs: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 14,
      flexDirection: "row",
      gap: 4,
      padding: 4
    },
    list: {
      gap: 2
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
    rank: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "900",
      minWidth: 22,
      textAlign: "center"
    },
    rankTop: {
      color: "#e05a4f"
    },
    readText: {
      color: tokens.textMuted
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
    row: {
      alignItems: "center",
      borderBottomColor: tokens.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 10,
      paddingVertical: 10
    },
    rowBody: {
      flex: 1,
      gap: 4
    },
    rowRead: {
      opacity: 0.62
    },
    rowTitle: {
      color: tokens.text,
      fontSize: 14,
      fontWeight: "800",
      lineHeight: 20
    },
    softButton: {
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    softButtonText: {
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "900"
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
      paddingBottom: 108
    },
    statePill: {
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      color: tokens.accent,
      fontSize: 11,
      fontWeight: "900",
      paddingHorizontal: 8,
      paddingVertical: 4
    },
    summary: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 18
    },
    tab: {
      alignItems: "center",
      borderRadius: 12,
      flex: 1,
      justifyContent: "center",
      minWidth: 0,
      paddingHorizontal: 4,
      paddingVertical: 10
    },
    tabActive: {
      backgroundColor: tokens.surface
    },
    tabText: {
      color: tokens.textMuted,
      fontSize: 14,
      fontWeight: "900"
    },
    tabTextActive: {
      color: tokens.accent
    },
    updatedText: {
      color: tokens.textMuted,
      fontSize: 11,
      fontWeight: "700"
    }
  });
}
