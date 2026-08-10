import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CollapsibleSectionFooter, sortByNewest, useCollapsibleList } from "@/shared/ui/CollapsibleList";
import { DatePickerPopup } from "@/shared/ui/DatePickerPopup";
import { PuppyIllustration } from "@/shared/ui/PuppyIllustration";
import { IconHeart } from "@/shared/ui/lineIcons";
import type { FixedBottomTabItem } from "@/shared/ui/FixedBottomTabs";
import type { UiTokens } from "@/shared/ui/primitives";
import { getCurrentPartnerId } from "@/auth/partnership";
import { hydrateFromCloud, saveCloudValue } from "@/features/sync/cloudSync";
import { deleteDiaryFromCloud, getCurrentLoveUserId, loadDiariesFromCloud, saveDiariesToCloud } from "./loveDiaryCloud";

export type LoveTab = "diary" | "gifts" | "anniversary" | "photos";
type DiaryVisibility = "private" | "couple_read" | "couple_edit";

export const loveTabs: FixedBottomTabItem<LoveTab>[] = [
  { label: "日记本", value: "diary" },
  { label: "礼物", value: "gifts" },
  { label: "纪念日", value: "anniversary" },
  { label: "照片墙", value: "photos" }
];

export type DiaryEntry = {
  category?: string;
  content: string;
  createTime: string;
  creator?: string;
  date: string;
  id: string;
  images?: string[];
  mood: string;
  ownerUserId?: string;
  title?: string;
  updatedAt?: string;
  updatedBy?: string;
  visibility: DiaryVisibility;
};

export type GiftEntry = {
  createTime: string;
  date: string;
  description: string;
  id: string;
  image: string | null;
  name: string;
  tag: string;
};

export type AnniversaryEntry = {
  date: string;
  id: string;
  image?: string | null;
  repeatYearly: boolean;
  title: string;
};

export type LoveStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export const DIARY_KEY = "fanfan-guanguan.love.diaries.v1";
export const GIFT_KEY = "fanfan-guanguan.love.gifts.v1";
export const ANNIVERSARY_KEY = "fanfan-guanguan.love.anniversaries.v1";
const moods = ["开心", "甜蜜", "平静", "难过", "生气", "疲惫"];
const moodIcons: Record<string, string> = {
  开心: "😊",
  甜蜜: "🥰",
  平静: "😌",
  难过: "😢",
  生气: "😤",
  疲惫: "😴"
};

let memoryStore = new Map<string, string>();

const memoryStorage: LoveStorage = {
  getItem: (key) => memoryStore.get(key) ?? null,
  setItem: (key, value) => {
    memoryStore.set(key, value);
  }
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const diaryCategories = ["日常记录", "纪念时刻", "约会", "旅行", "其他"];
const giftTags = ["生日", "惊喜", "纪念日", "节日", "日常", "其他"];

export function LovePanel({
  activeTab,
  onTabChange,
  showInlineTabs = true,
  storage,
  themeTokens
}: {
  activeTab?: LoveTab;
  onTabChange?: (tab: LoveTab) => void;
  showInlineTabs?: boolean;
  storage?: LoveStorage;
  themeTokens?: UiTokens;
}) {
  const loveStorage = useMemo(() => storage ?? getDefaultLoveStorage(), [storage]);
  const [localTab, setLocalTab] = useState<LoveTab>("diary");
  const tab = activeTab ?? localTab;
  const setTab = onTabChange ?? setLocalTab;
  const [diaries, setDiaries] = useState<DiaryEntry[]>(() => loadArray<DiaryEntry>(loveStorage, DIARY_KEY));
  const [gifts, setGifts] = useState<GiftEntry[]>(() => loadArray<GiftEntry>(loveStorage, GIFT_KEY));
  const [anniversaries, setAnniversaries] = useState<AnniversaryEntry[]>(() => loadArray<AnniversaryEntry>(loveStorage, ANNIVERSARY_KEY));
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("开心");
  const [category, setCategory] = useState("日常记录");
  const [date, setDate] = useState(todayIso());
  const [diaryImages, setDiaryImages] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [anniversaryTitle, setAnniversaryTitle] = useState("");
  const [anniversaryDate, setAnniversaryDate] = useState(todayIso());
  const [repeatYearly, setRepeatYearly] = useState(false);
  const [anniImage, setAnniImage] = useState<string | null>(null);
  const [giftName, setGiftName] = useState("");
  const [giftDate, setGiftDate] = useState(todayIso());
  const [giftTag, setGiftTag] = useState("生日");
  const [giftDescription, setGiftDescription] = useState("");
  const [giftImage, setGiftImage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("写下今天的小瞬间。");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [diaryHeight, setDiaryHeight] = useState(44);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [selectedPhotoSource, setSelectedPhotoSource] = useState<{ id: string; type: "diary" | "gift" | "anniversary" } | null>(null);
  const localDirtyRef = useRef(false);
  const diaryFileInputRef = useRef<HTMLInputElement | null>(null);
  const giftFileInputRef = useRef<HTMLInputElement | null>(null);
  const anniFileInputRef = useRef<HTMLInputElement | null>(null);
  const [diaryDatePickerOpen, setDiaryDatePickerOpen] = useState(false);
  const [anniversaryDatePickerOpen, setAnniversaryDatePickerOpen] = useState(false);
  const [giftDatePickerOpen, setGiftDatePickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getCurrentLoveUserId().then((userId) => {
      if (!cancelled) setCurrentUserId(userId);
    });
    void getCurrentPartnerId().then((pid) => {
      if (!cancelled) setPartnerId(pid);
    });
    void hydrateLoveFromCloud(loveStorage).then((next) => {
      if (!cancelled && !localDirtyRef.current) {
        setDiaries(next.diaries);
        setAnniversaries(next.anniversaries);
        setGifts(next.gifts);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loveStorage, partnerId]);

  // 智能相机联动已移除：拍照后不再自动带入恋爱日记，照片只保存在本机
  // 主动从云端重新拉取对方（及自己）的共享内容。PWA 没有浏览器地址栏刷新，
  // 对方写了新内容后必须手动触发才能看到最新的。
  const refreshShared = async () => {
    setSyncing(true);
    setFeedback("正在同步对方的共享内容…");
    try {
      const next = await hydrateLoveFromCloud(loveStorage);
      localDirtyRef.current = false;
      setDiaries(next.diaries);
      setAnniversaries(next.anniversaries);
      setGifts(next.gifts);
      setLastSync(new Date().toLocaleString());
      setFeedback(partnerId ? "已同步：当前已与对方绑定，可看到彼此的共享内容。" : "已同步：当前未绑定，内容仅自己可见。");
    } catch {
      setFeedback("同步失败，请检查网络后重试。");
    } finally {
      setSyncing(false);
    }
  };

  const saveDiary = async () => {
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle) {
      setFeedback("请先填写日记标题。");
      return;
    }

    const activePartnerId = partnerId ?? await getCurrentPartnerId();
    setPartnerId(activePartnerId);
    if (!activePartnerId) {
      setFeedback("当前云端未绑定，日记暂未发布到双方共享空间。请重新完成伴侣绑定后再保存。");
      return;
    }
    const authorId = currentUserId ?? await getCurrentLoveUserId();

    const entry: DiaryEntry = {
      category,
      content: cleanContent,
      createTime: new Date().toISOString(),
      creator: currentUserId ?? "我",
      date,
      id: createLoveId("diary"),
      images: diaryImages,
      mood,
      ownerUserId: authorId ?? undefined,
      title: cleanTitle,
      updatedAt: new Date().toISOString(),
      updatedBy: authorId ?? undefined,
      visibility: "couple_edit"
    };
    const nextEntries = [entry, ...diaries];
    try {
      await saveDiariesToCloud(nextEntries);
    } catch {
      setFeedback("云端共享保存失败，请检查登录和伴侣绑定状态后重试。");
      return;
    }
    setDiaries(nextEntries);
    localDirtyRef.current = true;
    writeDiariesLocal(nextEntries, loveStorage);
    setTitle("");
    setContent("");
    setDiaryImages([]);
    setFeedback(
      partnerId
        ? "日记已保存到情侣共享空间，对方点「刷新」即可看到。"
        : "日记已保存（当前未绑定，仅自己可见）。去设置里绑定后才会共享。"
    );
  };

  const saveGift = () => {
    const cleanName = giftName.trim();
    if (!cleanName) {
      setFeedback("请先填写礼物名称。");
      return;
    }

    const entry: GiftEntry = {
      createTime: new Date().toISOString(),
      date: giftDate,
      description: giftDescription.trim(),
      id: createLoveId("gift"),
      image: giftImage,
      name: cleanName,
      tag: giftTag
    };
    const nextEntries = [entry, ...gifts];
    setGifts(nextEntries);
    localDirtyRef.current = true;
    saveGifts(nextEntries, loveStorage);
    setGiftName("");
    setGiftDescription("");
    setGiftImage(null);
    setFeedback("礼物已保存。");
  };

  const saveAnniversary = () => {
    const titleText = anniversaryTitle.trim();
    if (!titleText) {
      setFeedback("请先输入纪念日名称。");
      return;
    }

    const entry: AnniversaryEntry = {
      date: anniversaryDate,
      id: createLoveId("anniversary"),
      image: anniImage,
      repeatYearly,
      title: titleText
    };
    const nextEntries = [entry, ...anniversaries];
    setAnniversaries(nextEntries);
    localDirtyRef.current = true;
    saveAnniversaries(nextEntries, loveStorage);
    setAnniversaryTitle("");
    setAnniImage(null);
    setFeedback("纪念日已添加。");
  };

  const deleteDiary = (id: string) => {
    const nextEntries = diaries.filter((entry) => entry.id !== id);
    setDiaries(nextEntries);
    localDirtyRef.current = true;
    saveDiaries(nextEntries, loveStorage);
    void deleteDiaryFromCloud(id);
    setFeedback("日记已删除。");
  };

  const deleteGift = (id: string) => {
    const nextEntries = gifts.filter((entry) => entry.id !== id);
    setGifts(nextEntries);
    localDirtyRef.current = true;
    saveGifts(nextEntries, loveStorage);
    setFeedback("礼物已删除。");
  };

  const deleteAnniversary = (id: string) => {
    const nextEntries = anniversaries.filter((entry) => entry.id !== id);
    setAnniversaries(nextEntries);
    localDirtyRef.current = true;
    saveAnniversaries(nextEntries, loveStorage);
    setFeedback("纪念日已删除。");
  };

  const handleDiaryImagePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const remainingSlots = 6 - diaryImages.length;
    const targets = Array.from(files).slice(0, remainingSlots);
    for (const file of targets) {
      const reader = new FileReader();
      reader.onload = () => {
        setDiaryImages((current) => [...current, String(reader.result)]);
      };
      reader.readAsDataURL(file);
    }
    event.target.value = "";
  };

  const handleSingleImagePick = (setImage: (value: string | null) => void) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result));
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const groupedPhotos = useMemo(() => buildPhotoGroups(diaries, gifts, anniversaries), [diaries, gifts, anniversaries]);

  const sortedDiaries = useMemo(() => sortByNewest(diaries, (entry) => [entry.date, entry.createTime]), [diaries]);
  const sortedGifts = useMemo(() => sortByNewest(gifts, (entry) => [entry.date, entry.createTime]), [gifts]);
  const sortedAnniversaries = useMemo(() => sortByNewest(anniversaries, (entry) => entry.date), [anniversaries]);
  // A diary is "mine" (deletable by me) only when I am its owner. Co-edited
  // entries created by the partner stay deletable only by the partner.
  const isOwnEntry = (entry: DiaryEntry) => !entry.ownerUserId || entry.ownerUserId === currentUserId;
  const diaryList = useCollapsibleList(sortedDiaries);
  const giftList = useCollapsibleList(sortedGifts);
  const anniversaryList = useCollapsibleList(sortedAnniversaries);
  const photoList = useCollapsibleList(groupedPhotos);

  const navigateToPhotoSource = () => {
    if (!selectedPhotoSource) return;
    const { type } = selectedPhotoSource;
    setExpandedImage(null);
    if (type === "diary") {
      setTab("diary");
    } else if (type === "gift") {
      setTab("gifts");
    } else {
      setTab("anniversary");
    }
    setSelectedPhotoSource(null);
  };

  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.pageWatermark}>
          <IconHeart color="#111827" size={84} />
        </View>
        <Text style={styles.heroTitle}>恋爱日记</Text>
        <Text style={styles.heroSub}>记录每一个甜蜜瞬间</Text>
      </View>

      <View style={styles.syncBar}>
        <View style={styles.syncStatus}>
          <Text style={styles.syncStatusText}>
            {partnerId ? "已绑定 · 可与对方共享" : "未绑定 · 内容仅自己可见"}
          </Text>
          {lastSync ? <Text style={styles.syncTimeText}>上次同步：{lastSync}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="刷新共享内容"
          disabled={syncing}
          onPress={refreshShared}
          style={[styles.refreshButton, syncing ? styles.refreshButtonBusy : null]}
          testID="love-refresh-button"
        >
          <Text style={styles.refreshText}>{syncing ? "同步中…" : "⟳ 刷新"}</Text>
        </Pressable>
      </View>

      {tab === "diary" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>写日记</Text>
            <TextInput
              onChangeText={setTitle}
              placeholder="标题，例如：一起吃饭"
              style={styles.input}
              testID="love-diary-title-input"
              value={title}
            />
            <TextInput
              multiline
              onChangeText={setContent}
              onContentSizeChange={(event) => setDiaryHeight(event.nativeEvent.contentSize.height)}
              placeholder="今天发生了什么..."
              style={[styles.input, styles.diaryInput, { minHeight: Math.max(44, diaryHeight) }]}
              value={content}
            />
            <View style={styles.moodGrid}>
              {diaryCategories.map((item) => (
                <Pressable key={item} accessibilityRole="button" accessibilityLabel={`选择日记分类：${item}`} onPress={() => setCategory(item)} style={[styles.moodChip, category === item ? styles.moodChipActive : null]}>
                  <Text style={styles.moodText}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.moodGrid}>
              {moods.map((item) => (
                <Pressable key={item} accessibilityRole="button" accessibilityLabel={`选择心情：${item}`} onPress={() => setMood(item)} style={[styles.moodChip, mood === item ? styles.moodChipActive : null]}>
                  <Text style={styles.moodText}>{moodIcons[item]} {item}</Text>
                </Pressable>
              ))}
            </View>

            {diaryImages.length > 0 ? (
              <View style={styles.imageGrid}>
                {diaryImages.map((image, index) => (
                  <View key={index} style={styles.imageThumbWrap}>
                    <Pressable onPress={() => setExpandedImage(image)}>
                      <Image source={{ uri: image }} style={styles.imageThumb} />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="删除图片" onPress={() => setDiaryImages((current) => current.filter((_, i) => i !== index))} style={styles.imageRemove}>
                      <Text style={styles.imageRemoveText}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.saveRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="上传图片" onPress={() => diaryFileInputRef.current?.click()} style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>📷 上传图片</Text>
              </Pressable>
              <input
                accept="image/*"
                multiple
                onChange={handleDiaryImagePick}
                ref={diaryFileInputRef}
                style={{ display: "none" }}
                type="file"
              />
              <Pressable accessibilityRole="button" accessibilityLabel="选择日记日期" onPress={() => setDiaryDatePickerOpen((value) => !value)} style={[styles.input, styles.dateInput, styles.dateField]}>
                <Text style={styles.dateValue}>{date.replaceAll("-", "/")}</Text>
                <Text style={styles.dateChevron}>⌄</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="保存日记" nativeID="love-save-diary-button" onPress={() => void saveDiary()} style={styles.primaryButton}>
                <Text style={styles.primaryText}>保存</Text>
              </Pressable>
            </View>
            <DatePickerPopup
              onCancel={() => setDiaryDatePickerOpen(false)}
              onConfirm={(selectedDate) => { setDate(selectedDate); setDiaryDatePickerOpen(false); }}
              selectedDate={date}
              title="选择日记日期"
              visible={diaryDatePickerOpen}
            />
            <Text style={styles.sharedHint}>恋爱空间内容会保存到双方共享空间，双方都可以查看和编辑。</Text>
            <Text nativeID="love-feedback" style={styles.feedback}>{feedback}</Text>
          </View>

          {diaries.length === 0 ? (
            <View style={styles.emptyBox}>
              <PuppyIllustration color="#9cc39c" scene="generic" size={86} />
              <Text style={styles.emptyTitle}>还没有日记</Text>
              <Text style={styles.emptyText}>记录第一篇日记吧</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>日记列表（{diaryList.total}）</Text>
              {diaryList.visibleItems.map((entry) => (
                <View key={entry.id} style={styles.diaryCard}>
                  <View style={styles.diaryMetaRow}>
                    <Text style={styles.diaryDate}>{entry.date}</Text>
                    <View style={styles.diaryActions}>
                      <Text style={styles.visibilityBadge}>共享</Text>
                      {isOwnEntry(entry) ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`删除日记：${entry.title}`} onPress={() => deleteDiary(entry.id)} style={styles.deleteButton}>
                          <Text style={styles.deleteText}>删除</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.diaryTitle}>{entry.title ?? (entry.content.slice(0, 24) || "恋爱日记")}</Text>
                  <Text style={styles.diaryMood}>{moodIcons[entry.mood]} {entry.mood}</Text>
                  <Text style={styles.emptyText}>{entry.category ?? "日常记录"} · {entry.ownerUserId === currentUserId ? "我创建" : "TA创建"} · 最后由 {entry.creator ?? entry.updatedBy ?? entry.ownerUserId ?? "对方"} 修改</Text>
                  {entry.images && entry.images.length > 0 ? (
                    <View style={styles.imageGrid}>
                      {entry.images.map((image, index) => (
                        <Pressable key={index} onPress={() => setExpandedImage(image)} style={styles.imageThumbWrap}>
                          <Image source={{ uri: image }} style={styles.imageThumb} />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  <Text style={styles.diaryContent}>{entry.content}</Text>
                </View>
              ))}
              <CollapsibleSectionFooter
                expanded={diaryList.expanded}
                hiddenCount={diaryList.hiddenCount}
                name="日记"
                onPress={diaryList.toggle}
                testID="love-diary-show-more"
                tokens={themeTokens}
                visible={diaryList.canExpand}
              />
            </View>
          )}
        </>
      ) : null}

      {tab === "gifts" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>记录礼物</Text>
            <TextInput onChangeText={setGiftName} placeholder="礼物名称（如：手表）" style={styles.input} value={giftName} />
            <View style={styles.moodGrid}>
              {giftTags.map((item) => (
                <Pressable key={item} accessibilityRole="button" accessibilityLabel={`选择礼物标签：${item}`} onPress={() => setGiftTag(item)} style={[styles.moodChip, giftTag === item ? styles.moodChipActive : null]}>
                  <Text style={styles.moodText}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput multiline onChangeText={setGiftDescription} placeholder="描述（可选）" style={[styles.input, styles.diaryInput]} value={giftDescription} />

            {giftImage ? (
              <View style={styles.imageThumbWrap}>
                <Pressable onPress={() => setExpandedImage(giftImage)}>
                  <Image source={{ uri: giftImage }} style={styles.imageThumb} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="删除图片" onPress={() => setGiftImage(null)} style={styles.imageRemove}>
                  <Text style={styles.imageRemoveText}>×</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.saveRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="上传礼物图片" onPress={() => giftFileInputRef.current?.click()} style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>📷 上传图片</Text>
              </Pressable>
              <input accept="image/*" onChange={handleSingleImagePick(setGiftImage)} ref={giftFileInputRef} style={{ display: "none" }} type="file" />
              <Pressable accessibilityRole="button" accessibilityLabel="选择礼物日期" onPress={() => setGiftDatePickerOpen((value) => !value)} style={[styles.input, styles.dateInput, styles.dateField]}>
                <Text style={styles.dateValue}>{giftDate.replaceAll("-", "/")}</Text>
                <Text style={styles.dateChevron}>⌄</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="保存礼物" onPress={saveGift} style={styles.primaryButton}>
                <Text style={styles.primaryText}>保存</Text>
              </Pressable>
            </View>
            <DatePickerPopup
              onCancel={() => setGiftDatePickerOpen(false)}
              onConfirm={(selectedDate) => { setGiftDate(selectedDate); setGiftDatePickerOpen(false); }}
              selectedDate={giftDate}
              title="选择礼物日期"
              visible={giftDatePickerOpen}
            />
            <Text nativeID="love-feedback" style={styles.feedback}>{feedback}</Text>
          </View>

          {gifts.length === 0 ? (
            <View style={styles.emptyBox}>
              <PuppyIllustration color="#9cc39c" scene="gift" size={86} />
              <Text style={styles.emptyTitle}>还没有礼物记录</Text>
              <Text style={styles.emptyText}>记录你们互赠的礼物</Text>
            </View>
          ) : (
            <>
            {giftList.visibleItems.map((entry) => (
              <View key={entry.id} style={styles.giftCard}>
                <View style={styles.diaryMetaRow}>
                  <Text style={styles.diaryDate}>{entry.date}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`删除礼物：${entry.name}`} onPress={() => deleteGift(entry.id)} style={styles.deleteButton}>
                    <Text style={styles.deleteText}>删除</Text>
                  </Pressable>
                </View>
                <View style={styles.giftBody}>
                  {entry.image ? (
                    <Pressable onPress={() => { setSelectedPhotoSource({ id: entry.id, type: "gift" }); setExpandedImage(entry.image); }}>
                      <Image source={{ uri: entry.image }} style={styles.giftThumb} />
                    </Pressable>
                  ) : null}
                  <View style={styles.giftInfo}>
                    <Text style={styles.diaryTitle}>{entry.name}</Text>
                    <Text style={styles.diaryCategory}>标签：{entry.tag}</Text>
                    {entry.description ? <Text style={styles.diaryContent}>{entry.description}</Text> : null}
                  </View>
                </View>
              </View>
            ))}
            <CollapsibleSectionFooter
              expanded={giftList.expanded}
              hiddenCount={giftList.hiddenCount}
              name="礼物记录"
              onPress={giftList.toggle}
              testID="love-gift-show-more"
              tokens={themeTokens}
              visible={giftList.canExpand}
            />
            </>
          )}
        </>
      ) : null}

      {tab === "anniversary" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>添加纪念日</Text>
            <TextInput onChangeText={setAnniversaryTitle} placeholder="纪念日名称（如：在一起的日子）" style={styles.input} value={anniversaryTitle} />
            <Pressable accessibilityRole="button" accessibilityLabel="选择纪念日日期" onPress={() => setAnniversaryDatePickerOpen((value) => !value)} style={[styles.input, styles.dateField]}>
              <Text style={styles.dateValue}>{anniversaryDate.replaceAll("-", "/")}</Text>
              <Text style={styles.dateChevron}>⌄</Text>
            </Pressable>
            <DatePickerPopup
              onCancel={() => setAnniversaryDatePickerOpen(false)}
              onConfirm={(selectedDate) => { setAnniversaryDate(selectedDate); setAnniversaryDatePickerOpen(false); }}
              selectedDate={anniversaryDate}
              title="选择纪念日日期"
              visible={anniversaryDatePickerOpen}
            />
            <Pressable accessibilityRole="switch" accessibilityLabel="每年重复" accessibilityState={{ checked: repeatYearly }} onPress={() => setRepeatYearly((value) => !value)} style={styles.repeatRow}>
              <View style={[styles.switchTrack, repeatYearly ? styles.switchTrackActive : null]}>
                <View style={[styles.switchThumb, repeatYearly ? styles.switchThumbActive : null]} />
              </View>
              <Text style={styles.repeatText}>每年重复</Text>
            </Pressable>

            {anniImage ? (
              <View style={styles.imageThumbWrap}>
                <Pressable onPress={() => setExpandedImage(anniImage)}>
                  <Image source={{ uri: anniImage }} style={styles.imageThumb} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="删除图片" onPress={() => setAnniImage(null)} style={styles.imageRemove}>
                  <Text style={styles.imageRemoveText}>×</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.saveRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="上传纪念日图片" onPress={() => anniFileInputRef.current?.click()} style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>📷 上传图片</Text>
              </Pressable>
              <input accept="image/*" onChange={handleSingleImagePick(setAnniImage)} ref={anniFileInputRef} style={{ display: "none" }} type="file" />
              <Pressable accessibilityRole="button" accessibilityLabel="添加纪念日" onPress={saveAnniversary} style={styles.primaryButton}>
                <Text style={styles.primaryText}>添加</Text>
              </Pressable>
            </View>
            <Text nativeID="love-feedback" style={styles.feedback}>{feedback}</Text>
          </View>

          {anniversaries.length === 0 ? (
            <View style={styles.emptyBox}>
              <PuppyIllustration color="#9cc39c" scene="generic" size={86} />
              <Text style={styles.emptyTitle}>还没有纪念日</Text>
              <Text style={styles.emptyText}>添加你们的特殊日子</Text>
            </View>
          ) : (
            <>
            {anniversaryList.visibleItems.map((entry) => (
              <View key={entry.id} style={styles.diaryCard}>
                <View style={styles.diaryMetaRow}>
                  <Text style={styles.diaryDate}>{entry.date}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`删除纪念日：${entry.title}`} onPress={() => deleteAnniversary(entry.id)} style={styles.deleteButton}>
                    <Text style={styles.deleteText}>删除</Text>
                  </Pressable>
                </View>
                <Text style={styles.diaryTitle}>{entry.title}</Text>
                <Text style={styles.anniversaryDistance}>{calculateAnniversaryDistance(entry.date, entry.repeatYearly)}</Text>
                {entry.image ? (
                  <View style={styles.imageGrid}>
                    <Pressable onPress={() => { setSelectedPhotoSource({ id: entry.id, type: "anniversary" }); setExpandedImage(entry.image ?? null); }}>
                      <Image source={{ uri: entry.image }} style={styles.imageThumb} />
                    </Pressable>
                  </View>
                ) : null}
                <Text style={styles.emptyText}>{entry.repeatYearly ? "每年重复" : "不重复"}</Text>
              </View>
            ))}
            <CollapsibleSectionFooter
              expanded={anniversaryList.expanded}
              hiddenCount={anniversaryList.hiddenCount}
              name="纪念日"
              onPress={anniversaryList.toggle}
              testID="love-anniversary-show-more"
              tokens={themeTokens}
              visible={anniversaryList.canExpand}
            />
            </>
          )}
        </>
      ) : null}

      {tab === "photos" ? (
        groupedPhotos.length === 0 ? (
          <View style={styles.emptyBox}>
            <PuppyIllustration color="#9cc39c" scene="search" size={86} />
            <Text style={styles.emptyTitle}>照片墙还是空的</Text>
            <Text style={styles.emptyText}>日记、礼物和纪念日里的照片会在这里按月份聚合展示。</Text>
          </View>
        ) : (
          <>
          {photoList.visibleItems.map((group) => (
            <View key={group.key} style={styles.card}>
              <Text style={styles.cardTitle}>{group.year} 年 {group.month} 月</Text>
              <View style={styles.photoGrid}>
                {group.photos.map((photo, index) => (
                  <Pressable
                    key={`${photo.source.id}-${index}`}
                    accessibilityLabel="查看照片"
                    onPress={() => { setSelectedPhotoSource(photo.source); setExpandedImage(photo.image); }}
                    style={styles.photoThumbWrap}
                  >
                    <Image source={{ uri: photo.image }} style={styles.photoThumb} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          <CollapsibleSectionFooter
            expanded={photoList.expanded}
            hiddenCount={photoList.hiddenCount}
            name="照片墙月份"
            onPress={photoList.toggle}
            testID="love-photo-show-more"
            tokens={themeTokens}
            unit="个月"
            visible={photoList.canExpand}
          />
          </>
        )
      ) : null}

      {showInlineTabs ? (
        <View testID="love-floating-tabs" style={[styles.tabs, styles.floatingTabs]}>
          {loveTabs.map((item) => (
            <TabButton key={item.value} active={tab === item.value} label={item.label} onPress={() => setTab(item.value)} />
          ))}
        </View>
      ) : null}

      {expandedImage ? (
        <Pressable onPress={() => setExpandedImage(null)} style={styles.lightbox}>
          <Image resizeMode="contain" source={{ uri: expandedImage }} style={styles.lightboxImage} />
          {selectedPhotoSource ? (
            <Pressable accessibilityRole="button" accessibilityLabel="查看来源" onPress={navigateToPhotoSource} style={styles.lightboxButton}>
              <Text style={styles.lightboxButtonText}>查看来源</Text>
            </Pressable>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.tab, active ? styles.tabActive : null]}>
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function getDefaultLoveStorage(): LoveStorage {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return memoryStorage;
}

function loadArray<T>(storage: LoveStorage, key: string) {
  const raw = storage.getItem(key);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDiaries(entries: DiaryEntry[], storage: LoveStorage = getDefaultLoveStorage()) {
  storage.setItem(DIARY_KEY, JSON.stringify(entries));
  void saveDiariesToCloud(entries).catch(() => undefined);
}

export function saveAnniversaries(entries: AnniversaryEntry[], storage: LoveStorage = getDefaultLoveStorage()) {
  storage.setItem(ANNIVERSARY_KEY, JSON.stringify(entries));
  void saveCloudValue(ANNIVERSARY_KEY, entries);
}

export function saveGifts(entries: GiftEntry[], storage: LoveStorage = getDefaultLoveStorage()) {
  storage.setItem(GIFT_KEY, JSON.stringify(entries));
  void saveCloudValue(GIFT_KEY, entries);
}

export async function hydrateLoveFromCloud(storage: LoveStorage = getDefaultLoveStorage()): Promise<{ anniversaries: AnniversaryEntry[]; diaries: DiaryEntry[]; gifts: GiftEntry[] }> {
  const localDiaries = loadArray<DiaryEntry>(storage, DIARY_KEY);
  const localAnniversaries = loadArray<AnniversaryEntry>(storage, ANNIVERSARY_KEY);
  const localGifts = loadArray<GiftEntry>(storage, GIFT_KEY);
  const [diaries, anniversaries, gifts] = await Promise.all([
    loadDiariesFromCloud(localDiaries, (value) => writeDiariesLocal(value, storage)),
    hydrateFromCloud<AnniversaryEntry[]>(ANNIVERSARY_KEY, localAnniversaries, (value) => saveAnniversaries(value, storage)),
    hydrateFromCloud<GiftEntry[]>(GIFT_KEY, localGifts, (value) => saveGifts(value, storage))
  ]);
  return { anniversaries, diaries, gifts };
}

function writeDiariesLocal(entries: DiaryEntry[], storage: LoveStorage) {
  storage.setItem(DIARY_KEY, JSON.stringify(entries));
}

function createLoveId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const value = Math.floor(Math.random() * 16);
    const hex = token === "x" ? value : (value & 0x3) | 0x8;
    return hex.toString(16);
  });
}

export function clearLoveMemoryForTests() {
  memoryStore = new Map<string, string>();
}

function calculateAnniversaryDistance(date: string, repeatYearly: boolean) {
  const today = new Date();
  const target = new Date(date);
  const currentYear = today.getFullYear();
  const targetThisYear = new Date(currentYear, target.getMonth(), target.getDate());
  let diffDays = Math.ceil((targetThisYear.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0 && repeatYearly) {
    const targetNextYear = new Date(currentYear + 1, target.getMonth(), target.getDate());
    diffDays = Math.ceil((targetNextYear.getTime() - today.getTime()) / 86_400_000);
  }

  if (diffDays === 0) return "今天就是纪念日 ❤️";
  if (diffDays > 0) return `还有 ${diffDays} 天`;
  return `已过去 ${Math.abs(diffDays)} 天`;
}

type PhotoItem = {
  date: string;
  image: string;
  source: { id: string; type: "diary" | "gift" | "anniversary" };
};

type PhotoGroup = {
  key: string;
  month: string;
  photos: PhotoItem[];
  year: string;
};

function buildPhotoGroups(diaries: DiaryEntry[], gifts: GiftEntry[], anniversaries: AnniversaryEntry[]): PhotoGroup[] {
  const photos: PhotoItem[] = [];

  for (const diary of diaries) {
    for (const image of diary.images ?? []) {
      photos.push({ date: diary.date, image, source: { id: diary.id, type: "diary" } });
    }
  }
  for (const gift of gifts) {
    if (gift.image) {
      photos.push({ date: gift.date, image: gift.image, source: { id: gift.id, type: "gift" } });
    }
  }
  for (const anni of anniversaries) {
    if (anni.image) {
      photos.push({ date: anni.date, image: anni.image, source: { id: anni.id, type: "anniversary" } });
    }
  }

  photos.sort((left, right) => right.date.localeCompare(left.date));

  const groups = new Map<string, PhotoGroup>();
  for (const photo of photos) {
    const [year, month] = photo.date.split("-");
    const key = `${year}-${month}`;
    const existing = groups.get(key);
    if (existing) {
      existing.photos.push(photo);
    } else {
      groups.set(key, { key, month, photos: [photo], year });
    }
  }

  return Array.from(groups.values()).sort((left, right) => right.key.localeCompare(left.key));
}

const styles = StyleSheet.create({
  anniversaryDistance: {
    color: "#0f79ad",
    fontSize: 14,
    fontWeight: "900"
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "#e6ebf2",
    borderRadius: 20,
    borderWidth: 1,
    elevation: 2,
    gap: 12,
    padding: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12
  },
  cardTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900"
  },
  dateChevron: {
    color: "#697386",
    fontSize: 18,
    fontWeight: "900"
  },
  dateField: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  dateInput: {
    flex: 1
  },
  dateValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700"
  },
  deleteButton: {
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  deleteText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "900"
  },
  diaryCard: {
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 14
  },
  diaryContent: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22
  },
  diaryActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  diaryCategory: {
    color: "#697386",
    fontSize: 14,
    fontWeight: "800"
  },
  diaryDate: {
    color: "#697386",
    fontSize: 14,
    fontWeight: "800"
  },
  diaryInput: {
    minHeight: 44,
    paddingVertical: 10,
    textAlignVertical: "top"
  },
  diaryMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  diaryMood: {
    color: "#697386",
    fontSize: 15,
    fontWeight: "800"
  },
  diaryTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900"
  },
  emptyBox: {
    alignItems: "center",
    gap: 8,
    minHeight: 230,
    justifyContent: "center"
  },
  emptyText: {
    color: "#697386",
    fontSize: 16,
    fontWeight: "700"
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900"
  },
  feedback: {
    color: "#697386",
    fontSize: 12,
    fontWeight: "800"
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
  giftBody: {
    flexDirection: "row",
    gap: 12
  },
  giftCard: {
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 14
  },
  giftInfo: {
    flex: 1,
    gap: 4
  },
  giftThumb: {
    backgroundColor: "#eef2f7",
    borderRadius: 12,
    height: 84,
    width: 84
  },
  hero: {
    gap: 6,
    overflow: "hidden",
    position: "relative"
  },
  pageWatermark: {
    bottom: -14,
    opacity: 0.05,
    position: "absolute",
    right: 4,
    top: -14
  },
  heroSub: {
    color: "#697386",
    fontSize: 15,
    fontWeight: "700"
  },
  heroTitle: {
    color: "#111827",
    fontSize: 26,
    fontWeight: "900"
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  imageRemove: {
    alignItems: "center",
    backgroundColor: "rgba(17,24,39,0.6)",
    borderRadius: 999,
    height: 20,
    justifyContent: "center",
    position: "absolute",
    right: -4,
    top: -4,
    width: 20
  },
  imageRemoveText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 16
  },
  imageThumb: {
    backgroundColor: "#eef2f7",
    borderRadius: 10,
    height: 72,
    width: 72
  },
  imageThumbWrap: {
    position: "relative"
  },
  input: {
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 12,
    borderWidth: 1,
    color: "#111827",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  lightbox: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.82)",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 120
  },
  lightboxButton: {
    backgroundColor: "#1fa8e2",
    borderRadius: 999,
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 10
  },
  lightboxButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  lightboxImage: {
    borderRadius: 14,
    height: "70%",
    width: "90%"
  },
  moodChip: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e3e8ef",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    minWidth: "28%",
    maxWidth: "32%",
    paddingVertical: 8
  },
  moodChipActive: {
    backgroundColor: "#eaf6ff",
    borderColor: "#1fa8e2"
  },
  moodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-start"
  },
  moodText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900"
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  photoThumb: {
    backgroundColor: "#eef2f7",
    borderRadius: 12,
    height: 96,
    width: 96
  },
  photoThumbWrap: {
    borderRadius: 12,
    overflow: "hidden"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#7acbf0",
    borderRadius: 12,
    minWidth: 96,
    paddingHorizontal: 18,
    paddingVertical: 11
  },
  primaryText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  repeatRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  repeatText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900"
  },
  saveRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#eef2f7",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  secondaryText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900"
  },
  sharedHint: {
    color: "#0f79ad",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18
  },
  syncBar: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "#e6ebf2",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  syncStatus: {
    flex: 1,
    gap: 2
  },
  syncStatusText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900"
  },
  syncTimeText: {
    color: "#697386",
    fontSize: 12,
    fontWeight: "700"
  },
  refreshButton: {
    alignItems: "center",
    backgroundColor: "#1fa8e2",
    borderRadius: 12,
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  refreshButtonBusy: {
    backgroundColor: "#9cc3d8"
  },
  refreshText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900"
  },
  stack: {
    gap: 18,
    paddingBottom: 108,
    position: "relative"
  },
  switchThumb: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    height: 32,
    width: 32
  },
  switchThumbActive: {
    marginLeft: 30
  },
  switchTrack: {
    backgroundColor: "#e3e8ef",
    borderRadius: 999,
    padding: 3,
    width: 68
  },
  switchTrackActive: {
    backgroundColor: "#7acbf0"
  },
  tab: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    paddingVertical: 10
  },
  tabActive: {
    backgroundColor: "#ffffff"
  },
  tabs: {
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    flexDirection: "row",
    gap: 4,
    padding: 4,
    width: "auto"
  },
  inlineTabs: {
    position: "relative",
    width: "100%"
  },
  tabText: {
    color: "#697386",
    fontSize: 15,
    fontWeight: "900"
  },
  tabTextActive: {
    color: "#111827"
  },
  visibilityBadge: {
    backgroundColor: "#eaf6ff",
    borderRadius: 999,
    color: "#0f79ad",
    fontSize: 13,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5
  }
});
