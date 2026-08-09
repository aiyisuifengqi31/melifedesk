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

  it("after A rebinds B->C, C sees & co-edits A's AB-era diary while B loses all access and B's own diary stays private", () => {
    const harness = createLovePolicyHarness(["A", "B", "C"]);
    harness.bindCouple("A", "B");
    const aDiary = harness.createRecord("diary", "A", "couple_edit");
    const bDiary = harness.createRecord("diary", "B", "couple_edit");

    // During A-B: mutual visibility & co-edit.
    expect(harness.canRead("B", aDiary.id)).toBe(true);
    expect(harness.canEdit("B", aDiary.id)).toBe(true);
    expect(harness.canRead("A", bDiary.id)).toBe(true);

    // Unbind: access revoked for both, data untouched.
    harness.unbindCouple("A");
    expect(harness.canRead("B", aDiary.id)).toBe(false);
    expect(harness.canRead("A", bDiary.id)).toBe(false);

    // Rebind A-C: C (current active partner of A) inherits A's history.
    harness.bindCouple("A", "C");
    expect(harness.canRead("C", aDiary.id)).toBe(true);
    expect(harness.canEdit("C", aDiary.id)).toBe(true);
    // Old partner B can no longer access A's content.
    expect(harness.canRead("B", aDiary.id)).toBe(false);
    // B's own diary stays with B — invisible to A and C.
    expect(harness.canRead("A", bDiary.id)).toBe(false);
    expect(harness.canRead("C", bDiary.id)).toBe(false);
    expect(harness.canEdit("C", bDiary.id)).toBe(false);
  });
});
