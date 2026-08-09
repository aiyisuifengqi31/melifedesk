import { createSharingPolicyHarness } from "@/domain/sharingPolicyHarness";

describe("Task 3 and Task 4 sharing permissions", () => {
  it("applies private, couple_read, and couple_edit permissions", () => {
    const harness = createSharingPolicyHarness(["A", "B", "C"]);
    harness.bindCouple("A", "B");
    const privateTask = harness.createRecord("task", "A", "private");
    const readTask = harness.createRecord("task", "A", "couple_read");
    const editTask = harness.createRecord("task", "A", "couple_edit");

    expect(harness.canRead("B", privateTask.id)).toBe(false);
    expect(harness.canRead("B", readTask.id)).toBe(true);
    expect(harness.canEdit("B", readTask.id)).toBe(false);
    expect(harness.canRead("B", editTask.id)).toBe(true);
    expect(harness.canEdit("B", editTask.id)).toBe(true);
    expect(harness.canRead("C", readTask.id)).toBe(false);
  });

  it("makes subitems, recurrences, workout parts, and workout photos follow parent permissions", () => {
    const harness = createSharingPolicyHarness(["A", "B"]);
    harness.bindCouple("A", "B");
    const task = harness.createRecord("task", "A", "couple_edit");
    const workout = harness.createRecord("workout", "A", "couple_read");

    expect(harness.canReadChild("B", harness.createChild("subitem", task.id).id)).toBe(true);
    expect(harness.canEditChild("B", harness.createChild("recurrence", task.id).id)).toBe(true);
    expect(harness.canReadChild("B", harness.createChild("workout_part", workout.id).id)).toBe(true);
    expect(harness.canEditChild("B", harness.createChild("workout_photo", workout.id).id)).toBe(false);
  });

  it("revokes shared task and workout photo access immediately after unbinding", () => {
    const harness = createSharingPolicyHarness(["A", "B"]);
    harness.bindCouple("A", "B");
    const task = harness.createRecord("task", "A", "couple_read");
    const workout = harness.createRecord("workout", "A", "couple_read");
    const photo = harness.createChild("workout_photo", workout.id);

    expect(harness.canRead("B", task.id)).toBe(true);
    expect(harness.canReadChild("B", photo.id)).toBe(true);

    harness.unbindCouple("A");

    expect(harness.canRead("B", task.id)).toBe(false);
    expect(harness.canReadChild("B", photo.id)).toBe(false);
  });

  it("lets the active partner READ a workout but never edit it, and loses access after rebinding", () => {
    const harness = createSharingPolicyHarness(["A", "B", "C"]);
    harness.bindCouple("A", "B");
    const aWorkout = harness.createRecord("workout", "A", "couple_read");

    // Active partner B can read but NOT edit A's workout.
    expect(harness.canRead("B", aWorkout.id)).toBe(true);
    expect(harness.canEdit("B", aWorkout.id)).toBe(false);

    harness.unbindCouple("A");
    expect(harness.canRead("B", aWorkout.id)).toBe(false);

    // After A rebinds to C, C (new active partner) can read A's history; B cannot.
    harness.bindCouple("A", "C");
    expect(harness.canRead("C", aWorkout.id)).toBe(true);
    expect(harness.canEdit("C", aWorkout.id)).toBe(false);
    expect(harness.canRead("B", aWorkout.id)).toBe(false);
  });
});
