export type RecycleBinItem = {
  deletedAt: string | null;
  hasSensitiveBody?: boolean;
  moduleKey: string;
  recordId: string;
  title: string;
};

export type SearchRecord = {
  deletedAt: string | null;
  moduleKey: string;
  recordId: string;
  snippet: string;
  title: string;
};

export function buildRecycleBinItems(items: RecycleBinItem[]) {
  return items
    .filter((item) => item.deletedAt)
    .map((item) => ({
      deletedAt: item.deletedAt,
      moduleKey: item.moduleKey,
      recordId: item.recordId,
      title: item.title
    }));
}

export function assertRecycleBinDoesNotCopySensitiveBody(items: RecycleBinItem[]) {
  if (items.some((item) => item.hasSensitiveBody)) {
    throw new Error("Recycle bin must use original tables and must not copy sensitive body text");
  }
}

export function searchVisibleRecords(input: { query: string; records: SearchRecord[] }) {
  const query = input.query.trim().toLowerCase();
  if (!query) {
    return [];
  }

  return input.records.filter((record) => {
    if (record.deletedAt) {
      return false;
    }
    return `${record.title} ${record.snippet}`.toLowerCase().includes(query);
  });
}

export function buildReminderSummary(input: {
  eveningReviewEnabled: boolean;
  pendingReturnGiftCount: number;
  weeklyReportEnabled: boolean;
}) {
  return {
    hasEveningReview: input.eveningReviewEnabled,
    hasGiftReturnReminder: input.pendingReturnGiftCount > 0,
    hasWeeklyReport: input.weeklyReportEnabled,
    reminderCount: [input.eveningReviewEnabled, input.weeklyReportEnabled, input.pendingReturnGiftCount > 0].filter(Boolean).length
  };
}

export function buildExportManifest(input: { format: "csv" | "json" | "pdf"; moduleKeys: string[]; ownerUserId: string }) {
  return {
    format: input.format,
    moduleKeys: [...new Set(input.moduleKeys)].sort(),
    ownerUserId: input.ownerUserId,
    status: "queued" as const
  };
}
