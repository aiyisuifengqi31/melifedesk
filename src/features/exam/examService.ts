export type ExamSubject = "xingce" | "shenlun" | "common";
export type ReviewStatus = "draft" | "approved" | "needs_review" | "rejected";

export type QuestionVersionSeed = {
  examScope: string;
  id: string;
  questionId: string;
  regionCode: string;
  reviewStatus: ReviewStatus;
  subject: ExamSubject;
  wrongCount?: number;
};

export type DailyAssignmentItemPlan = {
  position: number;
  questionVersionId: string;
  selectionReason: string;
  subject: ExamSubject;
};

export type SourceAttributionInput = {
  answerHash?: string | null;
  contentHash: string;
  questionId: string;
  sourceId: string;
};

export function normalizeRegionCode(regionCode?: string | null) {
  const normalized = regionCode?.trim().toUpperCase();
  return normalized || "NATIONAL";
}

export function buildDailyAssignmentItems(input: {
  examScope: string;
  limit: number;
  questionVersions: QuestionVersionSeed[];
  regionCode: string;
}): DailyAssignmentItemPlan[] {
  const regionCode = normalizeRegionCode(input.regionCode);

  return input.questionVersions
    .filter((version) => version.reviewStatus === "approved")
    .filter((version) => version.examScope === input.examScope)
    .filter((version) => version.regionCode === "NATIONAL" || version.regionCode === regionCode)
    .sort((left, right) => (right.wrongCount ?? 0) - (left.wrongCount ?? 0) || left.id.localeCompare(right.id))
    .slice(0, input.limit)
    .map((version, index) => ({
      position: index + 1,
      questionVersionId: version.id,
      selectionReason: (version.wrongCount ?? 0) > 0 ? "wrong_question_priority" : "approved_rotation",
      subject: version.subject
    }));
}

export function detectAnswerConflict(attributions: SourceAttributionInput[]) {
  const hashesByQuestion = new Map<string, Set<string>>();

  for (const attribution of attributions) {
    if (!attribution.answerHash) {
      continue;
    }
    const hashes = hashesByQuestion.get(attribution.questionId) ?? new Set<string>();
    hashes.add(attribution.answerHash);
    hashesByQuestion.set(attribution.questionId, hashes);
  }

  return Array.from(hashesByQuestion.entries())
    .filter(([, hashes]) => hashes.size > 1)
    .map(([questionId]) => ({ questionId, reason: "answer_or_explanation_conflict", reviewStatus: "needs_review" as const }));
}

export function buildExamDashboard(input: {
  attempts: Array<{ isCorrect: boolean | null; subject: ExamSubject }>;
  favoritesCount: number;
  todayItemsCount: number;
}) {
  const answered = input.attempts.length;
  const correct = input.attempts.filter((attempt) => attempt.isCorrect === true).length;
  const accuracy = answered === 0 ? 0 : Math.round((correct / answered) * 1000) / 10;
  const wrongBySubject = input.attempts.reduce<Record<ExamSubject, number>>(
    (acc, attempt) => {
      if (attempt.isCorrect === false) {
        acc[attempt.subject] += 1;
      }
      return acc;
    },
    { common: 0, shenlun: 0, xingce: 0 }
  );

  return {
    accuracy,
    answered,
    favoritesCount: input.favoritesCount,
    todayItemsCount: input.todayItemsCount,
    wrongBySubject
  };
}

export function createEssayDraft(input: { promptId: string; text?: string }) {
  return {
    autoScoreDisclaimer: "申论本阶段只保存草稿、参考要点和人工反馈，不宣称自动评分准确。",
    draftText: input.text ?? "",
    promptId: input.promptId
  };
}
