type UserId = string;

type Couple = {
  endedAt: Date | null;
  id: string;
};

type Member = {
  coupleId: string;
  leftAt: Date | null;
  userId: UserId;
};

type Invite = {
  acceptedAt: Date | null;
  acceptedByUserId: UserId | null;
  code: string;
  expiresAt: Date;
  inviterUserId: UserId;
  revokedAt: Date | null;
};

export function createCouplePolicyHarness(users: UserId[]) {
  const couples: Couple[] = [];
  const members: Member[] = [];
  const invites: Invite[] = [];
  let sequence = 1;

  function assertKnownUser(userId: UserId) {
    if (!users.includes(userId)) {
      throw new Error(`Unknown user: ${userId}`);
    }
  }

  function getActiveMemberships(userId: UserId) {
    return members.filter((member) => member.userId === userId && member.leftAt === null);
  }

  function getActiveCoupleId(userId: UserId) {
    return getActiveMemberships(userId)[0]?.coupleId ?? null;
  }

  function assertCanJoin(userId: UserId) {
    if (getActiveMemberships(userId).length > 0) {
      throw new Error(`${userId} already has an active couple`);
    }
  }

  function createInvite(inviterUserId: UserId) {
    assertKnownUser(inviterUserId);
    assertCanJoin(inviterUserId);

    const invite: Invite = {
      acceptedAt: null,
      acceptedByUserId: null,
      code: `INVITE${sequence++}`,
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      inviterUserId,
      revokedAt: null
    };
    invites.push(invite);
    return invite;
  }

  function acceptInvite(userId: UserId, code: string) {
    assertKnownUser(userId);
    const invite = invites.find((item) => item.code === code);

    if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt.getTime() <= Date.now()) {
      throw new Error("Invite is not available");
    }

    if (invite.inviterUserId === userId) {
      throw new Error("Inviter cannot accept their own invite");
    }

    assertCanJoin(invite.inviterUserId);
    assertCanJoin(userId);

    const couple: Couple = {
      endedAt: null,
      id: `couple-${sequence++}`
    };
    couples.push(couple);
    members.push({ coupleId: couple.id, leftAt: null, userId: invite.inviterUserId });
    members.push({ coupleId: couple.id, leftAt: null, userId });
    invite.acceptedAt = new Date();
    invite.acceptedByUserId = userId;
    return couple;
  }

  function leaveCouple(userId: UserId) {
    assertKnownUser(userId);
    const coupleId = getActiveCoupleId(userId);

    if (!coupleId) {
      throw new Error("No active couple");
    }

    const leftAt = new Date();
    for (const member of members) {
      if (member.coupleId === coupleId && member.leftAt === null) {
        member.leftAt = leftAt;
      }
    }

    const couple = couples.find((item) => item.id === coupleId);
    if (couple) {
      couple.endedAt = leftAt;
    }
  }

  function canReadSharedCouple(readerUserId: UserId, targetUserId: UserId) {
    const readerCoupleId = getActiveCoupleId(readerUserId);
    const targetCoupleId = getActiveCoupleId(targetUserId);
    return Boolean(readerCoupleId && targetCoupleId && readerCoupleId === targetCoupleId);
  }

  return {
    acceptInvite,
    acceptInviteConcurrently: async (userId: UserId, code: string) => acceptInvite(userId, code),
    canReadPrivateProfile: (readerUserId: UserId, ownerUserId: UserId) => readerUserId === ownerUserId,
    canReadSharedCouple,
    canReadUserSettings: (readerUserId: UserId, ownerUserId: UserId) => readerUserId === ownerUserId,
    createInvite,
    getActiveCoupleCount: (userId: UserId) => getActiveMemberships(userId).length,
    getActiveCoupleId,
    leaveCouple
  };
}
