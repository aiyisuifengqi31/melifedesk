type UserId = string;
type Visibility = "private" | "couple_read" | "couple_edit";
type OwnerRecordKind = "daily_assignment" | "question_attempt" | "essay_attempt";
type SharedRecordKind = "search_index" | "recycle_item";

type OwnerRecord = {
  id: string;
  kind: OwnerRecordKind;
  ownerUserId: UserId;
};

type SharedRecord = {
  deletedAt?: string | null;
  hasSensitiveBodyCopy?: boolean;
  id: string;
  kind: SharedRecordKind;
  ownerUserId: UserId;
  visibility: Visibility;
};

export function createExamCommonPolicyHarness(users: UserId[]) {
  const activeCouples = new Map<UserId, UserId>();
  const ownerRecords = new Map<string, OwnerRecord>();
  const sharedRecords = new Map<string, SharedRecord>();
  let sequence = 1;

  function assertUser(userId: UserId) {
    if (!users.includes(userId)) {
      throw new Error(`Unknown user: ${userId}`);
    }
  }

  function areActivePartners(left: UserId, right: UserId) {
    return activeCouples.get(left) === right && activeCouples.get(right) === left;
  }

  function canReadShared(userId: UserId, record: SharedRecord) {
    if (record.ownerUserId === userId) return true;
    return record.visibility !== "private" && areActivePartners(userId, record.ownerUserId);
  }

  function canEditShared(userId: UserId, record: SharedRecord) {
    if (record.ownerUserId === userId) return true;
    return record.visibility === "couple_edit" && areActivePartners(userId, record.ownerUserId);
  }

  return {
    bindCouple(left: UserId, right: UserId) {
      assertUser(left);
      assertUser(right);
      if (activeCouples.has(left) || activeCouples.has(right)) {
        throw new Error("User already has active couple");
      }
      activeCouples.set(left, right);
      activeCouples.set(right, left);
    },
    canReadOwnerRecord(userId: UserId, recordId: string) {
      assertUser(userId);
      const record = ownerRecords.get(recordId);
      return Boolean(record && record.ownerUserId === userId);
    },
    canReadRecycleItem(userId: UserId, recordId: string) {
      assertUser(userId);
      const record = sharedRecords.get(recordId);
      return Boolean(record && record.kind === "recycle_item" && record.deletedAt && canEditShared(userId, record));
    },
    canSearch(userId: UserId, recordId: string) {
      assertUser(userId);
      const record = sharedRecords.get(recordId);
      return Boolean(record && record.kind === "search_index" && !record.deletedAt && canReadShared(userId, record));
    },
    createOwnerRecord(kind: OwnerRecordKind, ownerUserId: UserId) {
      assertUser(ownerUserId);
      const record = { id: `${kind}-${sequence++}`, kind, ownerUserId };
      ownerRecords.set(record.id, record);
      return record;
    },
    createSharedRecord(kind: SharedRecordKind, ownerUserId: UserId, visibility: Visibility, deletedAt?: string | null) {
      assertUser(ownerUserId);
      const record = { deletedAt, id: `${kind}-${sequence++}`, kind, ownerUserId, visibility };
      sharedRecords.set(record.id, record);
      return record;
    },
    restoreRecycleItem(userId: UserId, recordId: string) {
      assertUser(userId);
      const record = sharedRecords.get(recordId);
      if (!record || !canEditShared(userId, record)) {
        throw new Error("Forbidden");
      }
      record.deletedAt = null;
      return record;
    },
    setSensitiveBodyCopy(recordId: string) {
      const record = sharedRecords.get(recordId);
      if (record) {
        record.hasSensitiveBodyCopy = true;
      }
    },
    unbindCouple(userId: UserId) {
      assertUser(userId);
      const partnerId = activeCouples.get(userId);
      if (partnerId) {
        activeCouples.delete(userId);
        activeCouples.delete(partnerId);
      }
    },
    validateRecycleDesign() {
      for (const record of sharedRecords.values()) {
        if (record.hasSensitiveBodyCopy) {
          throw new Error("Recycle bin copied sensitive body");
        }
      }
    }
  };
}
