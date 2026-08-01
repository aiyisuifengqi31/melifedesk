import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { UiTokens } from "@/shared/ui/primitives";

const ESSAY_DRAFT_KEY = "fanfan-guanguan.exam.essayDraft.v1";
const EXAM_WRONG_KEY = "fanfan-guanguan.exam.wrongQuestions.v1";
const EXAM_STATS_KEY = "fanfan-guanguan.exam.dailyStats.v1";
const EXAM_QUESTION_BANK_KEY = "fanfan-guanguan.exam.questionBank.v1";
const EXAM_READ_HISTORY_KEY = "fanfan-guanguan.exam.readHistory.v1";

type ExamTab = "quiz" | "wrong" | "wrongStats" | "essay";
type EssaySubTab = "recommend" | "history";
type QuizSubject = "reasoning" | "common" | "language" | "quantitative" | "data";

type Question = {
  answer: string;
  explanation: string;
  id: string;
  options: string[];
  question: string;
  subject: QuizSubject;
  subjectLabel: string;
};

type WrongRecord = {
  answeredAt: string;
  correctAnswer: string;
  id: string;
  myAnswer: string;
  question: Question;
};

type DailyArticle = {
  category: string;
  content: string;
  excerpt: string;
  id: string;
  readAt?: string;
  source: string;
  title: string;
};

const subjectTabs: { key: QuizSubject; label: string }[] = [
  { key: "reasoning", label: "判断推理" },
  { key: "common", label: "常识" },
  { key: "language", label: "言语" },
  { key: "quantitative", label: "数量关系" },
  { key: "data", label: "资料分析" }
];

const fallbackQuestionBank: Question[] = [
  {
    id: "q1",
    subject: "language",
    subjectLabel: "言语理解与表达",
    question: "中国传统工艺蕴含着丰富的文化内涵。下列选项中，最适合填入文中横线处的是：传统工艺不仅是技艺的传承，更是_________的延续。",
    options: ["A. 文化血脉", "B. 生产方式", "C. 商业活动", "D. 社会制度"],
    answer: "A",
    explanation: "横线前后强调\"传承\"与\"延续\"，对应\"文化血脉\"最为贴切。"
  },
  {
    id: "q2",
    subject: "language",
    subjectLabel: "言语理解与表达",
    question: "下列句子中，没有语病的一项是：",
    options: ["A. 通过这次学习，使我提高了认识", "B. 他的写作水平有了明显的提高", "C. 我们一定要发扬和继承优良传统", "D. 能否刻苦努力是取得好成绩的关键"],
    answer: "B",
    explanation: "A 缺少主语；C 语序不当，应为\"继承和发扬\"；D 两面与一面搭配不当。"
  },
  {
    id: "q3",
    subject: "quantitative",
    subjectLabel: "数量关系",
    question: "某单位共有员工72人，其中女性占1/3。后来调走几名女性，女性占总人数的1/4。问调走了几名女性？",
    options: ["A. 6", "B. 8", "C. 10", "D. 12"],
    answer: "B",
    explanation: "原有女性 24 人。设调走 x 人，则 (24-x)/(72-x)=1/4，解得 x=8。"
  },
  {
    id: "q4",
    subject: "quantitative",
    subjectLabel: "数量关系",
    question: "一项工程，甲单独做需要10天，乙单独做需要15天。两人合作3天后，乙离开，甲继续完成剩余工作。问甲还需要几天？",
    options: ["A. 3", "B. 4", "C. 5", "D. 6"],
    answer: "C",
    explanation: "甲效率 1/10，乙效率 1/15。合作 3 天完成 3×(1/10+1/15)=1/2。剩余 1/2 由甲单独完成需 (1/2)/(1/10)=5 天。"
  },
  {
    id: "q5",
    subject: "reasoning",
    subjectLabel: "判断推理",
    question: "所有党员都要遵纪守法，我不是党员，所以我不需要遵纪守法。这个推理的错误在于：",
    options: ["A. 大前提错误", "B. 小前提错误", "C. 偷换概念", "D. 推理形式错误"],
    answer: "D",
    explanation: "大前提为\"所有党员都要遵纪守法\"，并不意味着非党员不需要遵纪守法，推理形式错误。"
  },
  {
    id: "q6",
    subject: "reasoning",
    subjectLabel: "判断推理",
    question: "从所给的四个选项中，选择最合适的一个填入问号处，使之呈现一定的规律性：2, 4, 8, 14, 22, ?",
    options: ["A. 28", "B. 30", "C. 32", "D. 34"],
    answer: "C",
    explanation: "相邻两项差依次为 2, 4, 6, 8，下一个差为 10，22+10=32。"
  },
  {
    id: "q7",
    subject: "data",
    subjectLabel: "资料分析",
    question: "2023年全国粮食总产量69541万吨，比上年增长1.3%。其中稻谷产量20660万吨，增长0.9%。粮食播种面积11897万公顷，增长0.5%。问2022年粮食单产约为多少吨/公顷？",
    options: ["A. 5.45", "B. 5.78", "C. 5.82", "D. 5.94"],
    answer: "B",
    explanation: "2022 年产量 ≈ 69541/1.013 ≈ 68648 万吨；2022 年面积 ≈ 11897/1.005 ≈ 11838 万公顷；单产 ≈ 68648/11838 ≈ 5.78 吨/公顷。"
  },
  {
    id: "q8",
    subject: "common",
    subjectLabel: "常识判断",
    question: "根据《中华人民共和国宪法》，中华人民共和国的一切权力属于：",
    options: ["A. 全国人民代表大会", "B. 国务院", "C. 人民", "D. 中国共产党"],
    answer: "C",
    explanation: "《宪法》第二条规定：中华人民共和国的一切权力属于人民。"
  }
];

const dailyArticles: DailyArticle[] = [
  {
    id: "a1",
    title: "以高质量发展推进中国式现代化",
    excerpt: "高质量发展是全面建设社会主义现代化国家的首要任务。",
    content: "高质量发展是全面建设社会主义现代化国家的首要任务。必须完整、准确、全面贯彻新发展理念，坚持社会主义市场经济改革方向，把发展质量摆在更突出的位置。\n\n推动高质量发展，要着力提升全要素生产率，加快建设现代化产业体系，推进新型工业化，培育壮大战略性新兴产业，布局建设未来产业，完善现代化基础设施体系。",
    source: "人民日报",
    category: "政治"
  },
  {
    id: "a2",
    title: "基层治理现代化的实践路径",
    excerpt: "基层治理是国家治理的基石。",
    content: "基层治理是国家治理的基石。近年来，各地积极探索\"网格化管理+数字化赋能\"的治理新模式，有效提升了基层治理效能。\n\n推进基层治理现代化，要坚持党建引领，把党的领导贯穿基层治理全过程；要坚持人民主体地位，畅通群众参与治理的渠道；要善于运用现代科技手段，提高治理精细化、智能化水平。",
    source: "半月谈",
    category: "治理"
  },
  {
    id: "a3",
    title: "数字经济赋能乡村振兴",
    excerpt: "随着数字技术的快速发展，数字经济正在成为推动乡村振兴的重要力量。",
    content: "随着数字技术的快速发展，数字经济正在成为推动乡村振兴的重要力量。从智慧农业到农村电商，数字技术为农业农村现代化提供了新动能。\n\n要加快乡村数字基础设施建设，推动农业生产数字化转型，培育农村电商、乡村旅游等新业态，让更多农民共享数字经济发展红利。",
    source: "光明日报",
    category: "经济"
  }
];

function loadQuestionBank(): Question[] {
  if (typeof window !== "undefined" && window.localStorage) {
    const stored = window.localStorage.getItem(EXAM_QUESTION_BANK_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Question[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // fall through
      }
    }
  }
  return fallbackQuestionBank;
}

function saveQuestionBank(bank: Question[]) {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(EXAM_QUESTION_BANK_KEY, JSON.stringify(bank));
  }
}

function loadReadHistory(): DailyArticle[] {
  if (typeof window !== "undefined" && window.localStorage) {
    const stored = window.localStorage.getItem(EXAM_READ_HISTORY_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as DailyArticle[];
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // fall through
      }
    }
  }
  return [];
}

function saveReadHistory(history: DailyArticle[]) {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(EXAM_READ_HISTORY_KEY, JSON.stringify(history));
  }
}

function getDailyQuestions(bank: Question[]): Question[] {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const seed = dayOfYear * 7;
  const shuffled = [...bank].sort((a, b) => {
    const hashA = seed + a.id.charCodeAt(a.id.length - 1);
    const hashB = seed + b.id.charCodeAt(b.id.length - 1);
    return hashA - hashB;
  });
  return shuffled.slice(0, Math.min(3, shuffled.length));
}

function optionLetter(option: string) {
  return option.trim().charAt(0).toUpperCase();
}

export function ExamPanel({ themeTokens }: { themeTokens: UiTokens }) {
  const [activeTab, setActiveTab] = useState<ExamTab>("quiz");
  const [quizSubject, setQuizSubject] = useState<QuizSubject>("reasoning");
  const [essaySubTab, setEssaySubTab] = useState<EssaySubTab>("recommend");
  const [selectedArticle, setSelectedArticle] = useState<DailyArticle | null>(null);
  const [readHistory, setReadHistory] = useState<DailyArticle[]>(() => loadReadHistory());
  const styles = useMemo(() => createStyles(themeTokens), [themeTokens]);

  const [questionBank, setQuestionBank] = useState<Question[]>(() => loadQuestionBank());

  const [dailyStats, setDailyStats] = useState(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = window.localStorage.getItem(EXAM_STATS_KEY);
      if (stored) return JSON.parse(stored) as { answered: number; correct: number; date: string };
    }
    return { answered: 0, correct: 0, date: todayIso() };
  });

  const [wrongRecords, setWrongRecords] = useState<WrongRecord[]>(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = window.localStorage.getItem(EXAM_WRONG_KEY);
      if (stored) return JSON.parse(stored) as WrongRecord[];
    }
    return [];
  });

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizScores, setQuizScores] = useState<Array<{ correct: boolean; questionId: string }>>([]);
  const [feedback, setFeedback] = useState("每天3道精选题目，持续积累必有回报。");

  const subjectQuestions = questionBank.filter((q) => q.subject === quizSubject);
  const todayQuestions = getDailyQuestions(subjectQuestions);
  const currentQuestion = todayQuestions[currentQIndex];
  const totalQuestions = todayQuestions.length;

  const correctRate = dailyStats.answered > 0 ? Math.round((dailyStats.correct / dailyStats.answered) * 100) : 0;
  const favoriteCount = wrongRecords.filter((r) => {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(`exam-fav-${r.question.id}`) === "true";
    }
    return false;
  }).length;

  const resetQuizForSubject = (subject: QuizSubject) => {
    setQuizSubject(subject);
    setCurrentQIndex(0);
    setSelectedAnswer("");
    setShowResult(false);
    setQuizFinished(false);
    setQuizScores([]);
    setFeedback("每天3道精选题目，持续积累必有回报。");
  };

  const handleAnswer = (option: string) => {
    if (showResult || !currentQuestion) return;
    setSelectedAnswer(option);
    setShowResult(true);

    const isCorrect = optionLetter(option) === currentQuestion.answer.toUpperCase();

    const newStats = {
      ...dailyStats,
      answered: dailyStats.answered + 1,
      correct: dailyStats.correct + (isCorrect ? 1 : 0)
    };
    setDailyStats(newStats);
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(EXAM_STATS_KEY, JSON.stringify(newStats));
    }

    const newScores = [...quizScores, { correct: isCorrect, questionId: currentQuestion.id }];
    setQuizScores(newScores);

    if (!isCorrect) {
      const newWrong: WrongRecord = {
        answeredAt: new Date().toISOString(),
        correctAnswer: currentQuestion.answer,
        id: `w${Date.now()}`,
        myAnswer: optionLetter(option),
        question: currentQuestion
      };
      const updated = [newWrong, ...wrongRecords];
      setWrongRecords(updated);
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(EXAM_WRONG_KEY, JSON.stringify(updated));
      }
    }

    setFeedback(isCorrect ? "✓ 回答正确！" : `✗ 正确答案是 ${currentQuestion.answer}`);
  };

  const nextQuestion = () => {
    if (!currentQuestion) return;
    if (currentQIndex + 1 < totalQuestions) {
      setCurrentQIndex((i) => i + 1);
      setSelectedAnswer("");
      setShowResult(false);
      setFeedback("继续加油！");
    } else {
      setQuizFinished(true);
      const score = quizScores.filter((s) => s.correct).length + (
        showResult && optionLetter(selectedAnswer) === currentQuestion.answer.toUpperCase() ? 1 : 0
      );
      setFeedback(`答题完成！正确 ${score}/${totalQuestions} 题。`);
    }
  };

  const restartQuiz = () => {
    setCurrentQIndex(0);
    setSelectedAnswer("");
    setShowResult(false);
    setQuizFinished(false);
    setQuizScores([]);
    setFeedback("每天3道精选题目，持续积累必有回报。");
  };

  const deleteWrong = (id: string) => {
    const updated = wrongRecords.filter((r) => r.id !== id);
    setWrongRecords(updated);
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(EXAM_WRONG_KEY, JSON.stringify(updated));
    }
    setFeedback("错题已删除。");
  };

  const toggleFavorite = (questionId: string) => {
    if (typeof window !== "undefined" && window.localStorage) {
      const key = `exam-fav-${questionId}`;
      const current = window.localStorage.getItem(key) === "true";
      window.localStorage.setItem(key, current ? "false" : "true");
      setFeedback(current ? "已取消收藏。" : "已收藏。");
      setWrongRecords([...wrongRecords]);
    }
  };

  const openArticle = (article: DailyArticle) => {
    const read: DailyArticle = { ...article, readAt: new Date().toISOString() };
    const next = [read, ...readHistory.filter((a) => a.id !== article.id)];
    setReadHistory(next);
    saveReadHistory(next);
    setSelectedArticle(read);
    setFeedback(`正在阅读：${article.title}`);
  };

  const closeArticle = () => {
    setSelectedArticle(null);
  };

  const clearHistory = () => {
    setReadHistory([]);
    saveReadHistory([]);
    setFeedback("浏览记录已清空。");
  };

  const wrongUniqQuestions = useMemo(() => {
    const seen = new Set<string>();
    return wrongRecords.filter((r) => {
      if (seen.has(r.question.id)) return false;
      seen.add(r.question.id);
      return true;
    });
  }, [wrongRecords]);

  const wrongStats = useMemo(() => {
    const bySubject: Record<string, { total: number }> = {};
    for (const r of wrongRecords) {
      const s = r.question.subjectLabel;
      if (!bySubject[s]) bySubject[s] = { total: 0 };
      bySubject[s].total++;
    }
    return Object.entries(bySubject).sort((a, b) => b[1].total - a[1].total);
  }, [wrongRecords]);

  return (
    <View style={styles.stack}>
      <View style={styles.statsRow}>
        <StatBadge label="今日题目" styles={styles} value={String(dailyStats.answered)} />
        <StatBadge label="收藏题" styles={styles} value={String(favoriteCount)} />
        <StatBadge label="正确率" styles={styles} value={`${correctRate}%`} />
      </View>

      <View style={styles.tabs}>
        <TabButton active={activeTab === "quiz"} label="做题" onPress={() => setActiveTab("quiz")} />
        <TabButton active={activeTab === "wrong"} label="错题本" onPress={() => setActiveTab("wrong")} />
        <TabButton active={activeTab === "wrongStats"} label="错题统计" onPress={() => setActiveTab("wrongStats")} />
        <TabButton active={activeTab === "essay"} label="申论阅读" onPress={() => setActiveTab("essay")} />
      </View>

      <Text style={styles.feedback}>{feedback}</Text>

      {activeTab === "quiz" ? (
        <View style={styles.quizContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectTabs}>
            {subjectTabs.map((s) => (
              <Pressable
                key={s.key}
                accessibilityRole="button"
                accessibilityLabel={s.label}
                onPress={() => resetQuizForSubject(s.key)}
                style={[styles.subjectTab, quizSubject === s.key ? styles.subjectTabActive : null]}
              >
                <Text style={[styles.subjectTabText, quizSubject === s.key ? styles.subjectTabTextActive : null]}>{s.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {quizFinished ? (
            <View style={styles.card}>
              <Text style={styles.resultTitle}>答题完成</Text>
              <Text style={styles.resultScore}>
                {quizScores.filter((s) => s.correct).length + (showResult && currentQuestion && optionLetter(selectedAnswer) === currentQuestion.answer.toUpperCase() ? 1 : 0)} / {totalQuestions}
              </Text>
              <Text style={styles.resultHint}>每题答错自动进入错题本，下次再来挑战。</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="重新做题" onPress={restartQuiz} style={styles.primaryButton}>
                <Text style={styles.primaryText}>重新做题</Text>
              </Pressable>
            </View>
          ) : currentQuestion ? (
            <View style={styles.card}>
              <View style={styles.quizHeader}>
                <Text style={styles.quizSubject}>{currentQuestion.subjectLabel}</Text>
                <Text style={styles.quizProgress}>{currentQIndex + 1}/{totalQuestions}</Text>
              </View>
              <Text style={styles.questionText}>{currentQuestion.question}</Text>
              <View style={styles.optionsList}>
                {currentQuestion.options.map((option) => {
                  const isSelected = selectedAnswer === option;
                  const isCorrect = optionLetter(option) === currentQuestion.answer.toUpperCase();
                  let optionStyle = styles.optionBtn;
                  if (showResult) {
                    if (isCorrect) optionStyle = { ...optionStyle, ...styles.optionCorrect };
                    else if (isSelected && !isCorrect) optionStyle = { ...optionStyle, ...styles.optionWrong };
                  } else if (isSelected) {
                    optionStyle = { ...optionStyle, ...styles.optionSelected };
                  }
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      accessibilityLabel={`选项：${option}`}
                      onPress={() => handleAnswer(option)}
                      style={optionStyle}
                    >
                      <Text style={[
                        styles.optionText,
                        showResult && isCorrect ? styles.optionTextCorrect : null,
                        showResult && isSelected && !isCorrect ? styles.optionTextWrong : null,
                        !showResult && isSelected ? styles.optionTextSelected : null
                      ]}>
                        {option}{showResult && isCorrect ? " ✓" : ""}{showResult && isSelected && !isCorrect ? " ✗" : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {showResult ? (
                <>
                  <View style={styles.explanationBox}>
                    <Text style={styles.explanationTitle}>答案解析</Text>
                    <Text style={styles.explanationText}>正确答案：{currentQuestion.answer}</Text>
                    <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel="下一题" onPress={nextQuestion} style={styles.primaryButton}>
                    <Text style={styles.primaryText}>{currentQIndex + 1 < totalQuestions ? "下一题" : "查看结果"}</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>📝</Text>
                <Text style={styles.emptyTitle}>暂无题目</Text>
                <Text style={styles.emptyHint}>该科目题库为空，请先导入题库。</Text>
              </View>
            </View>
          )}

        </View>
      ) : null}

      {activeTab === "wrong" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>错题本 {wrongUniqQuestions.length > 0 ? `(${wrongUniqQuestions.length})` : ""}</Text>
          {wrongUniqQuestions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyTitle}>暂无错题</Text>
              <Text style={styles.emptyHint}>做题时答错的题目会自动收入错题本，方便反复练习。</Text>
            </View>
          ) : (
            wrongUniqQuestions.map((record) => (
              <View key={record.id} style={styles.wrongCard}>
                <Text style={styles.wrongSubject}>{record.question.subjectLabel}</Text>
                <Text style={styles.wrongQuestion}>{record.question.question}</Text>
                <View style={styles.wrongAnswerRow}>
                  <Text style={styles.wrongMy}>你的答案：{record.myAnswer}</Text>
                  <Text style={styles.wrongCorrect}>正确答案：{record.correctAnswer}</Text>
                </View>
                <Text style={styles.explanationText}>{record.question.explanation}</Text>
                <View style={styles.wrongActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel="收藏此题" onPress={() => toggleFavorite(record.question.id)} style={styles.tagButton}>
                    <Text style={styles.tagText}>{typeof window !== "undefined" && window.localStorage?.getItem(`exam-fav-${record.question.id}`) === "true" ? "★ 已收藏" : "☆ 收藏"}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="删除此题" onPress={() => deleteWrong(record.id)} style={styles.tagButton}>
                    <Text style={styles.tagText}>删除</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      ) : null}

      {activeTab === "wrongStats" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>错题统计</Text>
          {wrongStats.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyTitle}>暂无错题数据</Text>
              <Text style={styles.emptyHint}>完成一些题目后，这里会显示各科目的错题分布。</Text>
            </View>
          ) : (
            <View style={styles.statsList}>
              {wrongStats.map(([subject, data]) => {
                const maxCount = Math.max(...wrongStats.map(([, d]) => d.total), 1);
                const barWidth = Math.round((data.total / maxCount) * 100);
                return (
                  <View key={subject} style={styles.statRow}>
                    <Text style={styles.statSubject}>{subject}</Text>
                    <View style={styles.statTrack}>
                      <View style={[styles.statBar, { width: `${barWidth}%` }]} />
                    </View>
                    <Text style={styles.statCount}>{data.total} 题</Text>
                  </View>
                );
              })}
              <View style={styles.statSummary}>
                <Text style={styles.statSummaryText}>错题总计：{wrongRecords.length} 条</Text>
                <Text style={styles.statSummaryText}>涉及科目：{wrongStats.length} 个</Text>
              </View>
            </View>
          )}
        </View>
      ) : null}

      {activeTab === "essay" ? (
        <View style={styles.card}>
          {selectedArticle ? (
            <View style={styles.articleDetail}>
              <View style={styles.articleDetailHeader}>
                <Pressable accessibilityRole="button" accessibilityLabel="返回列表" onPress={closeArticle} style={styles.backButton}>
                  <Text style={styles.backButtonText}>← 返回</Text>
                </Pressable>
                <View style={styles.articleDetailMeta}>
                  <Text style={styles.articleSource}>{selectedArticle.source}</Text>
                  <Text style={styles.articleCategory}>{selectedArticle.category}</Text>
                </View>
                <View style={styles.backButton} />
              </View>
              <Text style={styles.articleDetailTitle}>{selectedArticle.title}</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={styles.articleDetailScroll}>
                <Text style={styles.articleDetailContent}>{selectedArticle.content}</Text>
              </ScrollView>
            </View>
          ) : (
            <>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>申论阅读</Text>
                <Text style={styles.essaySubtitle}>每天精选时政文章，积累申论素材</Text>
              </View>
              <View style={styles.essaySubTabs}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="为你推荐"
                  onPress={() => setEssaySubTab("recommend")}
                  style={[styles.essaySubTab, essaySubTab === "recommend" ? styles.essaySubTabActive : null]}
                >
                  <Text style={[styles.essaySubTabText, essaySubTab === "recommend" ? styles.essaySubTabTextActive : null]}>为你推荐</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="浏览记录"
                  onPress={() => setEssaySubTab("history")}
                  style={[styles.essaySubTab, essaySubTab === "history" ? styles.essaySubTabActive : null]}
                >
                  <Text style={[styles.essaySubTabText, essaySubTab === "history" ? styles.essaySubTabTextActive : null]}>
                    浏览记录{readHistory.length > 0 ? ` (${readHistory.length})` : ""}
                  </Text>
                </Pressable>
              </View>

              {essaySubTab === "recommend" ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.articleScroll} contentContainerStyle={styles.articleList}>
                  {dailyArticles.map((article) => (
                    <Pressable key={article.id} accessibilityRole="button" accessibilityLabel={`阅读：${article.title}`} onPress={() => openArticle(article)} style={styles.articleCard}>
                      <View style={styles.articleHeader}>
                        <Text style={styles.articleSource}>{article.source}</Text>
                        <Text style={styles.articleCategory}>{article.category}</Text>
                      </View>
                      <Text style={styles.articleTitle}>{article.title}</Text>
                      <Text style={styles.articleExcerpt} numberOfLines={5}>{article.excerpt}</Text>
                      <Text style={styles.articleReadMore}>阅读全文 →</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.historyList}>
                  {readHistory.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyIcon}>📖</Text>
                      <Text style={styles.emptyTitle}>暂无浏览记录</Text>
                      <Text style={styles.emptyHint}>阅读推荐文章后会自动记录在这里。</Text>
                    </View>
                  ) : (
                    <>
                      <Pressable accessibilityRole="button" accessibilityLabel="清空浏览记录" onPress={clearHistory} style={styles.clearHistoryButton}>
                        <Text style={styles.clearHistoryText}>清空记录</Text>
                      </Pressable>
                      {readHistory.map((article) => (
                        <Pressable key={`${article.id}-${article.readAt}`} accessibilityRole="button" accessibilityLabel={`继续阅读：${article.title}`} onPress={() => setSelectedArticle(article)} style={styles.historyRow}>
                          <View style={styles.historyRowHeader}>
                            <Text style={styles.historySource}>{article.source}</Text>
                            <Text style={styles.historyTime}>{article.readAt ? article.readAt.slice(0, 10) : ""}</Text>
                          </View>
                          <Text style={styles.historyTitle}>{article.title}</Text>
                          <Text style={styles.historyExcerpt} numberOfLines={2}>{article.excerpt}</Text>
                        </Pressable>
                      ))}
                    </>
                  )}
                </View>
              )}
            </>
          )}
          <View style={styles.sourceNote}>
            <Text style={styles.sourceNoteText}>申论素材来自人民日报、半月谈、光明日报等权威媒体。</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={tabStyles.tab}>
      <Text style={[tabStyles.tabText, active ? tabStyles.tabTextActive : null]}>{label}</Text>
      {active ? <View style={tabStyles.tabIndicator} /> : null}
    </Pressable>
  );
}

const tabStyles = StyleSheet.create({
  tab: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    gap: 6,
    paddingVertical: 12
  },
  tabIndicator: {
    backgroundColor: "#7cb87c",
    borderRadius: 999,
    height: 3,
    width: 20
  },
  tabText: {
    color: "#6b7c6b",
    fontSize: 15,
    fontWeight: "800"
  },
  tabTextActive: {
    color: "#7cb87c"
  }
});

function StatBadge({ label, styles, value }: { label: string; styles: ReturnType<typeof createStyles>; value: string }) {
  return (
    <View style={styles.statBadge}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    articleCard: {
      backgroundColor: "#ffffff",
      borderRadius: 18,
      gap: 10,
      padding: 16,
      width: 280,
      shadowColor: "#7cb87c",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 1
    },
    articleCategory: {
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "900",
      paddingHorizontal: 10,
      paddingVertical: 4
    },
    articleExcerpt: {
      color: "#7a8f7a",
      fontSize: 14,
      lineHeight: 22
    },
    articleHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10
    },
    articleList: {
      gap: 12
    },
    articleReadMore: {
      color: tokens.accent,
      fontSize: 14,
      fontWeight: "800"
    },
    articleScroll: {
      marginBottom: 6
    },
    articleSource: {
      color: "#1f2937",
      fontSize: 14,
      fontWeight: "900"
    },
    articleTitle: {
      color: "#1f2937",
      fontSize: 17,
      fontWeight: "900",
      lineHeight: 24
    },
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
    emptyBox: {
      alignItems: "center",
      gap: 8,
      minHeight: 160,
      justifyContent: "center"
    },
    emptyHint: {
      color: tokens.textMuted,
      fontSize: 14,
      textAlign: "center"
    },
    emptyIcon: {
      fontSize: 36
    },
    emptyTitle: {
      color: tokens.text,
      fontSize: 18,
      fontWeight: "900"
    },
    essaySubtitle: {
      color: tokens.textMuted,
      fontSize: 14,
      marginTop: -8
    },
    explanationBox: {
      backgroundColor: "#e2f2e2",
      borderRadius: 16,
      gap: 8,
      padding: 14
    },
    explanationText: {
      color: "#4a6b4a",
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 22
    },
    explanationTitle: {
      color: "#3a5a3a",
      fontSize: 15,
      fontWeight: "900"
    },
    feedback: {
      color: "#6b7c6b",
      fontSize: 14,
      fontWeight: "800"
    },
    optionBtn: {
      backgroundColor: "#f6faf6",
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    optionCorrect: {
      backgroundColor: "#dcfce7"
    },
    optionSelected: {
      backgroundColor: "#e2f2e2"
    },
    optionText: {
      color: "#1f2937",
      fontSize: 16,
      fontWeight: "700",
      lineHeight: 22
    },
    optionTextCorrect: {
      color: "#5a8f5a"
    },
    optionTextSelected: {
      color: "#5a8f5a"
    },
    optionTextWrong: {
      color: "#d85a5a"
    },
    optionWrong: {
      backgroundColor: "#fee2e2"
    },
    optionsList: {
      gap: 10
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: "#7cb87c",
      borderRadius: 14,
      paddingVertical: 14
    },
    primaryText: {
      color: "#ffffff",
      fontSize: 17,
      fontWeight: "900"
    },
    questionText: {
      color: "#1f2937",
      fontSize: 17,
      fontWeight: "600",
      lineHeight: 26
    },
    quizContainer: {
      gap: 14
    },
    quizHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    quizProgress: {
      color: "#6b7c6b",
      fontSize: 15,
      fontWeight: "800"
    },
    quizSubject: {
      backgroundColor: "#e2f2e2",
      borderRadius: 999,
      color: "#5a8f5a",
      fontSize: 13,
      fontWeight: "900",
      overflow: "hidden",
      paddingHorizontal: 12,
      paddingVertical: 6
    },
    resultHint: {
      color: "#6b7c6b",
      fontSize: 14,
      textAlign: "center"
    },
    resultScore: {
      color: tokens.accent,
      fontSize: 42,
      fontWeight: "900",
      textAlign: "center"
    },
    resultTitle: {
      color: "#1f2937",
      fontSize: 24,
      fontWeight: "900",
      textAlign: "center"
    },
    secondaryButton: {
      alignItems: "center",
      backgroundColor: "#f6faf6",
      borderRadius: 14,
      paddingVertical: 12
    },
    secondaryText: {
      color: "#1f2937",
      fontSize: 15,
      fontWeight: "900"
    },
    sectionTitle: {
      color: "#1f2937",
      fontSize: 20,
      fontWeight: "900"
    },
    sourceNote: {
      backgroundColor: "#f1f5f1",
      borderRadius: 12,
      marginTop: 4,
      padding: 12
    },
    sourceNoteText: {
      color: "#7a8f7a",
      fontSize: 12,
      lineHeight: 18
    },
    stack: {
      gap: 14
    },
    statBadge: {
      backgroundColor: "#ffffff",
      borderRadius: 18,
      flex: 1,
      padding: 14,
      shadowColor: "#7cb87c",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 1
    },
    statBar: {
      backgroundColor: "#7cb87c",
      borderRadius: 999,
      height: "100%"
    },
    statCount: {
      color: "#6b7c6b",
      fontSize: 14,
      fontWeight: "800",
      textAlign: "right",
      width: 48
    },
    statLabel: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "700"
    },
    statRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12
    },
    statsList: {
      gap: 14
    },
    statSubject: {
      color: "#1f2937",
      fontSize: 15,
      fontWeight: "800",
      width: 80
    },
    statSummary: {
      backgroundColor: "#f1f5f1",
      borderRadius: 12,
      flexDirection: "row",
      gap: 16,
      padding: 12
    },
    statSummaryText: {
      color: "#6b7c6b",
      fontSize: 14,
      fontWeight: "800"
    },
    statsRow: {
      flexDirection: "row",
      gap: 10
    },
    statTrack: {
      backgroundColor: "#e8f2e8",
      borderRadius: 999,
      flex: 1,
      height: 10,
      overflow: "hidden"
    },
    statValue: {
      color: "#1f2937",
      fontSize: 22,
      fontWeight: "900",
      marginTop: 4
    },
    subjectTab: {
      backgroundColor: "#f1f5f1",
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10
    },
    subjectTabActive: {
      backgroundColor: "#7cb87c"
    },
    subjectTabText: {
      color: "#6b7c6b",
      fontSize: 14,
      fontWeight: "900"
    },
    subjectTabTextActive: {
      color: "#ffffff"
    },
    subjectTabs: {
      gap: 10,
      paddingBottom: 2
    },
    tabs: {
      backgroundColor: "#ffffff",
      borderRadius: 18,
      flexDirection: "row",
      gap: 2,
      padding: 6,
      shadowColor: "#7cb87c",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 1
    },
    tagButton: {
      backgroundColor: "#f1f5f1",
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    tagText: {
      color: "#6b7c6b",
      fontSize: 12,
      fontWeight: "800"
    },
    wrongActions: {
      flexDirection: "row",
      gap: 8
    },
    wrongAnswerRow: {
      flexDirection: "row",
      gap: 16
    },
    wrongCard: {
      backgroundColor: "#f6faf6",
      borderRadius: 16,
      gap: 8,
      padding: 14
    },
    wrongCorrect: {
      color: "#5a8f5a",
      fontSize: 13,
      fontWeight: "800"
    },
    wrongMy: {
      color: "#d85a5a",
      fontSize: 13,
      fontWeight: "800"
    },
    wrongQuestion: {
      color: "#1f2937",
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 22
    },
    wrongSubject: {
      alignSelf: "flex-start",
      backgroundColor: "#fde8e8",
      borderRadius: 8,
      color: "#e57373",
      fontSize: 12,
      fontWeight: "900",
      overflow: "hidden",
      paddingHorizontal: 10,
      paddingVertical: 4
    },
    articleDetail: {
      gap: 12
    },
    articleDetailHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    backButton: {
      minWidth: 60
    },
    backButtonText: {
      color: "#7cb87c",
      fontSize: 15,
      fontWeight: "900"
    },
    articleDetailMeta: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10
    },
    articleDetailTitle: {
      color: "#1f2937",
      fontSize: 20,
      fontWeight: "900",
      lineHeight: 28
    },
    articleDetailScroll: {
      maxHeight: 360
    },
    articleDetailContent: {
      color: "#4b5d4b",
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 26
    },
    sectionTitleRow: {
      gap: 4
    },
    essaySubTabs: {
      flexDirection: "row",
      gap: 10
    },
    essaySubTab: {
      alignItems: "center",
      backgroundColor: "#f1f5f1",
      borderRadius: 999,
      flex: 1,
      paddingVertical: 12
    },
    essaySubTabActive: {
      backgroundColor: "#7cb87c"
    },
    essaySubTabText: {
      color: "#6b7c6b",
      fontSize: 14,
      fontWeight: "900"
    },
    essaySubTabTextActive: {
      color: "#ffffff"
    },
    historyList: {
      gap: 10
    },
    historyRow: {
      backgroundColor: "#f6faf6",
      borderRadius: 16,
      gap: 6,
      padding: 14
    },
    historyRowHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    historySource: {
      color: "#1f2937",
      fontSize: 13,
      fontWeight: "900"
    },
    historyTime: {
      color: "#8a9f8a",
      fontSize: 12,
      fontWeight: "800"
    },
    historyTitle: {
      color: "#1f2937",
      fontSize: 16,
      fontWeight: "900"
    },
    historyExcerpt: {
      color: "#6b7c6b",
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 20
    },
    clearHistoryButton: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: "#fde8e8",
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 7
    },
    clearHistoryText: {
      color: "#e57373",
      fontSize: 13,
      fontWeight: "900"
    }
  });
}
