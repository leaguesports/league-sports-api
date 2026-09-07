import { DomainError } from "../../../lib/domain-error";

export type TeamMemberRoleValue = "owner" | "captain" | "member";

export class TeamMemberRole {
  static readonly OWNER = new TeamMemberRole("owner");
  static readonly CAPTAIN = new TeamMemberRole("captain");
  static readonly MEMBER = new TeamMemberRole("member");

  private constructor(readonly value: TeamMemberRoleValue) {}

  static from(raw: unknown): TeamMemberRole {
    if (raw === "owner") return TeamMemberRole.OWNER;
    if (raw === "captain") return TeamMemberRole.CAPTAIN;
    if (raw === "member") return TeamMemberRole.MEMBER;
    throw new DomainError("role must be owner, captain, or member");
  }

  get isOwner(): boolean {
    return this.value === "owner";
  }

  get isCaptain(): boolean {
    return this.value === "captain";
  }

  get isMember(): boolean {
    return this.value === "member";
  }

  get canInvite(): boolean {
    return this.isOwner || this.isCaptain;
  }

  get canRemoveMembers(): boolean {
    return this.isOwner || this.isCaptain;
  }

  get canManageTeam(): boolean {
    return this.isOwner;
  }

  equals(other: TeamMemberRole): boolean {
    return this.value === other.value;
  }
}
