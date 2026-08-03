import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { GOLDEN_SENTENCES } from "@/features/exam/examLinks";
import {
  hydrateIdiomCheckinFromCloud,
  idiomStreak,
  loadIdiomCheckin,
  saveIdiomCheckin,
  todayIdiomBatch,
  type IdiomCheckinState
} from "@/features/exam/idiomData";
import {
  ESSAY_SOURCES,
  ESSAY_TIME_FILTERS,
  ESSAY_TOPICS,
  REAL_ESSAY_ARTICLES,
  isWithinDays,
  type EssayArticle,
  type EssayReadStatus
} from "@/features/exam/essayArticles";
import {
  addStudyMinutes,
  buildStudyBars,
  formatDuration,
  hydrateStudyFromCloud,
  loadStudyState,
  minutesOn,
  saveStudyState,
  studyStreakDays,
  toLocalIso,
  totalMinutes,
  type StudyState
} from "@/features/exam/studyTimer";
import type { FixedBottomTabItem } from "@/shared/ui/FixedBottomTabs";
import type { UiTokens } from "@/shared/ui/primitives";

export type ExamTab = "essay" | "knowledge" | "idiom" | "record";

export const examTabs: FixedBottomTabItem<ExamTab>[] = [
  { label: "申论精读", value: "essay" },
  { label: "常识积累", value: "knowledge" },
  { label: "成语积累", value: "idiom" },
  { label: "学习记录", value: "record" }
];

type ExamPanelProps = {
  activeTab?: ExamTab;
  onTabChange?: (tab: ExamTab) => void;
  showInlineTabs?: boolean;
  themeTokens: UiTokens;
};

type KnowledgeCard = {
  answer: string;
  category: string;
  explanation: string;
  id: string;
  question: string;
};

const KNOWLEDGE_BANK: KnowledgeCard[] = [
  { id: "k-law-1", category: "法律", question: "行政处罚的基本原则包括哪些？", answer: "处罚法定、公正公开、过罚相当、处罚与教育相结合。", explanation: "看到行政处罚，优先联想到合法性、比例原则和程序公开。" },
  { id: "k-pol-1", category: "政治", question: "全过程人民民主强调什么？", answer: "强调人民依法通过多种途径和形式管理国家事务、经济文化事业和社会事务。", explanation: "可用于民主治理、基层协商、群众路线等主题。" },
  { id: "k-eco-1", category: "经济", question: "宏观调控的主要目标有哪些？", answer: "促进经济增长、增加就业、稳定物价、保持国际收支平衡。", explanation: "常与财政政策、货币政策、就业优先政策结合考查。" },
  { id: "k-his-1", category: "历史", question: "中国古代科举制正式形成于哪个朝代？", answer: "隋朝。", explanation: "隋唐时期是制度形成和完善的重要阶段。" },
  { id: "k-geo-1", category: "地理", question: "我国地势总体特征是什么？", answer: "西高东低，呈三级阶梯状分布。", explanation: "影响河流流向、水能资源和气候分布。" },
  { id: "k-tech-1", category: "科技", question: "北斗系统属于哪类基础设施？", answer: "全球卫星导航系统。", explanation: "常与定位、授时、交通、农业和应急救援结合。" }
];

const REVIEW_LEVELS = [
  { label: "认识", value: "known" },
  { label: "模糊", value: "fuzzy" },
  { label: "不会", value: "unknown" }
] as const;

type ReviewLevel = (typeof REVIEW_LEVELS)[number]["value"];

const ESSAY_STATUS_KEY = "fanfan-guanguan.exam.essay.status.v1";
const ESSAY_FAVORITES_KEY = "fanfan-guanguan.exam.essay.favorites.v1";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

function openOfficialUrl(url: string) {
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function ExamPanel({ activeTab, onTabChange, showInlineTabs = true, themeTokens }: ExamPanelProps) {
  const styles = useMemo(() => createStyles(themeTokens), [themeTokens]);
  const [localTab, setLocalTab] = useState<ExamTab>("essay");
  const tab = activeTab ?? localTab;
  const setTab = onTabChange ?? setLocalTab;
  const [study, setStudy] = useState<StudyState>(() => loadStudyState());
  const [checkin, setCheckin] = useState<IdiomCheckinState>(() => loadIdiomCheckin());
  const [manualMinutes, setManualMinutes] = useState("10");
  const [feedback, setFeedback] = useState("");
  const [expandedKnowledge, setExpandedKnowledge] = useState<string | null>(null);
  const [reviewMap, setReviewMap] = useState<Record<string, ReviewLevel>>({});
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readJson<string[]>(ESSAY_FAVORITES_KEY, []));
  const [essayStatus, setEssayStatus] = useState<Record<string, EssayReadStatus>>(() => readJson<Record<string, EssayReadStatus>>(ESSAY_STATUS_KEY, {}));
  const [selectedArticle, setSelectedArticle] = useState<EssayArticle | null>(null);
  const [sentenceQuery, setSentenceQuery] = useState("");
  const [sentenceTheme, setSentenceTheme] = useState("全部");
  const [timeFilter, setTimeFilter] = useState<(typeof ESSAY_TIME_FILTERS)[number]>("最近30天");
  const [topicFilter, setTopicFilter] = useState("全部");
  const [sourceFilter, setSourceFilter] = useState("全部");
  const todayKey = toLocalIso(new Date());

  useEffect(() => {
    let alive = true;
    void hydrateStudyFromCloud().then((next) => alive && setStudy(next));
    void hydrateIdiomCheckinFromCloud().then((next) => alive && setCheckin(next));
    return () => {
      alive = false;
    };
  }, []);

  const filteredArticles = useMemo(() => {
    const now = new Date("2026-08-03T00:00:00+08:00");
    return REAL_ESSAY_ARTICLES.filter((article) => {
      const timeMatched = timeFilter === "历史收藏" ? favoriteIds.includes(article.id) : isWithinDays(article.publishedAt, now, timeFilter === "最近7天" ? 7 : 30);
      const topicMatched = topicFilter === "全部" || article.topics.includes(topicFilter);
      const sourceMatched =
        sourceFilter === "全部" ||
        article.source.includes(sourceFilter) ||
        (sourceFilter === "其他官方来源" && !["人民日报", "新华社", "人民网", "求是", "半月谈"].some((source) => article.source.includes(source)));
      return timeMatched && topicMatched && sourceMatched;
    }).sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  }, [favoriteIds, sourceFilter, timeFilter, topicFilter]);

  const dailyKnowledge = useMemo(() => rotateDaily(KNOWLEDGE_BANK, 6, 2), []);
  const dailyIdioms = useMemo(() => todayIdiomBatch(5), []);
  const sentenceThemes = useMemo(() => ["全部", ...Array.from(new Set(GOLDEN_SENTENCES.map((item) => item.category)))], []);
  const filteredSentences = useMemo(
    () =>
      GOLDEN_SENTENCES.filter((item) => {
        const themeMatched = sentenceTheme === "全部" || item.category === sentenceTheme;
        const queryMatched = !sentenceQuery.trim() || `${item.category}${item.text}${item.source}`.includes(sentenceQuery.trim());
        return themeMatched && queryMatched;
      }),
    [sentenceQuery, sentenceTheme]
  );
  const stats = useMemo(() => {
    const bars = buildStudyBars(study, 7);
    return {
      articlesRead: Object.values(essayStatus).filter((status) => status === "read").length,
      bars,
      collected: favoriteIds.length,
      idioms: dailyIdioms.filter((item) => reviewMap[item.id]).length,
      knowledge: dailyKnowledge.filter((item) => reviewMap[item.id]).length,
      streak: studyStreakDays(study),
      todayMinutes: minutesOn(study, todayKey),
      total: totalMinutes(study)
    };
  }, [dailyIdioms, dailyKnowledge, essayStatus, favoriteIds.length, reviewMap, study, todayKey]);

  const persistStudy = (next: StudyState) => {
    setStudy(next);
    saveStudyState(next);
  };

  const setArticleStatus = (articleId: string, status: EssayReadStatus) => {
    setEssayStatus((current) => {
      const next = { ...current, [articleId]: status };
      writeJson(ESSAY_STATUS_KEY, next);
      return next;
    });
  };

  const toggleFavorite = (id: string) => {
    setFavoriteIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [id, ...current];
      writeJson(ESSAY_FAVORITES_KEY, next);
      return next;
    });
  };

  const markReview = (id: string, level: ReviewLevel) => {
    setReviewMap((current) => ({ ...current, [id]: level }));
  };

  const addMinutes = () => {
    const minutes = Number.parseInt(manualMinutes, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setFeedback("请输入大于 0 的学习分钟数。");
      return;
    }
    const next = addStudyMinutes(study, minutes, "manual");
    persistStudy(next);
    setFeedback(`已记录 ${formatDuration(minutes)}。`);
  };

  const markIdiomCheckin = () => {
    const learned = new Set(checkin.learnedIds);
    dailyIdioms.forEach((item) => learned.add(item.id));
    const next = { dates: [todayKey, ...checkin.dates.filter((item) => item !== todayKey)].slice(0, 400), learnedIds: Array.from(learned) };
    setCheckin(next);
    saveIdiomCheckin(next);
    setFeedback("今日成语已加入学习记录。");
  };

  if (selectedArticle) {
    return (
      <View style={styles.stack} testID="essay-detail">
        <Pressable accessibilityRole="button" accessibilityLabel="返回申论文章列表" onPress={() => setSelectedArticle(null)} style={styles.backButton}>
          <Text style={styles.backText}>← 返回列表</Text>
        </Pressable>
        <View style={styles.card}>
          <Text style={styles.detailTitle}>{selectedArticle.title}</Text>
          <Text style={styles.articleMeta}>{selectedArticle.source} · {selectedArticle.publishedAt}</Text>
          <View style={styles.tagRow}>
            {selectedArticle.topics.map((topic) => <Text key={topic} style={styles.tag}>{topic}</Text>)}
          </View>
          <Text style={styles.summary}>{selectedArticle.summary}</Text>
          <EssaySection title="核心观点" items={selectedArticle.keyPoints} styles={styles} />
          <EssaySection title="论证结构" items={selectedArticle.structure} styles={styles} />
          <EssaySection title="可积累表达" items={selectedArticle.quotes} styles={styles} />
          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="收藏当前申论文章" onPress={() => toggleFavorite(selectedArticle.id)} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{favoriteIds.includes(selectedArticle.id) ? "已收藏" : "收藏"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="标记当前申论文章已读" onPress={() => setArticleStatus(selectedArticle.id, "read")} style={styles.softButton}>
              <Text style={styles.softButtonText}>标记已读</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="查看官方原文" onPress={() => openOfficialUrl(selectedArticle.officialUrl)} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>查看官方原文</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>考公学习</Text>
        <Text style={styles.heroSub}>每天 5 到 15 分钟，读一点、记一点、复习一点。</Text>
      </View>

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

      {tab === "essay" ? (
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>每日精选文章</Text>
            <Text style={styles.cardHint}>只展示最近 30 天内可核验的官方来源文章。摘要、观点和表达为系统基于真实文章整理。</Text>
            <FilterRow label="时间" options={[...ESSAY_TIME_FILTERS]} selected={timeFilter} onSelect={(value) => setTimeFilter(value as (typeof ESSAY_TIME_FILTERS)[number])} styles={styles} />
            <FilterRow label="主题" options={ESSAY_TOPICS} selected={topicFilter} onSelect={setTopicFilter} styles={styles} />
            <FilterRow label="来源" options={ESSAY_SOURCES} selected={sourceFilter} onSelect={setSourceFilter} styles={styles} />
            {filteredArticles.length === 0 ? <Text style={styles.emptyText}>暂时无法获取今日文章，请稍后刷新。已收藏文章会保留在历史收藏中。</Text> : null}
            {filteredArticles.map((article) => {
              const status = essayStatus[article.id] ?? "unread";
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`打开申论文章${article.title}`}
                  key={article.id}
                  onPress={() => {
                    setArticleStatus(article.id, status === "unread" ? "reading" : status);
                    setSelectedArticle(article);
                  }}
                  style={({ pressed }) => [styles.articleCard, status === "read" ? styles.articleRead : null, pressed ? styles.pressed : null]}
                  testID={`essay-article-${article.id}`}
                >
                  <View style={styles.articleHeader}>
                    <View style={styles.articleTitleBox}>
                      <Text style={[styles.articleTitle, status === "read" ? styles.readText : null]}>{article.title}</Text>
                      <Text style={styles.articleMeta}>{article.source} · {article.publishedAt}</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                  <View style={styles.tagRow}>{article.topics.map((topic) => <Text key={topic} style={styles.tag}>{topic}</Text>)}</View>
                  <Text style={styles.summary}>{article.summary}</Text>
                  <Text style={styles.fieldLabel}>推荐理由：{article.recommendationReason}</Text>
                  <View style={styles.actionRow}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`收藏${article.title}`} onPress={() => toggleFavorite(article.id)} style={styles.softButton}>
                      <Text style={styles.softButtonText}>{favoriteIds.includes(article.id) ? "已收藏" : "收藏"}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`标记已读${article.title}`} onPress={() => setArticleStatus(article.id, "read")} style={styles.softButton}>
                      <Text style={styles.softButtonText}>{status === "read" ? "已读" : "标记已读"}</Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <GoldenSentencePanel
            favoriteIds={favoriteIds}
            filteredSentences={filteredSentences}
            sentenceQuery={sentenceQuery}
            sentenceTheme={sentenceTheme}
            sentenceThemes={sentenceThemes}
            setSentenceQuery={setSentenceQuery}
            setSentenceTheme={setSentenceTheme}
            styles={styles}
            themeTokens={themeTokens}
            toggleFavorite={toggleFavorite}
          />
        </View>
      ) : null}

      {tab === "knowledge" ? <KnowledgePanel dailyKnowledge={dailyKnowledge} expandedKnowledge={expandedKnowledge} favoriteIds={favoriteIds} markReview={markReview} reviewMap={reviewMap} setExpandedKnowledge={setExpandedKnowledge} styles={styles} toggleFavorite={toggleFavorite} /> : null}
      {tab === "idiom" ? <IdiomPanel checkin={checkin} dailyIdioms={dailyIdioms} favoriteIds={favoriteIds} markIdiomCheckin={markIdiomCheckin} markReview={markReview} reviewMap={reviewMap} styles={styles} toggleFavorite={toggleFavorite} /> : null}
      {tab === "record" ? <RecordPanel addMinutes={addMinutes} manualMinutes={manualMinutes} setManualMinutes={setManualMinutes} stats={stats} styles={styles} themeTokens={themeTokens} /> : null}

      {showInlineTabs ? (
        <View testID="exam-inline-tabs" style={styles.inlineTabs}>
          {examTabs.map((item) => (
            <Pressable key={item.value} accessibilityRole="button" accessibilityLabel={item.label} onPress={() => setTab(item.value)} style={[styles.tab, tab === item.value ? styles.tabActive : null]}>
              <Text numberOfLines={1} style={[styles.tabText, tab === item.value ? styles.tabTextActive : null]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function EssaySection({ items, styles, title }: { items: string[]; styles: ReturnType<typeof createStyles>; title: string }) {
  return (
    <View style={styles.detailSection}>
      <Text style={styles.fieldLabel}>{title}</Text>
      {items.map((item) => <Text key={item} style={styles.point}>· {item}</Text>)}
    </View>
  );
}

function FilterRow({ label, onSelect, options, selected, styles }: { label: string; onSelect: (value: string) => void; options: string[]; selected: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.filterBlock}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {options.map((option) => (
          <Pressable accessibilityRole="button" accessibilityLabel={`${label}筛选${option}`} key={option} onPress={() => onSelect(option)} style={[styles.chip, selected === option ? styles.chipActive : null]}>
            <Text style={[styles.chipText, selected === option ? styles.chipTextActive : null]}>{option}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function GoldenSentencePanel({
  favoriteIds,
  filteredSentences,
  sentenceQuery,
  sentenceTheme,
  sentenceThemes,
  setSentenceQuery,
  setSentenceTheme,
  styles,
  themeTokens,
  toggleFavorite
}: {
  favoriteIds: string[];
  filteredSentences: typeof GOLDEN_SENTENCES;
  sentenceQuery: string;
  sentenceTheme: string;
  sentenceThemes: string[];
  setSentenceQuery: (value: string) => void;
  setSentenceTheme: (value: string) => void;
  styles: ReturnType<typeof createStyles>;
  themeTokens: UiTokens;
  toggleFavorite: (id: string) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>申论金句库</Text>
      <View style={styles.searchRow}>
        <TextInput accessibilityLabel="搜索申论金句" onChangeText={setSentenceQuery} placeholder="搜索主题或关键词" placeholderTextColor={themeTokens.textMuted} style={styles.searchInput} value={sentenceQuery} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {sentenceThemes.map((theme) => (
          <Pressable key={theme} accessibilityRole="button" accessibilityLabel={`筛选${theme}`} onPress={() => setSentenceTheme(theme)} style={[styles.chip, sentenceTheme === theme ? styles.chipActive : null]}>
            <Text style={[styles.chipText, sentenceTheme === theme ? styles.chipTextActive : null]}>{theme}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {filteredSentences.slice(0, 8).map((item) => (
        <View key={item.id} style={styles.sentenceCard}>
          <Text style={styles.fieldLabel}>{item.category}</Text>
          <Text style={styles.sentenceText}>{item.text}</Text>
          <Text style={styles.articleMeta}>来源：{item.source}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`收藏金句${item.id}`} onPress={() => toggleFavorite(`sentence-${item.id}`)} style={styles.softButton}>
            <Text style={styles.softButtonText}>{favoriteIds.includes(`sentence-${item.id}`) ? "已收藏" : "收藏"}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function KnowledgePanel({
  dailyKnowledge,
  expandedKnowledge,
  favoriteIds,
  markReview,
  reviewMap,
  setExpandedKnowledge,
  styles,
  toggleFavorite
}: {
  dailyKnowledge: KnowledgeCard[];
  expandedKnowledge: string | null;
  favoriteIds: string[];
  markReview: (id: string, level: ReviewLevel) => void;
  reviewMap: Record<string, ReviewLevel>;
  setExpandedKnowledge: (id: string | null) => void;
  styles: ReturnType<typeof createStyles>;
  toggleFavorite: (id: string) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>今日常识积累</Text>
      {dailyKnowledge.map((item) => {
        const opened = expandedKnowledge === item.id;
        return (
          <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`查看${item.question}`} onPress={() => setExpandedKnowledge(opened ? null : item.id)} style={styles.studyCard}>
            <View style={styles.studyHead}>
              <Text style={styles.categoryBadge}>{item.category}</Text>
              <Text style={styles.reviewState}>{reviewMap[item.id] ? REVIEW_LEVELS.find((level) => level.value === reviewMap[item.id])?.label : "未标记"}</Text>
            </View>
            <Text style={styles.studyQuestion}>{item.question}</Text>
            {opened ? (
              <>
                <Text style={styles.studyAnswer}>答案：{item.answer}</Text>
                <Text style={styles.summary}>{item.explanation}</Text>
              </>
            ) : null}
            <View style={styles.actionRow}>
              {REVIEW_LEVELS.map((level) => (
                <Pressable key={level.value} accessibilityRole="button" accessibilityLabel={`${item.question}${level.label}`} onPress={() => markReview(item.id, level.value)} style={[styles.softButton, reviewMap[item.id] === level.value ? styles.softButtonActive : null]}>
                  <Text style={[styles.softButtonText, reviewMap[item.id] === level.value ? styles.softButtonTextActive : null]}>{level.label}</Text>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" accessibilityLabel={`收藏${item.question}`} onPress={() => toggleFavorite(item.id)} style={styles.softButton}>
                <Text style={styles.softButtonText}>{favoriteIds.includes(item.id) ? "已收藏" : "收藏"}</Text>
              </Pressable>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function IdiomPanel({ checkin, dailyIdioms, favoriteIds, markIdiomCheckin, markReview, reviewMap, styles, toggleFavorite }: { checkin: IdiomCheckinState; dailyIdioms: ReturnType<typeof todayIdiomBatch>; favoriteIds: string[]; markIdiomCheckin: () => void; markReview: (id: string, level: ReviewLevel) => void; reviewMap: Record<string, ReviewLevel>; styles: ReturnType<typeof createStyles>; toggleFavorite: (id: string) => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>今日成语积累</Text>
          <Text style={styles.cardHint}>连续学习 {idiomStreak(checkin.dates)} 天</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="成语学习打卡" onPress={markIdiomCheckin} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>今日打卡</Text>
        </Pressable>
      </View>
      {dailyIdioms.map((item) => (
        <View key={item.id} style={styles.studyCard}>
          <View style={styles.studyHead}>
            <Text style={styles.idiomWord}>{item.word}</Text>
            <Text style={styles.articleMeta}>{item.pinyin}</Text>
          </View>
          <Text style={styles.studyAnswer}>正确释义：{item.meaning}</Text>
          <Text style={styles.summary}>常见误用：{item.tip}</Text>
          <View style={styles.actionRow}>
            {REVIEW_LEVELS.map((level) => (
              <Pressable key={level.value} accessibilityRole="button" accessibilityLabel={`${item.word}${level.label}`} onPress={() => markReview(item.id, level.value)} style={[styles.softButton, reviewMap[item.id] === level.value ? styles.softButtonActive : null]}>
                <Text style={[styles.softButtonText, reviewMap[item.id] === level.value ? styles.softButtonTextActive : null]}>{level.label}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" accessibilityLabel={`收藏${item.word}`} onPress={() => toggleFavorite(item.id)} style={styles.softButton}>
              <Text style={styles.softButtonText}>{favoriteIds.includes(item.id) ? "已收藏" : "收藏"}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function RecordPanel({ addMinutes, manualMinutes, setManualMinutes, stats, styles, themeTokens }: { addMinutes: () => void; manualMinutes: string; setManualMinutes: (value: string) => void; stats: { articlesRead: number; bars: ReturnType<typeof buildStudyBars>; collected: number; idioms: number; knowledge: number; streak: number; todayMinutes: number; total: number }; styles: ReturnType<typeof createStyles>; themeTokens: UiTokens }) {
  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>学习记录</Text>
        <View style={styles.statsGrid}>
          <Stat label="今日阅读时长" value={formatDuration(stats.todayMinutes)} styles={styles} />
          <Stat label="阅读文章" value={`${stats.articlesRead} 篇`} styles={styles} />
          <Stat label="常识学习" value={`${stats.knowledge} 条`} styles={styles} />
          <Stat label="成语学习" value={`${stats.idioms} 个`} styles={styles} />
          <Stat label="收藏" value={`${stats.collected} 条`} styles={styles} />
          <Stat label="连续学习" value={`${stats.streak} 天`} styles={styles} />
        </View>
        <View style={styles.manualRow}>
          <TextInput accessibilityLabel="补录学习分钟" keyboardType="numeric" onChangeText={setManualMinutes} placeholder="分钟" placeholderTextColor={themeTokens.textMuted} style={styles.minuteInput} value={manualMinutes} />
          <Pressable accessibilityRole="button" accessibilityLabel="记录学习时长" onPress={addMinutes} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>记录</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>近 7 天学习时长</Text>
        <View style={styles.chart}>
          {stats.bars.map((bar) => (
            <View key={bar.date} style={styles.barColumn}>
              <View style={styles.barTrack}><View style={[styles.barFill, { height: `${bar.height}%` }]} /></View>
              <Text style={styles.articleMeta}>{bar.label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.cardHint}>累计学习 {formatDuration(stats.total)}</Text>
      </View>
    </View>
  );
}

function rotateDaily<T>(items: T[], count: number, salt: number): T[] {
  const now = new Date();
  const dayNumber = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000) + salt;
  return Array.from({ length: Math.min(count, items.length) }, (_, index) => items[(dayNumber + index) % items.length]);
}

function Stat({ label, styles, value }: { label: string; styles: ReturnType<typeof createStyles>; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    articleCard: { backgroundColor: tokens.surfaceMuted, borderColor: tokens.border, borderRadius: 14, borderWidth: 1, gap: 8, padding: 12 },
    articleHeader: { alignItems: "flex-start", flexDirection: "row", gap: 10, justifyContent: "space-between" },
    articleMeta: { color: tokens.textMuted, fontSize: 12, fontWeight: "700" },
    articleRead: { opacity: 0.72 },
    articleTitle: { color: tokens.text, fontSize: 16, fontWeight: "900", lineHeight: 22 },
    articleTitleBox: { flex: 1, gap: 4 },
    backButton: { alignSelf: "flex-start", backgroundColor: tokens.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
    backText: { color: tokens.accent, fontSize: 13, fontWeight: "900" },
    barColumn: { alignItems: "center", flex: 1, gap: 4 },
    barFill: { backgroundColor: tokens.accent, borderRadius: 6, bottom: 0, left: "22%", position: "absolute", right: "22%" },
    barTrack: { backgroundColor: tokens.surfaceMuted, borderRadius: 6, height: 84, position: "relative", width: "100%" },
    card: { backgroundColor: tokens.surface, borderColor: tokens.border, borderRadius: 18, borderWidth: 1, gap: 12, padding: 14 },
    cardHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
    cardHint: { color: tokens.textMuted, fontSize: 12, lineHeight: 18 },
    cardTitle: { color: tokens.text, fontSize: 17, fontWeight: "900" },
    categoryBadge: { backgroundColor: tokens.accentSoft, borderRadius: 999, color: tokens.accent, fontSize: 12, fontWeight: "900", paddingHorizontal: 10, paddingVertical: 4 },
    chart: { alignItems: "flex-end", flexDirection: "row", gap: 8, minHeight: 110 },
    chevron: { color: tokens.accent, fontSize: 24, fontWeight: "500" },
    chip: { backgroundColor: tokens.surfaceMuted, borderColor: tokens.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
    chipActive: { backgroundColor: tokens.accent, borderColor: tokens.accent },
    chipRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
    chipText: { color: tokens.textMuted, fontSize: 12, fontWeight: "800" },
    chipTextActive: { color: "#ffffff" },
    detailSection: { gap: 5 },
    detailTitle: { color: tokens.text, fontSize: 22, fontWeight: "900", lineHeight: 30 },
    emptyText: { color: tokens.textMuted, fontSize: 13, lineHeight: 20, paddingVertical: 12 },
    feedback: { color: tokens.accent, fontSize: 13, fontWeight: "800" },
    fieldLabel: { color: tokens.accent, fontSize: 12, fontWeight: "900", lineHeight: 18 },
    filterBlock: { gap: 6 },
    filterLabel: { color: tokens.text, fontSize: 13, fontWeight: "900" },
    hero: { gap: 4 },
    heroSub: { color: tokens.textMuted, fontSize: 13 },
    heroTitle: { color: tokens.text, fontSize: 22, fontWeight: "900" },
    idiomWord: { color: tokens.text, fontSize: 18, fontWeight: "900" },
    inlineTabs: { backgroundColor: tokens.surfaceMuted, borderRadius: 14, flexDirection: "row", gap: 4, padding: 4 },
    manualRow: { alignItems: "center", flexDirection: "row", gap: 10 },
    minuteInput: { backgroundColor: tokens.surfaceMuted, borderColor: tokens.border, borderRadius: 12, borderWidth: 1, color: tokens.text, flex: 1, fontSize: 14, minHeight: 44, paddingHorizontal: 12 },
    point: { color: tokens.text, fontSize: 13, lineHeight: 20 },
    pressed: { transform: [{ scale: 0.995 }] },
    primaryButton: { alignItems: "center", backgroundColor: tokens.accent, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
    primaryButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
    readText: { color: tokens.textMuted },
    reviewState: { color: tokens.textMuted, fontSize: 12, fontWeight: "800" },
    searchInput: { backgroundColor: tokens.surfaceMuted, borderColor: tokens.border, borderRadius: 12, borderWidth: 1, color: tokens.text, flex: 1, fontSize: 14, minHeight: 42, paddingHorizontal: 12 },
    searchRow: { alignItems: "center", flexDirection: "row", gap: 8 },
    section: { gap: 14 },
    sentenceCard: { borderTopColor: tokens.border, borderTopWidth: StyleSheet.hairlineWidth, gap: 6, paddingTop: 10 },
    sentenceText: { color: tokens.text, fontSize: 14, lineHeight: 22 },
    softButton: { backgroundColor: tokens.surface, borderColor: tokens.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
    softButtonActive: { backgroundColor: tokens.accent, borderColor: tokens.accent },
    softButtonText: { color: tokens.accent, fontSize: 12, fontWeight: "900" },
    softButtonTextActive: { color: "#ffffff" },
    stack: { gap: 16, paddingBottom: 108 },
    statBox: { backgroundColor: tokens.surfaceMuted, borderRadius: 14, flex: 1, minWidth: 120, padding: 12 },
    statLabel: { color: tokens.textMuted, fontSize: 12, fontWeight: "800" },
    statValue: { color: tokens.text, fontSize: 18, fontWeight: "900", marginTop: 4 },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    studyAnswer: { color: tokens.text, fontSize: 14, fontWeight: "800", lineHeight: 22 },
    studyCard: { backgroundColor: tokens.surfaceMuted, borderColor: tokens.border, borderRadius: 14, borderWidth: 1, gap: 8, padding: 12 },
    studyHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
    studyQuestion: { color: tokens.text, fontSize: 15, fontWeight: "900", lineHeight: 22 },
    summary: { color: tokens.textMuted, fontSize: 13, lineHeight: 20 },
    tab: { alignItems: "center", borderRadius: 12, flex: 1, justifyContent: "center", minWidth: 0, paddingHorizontal: 4, paddingVertical: 10 },
    tabActive: { backgroundColor: tokens.surface },
    tabText: { color: tokens.textMuted, fontSize: 13, fontWeight: "900" },
    tabTextActive: { color: tokens.accent },
    tag: { backgroundColor: tokens.accentSoft, borderRadius: 999, color: tokens.accent, fontSize: 11, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 3 },
    tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 }
  });
}
