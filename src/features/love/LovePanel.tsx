import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CollapsibleSectionFooter, useCollapsibleList } from "@/shared/ui/CollapsibleList";
import { DatePickerPopup } from "@/shared/ui/DatePickerPopup";
import { PuppyIllustration } from "@/shared/ui/PuppyIllustration";
import type { FixedBottomTabItem } from "@/shared/ui/FixedBottomTabs";
import type { UiTokens } from "@/shared/ui/primitives";
import { getCurrentPartnerId } from "@/auth/partnership";
import { getCurrentLoveUserId, hydrateLoveSharedValue, saveLoveSharedValue } from "./loveSharedCloud";

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
  folderId?: string | null;
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
  direction?: GiftDirection;
  folderId?: string | null;
  id: string;
  image: string | null;
  name: string;
  tag: string;
};

export type AnniversaryEntry = {
  date: string;
  id: string;
  image?: string | null;
  reminderDays?: number;
  repeatYearly: boolean;
  title: string;
};

export type LoveFolder = {
  createTime: string;
  id: string;
  name: string;
};

export type LoveStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export const DIARY_KEY = "fanfan-guanguan.love.diaries.v1";
export const GIFT_KEY = "fanfan-guanguan.love.gifts.v1";
export const ANNIVERSARY_KEY = "fanfan-guanguan.love.anniversaries.v1";
export const LOVE_FOLDER_KEY = "fanfan-guanguan.love.folders.v1";
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
const giftDirections = ["我送 TA", "TA 送我"] as const;
type GiftDirection = (typeof giftDirections)[number];
const dateFilters = ["全部日期", "今天", "昨天", "本周", "本月"] as const;
const sortOptions = ["最新优先", "最早优先"] as const;
const repeatOptions = ["不重复", "每年重复"] as const;
const reminderOptions = [
  { label: "当天", value: 0 },
  { label: "1 天", value: 1 },
  { label: "3 天", value: 3 },
  { label: "7 天", value: 7 },
  { label: "30 天", value: 30 }
];

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
  const [folders, setFolders] = useState<LoveFolder[]>(() => loadArray<LoveFolder>(loveStorage, LOVE_FOLDER_KEY));
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("开心");
  const [category, setCategory] = useState("日常记录");
  const [date, setDate] = useState(todayIso());
  const [diaryFolderId, setDiaryFolderId] = useState<string | null>(null);
  const [diaryImages, setDiaryImages] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [anniversaryTitle, setAnniversaryTitle] = useState("");
  const [anniversaryDate, setAnniversaryDate] = useState(todayIso());
  const [repeatYearly, setRepeatYearly] = useState(false);
  const [reminderDays, setReminderDays] = useState(0);
  const [anniImage, setAnniImage] = useState<string | null>(null);
  const [giftName, setGiftName] = useState("");
  const [giftDate, setGiftDate] = useState(todayIso());
  const [giftTag, setGiftTag] = useState("生日");
  const [giftDirection, setGiftDirection] = useState<GiftDirection>("我送 TA");
  const [giftFolderId, setGiftFolderId] = useState<string | null>(null);
  const [giftDescription, setGiftDescription] = useState("");
  const [giftImage, setGiftImage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [diaryHeight, setDiaryHeight] = useState(44);
  const [giftDescriptionHeight, setGiftDescriptionHeight] = useState(44);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [selectedPhotoSource, setSelectedPhotoSource] = useState<{ id: string; type: "diary" | "gift" | "anniversary" } | null>(null);
  const [openPickerId, setOpenPickerId] = useState<string | null>(null);
  const [diarySearch, setDiarySearch] = useState("");
  const [diaryDateFilter, setDiaryDateFilter] = useState<(typeof dateFilters)[number]>("全部日期");
  const [diaryTypeFilter, setDiaryTypeFilter] = useState("全部");
  const [diaryFolderFilter, setDiaryFolderFilter] = useState<string | null>(null);
  const [diarySort, setDiarySort] = useState<(typeof sortOptions)[number]>("最新优先");
  const [giftSearch, setGiftSearch] = useState("");
  const [giftDateFilter, setGiftDateFilter] = useState<(typeof dateFilters)[number]>("全部日期");
  const [giftTypeFilter, setGiftTypeFilter] = useState("全部");
  const [giftDirectionFilter, setGiftDirectionFilter] = useState("全部");
  const [giftFolderFilter, setGiftFolderFilter] = useState<string | null>(null);
  const [giftSort, setGiftSort] = useState<(typeof sortOptions)[number]>("最新优先");
  const [newFolderName, setNewFolderName] = useState("");
  const [openDiaryMenuId, setOpenDiaryMenuId] = useState<string | null>(null);
  const [openGiftMenuId, setOpenGiftMenuId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<DetailState | null>(null);
  const [editingDiaryId, setEditingDiaryId] = useState<string | null>(null);
  const [editingGiftId, setEditingGiftId] = useState<string | null>(null);
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
        setFolders(next.folders);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loveStorage, partnerId]);

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
      setFolders(next.folders);
      setLastSync(new Date().toLocaleString());
      setFeedback(partnerId ? "✓ 已同步" : "当前未绑定");
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
      folderId: diaryFolderId,
      id: createLoveId("diary"),
      images: diaryImages,
      mood,
      ownerUserId: authorId ?? undefined,
      title: cleanTitle,
      updatedAt: new Date().toISOString(),
      updatedBy: authorId ?? undefined,
      visibility: "couple_edit"
    };
    const nextEntries = editingDiaryId ? diaries.map((item) => (item.id === editingDiaryId ? { ...entry, id: editingDiaryId, createTime: item.createTime } : item)) : [entry, ...diaries];
    try {
      await saveLoveSharedValue(DIARY_KEY, nextEntries);
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
    setDiaryFolderId(null);
    setEditingDiaryId(null);
    setFeedback(partnerId ? "✓ 已保存 · 已同步" : "✓ 已保存");
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
      direction: giftDirection,
      folderId: giftFolderId,
      id: createLoveId("gift"),
      image: giftImage,
      name: cleanName,
      tag: giftTag
    };
    const nextEntries = editingGiftId ? gifts.map((item) => (item.id === editingGiftId ? { ...entry, id: editingGiftId, createTime: item.createTime } : item)) : [entry, ...gifts];
    setGifts(nextEntries);
    localDirtyRef.current = true;
    saveGifts(nextEntries, loveStorage);
    setGiftName("");
    setGiftDescription("");
    setGiftImage(null);
    setGiftFolderId(null);
    setEditingGiftId(null);
    setFeedback("✓ 已保存");
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
      reminderDays,
      repeatYearly,
      title: titleText
    };
    const nextEntries = [entry, ...anniversaries];
    setAnniversaries(nextEntries);
    localDirtyRef.current = true;
    saveAnniversaries(nextEntries, loveStorage);
    setAnniversaryTitle("");
    setAnniImage(null);
    setReminderDays(0);
    setFeedback("✓ 已保存");
  };

  const deleteDiary = (id: string) => {
    if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm("确认删除这篇日记吗？")) return;
    const nextEntries = diaries.filter((entry) => entry.id !== id);
    setDiaries(nextEntries);
    localDirtyRef.current = true;
    saveDiaries(nextEntries, loveStorage);
    setFeedback("✓ 已删除");
  };

  const deleteGift = (id: string) => {
    if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm("确认删除这条礼物记录吗？")) return;
    const nextEntries = gifts.filter((entry) => entry.id !== id);
    setGifts(nextEntries);
    localDirtyRef.current = true;
    saveGifts(nextEntries, loveStorage);
    setFeedback("✓ 已删除");
  };

  const deleteAnniversary = (id: string) => {
    if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm("确认删除这个纪念日吗？")) return;
    const nextEntries = anniversaries.filter((entry) => entry.id !== id);
    setAnniversaries(nextEntries);
    localDirtyRef.current = true;
    saveAnniversaries(nextEntries, loveStorage);
    setFeedback("✓ 已删除");
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
  const folderOptions = useMemo(() => [{ label: "未分类", value: "" }, ...folders.map((folder) => ({ label: folder.name, value: folder.id }))], [folders]);
  const diaryArchive = useMemo(
    () => filterDiaries(diaries, { dateFilter: diaryDateFilter, folderId: diaryFolderFilter, query: diarySearch, sort: diarySort, type: diaryTypeFilter }),
    [diaries, diaryDateFilter, diaryFolderFilter, diarySearch, diarySort, diaryTypeFilter]
  );
  const giftArchive = useMemo(
    () => filterGifts(gifts, { dateFilter: giftDateFilter, direction: giftDirectionFilter, folderId: giftFolderFilter, query: giftSearch, sort: giftSort, type: giftTypeFilter }),
    [gifts, giftDateFilter, giftDirectionFilter, giftFolderFilter, giftSearch, giftSort, giftTypeFilter]
  );
  const sortedAnniversaries = useMemo(() => sortAnniversariesByNextDate(anniversaries), [anniversaries]);
  // A diary is "mine" (deletable by me) only when I am its owner. Co-edited
  // entries created by the partner stay deletable only by the partner.
  const isOwnEntry = (entry: DiaryEntry) => !entry.ownerUserId || entry.ownerUserId === currentUserId;
  const diaryList = useCollapsibleList(diaryArchive);
  const giftList = useCollapsibleList(giftArchive);
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

  const getFolderName = (folderId?: string | null) => folders.find((folder) => folder.id === folderId)?.name ?? "未分类";
  const togglePicker = (id: string) => setOpenPickerId((current) => (current === id ? null : id));
  const createFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    const nextFolders = [...folders, { createTime: new Date().toISOString(), id: createLoveId("folder"), name }];
    setFolders(nextFolders);
    saveFolders(nextFolders, loveStorage);
    setNewFolderName("");
    setFeedback("✓ 文件夹已保存");
  };
  const renameFolder = (folderId: string) => {
    if (typeof window === "undefined" || typeof window.prompt !== "function") return;
    const folder = folders.find((item) => item.id === folderId);
    const name = window.prompt("重命名文件夹", folder?.name ?? "");
    if (!name?.trim()) return;
    const nextFolders = folders.map((item) => (item.id === folderId ? { ...item, name: name.trim() } : item));
    setFolders(nextFolders);
    saveFolders(nextFolders, loveStorage);
    setFeedback("✓ 文件夹已重命名");
  };
  const deleteFolder = (folderId: string) => {
    if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm("删除文件夹后，里面的日记和礼物会回到未分类，确认删除吗？")) return;
    const nextFolders = folders.filter((item) => item.id !== folderId);
    const nextDiaries = diaries.map((item) => (item.folderId === folderId ? { ...item, folderId: null } : item));
    const nextGifts = gifts.map((item) => (item.folderId === folderId ? { ...item, folderId: null } : item));
    setFolders(nextFolders);
    setDiaries(nextDiaries);
    setGifts(nextGifts);
    saveFolders(nextFolders, loveStorage);
    saveDiaries(nextDiaries, loveStorage);
    saveGifts(nextGifts, loveStorage);
    setDiaryFolderFilter(null);
    setGiftFolderFilter(null);
    setFeedback("✓ 文件夹已删除");
  };
  const editDiary = (entry: DiaryEntry) => {
    setEditingDiaryId(entry.id);
    setTitle(entry.title ?? "");
    setContent(entry.content);
    setCategory(entry.category ?? "日常记录");
    setMood(entry.mood ?? "开心");
    setDate(entry.date);
    setDiaryFolderId(entry.folderId ?? null);
    setDiaryImages(entry.images ?? []);
    setOpenDiaryMenuId(null);
  };
  const moveDiary = (entry: DiaryEntry, folderId: string) => {
    const nextEntries = diaries.map((item) => (item.id === entry.id ? { ...item, folderId: folderId || null, updatedAt: new Date().toISOString(), updatedBy: currentUserId ?? undefined } : item));
    setDiaries(nextEntries);
    saveDiaries(nextEntries, loveStorage);
    setOpenDiaryMenuId(null);
    setFeedback("✓ 已移动");
  };
  const editGift = (entry: GiftEntry) => {
    setEditingGiftId(entry.id);
    setGiftName(entry.name);
    setGiftDate(entry.date);
    setGiftTag(entry.tag);
    setGiftDescription(entry.description);
    setGiftImage(entry.image);
    setGiftDirection(entry.direction ?? "我送 TA");
    setGiftFolderId(entry.folderId ?? null);
    setOpenGiftMenuId(null);
  };
  const moveGift = (entry: GiftEntry, folderId: string) => {
    const nextEntries = gifts.map((item) => (item.id === entry.id ? { ...item, folderId: folderId || null } : item));
    setGifts(nextEntries);
    saveGifts(nextEntries, loveStorage);
    setOpenGiftMenuId(null);
    setFeedback("✓ 已移动");
  };

  return (
    <View style={styles.stack}>
      <View style={styles.syncBar}>
        <View style={styles.syncStatus}>
          <Text style={styles.syncStatusText}>{partnerId ? "❤️ 已绑定" : "未绑定"}</Text>
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
          <Text style={styles.refreshText}>{syncing ? "…" : "⟳"}</Text>
        </Pressable>
      </View>

      {tab === "diary" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>写日记</Text>
            <View style={styles.inlineRow}>
              <TextInput
                onChangeText={setTitle}
                placeholder="标题，例如：一起吃饭"
                style={[styles.input, styles.titleField]}
                testID="love-diary-title-input"
                value={title}
              />
              <Pressable accessibilityRole="button" accessibilityLabel="选择日记日期" onPress={() => setDiaryDatePickerOpen((value) => !value)} style={[styles.input, styles.dateCompact]}>
                <Text style={styles.dateValue}>{date.replaceAll("-", "/")}</Text>
              </Pressable>
            </View>
            <TextInput
              scrollEnabled
              multiline
              onChangeText={setContent}
              onContentSizeChange={(event) => setDiaryHeight(event.nativeEvent.contentSize.height)}
              placeholder="今天发生了什么..."
              style={[styles.input, styles.diaryInput, { height: Math.min(Math.max(44, diaryHeight), 168) }]}
              value={content}
            />
            <View style={styles.inlineRow}>
              <PickerButton
                accessibilityLabel="选择日记类型"
                id="diary-type"
                label={category}
                onSelect={setCategory}
                onToggle={togglePicker}
                open={openPickerId === "diary-type"}
                options={diaryCategories.map((item) => ({ label: item, value: item }))}
                selectedValue={category}
              />
              <PickerButton
                accessibilityLabel="选择日记心情"
                id="diary-mood"
                label={`${moodIcons[mood]} ${mood}`}
                onSelect={setMood}
                onToggle={togglePicker}
                open={openPickerId === "diary-mood"}
                options={moods.map((item) => ({ label: `${moodIcons[item]} ${item}`, value: item }))}
                selectedValue={mood}
              />
            </View>
            <PickerButton
              accessibilityLabel="选择日记文件夹"
              id="diary-folder"
              label={getFolderName(diaryFolderId)}
              onSelect={(value) => setDiaryFolderId(value || null)}
              onToggle={togglePicker}
              open={openPickerId === "diary-folder"}
              options={folderOptions}
              selectedValue={diaryFolderId ?? ""}
            />

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
                <Text style={styles.secondaryText}>图片</Text>
              </Pressable>
              <input
                accept="image/*"
                multiple
                onChange={handleDiaryImagePick}
                ref={diaryFileInputRef}
                style={{ display: "none" }}
                type="file"
              />
              <Pressable accessibilityRole="button" accessibilityLabel="保存日记" nativeID="love-save-diary-button" onPress={() => void saveDiary()} style={styles.primaryButton}>
                <Text style={styles.primaryText}>{editingDiaryId ? "更新" : "保存"}</Text>
              </Pressable>
            </View>
            <DatePickerPopup
              onCancel={() => setDiaryDatePickerOpen(false)}
              onConfirm={(selectedDate) => { setDate(selectedDate); setDiaryDatePickerOpen(false); }}
              selectedDate={date}
              title="选择日记日期"
              visible={diaryDatePickerOpen}
            />
            {feedback ? <Text nativeID="love-feedback" style={styles.feedback}>{feedback}</Text> : null}
          </View>

          <View style={styles.card}>
            <View style={styles.archiveHeader}>
              <Text style={styles.cardTitle}>日记档案</Text>
              <Text style={styles.archiveCount}>{diaryArchive.length} 篇</Text>
            </View>
            <TextInput onChangeText={setDiarySearch} placeholder="搜索标题或正文" style={styles.input} value={diarySearch} />
            <View style={styles.filterGrid}>
              <PickerButton accessibilityLabel="筛选日记日期" grid id="diary-date-filter" label={diaryDateFilter === "全部日期" ? "日期" : diaryDateFilter} onSelect={(value) => setDiaryDateFilter(value as typeof diaryDateFilter)} onToggle={togglePicker} open={openPickerId === "diary-date-filter"} options={dateFilters.map((item) => ({ label: item, value: item }))} selectedValue={diaryDateFilter} />
              <PickerButton accessibilityLabel="筛选日记类型" grid id="diary-type-filter" label={diaryTypeFilter === "全部" ? "类型" : diaryTypeFilter} onSelect={setDiaryTypeFilter} onToggle={togglePicker} open={openPickerId === "diary-type-filter"} options={["全部", ...diaryCategories].map((item) => ({ label: item, value: item }))} selectedValue={diaryTypeFilter} />
              <PickerButton accessibilityLabel="筛选日记文件夹" grid id="diary-folder-filter" label={diaryFolderFilter ? getFolderName(diaryFolderFilter) : "文件夹"} onSelect={(value) => setDiaryFolderFilter(value === "__all" ? null : value || null)} onToggle={togglePicker} open={openPickerId === "diary-folder-filter"} options={[{ label: "全部", value: "__all" }, ...folderOptions]} selectedValue={diaryFolderFilter ?? "__all"} />
              <PickerButton accessibilityLabel="日记排序" grid id="diary-sort" label={diarySort === "最新优先" ? "排序" : diarySort} onSelect={(value) => setDiarySort(value as typeof diarySort)} onToggle={togglePicker} open={openPickerId === "diary-sort"} options={sortOptions.map((item) => ({ label: item, value: item }))} selectedValue={diarySort} />
            </View>
            <View style={styles.folderManager}>
              <TextInput onChangeText={setNewFolderName} placeholder="新建文件夹" style={[styles.input, styles.folderInput]} value={newFolderName} />
              <Pressable accessibilityRole="button" accessibilityLabel="新建文件夹" onPress={createFolder} style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>新建</Text>
              </Pressable>
            </View>
            {folders.length > 0 ? (
              <View style={styles.folderList}>
                {folders.map((folder) => (
                  <View key={folder.id} style={styles.folderPill}>
                    <Text style={styles.folderName}>{folder.name}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={`重命名文件夹：${folder.name}`} onPress={() => renameFolder(folder.id)}>
                      <Text style={styles.folderAction}>改名</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`删除文件夹：${folder.name}`} onPress={() => deleteFolder(folder.id)}>
                      <Text style={styles.folderDelete}>删除</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {diaryArchive.length === 0 ? (
            <View style={styles.emptyBox}>
              <PuppyIllustration color="#9cc39c" scene="generic" size={86} />
              <Text style={styles.emptyTitle}>{diaries.length === 0 ? "还没有日记" : "没有找到日记"}</Text>
              <Text style={styles.emptyText}>{diaries.length === 0 ? "记录第一篇日记吧" : "换个关键词或筛选条件试试"}</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {diaryList.visibleItems.map((entry) => (
                <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={`查看日记：${entry.title ?? "恋爱日记"}`} onPress={() => setDetailItem({ item: entry, type: "diary" })} style={styles.diaryCard}>
                  <View style={styles.diaryMetaRow}>
                    <Text style={styles.diaryDate}>{entry.date}</Text>
                    <View style={styles.diaryActions}>
                      <Text style={styles.archiveCount}>{entry.images?.length ? `${entry.images.length} 图` : getFolderName(entry.folderId)}</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={`打开日记菜单：${entry.title ?? "恋爱日记"}`} onPress={() => setOpenDiaryMenuId(openDiaryMenuId === entry.id ? null : entry.id)} style={styles.moreButton}>
                        <Text style={styles.moreButtonText}>•••</Text>
                      </Pressable>
                    </View>
                  </View>
                  {openDiaryMenuId === entry.id ? (
                    <View style={styles.menuRow}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`编辑日记：${entry.title ?? "恋爱日记"}`} onPress={() => editDiary(entry)} style={styles.menuButton}><Text style={styles.menuText}>编辑</Text></Pressable>
                      <PickerButton accessibilityLabel={`移动日记：${entry.title ?? "恋爱日记"}`} id={`diary-move-${entry.id}`} label="移动" onSelect={(value) => moveDiary(entry, value)} onToggle={togglePicker} open={openPickerId === `diary-move-${entry.id}`} options={folderOptions} selectedValue={entry.folderId ?? ""} />
                      {isOwnEntry(entry) ? <Pressable accessibilityRole="button" accessibilityLabel={`删除日记：${entry.title ?? "恋爱日记"}`} onPress={() => deleteDiary(entry.id)} style={styles.menuDelete}><Text style={styles.deleteText}>删除</Text></Pressable> : null}
                    </View>
                  ) : null}
                  <Text style={styles.diaryTitle}>{entry.title ?? (entry.content.slice(0, 24) || "恋爱日记")}</Text>
                  <Text style={styles.diaryMood}>{moodIcons[entry.mood]} {entry.mood} · {entry.category ?? "日常记录"} · {getFolderName(entry.folderId)}</Text>
                  <Text numberOfLines={3} style={styles.diaryContent}>{entry.content}</Text>
                  {entry.images && entry.images.length > 0 ? (
                    <View style={styles.imageGrid}>
                      {entry.images.map((image, index) => (
                        <Pressable key={index} onPress={() => setExpandedImage(image)} style={styles.imageThumbWrap}>
                          <Image source={{ uri: image }} style={styles.imageThumb} />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
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
            <View style={styles.inlineRow}>
              <TextInput onChangeText={setGiftName} placeholder="礼物名称（如：手表）" style={[styles.input, styles.titleField]} value={giftName} />
              <Pressable accessibilityRole="button" accessibilityLabel="选择礼物日期" onPress={() => setGiftDatePickerOpen((value) => !value)} style={[styles.input, styles.dateCompact]}>
                <Text style={styles.dateValue}>{giftDate.replaceAll("-", "/")}</Text>
              </Pressable>
            </View>
            <View style={styles.inlineRow}>
              <PickerButton accessibilityLabel="选择礼物类型" id="gift-type" label={giftTag} onSelect={setGiftTag} onToggle={togglePicker} open={openPickerId === "gift-type"} options={giftTags.map((item) => ({ label: item, value: item }))} selectedValue={giftTag} />
              <PickerButton accessibilityLabel="选择送礼方向" id="gift-direction" label={giftDirection} onSelect={(value) => setGiftDirection(value as GiftDirection)} onToggle={togglePicker} open={openPickerId === "gift-direction"} options={giftDirections.map((item) => ({ label: item, value: item }))} selectedValue={giftDirection} />
            </View>
            <TextInput
              scrollEnabled
              multiline
              onChangeText={setGiftDescription}
              onContentSizeChange={(event) => setGiftDescriptionHeight(event.nativeEvent.contentSize.height)}
              placeholder="描述（可选）"
              style={[styles.input, styles.diaryInput, { height: Math.min(Math.max(44, giftDescriptionHeight), 132) }]}
              value={giftDescription}
            />

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
                <Text style={styles.secondaryText}>图片</Text>
              </Pressable>
              <input accept="image/*" onChange={handleSingleImagePick(setGiftImage)} ref={giftFileInputRef} style={{ display: "none" }} type="file" />
              <PickerButton accessibilityLabel="选择礼物文件夹" id="gift-folder" label={getFolderName(giftFolderId)} onSelect={(value) => setGiftFolderId(value || null)} onToggle={togglePicker} open={openPickerId === "gift-folder"} options={folderOptions} selectedValue={giftFolderId ?? ""} />
              <Pressable accessibilityRole="button" accessibilityLabel="保存礼物" onPress={saveGift} style={styles.primaryButton}>
                <Text style={styles.primaryText}>{editingGiftId ? "更新" : "保存"}</Text>
              </Pressable>
            </View>
            <DatePickerPopup
              onCancel={() => setGiftDatePickerOpen(false)}
              onConfirm={(selectedDate) => { setGiftDate(selectedDate); setGiftDatePickerOpen(false); }}
              selectedDate={giftDate}
              title="选择礼物日期"
              visible={giftDatePickerOpen}
            />
            {feedback ? <Text nativeID="love-feedback" style={styles.feedback}>{feedback}</Text> : null}
          </View>

          <View style={styles.card}>
            <View style={styles.archiveHeader}>
              <Text style={styles.cardTitle}>礼物档案</Text>
              <Text style={styles.archiveCount}>{giftArchive.length} 件</Text>
            </View>
            <TextInput onChangeText={setGiftSearch} placeholder="搜索礼物或描述" style={styles.input} value={giftSearch} />
            <View style={styles.filterGrid}>
              <PickerButton accessibilityLabel="筛选礼物日期" grid id="gift-date-filter" label={giftDateFilter === "全部日期" ? "日期" : giftDateFilter} onSelect={(value) => setGiftDateFilter(value as typeof giftDateFilter)} onToggle={togglePicker} open={openPickerId === "gift-date-filter"} options={dateFilters.map((item) => ({ label: item, value: item }))} selectedValue={giftDateFilter} />
              <PickerButton accessibilityLabel="筛选礼物类型" grid id="gift-type-filter" label={giftTypeFilter === "全部" ? "类型" : giftTypeFilter} onSelect={setGiftTypeFilter} onToggle={togglePicker} open={openPickerId === "gift-type-filter"} options={["全部", ...giftTags].map((item) => ({ label: item, value: item }))} selectedValue={giftTypeFilter} />
              <PickerButton accessibilityLabel="筛选送礼方向" grid id="gift-direction-filter" label={giftDirectionFilter === "全部" ? "方向" : giftDirectionFilter} onSelect={setGiftDirectionFilter} onToggle={togglePicker} open={openPickerId === "gift-direction-filter"} options={["全部", ...giftDirections].map((item) => ({ label: item, value: item }))} selectedValue={giftDirectionFilter} />
              <PickerButton accessibilityLabel="筛选礼物文件夹" grid id="gift-folder-filter" label={giftFolderFilter ? getFolderName(giftFolderFilter) : "文件夹"} onSelect={(value) => setGiftFolderFilter(value === "__all" ? null : value || null)} onToggle={togglePicker} open={openPickerId === "gift-folder-filter"} options={[{ label: "全部", value: "__all" }, ...folderOptions]} selectedValue={giftFolderFilter ?? "__all"} />
              <PickerButton accessibilityLabel="礼物排序" grid id="gift-sort" label={giftSort === "最新优先" ? "排序" : giftSort} onSelect={(value) => setGiftSort(value as typeof giftSort)} onToggle={togglePicker} open={openPickerId === "gift-sort"} options={sortOptions.map((item) => ({ label: item, value: item }))} selectedValue={giftSort} />
            </View>
          </View>

          {giftArchive.length === 0 ? (
            <View style={styles.emptyBox}>
              <PuppyIllustration color="#9cc39c" scene="gift" size={86} />
              <Text style={styles.emptyTitle}>{gifts.length === 0 ? "还没有礼物记录" : "没有找到礼物"}</Text>
              <Text style={styles.emptyText}>{gifts.length === 0 ? "记录你们互赠的礼物" : "换个筛选条件试试"}</Text>
            </View>
          ) : (
            <>
            {giftList.visibleItems.map((entry) => (
              <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={`查看礼物：${entry.name}`} onPress={() => setDetailItem({ item: entry, type: "gift" })} style={styles.giftCard}>
                <View style={styles.diaryMetaRow}>
                  <Text style={styles.diaryDate}>{entry.date}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`打开礼物菜单：${entry.name}`} onPress={() => setOpenGiftMenuId(openGiftMenuId === entry.id ? null : entry.id)} style={styles.moreButton}>
                    <Text style={styles.moreButtonText}>•••</Text>
                  </Pressable>
                </View>
                {openGiftMenuId === entry.id ? (
                  <View style={styles.menuRow}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`编辑礼物：${entry.name}`} onPress={() => editGift(entry)} style={styles.menuButton}><Text style={styles.menuText}>编辑</Text></Pressable>
                    <PickerButton accessibilityLabel={`移动礼物：${entry.name}`} id={`gift-move-${entry.id}`} label="移动" onSelect={(value) => moveGift(entry, value)} onToggle={togglePicker} open={openPickerId === `gift-move-${entry.id}`} options={folderOptions} selectedValue={entry.folderId ?? ""} />
                    <Pressable accessibilityRole="button" accessibilityLabel={`删除礼物：${entry.name}`} onPress={() => deleteGift(entry.id)} style={styles.menuDelete}><Text style={styles.deleteText}>删除</Text></Pressable>
                  </View>
                ) : null}
                <View style={styles.giftBody}>
                  {entry.image ? (
                    <Pressable onPress={() => { setSelectedPhotoSource({ id: entry.id, type: "gift" }); setExpandedImage(entry.image); }}>
                      <Image source={{ uri: entry.image }} style={styles.giftThumb} />
                    </Pressable>
                  ) : null}
                  <View style={styles.giftInfo}>
                    <Text style={styles.diaryTitle}>{entry.name}</Text>
                    <Text style={styles.diaryCategory}>{entry.tag} · {entry.direction ?? "未设置"} · {getFolderName(entry.folderId)}</Text>
                    {entry.description ? <Text numberOfLines={2} style={styles.diaryContent}>{entry.description}</Text> : null}
                  </View>
                </View>
              </Pressable>
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
            <View style={styles.inlineRow}>
              <TextInput onChangeText={setAnniversaryTitle} placeholder="纪念日名称（如：在一起的日子）" style={[styles.input, styles.titleField]} value={anniversaryTitle} />
              <Pressable accessibilityRole="button" accessibilityLabel="选择纪念日日期" onPress={() => setAnniversaryDatePickerOpen((value) => !value)} style={[styles.input, styles.dateCompact]}>
                <Text style={styles.dateValue}>{anniversaryDate.replaceAll("-", "/")}</Text>
              </Pressable>
            </View>
            <DatePickerPopup
              onCancel={() => setAnniversaryDatePickerOpen(false)}
              onConfirm={(selectedDate) => { setAnniversaryDate(selectedDate); setAnniversaryDatePickerOpen(false); }}
              selectedDate={anniversaryDate}
              title="选择纪念日日期"
              visible={anniversaryDatePickerOpen}
            />
            <View style={styles.inlineRow}>
              <PickerButton accessibilityLabel="选择纪念日重复方式" id="anniversary-repeat" label={repeatYearly ? "每年重复" : "不重复"} onSelect={(value) => setRepeatYearly(value === "每年重复")} onToggle={togglePicker} open={openPickerId === "anniversary-repeat"} options={repeatOptions.map((item) => ({ label: item, value: item }))} selectedValue={repeatYearly ? "每年重复" : "不重复"} />
              <PickerButton accessibilityLabel="选择纪念日提醒" id="anniversary-reminder" label={reminderOptions.find((item) => item.value === reminderDays)?.label ?? "当天"} onSelect={(value) => setReminderDays(Number(value))} onToggle={togglePicker} open={openPickerId === "anniversary-reminder"} options={reminderOptions.map((item) => ({ label: item.label, value: String(item.value) }))} selectedValue={String(reminderDays)} />
            </View>

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
                <Text style={styles.secondaryText}>图片</Text>
              </Pressable>
              <input accept="image/*" onChange={handleSingleImagePick(setAnniImage)} ref={anniFileInputRef} style={{ display: "none" }} type="file" />
              <Pressable accessibilityRole="button" accessibilityLabel="添加纪念日" onPress={saveAnniversary} style={styles.primaryButton}>
                <Text style={styles.primaryText}>添加</Text>
              </Pressable>
            </View>
            {feedback ? <Text nativeID="love-feedback" style={styles.feedback}>{feedback}</Text> : null}
          </View>

          {anniversaries.length === 0 ? (
            <View style={styles.emptyBox}>
              <PuppyIllustration color="#9cc39c" scene="generic" size={86} />
              <Text style={styles.emptyTitle}>还没有纪念日</Text>
              <Text style={styles.emptyText}>添加你们的特殊日子</Text>
            </View>
          ) : (
            <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>即将到来</Text>
              {sortedAnniversaries.slice(0, 5).map((entry) => (
                <AnniversaryCard
                  entry={entry}
                  key={`upcoming-${entry.id}`}
                  onDelete={() => deleteAnniversary(entry.id)}
                  onImagePress={() => { if (entry.image) { setSelectedPhotoSource({ id: entry.id, type: "anniversary" }); setExpandedImage(entry.image); } }}
                />
              ))}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>全部纪念日</Text>
            {anniversaryList.visibleItems.map((entry) => (
              <AnniversaryCard
                entry={entry}
                key={entry.id}
                onDelete={() => deleteAnniversary(entry.id)}
                onImagePress={() => { if (entry.image) { setSelectedPhotoSource({ id: entry.id, type: "anniversary" }); setExpandedImage(entry.image); } }}
              />
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
            </View>
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

      {openPickerId ? <Pressable accessibilityLabel="关闭选择菜单" onPress={() => setOpenPickerId(null)} style={styles.dropdownBackdrop} testID="love-dropdown-dismiss" /> : null}

      {detailItem ? (
        <Pressable onPress={() => setDetailItem(null)} style={styles.lightbox}>
          <View style={styles.detailCard}>
            <Text style={styles.cardTitle}>{detailItem.type === "diary" ? detailItem.item.title ?? "恋爱日记" : detailItem.item.name}</Text>
            <Text style={styles.diaryCategory}>
              {detailItem.type === "diary"
                ? `${detailItem.item.date} · ${detailItem.item.category ?? "日常记录"} · ${moodIcons[detailItem.item.mood]} ${detailItem.item.mood}`
                : `${detailItem.item.date} · ${detailItem.item.tag} · ${detailItem.item.direction ?? "未设置"}`}
            </Text>
            <Text style={styles.diaryContent}>{detailItem.type === "diary" ? detailItem.item.content : detailItem.item.description || "没有描述"}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="关闭详情" onPress={() => setDetailItem(null)} style={styles.primaryButton}>
              <Text style={styles.primaryText}>关闭</Text>
            </Pressable>
          </View>
        </Pressable>
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

function PickerButton({
  accessibilityLabel,
  grid,
  id,
  label,
  onSelect,
  onToggle,
  open,
  options,
  selectedValue
}: {
  accessibilityLabel: string;
  grid?: boolean;
  id: string;
  label: string;
  onSelect: (value: string) => void;
  onToggle: (id: string) => void;
  open: boolean;
  options: ChoiceOption[];
  selectedValue: string;
}) {
  return (
    <View style={[styles.pickerShell, grid ? styles.pickerShellGrid : null, open ? styles.pickerShellOpen : null]}>
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => onToggle(id)} style={styles.pickerButton}>
        <Text style={styles.pickerText}>{label} ▼</Text>
      </Pressable>
      {open ? (
        <View style={styles.dropdownPopover} testID="love-dropdown-popover">
          {options.map((option) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`选择${accessibilityLabel.replace(/^选择日记|^选择礼物|^选择纪念日|^筛选日记|^筛选礼物/, "选择")}：${option.label}`}
              key={option.value}
              onPress={() => {
                onSelect(option.value);
                onToggle(id);
              }}
              style={[styles.dropdownOption, selectedValue === option.value ? styles.dropdownOptionActive : null]}
            >
              <Text style={[styles.dropdownOptionText, selectedValue === option.value ? styles.dropdownOptionTextActive : null]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function AnniversaryCard({ entry, onDelete, onImagePress }: { entry: AnniversaryEntry; onDelete: () => void; onImagePress: () => void }) {
  const info = getAnniversaryInfo(entry);
  return (
    <View style={styles.diaryCard}>
      <View style={styles.diaryMetaRow}>
        <View>
          <Text style={styles.diaryTitle}>{entry.title}</Text>
          <Text style={styles.diaryDate}>{entry.date} · {entry.repeatYearly ? "每年重复" : "不重复"} · 提前 {entry.reminderDays ?? 0} 天</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`删除纪念日：${entry.title}`} onPress={onDelete} style={styles.moreButton}>
          <Text style={styles.deleteText}>删除</Text>
        </Pressable>
      </View>
      <Text style={styles.anniversaryDistance}>{info.label}</Text>
      {info.years > 0 && entry.repeatYearly ? <Text style={styles.diaryCategory}>第 {info.years} 周年</Text> : null}
      {entry.image ? (
        <View style={styles.imageGrid}>
          <Pressable onPress={onImagePress}>
            <Image source={{ uri: entry.image }} style={styles.imageThumb} />
          </Pressable>
        </View>
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
  void saveLoveSharedValue(DIARY_KEY, entries).catch(() => undefined);
}

export function saveAnniversaries(entries: AnniversaryEntry[], storage: LoveStorage = getDefaultLoveStorage()) {
  storage.setItem(ANNIVERSARY_KEY, JSON.stringify(entries));
  void saveLoveSharedValue(ANNIVERSARY_KEY, entries).catch(() => undefined);
}

export function saveGifts(entries: GiftEntry[], storage: LoveStorage = getDefaultLoveStorage()) {
  storage.setItem(GIFT_KEY, JSON.stringify(entries));
  void saveLoveSharedValue(GIFT_KEY, entries).catch(() => undefined);
}

export function saveFolders(entries: LoveFolder[], storage: LoveStorage = getDefaultLoveStorage()) {
  storage.setItem(LOVE_FOLDER_KEY, JSON.stringify(entries));
  void saveLoveSharedValue(LOVE_FOLDER_KEY, entries).catch(() => undefined);
}

export async function hydrateLoveFromCloud(storage: LoveStorage = getDefaultLoveStorage()): Promise<{ anniversaries: AnniversaryEntry[]; diaries: DiaryEntry[]; folders: LoveFolder[]; gifts: GiftEntry[] }> {
  const localDiaries = loadArray<DiaryEntry>(storage, DIARY_KEY);
  const localAnniversaries = loadArray<AnniversaryEntry>(storage, ANNIVERSARY_KEY);
  const localGifts = loadArray<GiftEntry>(storage, GIFT_KEY);
  const localFolders = loadArray<LoveFolder>(storage, LOVE_FOLDER_KEY);
  const [diaries, anniversaries, gifts, folders] = await Promise.all([
    hydrateLoveSharedValue<DiaryEntry[]>(DIARY_KEY, localDiaries, (value) => writeDiariesLocal(value, storage)),
    hydrateLoveSharedValue<AnniversaryEntry[]>(ANNIVERSARY_KEY, localAnniversaries, (value) => writeAnniversariesLocal(value, storage)),
    hydrateLoveSharedValue<GiftEntry[]>(GIFT_KEY, localGifts, (value) => writeGiftsLocal(value, storage)),
    hydrateLoveSharedValue<LoveFolder[]>(LOVE_FOLDER_KEY, localFolders, (value) => writeFoldersLocal(value, storage))
  ]);
  return { anniversaries, diaries, folders, gifts };
}

function writeDiariesLocal(entries: DiaryEntry[], storage: LoveStorage) {
  storage.setItem(DIARY_KEY, JSON.stringify(entries));
}

function writeAnniversariesLocal(entries: AnniversaryEntry[], storage: LoveStorage) {
  storage.setItem(ANNIVERSARY_KEY, JSON.stringify(entries));
}

function writeGiftsLocal(entries: GiftEntry[], storage: LoveStorage) {
  storage.setItem(GIFT_KEY, JSON.stringify(entries));
}

function writeFoldersLocal(entries: LoveFolder[], storage: LoveStorage) {
  storage.setItem(LOVE_FOLDER_KEY, JSON.stringify(entries));
}

function createLoveId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  const fallbackId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const value = Math.floor(Math.random() * 16);
    const hex = token === "x" ? value : (value & 0x3) | 0x8;
    return hex.toString(16);
  });
  return `${prefix}-${fallbackId}`;
}

export function clearLoveMemoryForTests() {
  memoryStore = new Map<string, string>();
}

function getAnniversaryInfo(entry: AnniversaryEntry) {
  const start = startOfDay(new Date(entry.date));
  const today = startOfDay(new Date());
  const currentYear = today.getFullYear();
  let next = entry.repeatYearly ? new Date(currentYear, start.getMonth(), start.getDate()) : start;
  if (entry.repeatYearly && next.getTime() < today.getTime()) {
    next = new Date(currentYear + 1, start.getMonth(), start.getDate());
  }
  const days = Math.round((next.getTime() - today.getTime()) / 86_400_000);
  const years = entry.repeatYearly && days >= 0 ? Math.max(0, next.getFullYear() - start.getFullYear()) : 0;
  const label = days === 0 ? "就是今天" : days === 1 ? "还有 1 天" : days > 1 ? `还有 ${days} 天` : `已过去 ${Math.abs(days)} 天`;
  return { days, label, next, years };
}

function sortAnniversariesByNextDate(entries: AnniversaryEntry[]) {
  return [...entries].sort((left, right) => getAnniversaryInfo(left).days - getAnniversaryInfo(right).days);
}

function filterDiaries(
  entries: DiaryEntry[],
  filters: { dateFilter: string; folderId: string | null; query: string; sort: string; type: string }
) {
  const query = filters.query.trim().toLowerCase();
  const filtered = entries.filter((entry) => {
    if (query && !`${entry.title ?? ""} ${entry.content}`.toLowerCase().includes(query)) return false;
    if (filters.type !== "全部" && (entry.category ?? "日常记录") !== filters.type) return false;
    if (filters.folderId !== null && (entry.folderId ?? "") !== filters.folderId) return false;
    return matchesDateFilter(entry.date, filters.dateFilter);
  });
  return sortByLoveDate(filtered, filters.sort, (entry) => [entry.date, entry.createTime]);
}

function filterGifts(
  entries: GiftEntry[],
  filters: { dateFilter: string; direction: string; folderId: string | null; query: string; sort: string; type: string }
) {
  const query = filters.query.trim().toLowerCase();
  const filtered = entries.filter((entry) => {
    if (query && !`${entry.name} ${entry.description}`.toLowerCase().includes(query)) return false;
    if (filters.type !== "全部" && entry.tag !== filters.type) return false;
    if (filters.direction !== "全部" && (entry.direction ?? "未设置") !== filters.direction) return false;
    if (filters.folderId !== null && (entry.folderId ?? "") !== filters.folderId) return false;
    return matchesDateFilter(entry.date, filters.dateFilter);
  });
  return sortByLoveDate(filtered, filters.sort, (entry) => [entry.date, entry.createTime]);
}

function matchesDateFilter(date: string, filter: string) {
  if (filter === "全部日期") return true;
  const target = startOfDay(new Date(date));
  const today = startOfDay(new Date());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (filter === "今天") return diffDays === 0;
  if (filter === "昨天") return diffDays === 1;
  if (filter === "本周") return diffDays >= 0 && diffDays < 7;
  if (filter === "本月") return target.getFullYear() === today.getFullYear() && target.getMonth() === today.getMonth();
  return true;
}

function sortByLoveDate<T>(entries: T[], sort: string, getKeys: (entry: T) => string[]) {
  return [...entries].sort((left, right) => {
    const leftKey = getKeys(left).join(" ");
    const rightKey = getKeys(right).join(" ");
    return sort === "最早优先" ? leftKey.localeCompare(rightKey) : rightKey.localeCompare(leftKey);
  });
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

type ChoiceOption = {
  label: string;
  value: string;
};

type DetailState =
  | { item: DiaryEntry; type: "diary" }
  | { item: GiftEntry; type: "gift" };

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
    backgroundColor: "rgba(255,252,253,0.95)",
    borderColor: "#f3d6df",
    borderRadius: 22,
    borderWidth: 1,
    elevation: 2,
    gap: 12,
    padding: 15,
    shadowColor: "#ef7f98",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 14
  },
  cardTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900"
  },
  archiveCount: {
    color: "#8b7280",
    fontSize: 12,
    fontWeight: "800"
  },
  archiveHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
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
    fontSize: 13,
    fontWeight: "700"
  },
  dateCompact: {
    alignItems: "center",
    flexGrow: 0,
    flexShrink: 0,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 132,
    paddingHorizontal: 8,
    width: 138
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
    backgroundColor: "#fff7f9",
    borderColor: "#f5d6de",
    borderRadius: 18,
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
    justifyContent: "center",
    minHeight: 210,
    paddingVertical: 18
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
    color: "#c75670",
    fontSize: 12,
    fontWeight: "800"
  },
  filterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
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
  giftBody: {
    flexDirection: "row",
    gap: 12
  },
  giftCard: {
    backgroundColor: "#fff7f9",
    borderColor: "#f5d6de",
    borderRadius: 18,
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
  folderList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  folderManager: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  folderInput: {
    flex: 1
  },
  folderPill: {
    alignItems: "center",
    backgroundColor: "#fff0f4",
    borderColor: "#f3d6df",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  folderName: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "900"
  },
  folderAction: {
    color: "#c75670",
    fontSize: 12,
    fontWeight: "900"
  },
  folderDelete: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "900"
  },
  inlineRow: {
    flexDirection: "row",
    gap: 10,
    overflow: "visible"
  },
  hero: {
    gap: 6,
    minHeight: 92,
    overflow: "hidden",
    paddingRight: 112,
    position: "relative"
  },
  decorStickers: {
    opacity: 0.9,
    position: "absolute",
    right: -18,
    top: -18,
    zIndex: 1
  },
  pageWatermark: {
    bottom: -14,
    opacity: 0.035,
    position: "absolute",
    right: 4,
    top: -14
  },
  heroSub: {
    color: "#697386",
    fontSize: 15,
    fontWeight: "700",
    zIndex: 2
  },
  heroTitle: {
    color: "#111827",
    fontSize: 26,
    fontWeight: "900",
    zIndex: 2
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
    backgroundColor: "#fffafd",
    borderColor: "#eadfe5",
    borderRadius: 12,
    borderWidth: 1,
    color: "#111827",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  titleField: {
    flex: 1,
    minWidth: 0
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
  detailCard: {
    backgroundColor: "#fffafd",
    borderRadius: 22,
    gap: 12,
    maxWidth: 520,
    padding: 18,
    width: "86%"
  },
  menuRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  menuButton: {
    backgroundColor: "#fff0f4",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  menuDelete: {
    backgroundColor: "#fee2e2",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  menuText: {
    color: "#c75670",
    fontSize: 12,
    fontWeight: "900"
  },
  moreButton: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 32,
    minWidth: 34,
    paddingHorizontal: 6
  },
  moreButtonText: {
    color: "#776878",
    fontSize: 18,
    fontWeight: "900"
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
    backgroundColor: "#fff0f4",
    borderColor: "#f08aa0"
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
  pickerShell: {
    flex: 1,
    minWidth: 0,
    position: "relative"
  },
  pickerShellGrid: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 128
  },
  pickerShellOpen: {
    elevation: 18,
    zIndex: 220
  },
  pickerButton: {
    alignItems: "center",
    backgroundColor: "#fffafd",
    borderColor: "#eadfe5",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 9,
    paddingVertical: 9
  },
  pickerText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17,
    textAlign: "center"
  },
  dropdownBackdrop: {
    bottom: 0,
    left: 0,
    position: Platform.OS === "web" ? ("fixed" as "absolute") : "absolute",
    right: 0,
    top: 0,
    zIndex: 90
  },
  dropdownPopover: {
    backgroundColor: "#fffafd",
    borderColor: "#f1cad4",
    borderRadius: 16,
    borderWidth: 1,
    elevation: 18,
    gap: 4,
    left: 0,
    minWidth: "100%",
    padding: 6,
    position: "absolute",
    shadowColor: "#ef7f98",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    top: 48,
    zIndex: 240
  },
  dropdownOption: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  dropdownOptionActive: {
    backgroundColor: "#fff0f4"
  },
  dropdownOptionText: {
    color: "#776878",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
    textAlign: "center"
  },
  dropdownOptionTextActive: {
    color: "#c75670"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#ff8fa3",
    borderRadius: 12,
    minWidth: 96,
    paddingHorizontal: 16,
    paddingVertical: 10
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
    gap: 8
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#fff0f4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  secondaryText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900"
  },
  sharedHint: {
    color: "#c75670",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18
  },
  syncBar: {
    alignItems: "center",
    backgroundColor: "rgba(255,252,253,0.96)",
    borderColor: "#f3d6df",
    borderRadius: 18,
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
    backgroundColor: "#ff8fa3",
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    minWidth: 34,
    paddingHorizontal: 10
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
    gap: 12,
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
