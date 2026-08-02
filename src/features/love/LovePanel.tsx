import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { DatePickerPopup } from "@/shared/ui/DatePickerPopup";
import type { UiTokens } from "@/shared/ui/primitives";
import { hydrateFromCloud, saveCloudValue } from "@/features/sync/cloudSync";
import { deleteDiaryFromCloud, getCurrentLoveUserId, loadDiariesFromCloud, saveDiariesToCloud } from "./loveDiaryCloud";

type LoveTab = "diary" | "anniversary";
type DiaryVisibility = "private" | "couple_read";

export type DiaryEntry = {
  content: string;
  createTime: string;
  date: string;
  id: string;
  mood: string;
  ownerUserId?: string;
  visibility: DiaryVisibility;
};

export type AnniversaryEntry = {
  date: string;
  id: string;
  repeatYearly: boolean;
  title: string;
};

export type LoveStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export const DIARY_KEY = "fanfan-guanguan.love.diaries.v1";
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

export function LovePanel({ storage }: { storage?: LoveStorage; themeTokens?: UiTokens }) {
  const loveStorage = useMemo(() => storage ?? getDefaultLoveStorage(), [storage]);
  const [tab, setTab] = useState<LoveTab>("diary");
  const [diaries, setDiaries] = useState<DiaryEntry[]>(() => loadArray<DiaryEntry>(loveStorage, DIARY_KEY));
  const [anniversaries, setAnniversaries] = useState<AnniversaryEntry[]>(() => loadArray<AnniversaryEntry>(loveStorage, ANNIVERSARY_KEY));
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("开心");
  const [date, setDate] = useState(todayIso());
  const [visibility, setVisibility] = useState<DiaryVisibility>("couple_read");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [anniversaryTitle, setAnniversaryTitle] = useState("");
  const [anniversaryDate, setAnniversaryDate] = useState(todayIso());
  const [repeatYearly, setRepeatYearly] = useState(false);
  const [feedback, setFeedback] = useState("写下今天的小瞬间。");
  const [diaryHeight, setDiaryHeight] = useState(44);
  const localDirtyRef = useRef(false);

  const [diaryDatePickerOpen, setDiaryDatePickerOpen] = useState(false);
  const [anniversaryDatePickerOpen, setAnniversaryDatePickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getCurrentLoveUserId().then((userId) => {
      if (!cancelled) setCurrentUserId(userId);
    });
    void hydrateLoveFromCloud(loveStorage).then((next) => {
      if (!cancelled && !localDirtyRef.current) {
        setDiaries(next.diaries);
        setAnniversaries(next.anniversaries);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loveStorage]);

  const saveDiary = () => {
    const cleanContent = content.trim();
    if (!cleanContent) {
      setFeedback("请先写一点日记内容。");
      return;
    }

    const entry: DiaryEntry = {
      content: cleanContent,
      createTime: new Date().toISOString(),
      date,
      id: createLoveId("diary"),
      mood,
      ownerUserId: currentUserId ?? undefined,
      visibility
    };
    const nextEntries = [entry, ...diaries];
    setDiaries(nextEntries);
    localDirtyRef.current = true;
    saveDiaries(nextEntries, loveStorage);
    setContent("");
    setFeedback("日记已保存。");
  };

  const saveAnniversary = () => {
    const title = anniversaryTitle.trim();
    if (!title) {
      setFeedback("请先输入纪念日名称。");
      return;
    }

    const entry: AnniversaryEntry = {
      date: anniversaryDate,
      id: createLoveId("anniversary"),
      repeatYearly,
      title
    };
    const nextEntries = [entry, ...anniversaries];
    setAnniversaries(nextEntries);
    localDirtyRef.current = true;
    saveAnniversaries(nextEntries, loveStorage);
    setAnniversaryTitle("");
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

  const deleteAnniversary = (id: string) => {
    const nextEntries = anniversaries.filter((entry) => entry.id !== id);
    setAnniversaries(nextEntries);
    localDirtyRef.current = true;
    saveAnniversaries(nextEntries, loveStorage);
    setFeedback("纪念日已删除。");
  };

  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>恋爱日记</Text>
        <Text style={styles.heroSub}>记录每一个甜蜜瞬间</Text>
      </View>

      {tab === "diary" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>写日记</Text>
            <TextInput
              multiline
              onChangeText={setContent}
              onContentSizeChange={(event) => setDiaryHeight(event.nativeEvent.contentSize.height)}
              placeholder="今天发生了什么..."
              style={[styles.input, styles.diaryInput, { minHeight: Math.max(44, diaryHeight) }]}
              value={content}
            />
            <View style={styles.moodGrid}>
              {moods.map((item) => (
                <Pressable key={item} accessibilityRole="button" accessibilityLabel={`选择心情：${item}`} onPress={() => setMood(item)} style={[styles.moodChip, mood === item ? styles.moodChipActive : null]}>
                  <Text style={styles.moodText}>{moodIcons[item]} {item}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.visibilityRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="仅自己可见" onPress={() => setVisibility("private")} style={[styles.visibilityButton, visibility === "private" ? styles.visibilityActive : null]}>
                <Text style={[styles.visibilityText, visibility === "private" ? styles.visibilityTextActive : null]}>仅自己可见</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="双方可见" onPress={() => setVisibility("couple_read")} style={[styles.visibilityButton, visibility === "couple_read" ? styles.visibilityActive : null]}>
                <Text style={[styles.visibilityText, visibility === "couple_read" ? styles.visibilityTextActive : null]}>双方可见</Text>
              </Pressable>
            </View>
            <View style={styles.saveRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="选择日记日期" onPress={() => setDiaryDatePickerOpen((value) => !value)} style={[styles.input, styles.dateInput, styles.dateField]}>
                <Text style={styles.dateValue}>{date.replaceAll("-", "/")}</Text>
                <Text style={styles.dateChevron}>⌄</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="保存日记" nativeID="love-save-diary-button" onPress={saveDiary} style={styles.primaryButton}>
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
            <Text nativeID="love-feedback" style={styles.feedback}>{feedback}</Text>
          </View>

          {diaries.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>♡</Text>
              <Text style={styles.emptyTitle}>还没有日记</Text>
              <Text style={styles.emptyText}>记录第一篇日记吧</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>日记列表</Text>
              {diaries.map((entry) => (
                <View key={entry.id} style={styles.diaryCard}>
                  <View style={styles.diaryMetaRow}>
                    <Text style={styles.diaryDate}>{entry.date}</Text>
                    <View style={styles.diaryActions}>
                      <Text style={styles.visibilityBadge}>{entry.visibility === "private" ? "仅自己可见" : "双方可见"}</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={`删除日记：${entry.date}`} onPress={() => deleteDiary(entry.id)} style={styles.deleteButton}>
                        <Text style={styles.deleteText}>删除</Text>
                      </Pressable>
                    </View>
                  </View>
                  <Text style={styles.diaryMood}>{moodIcons[entry.mood]} {entry.mood}</Text>
                  <Text style={styles.diaryContent}>{entry.content}</Text>
                </View>
              ))}
            </View>
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
            <Pressable accessibilityRole="button" accessibilityLabel="添加纪念日" onPress={saveAnniversary} style={styles.primaryButton}>
              <Text style={styles.primaryText}>添加</Text>
            </Pressable>
          </View>

          {anniversaries.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>♡</Text>
              <Text style={styles.emptyTitle}>还没有纪念日</Text>
              <Text style={styles.emptyText}>添加你们的特殊日子</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>纪念日列表</Text>
              {anniversaries.map((entry) => (
                <View key={entry.id} style={styles.diaryCard}>
                  <View style={styles.diaryMetaRow}>
                    <Text style={styles.diaryDate}>{entry.date}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={`删除纪念日：${entry.title}`} onPress={() => deleteAnniversary(entry.id)} style={styles.deleteButton}>
                      <Text style={styles.deleteText}>删除</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.diaryContent}>{entry.title}</Text>
                  <Text style={styles.emptyText}>{entry.repeatYearly ? "每年重复" : "不重复"}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}
      <View testID="love-floating-tabs" style={[styles.tabs, styles.floatingTabs]}>
        <TabButton active={tab === "diary"} label="日记" onPress={() => setTab("diary")} />
        <TabButton active={tab === "anniversary"} label="纪念日" onPress={() => setTab("anniversary")} />
      </View>
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
  void saveDiariesToCloud(entries);
}

export function saveAnniversaries(entries: AnniversaryEntry[], storage: LoveStorage = getDefaultLoveStorage()) {
  storage.setItem(ANNIVERSARY_KEY, JSON.stringify(entries));
  void saveCloudValue(ANNIVERSARY_KEY, entries);
}

export async function hydrateLoveFromCloud(storage: LoveStorage = getDefaultLoveStorage()): Promise<{ anniversaries: AnniversaryEntry[]; diaries: DiaryEntry[] }> {
  const localDiaries = loadArray<DiaryEntry>(storage, DIARY_KEY);
  const localAnniversaries = loadArray<AnniversaryEntry>(storage, ANNIVERSARY_KEY);
  const [diaries, anniversaries] = await Promise.all([
    loadDiariesFromCloud(localDiaries, (value) => writeDiariesLocal(value, storage)),
    hydrateFromCloud<AnniversaryEntry[]>(ANNIVERSARY_KEY, localAnniversaries, (value) => saveAnniversaries(value, storage))
  ]);
  return { anniversaries, diaries };
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e3e8ef",
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 14
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
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 24
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
  diaryActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
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
  emptyBox: {
    alignItems: "center",
    gap: 8,
    minHeight: 230,
    justifyContent: "center"
  },
  emptyIcon: {
    color: "#c6ccd5",
    fontSize: 76,
    lineHeight: 82
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
  hero: {
    gap: 6
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
  stack: {
    gap: 18,
    paddingBottom: 84,
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
  tabText: {
    color: "#697386",
    fontSize: 15,
    fontWeight: "900"
  },
  tabTextActive: {
    color: "#111827"
  },
  visibilityActive: {
    backgroundColor: "#1fa8e2",
    borderColor: "#1fa8e2"
  },
  visibilityBadge: {
    backgroundColor: "#eaf6ff",
    borderRadius: 999,
    color: "#0f79ad",
    fontSize: 13,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  visibilityButton: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e3e8ef",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    minWidth: 100,
    paddingVertical: 9
  },
  visibilityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  visibilityText: {
    color: "#697386",
    fontSize: 13,
    fontWeight: "900"
  },
  visibilityTextActive: {
    color: "#ffffff"
  }
});
