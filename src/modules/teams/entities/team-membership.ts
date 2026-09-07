import { randomUUID } from "node:crypto";

import { requiredTrimmed } from "../../../lib/domain-error";
import { TeamMemberRole } from "./team-member-role";
import { TeamMemberStatus } from "./team-member-status";

export type TeamMembershipSnapshot = {
  id: string;
  userId: string;
  role: "owner" | "captain" | "member";
  status: "active" | "invited";
  joinedAt: string;
};

export class TeamMembership {
  private constructor(
    readonly id: string,
    readonly userId: string,
    private roleValue: TeamMemberRole,
    private statusValue: TeamMemberStatus,
    readonly joinedAt: Date,
  ) {}

  static owner(userId: string, joinedAt = new Date()): TeamMembership {
    return new TeamMembership(
      randomUUID(),
      requiredTrimmed(userId, "userId"),
      TeamMemberRole.OWNER,
      TeamMemberStatus.ACTIVE,
      joinedAt,
    );
  }

  static captain(userId: string, joinedAt = new Date()): TeamMembership {
    return new TeamMembership(
      randomUUID(),
      requiredTrimmed(userId, "userId"),
      TeamMemberRole.CAPTAIN,
      TeamMemberStatus.ACTIVE,
      joinedAt,
    );
  }

  static member(
    userId: string,
    status: TeamMemberStatus = TeamMemberStatus.ACTIVE,
    joinedAt = new Date(),
  ): TeamMembership {
    return new TeamMembership(
      randomUUID(),
      requiredTrimmed(userId, "userId"),
      TeamMemberRole.MEMBER,
      status,
      joinedAt,
    );
  }

  static rehydrate(props: {
    id: string;
    userId: string;
    role: TeamMemberRole;
    status: TeamMemberStatus;
    joinedAt: Date;
  }): TeamMembership {
    return new TeamMembership(
      props.id,
      props.userId,
      props.role,
      props.status,
      props.joinedAt,
    );
  }

  get role(): TeamMemberRole {
    return this.roleValue;
  }

  get status(): TeamMemberStatus {
    return this.statusValue;
  }

  assignRole(role: TeamMemberRole): void {
    this.roleValue = role;
  }

  activate(): void {
    this.statusValue = TeamMemberStatus.ACTIVE;
  }

  toSnapshot(): TeamMembershipSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      role: this.roleValue.value,
      status: this.statusValue.value,
      joinedAt: this.joinedAt.toISOString(),
    };
  }
}
