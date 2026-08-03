import { parseQuickCaptureText } from "@/features/quick-capture/quickCapture";

describe("quick capture parser", () => {
  const now = new Date("2026-08-03T09:00:00+08:00");

  it("suggests an expense from a short spending sentence", () => {
    const draft = parseQuickCaptureText("午饭花了25元", now);

    expect(draft.kind).toBe("expense");
    expect(draft.transactionType).toBe("expense");
    expect(draft.amount).toBe("25.00");
    expect(draft.categoryName).toBe("餐饮");
  });

  it("suggests a todo with relative date and time", () => {
    const draft = parseQuickCaptureText("明天下午三点提醒我去取快递", now);

    expect(draft.kind).toBe("package");
    expect(draft.date).toBe("2026-08-04");
    expect(draft.time).toBe("15:00");
  });

  it("extracts package code and company when express words are present", () => {
    const draft = parseQuickCaptureText("韵达快递取件码 0729-207 在菜鸟驿站", now);

    expect(draft.kind).toBe("package");
    expect(draft.packageCompany).toBe("韵达快递");
    expect(draft.pickupCode).toBe("0729-207");
    expect(draft.pickupLocation).toContain("菜鸟驿站");
  });
});
