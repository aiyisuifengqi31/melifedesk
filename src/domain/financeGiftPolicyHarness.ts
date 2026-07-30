type UserId = string;
type Visibility = "private" | "couple_read" | "couple_edit";
type SharedRecordKind = "finance_transaction" | "gift_record";
type CategoryType = "expense" | "income";

type SharedRecord = {
  id: string;
  kind: SharedRecordKind;
  ownerUserId: UserId;
  visibility: Visibility;
};

type CategoryRecord = {
  id: string;
  isSystem: boolean;
  name: string;
  ownerUserId: UserId | null;
  transactionType: CategoryType;
};

export function createFinanceGiftPolicyHarness(users: UserId[]) {
  const activeCouples = new Map<UserId, UserId>();
  const records = new Map<string, SharedRecord>();
  const categories = new Map<string, CategoryRecord>();
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
    return record.visibility === "couple_edit" && areActivePartners(userId, record.ownerUserId);
  }

  return {
    assertCanInsert(actorUserId: UserId, input: { coupleOwnerUserId?: UserId; ownerUserId: UserId; visibility: Visibility }) {
      assertUser(actorUserId);
      if (input.ownerUserId !== actorUserId) {
        throw new Error("Invalid owner");
      }
      if (input.visibility !== "private" && (!input.coupleOwnerUserId || !areActivePartners(actorUserId, input.coupleOwnerUserId))) {
        throw new Error("Invalid couple");
      }
    },
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
    canEditCategory(userId: UserId, categoryId: string) {
      assertUser(userId);
      const category = categories.get(categoryId);
      return Boolean(category && !category.isSystem && category.ownerUserId === userId);
    },
    canRead,
    canReadCategory(userId: UserId, categoryId: string) {
      assertUser(userId);
      const category = categories.get(categoryId);
      return Boolean(category && (category.isSystem || category.ownerUserId === userId));
    },
    canSoftDeleteCategory(userId: UserId, categoryId: string) {
      assertUser(userId);
      const category = categories.get(categoryId);
      return Boolean(category && !category.isSystem && category.ownerUserId === userId);
    },
    createRecord(kind: SharedRecordKind, ownerUserId: UserId, visibility: Visibility) {
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
    createSystemCategory(name: string, transactionType: CategoryType) {
      const category: CategoryRecord = {
        id: `category-${sequence++}`,
        isSystem: true,
        name,
        ownerUserId: null,
        transactionType
      };
      categories.set(category.id, category);
      return category;
    },
    createUserCategory(ownerUserId: UserId, name: string, transactionType: CategoryType) {
      assertUser(ownerUserId);
      const category: CategoryRecord = {
        id: `category-${sequence++}`,
        isSystem: false,
        name,
        ownerUserId,
        transactionType
      };
      categories.set(category.id, category);
      return category;
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
