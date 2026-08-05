import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { CollapsibleSectionFooter, useCollapsibleList } from "@/shared/ui/CollapsibleList";
import type { FixedBottomTabItem } from "@/shared/ui/FixedBottomTabs";
import type { UiTokens } from "@/shared/ui/primitives";
import { openLink } from "./entertainmentData";
import { fetchHotList, type HotItem, type HotSource } from "./hotListService";
import {
  HOLIDAYS_2026,
  MEDIA_AREAS,
  MEDIA_GENRES,
  MEDIA_STATUSES,
  MEDIA_TYPES,
  createReminderId,
  daysUntil,
  emptyMediaItem,
  loadMediaItems,
  loadReminders,
  mediaYears,
  saveMediaItems,
  saveReminders,
  type MediaItem,
  type MediaStatus,
  type ReminderItem
} from "./mediaLibrary";

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
type FilmMode = "library" | "weekend" | "progress" | "variety" | "detail";
type UsefulMode = "home" | "holiday" | "release" | "reminder" | "links";

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
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(() => loadMediaItems());
  const [mediaDraft, setMediaDraft] = useState<MediaItem>(() => emptyMediaItem());
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [filmMode, setFilmMode] = useState<FilmMode>("library");
  const [filters, setFilters] = useState({ area: "全部", genre: "全部", status: "全部", type: "全部", year: "全部" });
  const [usefulMode, setUsefulMode] = useState<UsefulMode>("home");
  const [reminders, setReminders] = useState<ReminderItem[]>(() => loadReminders());
  const [reminderDraft, setReminderDraft] = useState({ date: "", note: "", title: "" });

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

  const years = useMemo(() => mediaYears(mediaItems), [mediaItems]);
  const filteredMedia = useMemo(
    () =>
      mediaItems.filter((item) => {
        const yearMatched = filters.year === "全部" || (filters.year === "更早" ? Number(item.year) < 2023 : item.year === filters.year);
        return (
          (filters.type === "全部" || item.type === filters.type) &&
          yearMatched &&
          (filters.genre === "全部" || item.genre === filters.genre) &&
          (filters.area === "全部" || item.area === filters.area) &&
          (filters.status === "全部" || item.status === filters.status)
        );
      }),
    [filters, mediaItems]
  );
  const weekendItems = mediaItems.filter((item) => item.status === "想看" || item.status === "收藏");
  const progressItems = mediaItems.filter((item) => item.type !== "电影" && item.status === "在看");
  const varietyItems = mediaItems.filter((item) => item.type === "综艺");
  const selectedMedia = mediaItems.find((item) => item.id === selectedMediaId) ?? null;

  const toggleRead = (id: string) => setReadIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [id, ...current]));
  const toggleFavorite = (id: string) => setFavoriteIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [id, ...current]));

  const persistMedia = (items: MediaItem[]) => {
    setMediaItems(items);
    saveMediaItems(items);
  };

  const updateMedia = (id: string, patch: Partial<MediaItem>) => {
    persistMedia(mediaItems.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const saveMediaDraft = () => {
    if (!mediaDraft.title.trim()) return;
    persistMedia([{ ...mediaDraft, title: mediaDraft.title.trim() }, ...mediaItems]);
    setMediaDraft(emptyMediaItem());
  };

  const removeMedia = (id: string) => {
    persistMedia(mediaItems.filter((item) => item.id !== id));
    if (selectedMediaId === id) setSelectedMediaId(null);
  };

  const persistReminders = (items: ReminderItem[]) => {
    setReminders(items);
    saveReminders(items);
  };

  const saveReminder = () => {
    if (!reminderDraft.title.trim() || !reminderDraft.date.trim()) return;
    persistReminders([{ id: createReminderId(), ...reminderDraft, title: reminderDraft.title.trim() }, ...reminders]);
    setReminderDraft({ date: "", note: "", title: "" });
  };

  if (tab === "film" && filmMode === "detail" && selectedMedia) {
    return (
      <View style={styles.stack} testID="media-detail">
        <Pressable accessibilityRole="button" accessibilityLabel="返回影视列表" onPress={() => setFilmMode("library")} style={styles.backButton}>
          <Text style={styles.backText}>← 返回影视</Text>
        </Pressable>
        <View style={styles.card}>
          <Text style={styles.detailTitle}>{selectedMedia.title}</Text>
          <Text style={styles.meta}>{selectedMedia.year} · {selectedMedia.type} · {selectedMedia.area} · {selectedMedia.genre}</Text>
          <Text style={styles.summary}>{selectedMedia.description || "还没有简介，可以在备注里补充观看理由。"}</Text>
          <Text style={styles.fieldLabel}>状态：{selectedMedia.status} · {selectedMedia.updateStatus}</Text>
          <Text style={styles.fieldLabel}>进度：{selectedMedia.currentEpisode}/{selectedMedia.episodes} 集</Text>
          <Text style={styles.summary}>备注：{selectedMedia.note || "暂无个人备注"}</Text>
          <View style={styles.actionRow}>
            {(["想看", "在看", "看过", "收藏"] as MediaStatus[]).map((status) => (
              <Pressable key={status} accessibilityRole="button" accessibilityLabel={`${selectedMedia.title}${status}`} onPress={() => updateMedia(selectedMedia.id, { status })} style={[styles.softButton, selectedMedia.status === status ? styles.softButtonActive : null]}>
                <Text style={[styles.softButtonText, selectedMedia.status === status ? styles.softButtonTextActive : null]}>{status}</Text>
              </Pressable>
            ))}
            {selectedMedia.sourceUrl ? (
              <Pressable accessibilityRole="button" accessibilityLabel="打开影视资料来源" onPress={() => openLink(selectedMedia.sourceUrl)} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>资料来源</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>娱乐</Text>
        <Text style={styles.heroSub}>热点先看摘要，影视和实用工具都能点进去处理。</Text>
      </View>

      {tab === "hot" ? (
        <HotPanel
          expandedHotId={expandedHotId}
          favoriteIds={favoriteIds}
          hotError={hotError}
          hotItems={hotItems}
          hotLoading={hotLoading}
          hotSource={hotSource}
          hotUpdatedAt={hotUpdatedAt}
          loadHot={loadHot}
          readIds={readIds}
          setExpandedHotId={setExpandedHotId}
          setHotSource={setHotSource}
          styles={styles}
          tokens={tokens}
          toggleFavorite={toggleFavorite}
          toggleRead={toggleRead}
        />
      ) : null}

      {tab === "film" ? (
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>影视发现与记录</Text>
            <Text style={styles.cardHint}>没有稳定影视 API 时，不显示虚构推荐。你可以手动添加真实条目、保存状态和追剧进度。</Text>
            <View style={styles.quickGrid}>
              <QuickCard label="周末观影清单" value={`${weekendItems.length} 部`} onPress={() => setFilmMode("weekend")} styles={styles} />
              <QuickCard label="追剧进度" value={`${progressItems.length} 部`} onPress={() => setFilmMode("progress")} styles={styles} />
              <QuickCard label="下饭综艺" value={`${varietyItems.length} 个`} onPress={() => setFilmMode("variety")} styles={styles} />
            </View>
          </View>
          <MediaForm draft={mediaDraft} onChange={setMediaDraft} onSave={saveMediaDraft} styles={styles} />
          <MediaList
            filteredMedia={filmMode === "weekend" ? weekendItems : filmMode === "progress" ? progressItems : filmMode === "variety" ? varietyItems : filteredMedia}
            filters={filters}
            genres={MEDIA_GENRES}
            mode={filmMode}
            onBack={() => setFilmMode("library")}
            onOpen={(id) => {
              setSelectedMediaId(id);
              setFilmMode("detail");
            }}
            onRemove={removeMedia}
            onStatus={(id, status) => updateMedia(id, { status })}
            onStep={(id) => {
              const item = mediaItems.find((media) => media.id === id);
              if (item) updateMedia(id, { currentEpisode: Math.min(item.episodes, item.currentEpisode + 1), status: "在看" });
            }}
            setFilters={setFilters}
            styles={styles}
            tokens={tokens}
            types={MEDIA_TYPES}
            years={years}
          />
        </View>
      ) : null}

      {tab === "useful" ? (
        <UsefulPanel
          mediaItems={mediaItems}
          mode={usefulMode}
          reminderDraft={reminderDraft}
          reminders={reminders}
          saveReminder={saveReminder}
          setMode={setUsefulMode}
          setReminderDraft={setReminderDraft}
          styles={styles}
          tokens={tokens}
          removeReminder={(id) => persistReminders(reminders.filter((item) => item.id !== id))}
        />
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

function HotPanel({ expandedHotId, favoriteIds, hotError, hotItems, hotLoading, hotSource, hotUpdatedAt, loadHot, readIds, setExpandedHotId, setHotSource, styles, tokens, toggleFavorite, toggleRead }: { expandedHotId: string | null; favoriteIds: string[]; hotError: string; hotItems: HotItem[]; hotLoading: boolean; hotSource: HotSource; hotUpdatedAt: string; loadHot: (source: HotSource, force?: boolean) => Promise<void>; readIds: string[]; setExpandedHotId: (id: string | null) => void; setHotSource: (source: HotSource) => void; styles: ReturnType<typeof createStyles>; tokens: UiTokens; toggleFavorite: (id: string) => void; toggleRead: (id: string) => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{hotSource}热点</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="刷新热点" onPress={() => void loadHot(hotSource, true)} style={styles.refreshButton}><Text style={styles.refreshText}>刷新</Text></Pressable>
      </View>
      <View style={styles.sourceRow}>
        {HOT_SOURCES.map((source) => (
          <Pressable key={source} accessibilityRole="button" accessibilityLabel={`${source}热点`} onPress={() => setHotSource(source)} style={[styles.sourceChip, hotSource === source ? styles.sourceChipActive : null]}>
            <Text style={[styles.sourceChipText, hotSource === source ? styles.sourceChipTextActive : null]}>{source}</Text>
          </Pressable>
        ))}
      </View>
      {hotUpdatedAt ? <Text style={styles.updatedText}>更新于 {hotUpdatedAt}</Text> : null}
      {hotError ? <Text style={styles.errorText}>{hotError}</Text> : null}
      {hotLoading && hotItems.length === 0 ? <View style={styles.loadingBox}><ActivityIndicator color={tokens.accent} /><Text style={styles.loadingText}>正在获取实时热点...</Text></View> : null}
      <View style={styles.list}>
        {hotItems.map((item) => (
          <HotRow expanded={expandedHotId === item.id} favorite={favoriteIds.includes(item.id)} item={item} key={item.id} onOpen={() => item.url && openLink(item.url)} onPress={() => setExpandedHotId(expandedHotId === item.id ? null : item.id)} onRead={() => toggleRead(item.id)} onToggleFavorite={() => toggleFavorite(item.id)} read={readIds.includes(item.id)} styles={styles} />
        ))}
      </View>
      {!hotLoading && hotItems.length === 0 ? <Text style={styles.emptyText}>暂时没有拿到数据，点“刷新”再试一次。</Text> : null}
    </View>
  );
}

function HotRow({ expanded, favorite, item, onOpen, onPress, onRead, onToggleFavorite, read, styles }: { expanded: boolean; favorite: boolean; item: HotItem; onOpen: () => void; onPress: () => void; onRead: () => void; onToggleFavorite: () => void; read: boolean; styles: ReturnType<typeof createStyles> }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={item.title} onPress={onPress} style={[styles.row, read ? styles.rowRead : null]}>
      <Text style={[styles.rank, item.rank <= 3 ? styles.rankTop : null]}>{item.rank}</Text>
      <View style={styles.rowBody}>
        <Text numberOfLines={expanded ? 4 : 2} style={[styles.rowTitle, read ? styles.readText : null]}>{item.title}</Text>
        {item.desc || expanded ? <Text style={styles.summary}>{item.desc || "暂无摘要，可先收藏或标记已读。"}</Text> : null}
        {expanded ? (
          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={`标记已读${item.title}`} onPress={onRead} style={styles.softButton}><Text style={styles.softButtonText}>{read ? "取消已读" : "已读"}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`收藏${item.title}`} onPress={onToggleFavorite} style={styles.softButton}><Text style={styles.softButtonText}>{favorite ? "已收藏" : "收藏"}</Text></Pressable>
            {item.url ? <Pressable accessibilityRole="button" accessibilityLabel={`查看原文${item.title}`} onPress={onOpen} style={styles.softButton}><Text style={styles.softButtonText}>原文</Text></Pressable> : null}
          </View>
        ) : null}
      </View>
      {item.hot ? <Text style={styles.hot}>{item.hot}</Text> : null}
    </Pressable>
  );
}

function QuickCard({ label, onPress, styles, value }: { label: string; onPress: () => void; styles: ReturnType<typeof createStyles>; value: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.quickCard, pressed ? styles.pressed : null]}>
      <Text style={styles.quickValue}>{value}</Text>
      <Text style={styles.quickLabel}>{label} ›</Text>
    </Pressable>
  );
}

function MediaForm({ draft, onChange, onSave, styles }: { draft: MediaItem; onChange: (item: MediaItem) => void; onSave: () => void; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.card} testID="media-form">
      <Text style={styles.cardTitle}>添加影视条目</Text>
      <TextInput placeholder="名称" onChangeText={(title) => onChange({ ...draft, title })} style={styles.input} value={draft.title} />
      <View style={styles.formRow}>
        <TextInput placeholder="年份" onChangeText={(year) => onChange({ ...draft, year })} style={[styles.input, styles.inputHalf]} value={draft.year} />
        <TextInput placeholder="题材" onChangeText={(genre) => onChange({ ...draft, genre })} style={[styles.input, styles.inputHalf]} value={draft.genre} />
      </View>
      <TextInput placeholder="简介或备注" onChangeText={(description) => onChange({ ...draft, description })} style={styles.input} value={draft.description} />
      <View style={styles.actionRow}>
        {(["电影", "电视剧", "综艺", "动漫", "纪录片"] as MediaItem["type"][]).map((type) => (
          <Pressable key={type} accessibilityRole="button" accessibilityLabel={`类型${type}`} onPress={() => onChange({ ...draft, type, episodes: type === "电影" ? 1 : draft.episodes })} style={[styles.softButton, draft.type === type ? styles.softButtonActive : null]}>
            <Text style={[styles.softButtonText, draft.type === type ? styles.softButtonTextActive : null]}>{type}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="保存影视条目" onPress={onSave} style={[styles.primaryButton, !draft.title.trim() ? styles.disabled : null]}><Text style={styles.primaryButtonText}>保存影视条目</Text></Pressable>
    </View>
  );
}

function MediaList({ filteredMedia, filters, genres, mode, onBack, onOpen, onRemove, onStatus, onStep, setFilters, styles, tokens, types, years }: { filteredMedia: MediaItem[]; filters: { area: string; genre: string; status: string; type: string; year: string }; genres: string[]; mode: FilmMode; onBack: () => void; onOpen: (id: string) => void; onRemove: (id: string) => void; onStatus: (id: string, status: MediaStatus) => void; onStep: (id: string) => void; setFilters: (filters: { area: string; genre: string; status: string; type: string; year: string }) => void; styles: ReturnType<typeof createStyles>; tokens: UiTokens; types: string[]; years: string[] }) {
  const title = mode === "weekend" ? "周末观影清单" : mode === "progress" ? "我的追剧" : mode === "variety" ? "下饭综艺" : "影视列表";
  // mediaItems 新增时一律前置，数组顺序本身即「最新在前」，无 createTime 字段可排。
  const mediaList = useCollapsibleList(filteredMedia);
  return (
    <View style={styles.card} testID="media-list">
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {mode !== "library" ? <Pressable accessibilityRole="button" accessibilityLabel="返回影视列表" onPress={onBack} style={styles.softButton}><Text style={styles.softButtonText}>全部</Text></Pressable> : null}
      </View>
      {mode === "library" ? (
        <>
          <FilterRow label="类型" options={types} selected={filters.type} onSelect={(type) => setFilters({ ...filters, type })} styles={styles} />
          <FilterRow label="年份" options={years} selected={filters.year} onSelect={(year) => setFilters({ ...filters, year })} styles={styles} />
          <FilterRow label="题材" options={genres} selected={filters.genre} onSelect={(genre) => setFilters({ ...filters, genre })} styles={styles} />
          <FilterRow label="地区" options={MEDIA_AREAS} selected={filters.area} onSelect={(area) => setFilters({ ...filters, area })} styles={styles} />
          <FilterRow label="状态" options={MEDIA_STATUSES} selected={filters.status} onSelect={(status) => setFilters({ ...filters, status })} styles={styles} />
        </>
      ) : null}
      {filteredMedia.length === 0 ? <Text style={styles.emptyText}>这里还没有条目。先在上方添加真实影视内容，再进行筛选和记录。</Text> : null}
      {mediaList.visibleItems.map((item) => (
        <View key={item.id} style={styles.mediaCard}>
          <Pressable accessibilityRole="button" accessibilityLabel={`打开${item.title}详情`} onPress={() => onOpen(item.id)} style={styles.mediaMain}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.meta}>{item.year} · {item.type} · {item.area} · {item.genre}</Text>
            <Text style={styles.summary}>{item.description || "暂无简介"}</Text>
            {item.type !== "电影" ? <Text style={styles.meta}>进度 {item.currentEpisode}/{item.episodes} 集 · {item.updateStatus}</Text> : null}
          </Pressable>
          <View style={styles.actionRow}>
            {(["想看", "在看", "看过", "收藏"] as MediaStatus[]).map((status) => (
              <Pressable key={status} accessibilityRole="button" accessibilityLabel={`${item.title}${status}`} onPress={() => onStatus(item.id, status)} style={[styles.softButton, item.status === status ? styles.softButtonActive : null]}>
                <Text style={[styles.softButtonText, item.status === status ? styles.softButtonTextActive : null]}>{status}</Text>
              </Pressable>
            ))}
            {item.type !== "电影" ? <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}已看一集`} onPress={() => onStep(item.id)} style={styles.softButton}><Text style={styles.softButtonText}>已看一集</Text></Pressable> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={`删除${item.title}`} onPress={() => onRemove(item.id)} style={styles.deleteButton}><Text style={styles.deleteText}>删除</Text></Pressable>
          </View>
        </View>
      ))}
      <CollapsibleSectionFooter
        expanded={mediaList.expanded}
        hiddenCount={mediaList.hiddenCount}
        name={title}
        onPress={mediaList.toggle}
        testID="media-show-more"
        tokens={tokens}
        visible={mediaList.canExpand}
      />
    </View>
  );
}

function UsefulPanel({ mediaItems, mode, reminderDraft, reminders, removeReminder, saveReminder, setMode, setReminderDraft, styles, tokens }: { mediaItems: MediaItem[]; mode: UsefulMode; reminderDraft: { date: string; note: string; title: string }; reminders: ReminderItem[]; removeReminder: (id: string) => void; saveReminder: () => void; setMode: (mode: UsefulMode) => void; setReminderDraft: (draft: { date: string; note: string; title: string }) => void; styles: ReturnType<typeof createStyles>; tokens: UiTokens }) {
  if (mode !== "home") {
    return (
      <View style={styles.section}>
        <Pressable accessibilityRole="button" accessibilityLabel="返回实用首页" onPress={() => setMode("home")} style={styles.backButton}><Text style={styles.backText}>← 返回实用</Text></Pressable>
        {mode === "holiday" ? <HolidayTool styles={styles} /> : null}
        {mode === "release" ? <ReleaseTool mediaItems={mediaItems} styles={styles} /> : null}
        {mode === "reminder" ? <ReminderTool draft={reminderDraft} reminders={reminders} removeReminder={removeReminder} saveReminder={saveReminder} setDraft={setReminderDraft} styles={styles} tokens={tokens} /> : null}
        {mode === "links" ? <UsefulLinks styles={styles} /> : null}
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>实用</Text>
      <View style={styles.quickGrid}>
        <QuickCard label="节假日日历" value="查看" onPress={() => setMode("holiday")} styles={styles} />
        <QuickCard label="电影上映日历" value={`${mediaItems.filter((item) => item.type === "电影").length} 条`} onPress={() => setMode("release")} styles={styles} />
        <QuickCard label="生活日期提醒" value={`${reminders.length} 条`} onPress={() => setMode("reminder")} styles={styles} />
        <QuickCard label="常用查询入口" value="打开" onPress={() => setMode("links")} styles={styles} />
      </View>
    </View>
  );
}

function HolidayTool({ styles }: { styles: ReturnType<typeof createStyles> }) {
  const next = HOLIDAYS_2026.map((item) => ({ ...item, days: daysUntil(item.date) })).filter((item) => item.days >= 0).sort((a, b) => a.days - b.days)[0];
  return (
    <View style={styles.card} testID="holiday-tool">
      <Text style={styles.cardTitle}>节假日日历</Text>
      {next ? <Text style={styles.cardHint}>距离下一个节假日：{next.name} 还有 {next.days} 天。</Text> : null}
      {HOLIDAYS_2026.map((item) => <View key={item.date} style={styles.infoCard}><Text style={styles.rowTitle}>{item.name} · {item.date}</Text><Text style={styles.summary}>{item.detail}</Text><Text style={styles.meta}>来源：{item.source}</Text></View>)}
    </View>
  );
}

function ReleaseTool({ mediaItems, styles }: { mediaItems: MediaItem[]; styles: ReturnType<typeof createStyles> }) {
  const movies = mediaItems.filter((item) => item.type === "电影").sort((a, b) => b.year.localeCompare(a.year));
  return <View style={styles.card} testID="release-tool"><Text style={styles.cardTitle}>电影上映日历</Text>{movies.length === 0 ? <Text style={styles.emptyText}>还没有电影条目。先在影视页添加真实电影，再用这里做上映提醒。</Text> : movies.map((item) => <View key={item.id} style={styles.infoCard}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.meta}>{item.year} · {item.area} · {item.updateStatus}</Text></View>)}</View>;
}

function ReminderTool({ draft, reminders, removeReminder, saveReminder, setDraft, styles, tokens }: { draft: { date: string; note: string; title: string }; reminders: ReminderItem[]; removeReminder: (id: string) => void; saveReminder: () => void; setDraft: (draft: { date: string; note: string; title: string }) => void; styles: ReturnType<typeof createStyles>; tokens: UiTokens }) {
  // reminders 新增时前置，数组顺序即「最新在前」。
  const reminderList = useCollapsibleList(reminders);
  return (
    <View style={styles.card} testID="reminder-tool">
      <Text style={styles.cardTitle}>生活日期提醒</Text>
      <TextInput placeholder="提醒名称，如会员续费" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} style={styles.input} />
      <TextInput placeholder="日期，如 2026-09-01" value={draft.date} onChangeText={(date) => setDraft({ ...draft, date })} style={styles.input} />
      <TextInput placeholder="备注" value={draft.note} onChangeText={(note) => setDraft({ ...draft, note })} style={styles.input} />
      <Pressable accessibilityRole="button" accessibilityLabel="保存生活提醒" onPress={saveReminder} style={styles.primaryButton}><Text style={styles.primaryButtonText}>保存提醒</Text></Pressable>
      {reminders.length === 0 ? <Text style={styles.emptyText}>还没有提醒，可以记录订阅到期、会员续费、证件到期或纪念日。</Text> : null}
      {reminderList.visibleItems.map((item) => <View key={item.id} style={styles.infoCard}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.meta}>{item.date}</Text><Text style={styles.summary}>{item.note}</Text><Pressable accessibilityRole="button" accessibilityLabel={`删除提醒${item.title}`} onPress={() => removeReminder(item.id)} style={styles.deleteButton}><Text style={styles.deleteText}>删除</Text></Pressable></View>)}
      <CollapsibleSectionFooter
        expanded={reminderList.expanded}
        hiddenCount={reminderList.hiddenCount}
        name="生活提醒"
        onPress={reminderList.toggle}
        testID="reminder-show-more"
        tokens={tokens}
        visible={reminderList.canExpand}
      />
    </View>
  );
}

function UsefulLinks({ styles }: { styles: ReturnType<typeof createStyles> }) {
  const links = [
    { label: "中国政府网", url: "https://www.gov.cn/" },
    { label: "铁路 12306", url: "https://www.12306.cn/" },
    { label: "国家政务服务平台", url: "https://gjzwfw.www.gov.cn/" }
  ];
  return <View style={styles.card} testID="links-tool"><Text style={styles.cardTitle}>常用查询入口</Text>{links.map((link) => <Pressable key={link.url} accessibilityRole="button" accessibilityLabel={`打开${link.label}`} onPress={() => openLink(link.url)} style={styles.infoCard}><Text style={styles.rowTitle}>{link.label} ›</Text><Text style={styles.meta}>{link.url}</Text></Pressable>)}</View>;
}

function FilterRow({ label, onSelect, options, selected, styles }: { label: string; onSelect: (value: string) => void; options: string[]; selected: string; styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.filterBlock}><Text style={styles.fieldLabel}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{options.map((option) => <Pressable key={option} accessibilityRole="button" accessibilityLabel={`${label}筛选${option}`} onPress={() => onSelect(option)} style={[styles.chip, selected === option ? styles.chipActive : null]}><Text style={[styles.chipText, selected === option ? styles.chipTextActive : null]}>{option}</Text></Pressable>)}</ScrollView></View>;
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    backButton: { alignSelf: "flex-start", backgroundColor: tokens.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
    backText: { color: tokens.accent, fontSize: 13, fontWeight: "900" },
    card: { backgroundColor: tokens.surface, borderColor: tokens.border, borderRadius: 18, borderWidth: 1, gap: 12, padding: 14 },
    cardHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
    cardHint: { color: tokens.textMuted, fontSize: 12, lineHeight: 18 },
    cardTitle: { color: tokens.text, fontSize: 17, fontWeight: "900" },
    chip: { backgroundColor: tokens.surfaceMuted, borderColor: tokens.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
    chipActive: { backgroundColor: tokens.accent, borderColor: tokens.accent },
    chipRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
    chipText: { color: tokens.textMuted, fontSize: 12, fontWeight: "800" },
    chipTextActive: { color: "#ffffff" },
    deleteButton: { alignSelf: "flex-start", backgroundColor: "#fee2e2", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
    deleteText: { color: "#dc2626", fontSize: 12, fontWeight: "900" },
    detailTitle: { color: tokens.text, fontSize: 22, fontWeight: "900", lineHeight: 30 },
    disabled: { opacity: 0.45 },
    emptyText: { color: tokens.textMuted, fontSize: 13, lineHeight: 20, paddingVertical: 12 },
    errorText: { color: "#d97706", fontSize: 12 },
    fieldLabel: { color: tokens.text, fontSize: 13, fontWeight: "900" },
    filterBlock: { gap: 6 },
    formRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    hero: { gap: 4 },
    heroSub: { color: tokens.textMuted, fontSize: 13 },
    heroTitle: { color: tokens.text, fontSize: 22, fontWeight: "900" },
    hot: { color: tokens.textMuted, fontSize: 11, fontWeight: "800" },
    infoCard: { backgroundColor: tokens.surfaceMuted, borderColor: tokens.border, borderRadius: 14, borderWidth: 1, gap: 8, padding: 12 },
    inlineTabs: { backgroundColor: tokens.surfaceMuted, borderRadius: 14, flexDirection: "row", gap: 4, padding: 4 },
    input: { backgroundColor: tokens.surfaceMuted, borderColor: tokens.border, borderRadius: 12, borderWidth: 1, color: tokens.text, fontSize: 14, minHeight: 44, paddingHorizontal: 12 },
    inputHalf: { flex: 1, minWidth: 120 },
    list: { gap: 2 },
    loadingBox: { alignItems: "center", gap: 8, paddingVertical: 24 },
    loadingText: { color: tokens.textMuted, fontSize: 13 },
    mediaCard: { backgroundColor: tokens.surfaceMuted, borderColor: tokens.border, borderRadius: 14, borderWidth: 1, gap: 10, padding: 12 },
    mediaMain: { gap: 5 },
    meta: { color: tokens.textMuted, fontSize: 12, fontWeight: "700" },
    pressed: { transform: [{ scale: 0.99 }] },
    primaryButton: { alignItems: "center", backgroundColor: tokens.accent, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
    primaryButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
    quickCard: { backgroundColor: tokens.surfaceMuted, borderColor: tokens.border, borderRadius: 14, borderWidth: 1, flex: 1, minWidth: 120, padding: 12 },
    quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    quickLabel: { color: tokens.textMuted, fontSize: 12, fontWeight: "800", marginTop: 4 },
    quickValue: { color: tokens.text, fontSize: 18, fontWeight: "900" },
    rank: { color: tokens.textMuted, fontSize: 13, fontWeight: "900", minWidth: 22, textAlign: "center" },
    rankTop: { color: "#e05a4f" },
    readText: { color: tokens.textMuted },
    refreshButton: { backgroundColor: tokens.surfaceMuted, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    refreshText: { color: tokens.accent, fontSize: 12, fontWeight: "800" },
    row: { alignItems: "center", borderBottomColor: tokens.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 10, paddingVertical: 10 },
    rowBody: { flex: 1, gap: 4 },
    rowRead: { opacity: 0.62 },
    rowTitle: { color: tokens.text, fontSize: 14, fontWeight: "800", lineHeight: 20 },
    section: { gap: 14 },
    softButton: { backgroundColor: tokens.surface, borderColor: tokens.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
    softButtonActive: { backgroundColor: tokens.accent, borderColor: tokens.accent },
    softButtonText: { color: tokens.accent, fontSize: 12, fontWeight: "900" },
    softButtonTextActive: { color: "#ffffff" },
    sourceChip: { backgroundColor: tokens.surfaceMuted, borderRadius: 999, flex: 1, paddingVertical: 8 },
    sourceChipActive: { backgroundColor: tokens.accent },
    sourceChipText: { color: tokens.textMuted, fontSize: 13, fontWeight: "800", textAlign: "center" },
    sourceChipTextActive: { color: "#ffffff" },
    sourceRow: { flexDirection: "row", gap: 8 },
    stack: { gap: 16, paddingBottom: 108 },
    summary: { color: tokens.textMuted, fontSize: 12, lineHeight: 18 },
    tab: { alignItems: "center", borderRadius: 12, flex: 1, justifyContent: "center", minWidth: 0, paddingHorizontal: 4, paddingVertical: 10 },
    tabActive: { backgroundColor: tokens.surface },
    tabText: { color: tokens.textMuted, fontSize: 14, fontWeight: "900" },
    tabTextActive: { color: tokens.accent },
    updatedText: { color: tokens.textMuted, fontSize: 11, fontWeight: "700" }
  });
}
