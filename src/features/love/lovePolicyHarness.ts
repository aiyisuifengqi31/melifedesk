type UserId = string;
type Visibility = "private" | "couple_read" | "couple_edit";
type Kind = "mood" | "diary";

type SharedRecord = {
  id: string;
  kind: Kind;
  ownerUserId: UserId;
  visibility: Visibility;
};

type CycleRecord = {
  id: string;
  ownerUserId: UserId;
  shareWithPartner: boolean;
};

export function createLovePolicyHarness(users: UserId[]) {
  const activeCouples = new Map<UserId, UserId>();
  const records = new Map<string, SharedRecord>();
  const cycles = new Map<string, CycleRecord>();
  const images = new Map<string, string>();
  let sequence = 1;

  function assertUser(userId: UserId) {
    if (!users.includes(userId)) throw new Error(`Unknown user: ${userId}`);
  }

  function areActivePartners(left: UserId, right: UserId) {
    return activeCouples.get(left) === right && activeCouples.get(right) === left;
  }

  function canRead(userId: UserId, recordId: string) {
    assertUser(userId);
    const record = records.get(recordId);
    if (!record) return false;
    if (record.ownerUserId === userId) return true;
    return record.visibility !== "private" && areActivePartners(userId, record.ownerUserId);
  }

  function canEdit(userId: UserId, recordId: string) {
    assertUser(userId);
    const record = records.get(recordId);
    if (!record) return false;
    if (record.ownerUserId === userId) return true;
    return record.visibility === "couple_edit" && areActivePartners(userId, record.ownerUserId);
  }

  return {
    bindCouple(left: UserId, right: UserId) {
      assertUser(left);
      assertUser(right);
      activeCouples.set(left, right);
      activeCouples.set(right, left);
    },
    canEdit,
    canEditCycle(userId: UserId, cycleId: string) {
      assertUser(userId);
      return cycles.get(cycleId)?.ownerUserId === userId;
    },
    canEditImage(userId: UserId, imageId: string) {
      const diaryId = images.get(imageId);
      return diaryId ? canEdit(userId, diaryId) : false;
    },
    canRead,
    canReadCycle(userId: UserId, cycleId: string) {
      assertUser(userId);
      const cycle = cycles.get(cycleId);
      if (!cycle) return false;
      if (cycle.ownerUserId === userId) return true;
      return cycle.shareWithPartner && areActivePartners(userId, cycle.ownerUserId);
    },
    canReadImage(userId: UserId, imageId: string) {
      const diaryId = images.get(imageId);
      return diaryId ? canRead(userId, diaryId) : false;
    },
    createCycle(ownerUserId: UserId, shareWithPartner = false) {
      assertUser(ownerUserId);
      const cycle = { id: `cycle-${sequence++}`, ownerUserId, shareWithPartner };
      cycles.set(cycle.id, cycle);
      return cycle;
    },
    createDiaryImage(diaryId: string) {
      if (!records.has(diaryId)) throw new Error("Missing diary");
      const imageId = `diary-image-${sequence++}`;
      images.set(imageId, diaryId);
      return { id: imageId };
    },
    createRecord(kind: Kind, ownerUserId: UserId, visibility: Visibility) {
      assertUser(ownerUserId);
      const record = { id: `${kind}-${sequence++}`, kind, ownerUserId, visibility };
      records.set(record.id, record);
      return record;
    },
    setCycleSharing(cycleId: string, shareWithPartner: boolean) {
      const cycle = cycles.get(cycleId);
      if (cycle) cycle.shareWithPartner = shareWithPartner;
    },
    unbindCouple(userId: UserId) {
      assertUser(userId);
      const partnerId = activeCouples.get(userId);
      if (partnerId) {
        activeCouples.delete(userId);
        activeCouples.delete(partnerId);
      }
    }
  };
}
