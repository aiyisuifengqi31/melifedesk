import { createExamCommonPolicyHarness } from "@/domain/examCommonPolicyHarness";
import { assertRecycleBinDoesNotCopySensitiveBody, buildExportManifest, buildRecycleBinItems, buildReminderSummary, searchVisibleRecords } from "@/features/common/commonService";
import { buildDailyAssignmentItems, buildExamDashboard, createEssayDraft, detectAnswerConflict, normalizeRegionCode } from "@/features/exam/examService";
import { assertPreviewEnvironment, buildReleaseReadiness, scanClientBundleForSecrets } from "@/features/release/releaseChecklist";

describe("Task 8 exam service", () => {
  it("normalizes empty region to NATIONAL and builds positioned daily assignment items", () => {
    expect(normalizeRegionCode("")).toBe("NATIONAL");

    expect(
      buildDailyAssignmentItems({
        examScope: "civil_service",
        limit: 2,
        regionCode: "CN-HE",
        questionVersions: [
          { examScope: "civil_service", id: "qv-1", questionId: "q-1", regionCode: "CN-BJ", reviewStatus: "approved", subject: "xingce", wrongCount: 9 },
          { examScope: "civil_service", id: "qv-2", questionId: "q-2", regionCode: "CN-HE", reviewStatus: "approved", subject: "xingce", wrongCount: 4 },
          { examScope: "civil_service", id: "qv-3", questionId: "q-3", regionCode: "NATIONAL", reviewStatus: "approved", subject: "shenlun" },
          { examScope: "civil_service", id: "qv-4", questionId: "q-4", regionCode: "CN-HE", reviewStatus: "needs_review", subject: "common" }
        ]
      })
    ).toEqual([
      { position: 1, questionVersionId: "qv-2", selectionReason: "wrong_question_priority", subject: "xingce" },
      { position: 2, questionVersionId: "qv-3", selectionReason: "approved_rotation", subject: "shenlun" }
    ]);
  });

  it("marks answer conflicts as needs_review instead of overwriting", () => {
    expect(
      detectAnswerConflict([
        { answerHash: "a", contentHash: "stem", questionId: "q1", sourceId: "official" },
        { answerHash: "b", contentHash: "stem", questionId: "q1", sourceId: "recall" },
        { answerHash: "c", contentHash: "other", questionId: "q2", sourceId: "mock" }
      ])
    ).toEqual([{ questionId: "q1", reason: "answer_or_explanation_conflict", reviewStatus: "needs_review" }]);
  });

  it("summarizes exam attempts and keeps essay scoring disclaimer", () => {
    expect(buildExamDashboard({ attempts: [{ isCorrect: true, subject: "xingce" }, { isCorrect: false, subject: "shenlun" }], favoritesCount: 3, todayItemsCount: 10 })).toEqual({
      accuracy: 50,
      answered: 2,
      favoritesCount: 3,
      todayItemsCount: 10,
      wrongBySubject: { common: 0, shenlun: 1, xingce: 0 }
    });
    expect(createEssayDraft({ promptId: "essay-1" }).autoScoreDisclaimer).toContain("不宣称自动评分准确");
  });
});

describe("Task 9 common policy", () => {
  it("keeps personal exam records private to their owner", () => {
    const harness = createExamCommonPolicyHarness(["A", "B"]);
    const assignment = harness.createOwnerRecord("daily_assignment", "A");
    const attempt = harness.createOwnerRecord("question_attempt", "A");

    expect(harness.canReadOwnerRecord("A", assignment.id)).toBe(true);
    expect(harness.canReadOwnerRecord("B", assignment.id)).toBe(false);
    expect(harness.canReadOwnerRecord("B", attempt.id)).toBe(false);
  });

  it("applies active-couple visibility to search and recycle access", () => {
    const harness = createExamCommonPolicyHarness(["A", "B", "C"]);
    harness.bindCouple("A", "B");
    const searchRecord = harness.createSharedRecord("search_index", "A", "couple_read");
    const recycleRecord = harness.createSharedRecord("recycle_item", "A", "couple_edit", "2026-07-30T00:00:00.000Z");

    expect(harness.canSearch("B", searchRecord.id)).toBe(true);
    expect(harness.canSearch("C", searchRecord.id)).toBe(false);
    expect(harness.canReadRecycleItem("B", recycleRecord.id)).toBe(true);

    harness.unbindCouple("A");

    expect(harness.canSearch("B", searchRecord.id)).toBe(false);
    expect(harness.canReadRecycleItem("B", recycleRecord.id)).toBe(false);
  });

  it("does not copy sensitive body text into recycle bin data", () => {
    const item = { deletedAt: "2026-07-30", moduleKey: "love_diary_entries", recordId: "r1", title: "日记" };

    expect(buildRecycleBinItems([item, { ...item, deletedAt: null, recordId: "r2" }])).toEqual([item]);
    expect(() => assertRecycleBinDoesNotCopySensitiveBody([{ ...item, hasSensitiveBody: true }])).toThrow("must not copy sensitive body text");
  });

  it("filters deleted records from search and builds reminder/export plans", () => {
    expect(
      searchVisibleRecords({
        query: "budget",
        records: [
          { deletedAt: null, moduleKey: "finance", recordId: "r1", snippet: "monthly budget", title: "Finance" },
          { deletedAt: "2026-07-30", moduleKey: "finance", recordId: "r2", snippet: "budget", title: "Deleted" }
        ]
      })
    ).toHaveLength(1);
    expect(buildReminderSummary({ eveningReviewEnabled: true, pendingReturnGiftCount: 2, weeklyReportEnabled: false }).reminderCount).toBe(2);
    expect(buildExportManifest({ format: "json", moduleKeys: ["tasks", "tasks", "finance"], ownerUserId: "A" }).moduleKeys).toEqual(["finance", "tasks"]);
  });
});

describe("Task 10 release checks", () => {
  it("blocks production preview shortcuts and scans bundle text for secrets", () => {
    const serviceRole = ["SERVICE", "ROLE"].join("_");
    const publicServiceRole = ["EXPO_PUBLIC_SUPABASE", serviceRole, "KEY"].join("_");

    expect(assertPreviewEnvironment({ environment: "staging", releaseChannel: "preview" })).toBe(true);
    expect(() => assertPreviewEnvironment({ environment: "production", releaseChannel: "preview" })).toThrow("must not publish production");
    expect(scanClientBundleForSecrets(`const key = '${publicServiceRole}'`)).toEqual([serviceRole, publicServiceRole]);
  });

  it("checks fixed app identifiers and keeps production publish disabled", () => {
    expect(
      buildReleaseReadiness({
        androidPackage: "com.fanfan.guanguan",
        bundleIdentifier: "com.fanfan.guanguan",
        hasBackupPlan: true,
        hasRollbackPlan: true,
        webTitle: "帆帆和关关"
      })
    ).toEqual({
      androidPackageLocked: true,
      bundleIdentifierLocked: true,
      canCreatePreviewBuild: true,
      productionPublishAllowed: false
    });
  });
});
