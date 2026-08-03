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
  addStudyMinutes,
  buildStudyBars,
  formatDuration,
  hydrateStudyFromCloud,
  loadStudyState,
  minutesOn,
  saveStudyState,
  shiftDate,
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

type EssayArticle = {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  tags: string[];
  summary: string;
  themes: string;
  points: string[];
  quotes: string[];
  originalUrl?: string;
};

type KnowledgeCard = {
  id: string;
  category: string;
  question: string;
  answer: string;
  explanation: string;
};

const ESSAY_BANK: EssayArticle[] = [
  {
    id: "essay-governance-1",
    title: "以基层治理“小网格”托起民生“大服务”",
    source: "人民日报评论整理",
    publishedAt: "每日轮换",
    tags: ["基层治理", "民生服务"],
    summary: "文章围绕社区网格、数字平台和群众诉求闭环展开，适合积累“治理重心下移”“服务触角延伸”等表达。重点是把问题解决在基层、把服务送到群众身边。",
    themes: "基层治理、服务型政府、民生保障",
    points: ["治理要从被动响应转向主动发现。", "数字工具最终要落到解决群众具体问题。", "基层干部既要会协调资源，也要会倾听需求。"],
    quotes: ["民生无小事，枝叶总关情。", "治理的温度，藏在一件件小事的回应里。"]
  },
  {
    id: "essay-quality-1",
    title: "在高质量发展中增强群众获得感",
    source: "新华社要点整理",
    publishedAt: "每日轮换",
    tags: ["高质量发展", "共同富裕"],
    summary: "内容聚焦产业升级、公共服务和就业支撑。可用于申论中论证“发展为了人民、发展依靠人民、发展成果由人民共享”。",
    themes: "高质量发展、就业、公共服务",
    points: ["高质量发展不是单纯速度竞争，而是结构、效益和公平的统一。", "稳就业是稳预期、稳民生的重要抓手。", "公共服务均衡化能释放长期发展潜力。"],
    quotes: ["发展成色好不好，人民感受最有发言权。", "把发展答卷写在群众笑脸上。"]
  },
  {
    id: "essay-rural-1",
    title: "让乡村振兴既有颜值也有产值",
    source: "半月谈材料整理",
    publishedAt: "每日轮换",
    tags: ["乡村振兴", "产业融合"],
    summary: "文章适合积累乡村产业、生态宜居和人才回流相关论述。核心在于避免空心化建设，让乡村资源真正转化为发展优势。",
    themes: "乡村振兴、产业兴旺、生态文明",
    points: ["产业兴旺是乡村振兴的底盘。", "保护乡土风貌不是拒绝现代化。", "人才回流需要产业机会和公共服务共同支撑。"],
    quotes: ["乡村振兴既要塑形，也要铸魂。", "绿水青山要转化为富民增收的金山银山。"]
  },
  {
    id: "essay-tech-1",
    title: "以科技创新塑造发展新优势",
    source: "求是网主题整理",
    publishedAt: "每日轮换",
    tags: ["科技创新", "新质生产力"],
    summary: "材料围绕创新链、产业链和人才链协同展开，可用于科技创新、产业转型、青年担当等主题。",
    themes: "科技创新、新质生产力、人才强国",
    points: ["关键核心技术要靠自主攻关。", "创新成果要走向产业场景。", "青年人才是创新活力的重要来源。"],
    quotes: ["惟创新者进，惟创新者强。", "把关键变量转化为最大增量。"]
  },
  {
    id: "essay-ecology-1",
    title: "用制度力量守护生态底色",
    source: "人民网观点整理",
    publishedAt: "每日轮换",
    tags: ["生态文明", "绿色发展"],
    summary: "文章强调生态保护不能只靠运动式治理，而要依靠制度、监督和公众参与形成长效机制。",
    themes: "生态文明、绿色治理、制度建设",
    points: ["生态治理需要算长远账、整体账。", "制度刚性是守住生态红线的关键。", "公众参与能让绿色理念成为日常行动。"],
    quotes: ["良好生态环境是最普惠的民生福祉。", "绿色发展不是选择题，而是必答题。"]
  }
];

const KNOWLEDGE_BANK: KnowledgeCard[] = [
  { id: "k-law-1", category: "法律", question: "行政处罚的基本原则包括哪些？", answer: "处罚法定、公正公开、过罚相当、处罚与教育相结合。", explanation: "做常识题时，看到行政处罚应优先联想到合法性、比例性和程序公开。" },
  { id: "k-pol-1", category: "政治", question: "全过程人民民主强调什么？", answer: "强调人民依法通过多种途径和形式管理国家事务、经济文化事业和社会事务。", explanation: "申论中可用于民主治理、基层协商、群众路线等主题。" },
  { id: "k-eco-1", category: "经济", question: "宏观调控的主要目标有哪些？", answer: "促进经济增长、增加就业、稳定物价、保持国际收支平衡。", explanation: "四项目标常成套出现，注意与财政政策、货币政策区分。" },
  { id: "k-his-1", category: "历史", question: "中国古代科举制正式形成于哪个朝代？", answer: "隋朝。", explanation: "隋唐时期是制度形成和完善的重要阶段，题目常考制度沿革。" },
  { id: "k-geo-1", category: "地理", question: "我国地势总体特征是什么？", answer: "西高东低，呈三级阶梯状分布。", explanation: "该特征影响河流流向、水能资源和气候分布。" },
  { id: "k-tech-1", category: "科技", question: "北斗系统属于哪类基础设施？", answer: "全球卫星导航系统。", explanation: "常与定位、授时、交通、农业和应急救援场景结合考查。" }
];

const REVIEW_LEVELS = [
  { label: "认识", value: "known" },
  { label: "模糊", value: "fuzzy" },
  { label: "不会", value: "unknown" }
] as const;

type ReviewLevel = (typeof REVIEW_LEVELS)[number]["value"];

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
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [sentenceQuery, setSentenceQuery] = useState("");
  const [sentenceTheme, setSentenceTheme] = useState("全部");
  const todayKey = toLocalIso(new Date());

  useEffect(() => {
    let alive = true;
    void hydrateStudyFromCloud().then((next) => alive && setStudy(next));
    void hydrateIdiomCheckinFromCloud().then((next) => alive && setCheckin(next));
    return () => {
      alive = false;
    };
  }, []);

  const dailyArticles = useMemo(() => rotateDaily(ESSAY_BANK, 4, 0), []);
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
      articlesRead: favoriteIds.filter((id) => id.startsWith("read-essay")).length,
      bars,
      collected: favoriteIds.length,
      idioms: dailyIdioms.filter((item) => reviewMap[item.id]).length,
      knowledge: dailyKnowledge.filter((item) => reviewMap[item.id]).length,
      streak: studyStreakDays(study),
      todayMinutes: minutesOn(study, todayKey),
      total: totalMinutes(study)
    };
  }, [dailyIdioms, dailyKnowledge, favoriteIds, reviewMap, study, todayKey]);

  const persistStudy = (next: StudyState) => {
    setStudy(next);
    saveStudyState(next);
  };

  const persistCheckin = (next: IdiomCheckinState) => {
    setCheckin(next);
    saveIdiomCheckin(next);
  };

  const markReview = (id: string, level: ReviewLevel) => {
    setReviewMap((current) => ({ ...current, [id]: level }));
  };

  const toggleFavorite = (id: string) => {
    setFavoriteIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [id, ...current]));
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
    persistCheckin({ dates: [todayKey, ...checkin.dates.filter((item) => item !== todayKey)].slice(0, 400), learnedIds: Array.from(learned) });
    setFeedback("今日成语已加入学习记录。");
  };

  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>考公练习</Text>
        <Text style={styles.heroSub}>每天 5 到 15 分钟，读一点、记一点、复习一点。</Text>
      </View>

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

      {tab === "essay" ? (
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>每日精选文章</Text>
            <Text style={styles.cardHint}>本地精选内容按日期轮换；没有可靠原文链接时不伪造跳转。</Text>
            {dailyArticles.map((article) => (
              <View key={article.id} style={styles.articleCard}>
                <View style={styles.articleHeader}>
                  <View style={styles.articleTitleBox}>
                    <Text style={styles.articleTitle}>{article.title}</Text>
                    <Text style={styles.articleMeta}>{article.source} · {article.publishedAt}</Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`收藏${article.title}`} onPress={() => toggleFavorite(article.id)} style={styles.smallButton}>
                    <Text style={styles.smallButtonText}>{favoriteIds.includes(article.id) ? "已收藏" : "收藏"}</Text>
                  </Pressable>
                </View>
                <View style={styles.tagRow}>
                  {article.tags.map((tag) => (
                    <Text key={tag} style={styles.tag}>{tag}</Text>
                  ))}
                </View>
                <Text style={styles.summary}>{article.summary}</Text>
                <Text style={styles.fieldLabel}>适用主题：{article.themes}</Text>
                {article.points.map((point) => <Text key={point} style={styles.point}>· {point}</Text>)}
                {article.quotes.map((quote) => <Text key={quote} style={styles.quote}>“{quote}”</Text>)}
                <View style={styles.actionRow}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`标记已读${article.title}`} onPress={() => toggleFavorite(`read-${article.id}`)} style={styles.softButton}>
                    <Text style={styles.softButtonText}>{favoriteIds.includes(`read-${article.id}`) ? "已读" : "标记已读"}</Text>
                  </Pressable>
                  {article.originalUrl ? (
                    <Text style={styles.linkText}>查看原文</Text>
                  ) : (
                    <Text style={styles.disabledLink}>原文链接待接入官方源</Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>申论金句库</Text>
            <View style={styles.searchRow}>
              <TextInput
                accessibilityLabel="搜索申论金句"
                onChangeText={setSentenceQuery}
                placeholder="搜索主题或关键词"
                placeholderTextColor={themeTokens.textMuted}
                style={styles.searchInput}
                value={sentenceQuery}
              />
              <Pressable accessibilityRole="button" accessibilityLabel="随机复习金句" onPress={() => setSentenceQuery("")} style={styles.softButton}>
                <Text style={styles.softButtonText}>随机复习</Text>
              </Pressable>
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
                <View style={styles.actionRow}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`收藏金句${item.id}`} onPress={() => toggleFavorite(`sentence-${item.id}`)} style={styles.softButton}>
                    <Text style={styles.softButtonText}>{favoriteIds.includes(`sentence-${item.id}`) ? "已收藏" : "收藏"}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`掌握金句${item.id}`} onPress={() => toggleFavorite(`master-${item.id}`)} style={styles.softButton}>
                    <Text style={styles.softButtonText}>{favoriteIds.includes(`master-${item.id}`) ? "已掌握" : "已掌握"}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {tab === "knowledge" ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>今日常识积累</Text>
          <Text style={styles.cardHint}>点击题目翻看答案，再标记掌握程度；模糊和不会会作为次日优先复习依据。</Text>
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
      ) : null}

      {tab === "idiom" ? (
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
              <Text style={styles.summary}>正确例句：在写作中注意贴合语境，避免望文生义。</Text>
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
      ) : null}

      {tab === "record" ? (
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
              <TextInput
                accessibilityLabel="补录学习分钟"
                keyboardType="numeric"
                onChangeText={setManualMinutes}
                placeholder="分钟"
                placeholderTextColor={themeTokens.textMuted}
                style={styles.minuteInput}
                value={manualMinutes}
              />
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
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { height: `${bar.height}%` }]} />
                  </View>
                  <Text style={styles.articleMeta}>{bar.label}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.cardHint}>累计学习 {formatDuration(stats.total)}</Text>
          </View>
        </View>
      ) : null}

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
    actionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    articleCard: {
      backgroundColor: tokens.surfaceMuted,
      borderColor: tokens.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: 8,
      padding: 12
    },
    articleHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 10,
      justifyContent: "space-between"
    },
    articleMeta: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "700"
    },
    articleTitle: {
      color: tokens.text,
      fontSize: 16,
      fontWeight: "900",
      lineHeight: 22
    },
    articleTitleBox: {
      flex: 1,
      gap: 4
    },
    barColumn: {
      alignItems: "center",
      flex: 1,
      gap: 4
    },
    barFill: {
      backgroundColor: tokens.accent,
      borderRadius: 6,
      bottom: 0,
      left: "22%",
      position: "absolute",
      right: "22%"
    },
    barTrack: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 6,
      height: 84,
      position: "relative",
      width: "100%"
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
    categoryBadge: {
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "900",
      paddingHorizontal: 10,
      paddingVertical: 4
    },
    chart: {
      alignItems: "flex-end",
      flexDirection: "row",
      gap: 8,
      minHeight: 110
    },
    chip: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7
    },
    chipActive: {
      backgroundColor: tokens.accent
    },
    chipRow: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 2
    },
    chipText: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "800"
    },
    chipTextActive: {
      color: "#ffffff"
    },
    disabledLink: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "800"
    },
    feedback: {
      color: tokens.accent,
      fontSize: 13,
      fontWeight: "800"
    },
    fieldLabel: {
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "900"
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
    idiomWord: {
      color: tokens.text,
      fontSize: 18,
      fontWeight: "900"
    },
    inlineTabs: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 14,
      flexDirection: "row",
      gap: 4,
      padding: 4
    },
    linkText: {
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "900"
    },
    manualRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10
    },
    minuteInput: {
      backgroundColor: tokens.surfaceMuted,
      borderColor: tokens.border,
      borderRadius: 12,
      borderWidth: 1,
      color: tokens.text,
      flex: 1,
      fontSize: 14,
      minHeight: 44,
      paddingHorizontal: 12
    },
    point: {
      color: tokens.text,
      fontSize: 13,
      lineHeight: 20
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: tokens.accent,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11
    },
    primaryButtonText: {
      color: "#ffffff",
      fontSize: 13,
      fontWeight: "900"
    },
    quote: {
      color: tokens.text,
      fontSize: 13,
      fontWeight: "800",
      lineHeight: 20
    },
    reviewState: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "800"
    },
    searchInput: {
      backgroundColor: tokens.surfaceMuted,
      borderColor: tokens.border,
      borderRadius: 12,
      borderWidth: 1,
      color: tokens.text,
      flex: 1,
      fontSize: 14,
      minHeight: 42,
      paddingHorizontal: 12
    },
    searchRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8
    },
    section: {
      gap: 14
    },
    sentenceCard: {
      borderTopColor: tokens.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 6,
      paddingTop: 10
    },
    sentenceText: {
      color: tokens.text,
      fontSize: 14,
      lineHeight: 22
    },
    smallButton: {
      backgroundColor: tokens.surface,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    smallButtonText: {
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "900"
    },
    softButton: {
      backgroundColor: tokens.surfaceMuted,
      borderColor: tokens.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    softButtonActive: {
      backgroundColor: tokens.accent,
      borderColor: tokens.accent
    },
    softButtonText: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "800"
    },
    softButtonTextActive: {
      color: "#ffffff"
    },
    stack: {
      gap: 16,
      paddingBottom: 108
    },
    statBox: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 14,
      flex: 1,
      minWidth: 120,
      padding: 12
    },
    statLabel: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "800"
    },
    statValue: {
      color: tokens.text,
      fontSize: 18,
      fontWeight: "900",
      marginTop: 4
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10
    },
    studyAnswer: {
      color: tokens.text,
      fontSize: 14,
      fontWeight: "800",
      lineHeight: 22
    },
    studyCard: {
      backgroundColor: tokens.surfaceMuted,
      borderColor: tokens.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: 8,
      padding: 12
    },
    studyHead: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    studyQuestion: {
      color: tokens.text,
      fontSize: 15,
      fontWeight: "900",
      lineHeight: 22
    },
    summary: {
      color: tokens.textMuted,
      fontSize: 13,
      lineHeight: 20
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
      fontSize: 13,
      fontWeight: "900"
    },
    tabTextActive: {
      color: tokens.accent
    },
    tag: {
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      color: tokens.accent,
      fontSize: 11,
      fontWeight: "900",
      paddingHorizontal: 8,
      paddingVertical: 3
    },
    tagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6
    }
  });
}
