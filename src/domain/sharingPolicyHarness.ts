type UserId = string;
type Visibility = "private" | "couple_read" | "couple_edit";
type RecordKind = "task" | "workout";
type ChildKind = "subitem" | "recurrence" | "workout_part" | "workout_photo";

type SharedRecord = {
  id: string;
  kind: RecordKind;
  ownerUserId: UserId;
  visibility: Visibility;
};

type ChildRecord = {
  id: string;
  kind: ChildKind;
  parentId: string;
};

export function createSharingPolicyHarness(users: UserId[]) {
  const activeCouples = new Map<UserId, UserId>();
  const records = new Map<string, SharedRecord>();
  const children = new Map<string, ChildRecord>();
  let sequence = 1;

  function assertUser(userId: UserId) {
    if (!users.includes(userId)) {
      throw new Error(`Unknown user: ${userId}`);
    }
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
    // Workouts are READ-ONLY for the active partner: only the owner may edit.
    if (record.kind === "workout") return false;
    return record.visibility === "couple_edit" && areActivePartners(userId, record.ownerUserId);
  }

  function parentForChild(childId: string) {
    const child = children.get(childId);
    return child ? records.get(child.parentId) : undefined;
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
    canEdit,
    canEditChild(userId: UserId, childId: string) {
      const parent = parentForChild(childId);
      return parent ? canEdit(userId, parent.id) : false;
    },
    canRead,
    canReadChild(userId: UserId, childId: string) {
      const parent = parentForChild(childId);
      return parent ? canRead(userId, parent.id) : false;
    },
    createChild(kind: ChildKind, parentId: string) {
      if (!records.has(parentId)) {
        throw new Error("Missing parent");
      }
      const child: ChildRecord = {
        id: `${kind}-${sequence++}`,
        kind,
        parentId
      };
      children.set(child.id, child);
      return child;
    },
    createRecord(kind: RecordKind, ownerUserId: UserId, visibility: Visibility) {
      assertUser(ownerUserId);
      const record: SharedRecord = {
        id: `${kind}-${sequence++}`,
        kind,
        ownerUserId,
        visibility
      };
      records.set(record.id, record);
      return record;
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
