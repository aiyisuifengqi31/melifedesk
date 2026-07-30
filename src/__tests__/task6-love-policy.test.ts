import { createLovePolicyHarness } from "@/features/love/lovePolicyHarness";

describe("Task 6 love diary permissions", () => {
  it("protects private mood and shared diary records", () => {
    const harness = createLovePolicyHarness(["A", "B", "C"]);
    const privateMood = harness.createRecord("mood", "A", "private");

    expect(harness.canRead("A", privateMood.id)).toBe(true);
    expect(harness.canRead("B", privateMood.id)).toBe(false);

    harness.bindCouple("A", "B");
    const readDiary = harness.createRecord("diary", "A", "couple_read");
    const editDiary = harness.createRecord("diary", "A", "couple_edit");

    expect(harness.canRead("B", readDiary.id)).toBe(true);
    expect(harness.canEdit("B", readDiary.id)).toBe(false);
    expect(harness.canEdit("B", editDiary.id)).toBe(true);
    expect(harness.canRead("C", readDiary.id)).toBe(false);

    harness.unbindCouple("A");
    expect(harness.canRead("B", readDiary.id)).toBe(false);
  });

  it("makes diary images follow diary entry permissions", () => {
    const harness = createLovePolicyHarness(["A", "B"]);
    harness.bindCouple("A", "B");
    const diary = harness.createRecord("diary", "A", "couple_read");
    const image = harness.createDiaryImage(diary.id);

    expect(harness.canReadImage("B", image.id)).toBe(true);
    expect(harness.canEditImage("B", image.id)).toBe(false);
  });

  it("keeps menstrual cycles private unless explicitly shared as read-only", () => {
    const harness = createLovePolicyHarness(["A", "B"]);
    harness.bindCouple("A", "B");
    const cycle = harness.createCycle("A");

    expect(harness.canReadCycle("A", cycle.id)).toBe(true);
    expect(harness.canReadCycle("B", cycle.id)).toBe(false);
    expect(harness.canEditCycle("B", cycle.id)).toBe(false);

    harness.setCycleSharing(cycle.id, true);
    expect(harness.canReadCycle("B", cycle.id)).toBe(true);
    expect(harness.canEditCycle("B", cycle.id)).toBe(false);

    harness.setCycleSharing(cycle.id, false);
    expect(harness.canReadCycle("B", cycle.id)).toBe(false);

    harness.setCycleSharing(cycle.id, true);
    harness.unbindCouple("A");
    expect(harness.canReadCycle("B", cycle.id)).toBe(false);
  });
});
