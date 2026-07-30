import { createFinanceGiftPolicyHarness } from "@/domain/financeGiftPolicyHarness";

describe("Task 5 finance category permissions", () => {
  it("lets A/B/C read system categories but not modify or delete them", () => {
    const harness = createFinanceGiftPolicyHarness(["A", "B", "C"]);
    const systemCategory = harness.createSystemCategory("份子", "expense");

    expect(harness.canReadCategory("A", systemCategory.id)).toBe(true);
    expect(harness.canReadCategory("B", systemCategory.id)).toBe(true);
    expect(harness.canReadCategory("C", systemCategory.id)).toBe(true);
    expect(harness.canEditCategory("A", systemCategory.id)).toBe(false);
    expect(harness.canSoftDeleteCategory("A", systemCategory.id)).toBe(false);
  });

  it("keeps user categories private to their owner", () => {
    const harness = createFinanceGiftPolicyHarness(["A", "B"]);
    const category = harness.createUserCategory("A", "咖啡", "expense");

    expect(harness.canReadCategory("A", category.id)).toBe(true);
    expect(harness.canEditCategory("A", category.id)).toBe(true);
    expect(harness.canSoftDeleteCategory("A", category.id)).toBe(true);
    expect(harness.canReadCategory("B", category.id)).toBe(false);
    expect(harness.canEditCategory("B", category.id)).toBe(false);
  });
});

describe("Task 5 and Task 7 sharing permissions", () => {
  it("applies private, couple_read, and couple_edit to finance transactions", () => {
    const harness = createFinanceGiftPolicyHarness(["A", "B", "C"]);
    harness.bindCouple("A", "B");
    const privateBill = harness.createRecord("finance_transaction", "A", "private");
    const readBill = harness.createRecord("finance_transaction", "A", "couple_read");
    const editBill = harness.createRecord("finance_transaction", "A", "couple_edit");

    expect(harness.canRead("B", privateBill.id)).toBe(false);
    expect(harness.canRead("B", readBill.id)).toBe(true);
    expect(harness.canEdit("B", readBill.id)).toBe(false);
    expect(harness.canEdit("B", editBill.id)).toBe(true);
    expect(harness.canRead("C", readBill.id)).toBe(false);
  });

  it("applies private, couple_read, and couple_edit to gift records", () => {
    const harness = createFinanceGiftPolicyHarness(["A", "B", "C"]);
    harness.bindCouple("A", "B");
    const readGift = harness.createRecord("gift_record", "A", "couple_read");
    const editGift = harness.createRecord("gift_record", "A", "couple_edit");

    expect(harness.canRead("B", readGift.id)).toBe(true);
    expect(harness.canEdit("B", readGift.id)).toBe(false);
    expect(harness.canEdit("B", editGift.id)).toBe(true);
    expect(harness.canRead("C", readGift.id)).toBe(false);
  });

  it("revokes shared finance and gift access immediately after unbinding", () => {
    const harness = createFinanceGiftPolicyHarness(["A", "B"]);
    harness.bindCouple("A", "B");
    const bill = harness.createRecord("finance_transaction", "A", "couple_read");
    const gift = harness.createRecord("gift_record", "A", "couple_read");

    expect(harness.canRead("B", bill.id)).toBe(true);
    expect(harness.canRead("B", gift.id)).toBe(true);

    harness.unbindCouple("A");

    expect(harness.canRead("B", bill.id)).toBe(false);
    expect(harness.canRead("B", gift.id)).toBe(false);
  });

  it("rejects owner and couple spoofing", () => {
    const harness = createFinanceGiftPolicyHarness(["A", "B", "C"]);
    harness.bindCouple("A", "B");

    expect(() => harness.assertCanInsert("A", { coupleOwnerUserId: "C", ownerUserId: "A", visibility: "couple_read" })).toThrow("Invalid couple");
    expect(() => harness.assertCanInsert("B", { ownerUserId: "A", visibility: "private" })).toThrow("Invalid owner");
  });
});
