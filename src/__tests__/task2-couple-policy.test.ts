import { createCouplePolicyHarness } from "@/auth/couplePolicyHarness";

describe("Task 2 couple permission model", () => {
  it("isolates private profile/settings data across A/B/C users", () => {
    const harness = createCouplePolicyHarness(["A", "B", "C"]);

    expect(harness.canReadPrivateProfile("A", "A")).toBe(true);
    expect(harness.canReadPrivateProfile("B", "A")).toBe(false);
    expect(harness.canReadPrivateProfile("C", "A")).toBe(false);
    expect(harness.canReadUserSettings("A", "A")).toBe(true);
    expect(harness.canReadUserSettings("B", "A")).toBe(false);
  });

  it("allows A and B to share couple rows after accepting an invite while C remains blocked", () => {
    const harness = createCouplePolicyHarness(["A", "B", "C"]);
    const invite = harness.createInvite("A");

    harness.acceptInvite("B", invite.code);

    expect(harness.canReadSharedCouple("A", "B")).toBe(true);
    expect(harness.canReadSharedCouple("B", "A")).toBe(true);
    expect(harness.canReadSharedCouple("C", "A")).toBe(false);
    expect(harness.getActiveCoupleId("A")).toBe(harness.getActiveCoupleId("B"));
  });

  it("keeps only one active couple when two invites are accepted concurrently", async () => {
    const harness = createCouplePolicyHarness(["A", "B", "C"]);
    const inviteFromA = harness.createInvite("A");
    const inviteFromC = harness.createInvite("C");

    const results = await Promise.allSettled([
      harness.acceptInviteConcurrently("B", inviteFromA.code),
      harness.acceptInviteConcurrently("B", inviteFromC.code)
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(harness.getActiveCoupleCount("B")).toBe(1);
  });

  it("revokes shared access immediately after unbinding", () => {
    const harness = createCouplePolicyHarness(["A", "B"]);
    const invite = harness.createInvite("A");
    harness.acceptInvite("B", invite.code);

    expect(harness.canReadSharedCouple("A", "B")).toBe(true);

    harness.leaveCouple("A");

    expect(harness.canReadSharedCouple("A", "B")).toBe(false);
    expect(harness.canReadSharedCouple("B", "A")).toBe(false);
    expect(harness.getActiveCoupleId("A")).toBeNull();
    expect(harness.getActiveCoupleId("B")).toBeNull();
  });
});
