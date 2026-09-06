import { randomUUID } from "node:crypto";

import { requiredTrimmed } from "../../../lib/domain-error";
import { CommunityMemberRole } from "./community-member-role";

export type CommunityMembershipSnapshot = {
  id: string;
  userId: string;
  role: "owner" | "member";
  joinedAt: string;
};

export class CommunityMembership {
  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly role: CommunityMemberRole,
    readonly joinedAt: Date,
  ) {}

  static owner(userId: string, joinedAt = new Date()): CommunityMembership {
    return new CommunityMembership(
      randomUUID(),
      requiredTrimmed(userId, "userId"),
      CommunityMemberRole.OWNER,
      joinedAt,
    );
  }

  static member(userId: string, joinedAt = new Date()): CommunityMembership {
    return new CommunityMembership(
      randomUUID(),
      requiredTrimmed(userId, "userId"),
      CommunityMemberRole.MEMBER,
      joinedAt,
    );
  }

  static rehydrate(props: {
    id: string;
    userId: string;
    role: CommunityMemberRole;
    joinedAt: Date;
  }): CommunityMembership {
    return new CommunityMembership(
      props.id,
      props.userId,
      props.role,
      props.joinedAt,
    );
  }

  toSnapshot(): CommunityMembershipSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      role: this.role.value,
      joinedAt: this.joinedAt.toISOString(),
    };
  }
}
