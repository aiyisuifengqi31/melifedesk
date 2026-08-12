import {
  daysUntil,
  DEFAULT_REMINDER_DAYS,
  expiryStatus,
  expiringSoonCount,
  filterExpiry,
  sortExpiryByUrgency,
  type ExpiryItem
} from "@/features/expiry/expiryUtils";

const TODAY = "2026-08-12";

function mk(id: string, expiryDate: string): ExpiryItem {
  return {
    category: "other",
    createdAt: "",
    expiryDate,
    id,
    reminderDays: DEFAULT_REMINDER_DAYS,
    title: id,
    updatedAt: ""
  };
}

describe("daysUntil", () => {
  it("computes remaining days including zero and negative", () => {
    expect(daysUntil("2026-09-09", TODAY)).toBe(28);
    expect(daysUntil("2026-08-17", TODAY)).toBe(5);
    expect(daysUntil("2026-08-12", TODAY)).toBe(0);
    expect(daysUntil("2026-08-10", TODAY)).toBe(-2);
  });
});

describe("expiryStatus", () => {
  it("labels by urgency level (spec 四)", () => {
    expect(expiryStatus(186).label).toBe("还有 186 天");
    expect(expiryStatus(186).level).toBe("normal");
    expect(expiryStatus(65).level).toBe("near");
    expect(expiryStatus(28).level).toBe("soon");
    expect(expiryStatus(5).level).toBe("urgent");
    expect(expiryStatus(0).label).toBe("今天到期");
    expect(expiryStatus(0).level).toBe("today");
    expect(expiryStatus(-3).label).toBe("已过期 3 天");
    expect(expiryStatus(-3).level).toBe("expired");
  });
});

describe("sortExpiryByUrgency", () => {
  it("puts most urgent (expired/today) first, then nearest (spec 十二)", () => {
    const items = [mk("idcard", "2027-02-14"), mk("license", "2026-09-09"), mk("vip", "2026-08-17"), mk("old", "2026-08-10")];
    expect(sortExpiryByUrgency(items, TODAY).map((i) => i.id)).toEqual(["old", "vip", "license", "idcard"]);
  });
});

describe("filterExpiry", () => {
  it("filters soon (0~30) and expired", () => {
    const items = [mk("idcard", "2027-02-14"), mk("license", "2026-09-09"), mk("vip", "2026-08-17"), mk("old", "2026-08-10")];
    expect(filterExpiry(items, "expired", TODAY).map((i) => i.id)).toEqual(["old"]);
    expect(filterExpiry(items, "soon", TODAY).map((i) => i.id).sort()).toEqual(["license", "vip"]);
    expect(filterExpiry(items, "all", TODAY)).toHaveLength(4);
  });
});

describe("expiringSoonCount", () => {
  it("counts expired or <=7 days for the homepage badge (spec 十五)", () => {
    const items = [mk("a", "2027-02-14"), mk("b", "2026-08-17"), mk("c", "2026-08-10")];
    expect(expiringSoonCount(items, TODAY)).toBe(2);
  });
});
